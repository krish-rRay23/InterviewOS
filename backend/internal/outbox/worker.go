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
	store      *store.MemoryStore
	running    bool
	mu         sync.Mutex
	cancelFunc context.CancelFunc
}

func NewOutboxWorker(s *store.MemoryStore) *OutboxWorker {
	return &OutboxWorker{
		store: s,
	}
}

func (w *OutboxWorker) Start(ctx context.Context) {
	w.mu.Lock()
	w.running = true
	ctx, cancel := context.WithCancel(ctx)
	w.cancelFunc = cancel
	w.mu.Unlock()

	go func() {
		ticker := time.NewTicker(500 * time.Millisecond)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				w.processUnpublishedMessages()
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

func (w *OutboxWorker) processUnpublishedMessages() {
	// Query unpublished messages
	msgs := w.store.GetUnpublishedOutboxMessages()
	for _, m := range msgs {
		// Simulate Redis Streams XADD / distribution
		log.Printf("[Transactional Outbox] Distributing message %s (Type: %s, Aggregate: %s) to Redis Streams",
			m.ID, m.EventType, m.AggregateID)

		// Mark published atomically
		w.store.MarkOutboxMessagePublished(m.ID)
	}
}

// ComputeHMACSignature generates HMAC-SHA256 signature for signed webhooks
func ComputeHMACSignature(secret string, payload []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}
