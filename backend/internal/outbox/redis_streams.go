package outbox

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/interviewos/interviewos/backend/internal/store"
)

const (
	StreamSessionEvents = "interviewos:stream:session:events"
	StreamDeadLetter    = "interviewos:stream:deadletter"
	ConsumerGroupAgents = "interviewos:group:agents"
)

// RedisStreamsBroker manages producer & consumer group streaming over Redis Streams.
type RedisStreamsBroker struct {
	client    *redis.Client
	store     store.Store
	consumerID string
	mu        sync.Mutex
	running   bool
	cancel    context.CancelFunc
}

// NewRedisStreamsBroker initializes the Redis connection and ensures consumer group exists.
func NewRedisStreamsBroker(redisURL string, s store.Store, consumerID string) (*RedisStreamsBroker, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("invalid redis url: %w", err)
	}

	client := redis.NewClient(opts)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("failed to ping redis: %w", err)
	}

	broker := &RedisStreamsBroker{
		client:     client,
		store:      s,
		consumerID: consumerID,
	}

	// Ensure stream and consumer group exist
	_ = client.XGroupCreateMkStream(context.Background(), StreamSessionEvents, ConsumerGroupAgents, "$").Err()

	return broker, nil
}

// PublishEvent produces an event to the Redis Stream (At-Least-Once Delivery).
// Returns the assigned Redis Stream message ID.
func (b *RedisStreamsBroker) PublishEvent(ctx context.Context, msg store.OutboxMessage) (string, error) {
	payloadBytes, err := json.Marshal(msg.Payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payload: %w", err)
	}

	args := &redis.XAddArgs{
		Stream: StreamSessionEvents,
		Values: map[string]interface{}{
			"message_id":     msg.ID,
			"aggregate_type": msg.AggregateType,
			"aggregate_id":   msg.AggregateID,
			"event_type":     msg.EventType,
			"payload":        string(payloadBytes),
			"created_at":     msg.CreatedAt.Format(time.RFC3339Nano),
		},
	}

	streamID, err := b.client.XAdd(ctx, args).Result()
	if err != nil {
		return "", fmt.Errorf("redis XADD failed: %w", err)
	}

	return streamID, nil
}

// StartConsumerLoop polls consumer group, claims pending entries, and calls handler.
func (b *RedisStreamsBroker) StartConsumerLoop(ctx context.Context, handler func(msg store.OutboxMessage) error) {
	b.mu.Lock()
	b.running = true
	ctx, cancel := context.WithCancel(ctx)
	b.cancel = cancel
	b.mu.Unlock()

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
				// 1. Process pending/stale entries (AutoClaim for crash recovery)
				b.recoverPendingEntries(ctx, handler)

				// 2. Read new entries from stream
				streams, err := b.client.XReadGroup(ctx, &redis.XReadGroupArgs{
					Group:    ConsumerGroupAgents,
					Consumer: b.consumerID,
					Streams:  []string{StreamSessionEvents, ">"},
					Count:    10,
					Block:    1 * time.Second,
				}).Result()

				if err != nil && err != redis.Nil {
					time.Sleep(500 * time.Millisecond)
					continue
				}

				for _, stream := range streams {
					for _, msg := range stream.Messages {
						b.processStreamMessage(ctx, msg, handler)
					}
				}
			}
		}
	}()
}

func (b *RedisStreamsBroker) processStreamMessage(ctx context.Context, msg redis.XMessage, handler func(msg store.OutboxMessage) error) {
	outboxMsg := parseOutboxMessage(msg)
	
	// Execute idempotent consumer handler
	err := handler(outboxMsg)
	if err == nil {
		// Acknowledge processed message (XACK)
		_ = b.client.XAck(ctx, StreamSessionEvents, ConsumerGroupAgents, msg.ID).Err()
	} else {
		log.Printf("[RedisStreams] Consumer failed to process message %s: %v. Retrying.", msg.ID, err)
		// Check retry threshold for dead-letter routing
		b.checkDeadLetter(ctx, msg, err)
	}
}

// recoverPendingEntries claims messages abandoned by crashed workers (pending > 10s)
func (b *RedisStreamsBroker) recoverPendingEntries(ctx context.Context, handler func(msg store.OutboxMessage) error) {
	claim, _, err := b.client.XAutoClaim(ctx, &redis.XAutoClaimArgs{
		Stream:   StreamSessionEvents,
		Group:    ConsumerGroupAgents,
		Consumer: b.consumerID,
		MinIdle:  10 * time.Second,
		Start:    "0-0",
		Count:    10,
	}).Result()

	if err != nil || len(claim) == 0 {
		return
	}

	for _, msg := range claim {
		log.Printf("[RedisStreams] Recovered abandoned message %s from crashed worker. Re-processing.", msg.ID)
		b.processStreamMessage(ctx, msg, handler)
	}
}

// checkDeadLetter routes poisoned messages exceeding 5 deliveries to StreamDeadLetter
func (b *RedisStreamsBroker) checkDeadLetter(ctx context.Context, msg redis.XMessage, cause error) {
	// Query PEL for delivery counter
	pending, err := b.client.XPendingExt(ctx, &redis.XPendingExtArgs{
		Stream: StreamSessionEvents,
		Group:  ConsumerGroupAgents,
		Start:  msg.ID,
		End:    msg.ID,
		Count:  1,
	}).Result()

	if err == nil && len(pending) > 0 && pending[0].RetryCount > 5 {
		log.Printf("[RedisStreams] Message %s exceeded retry limit (%d). Routing to Dead-Letter Stream.", msg.ID, pending[0].RetryCount)
		_ = b.client.XAdd(ctx, &redis.XAddArgs{
			Stream: StreamDeadLetter,
			Values: map[string]interface{}{
				"original_id": msg.ID,
				"error":       cause.Error(),
				"payload":     msg.Values,
				"diverted_at": time.Now().UTC().Format(time.RFC3339),
			},
		}).Err()
		// Ack from main stream so it does not block PEL
		_ = b.client.XAck(ctx, StreamSessionEvents, ConsumerGroupAgents, msg.ID).Err()
	}
}

func (b *RedisStreamsBroker) Stop() {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.running && b.cancel != nil {
		b.cancel()
		b.running = false
	}
	if b.client != nil {
		_ = b.client.Close()
	}
}

func parseOutboxMessage(msg redis.XMessage) store.OutboxMessage {
	out := store.OutboxMessage{
		ID: fmt.Sprintf("%v", msg.Values["message_id"]),
		AggregateType: fmt.Sprintf("%v", msg.Values["aggregate_type"]),
		AggregateID: fmt.Sprintf("%v", msg.Values["aggregate_id"]),
		EventType: fmt.Sprintf("%v", msg.Values["event_type"]),
		IsPublished: true,
	}
	if payloadStr, ok := msg.Values["payload"].(string); ok {
		var pl map[string]interface{}
		_ = json.Unmarshal([]byte(payloadStr), &pl)
		out.Payload = pl
	}
	if createdAtStr, ok := msg.Values["created_at"].(string); ok {
		t, _ := time.Parse(time.RFC3339Nano, createdAtStr)
		out.CreatedAt = t
	}
	return out
}
