package outbox

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"log"
	"sync"
	"time"

	"github.com/interviewos/interviewos/backend/internal/store"
)

type OutboxWorker struct {
	store      store.Store
	broker     *RedisStreamsBroker
	running    bool
	mu         sync.Mutex
	cancelFunc context.CancelFunc
}

func NewOutboxWorker(s store.Store, broker *RedisStreamsBroker) *OutboxWorker {
	return &OutboxWorker{
		store:  s,
		broker: broker,
	}
}

func (w *OutboxWorker) Start(ctx context.Context) {
	w.mu.Lock()
	w.running = true
	ctx, cancel := context.WithCancel(ctx)
	w.cancelFunc = cancel
	w.mu.Unlock()

	go func() {
		ticker := time.NewTicker(300 * time.Millisecond)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				w.processUnpublishedMessages(ctx)
			}
		}
	}()
}

func (w *OutboxWorker) Stop() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.running && w.cancelFunc != nil {
		w.cancelFunc()
		w.running = false
	}
}

func (w *OutboxWorker) processUnpublishedMessages(ctx context.Context) {
	msgs := w.store.GetUnpublishedOutboxMessages()
	for _, m := range msgs {
		if w.broker != nil {
			streamID, err := w.broker.PublishEvent(ctx, m)
			if err != nil {
				log.Printf("[Transactional Outbox] Failed to publish message %s to Redis Streams: %v", m.ID, err)
				continue
			}
			log.Printf("[Transactional Outbox] Published message %s (Type: %s) to Redis Streams [StreamID: %s]",
				m.ID, m.EventType, streamID)
		} else {
			log.Printf("[Transactional Outbox] Dispatched message %s (Type: %s, Aggregate: %s) [Storage: %s]",
				m.ID, m.EventType, m.AggregateID, w.store.StorageType())
		}

		// Mark published atomically in database
		w.store.MarkOutboxMessagePublished(m.ID)
	}
}

// ComputeHMACSignature generates HMAC-SHA256 signature for signed webhooks
func ComputeHMACSignature(secret string, payload []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}
