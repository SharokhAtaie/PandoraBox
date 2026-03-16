package proxy

import (
	"sync"
)

type InterceptDecision struct {
	Forward     bool
	Drop        bool
	ModifiedRaw []byte
}

type pendingRequest struct {
	requestID int64
	raw       []byte
	decision  chan InterceptDecision
}

type InterceptQueue struct {
	mu      sync.RWMutex
	enabled bool
	pending map[int64]*pendingRequest
}

func NewInterceptQueue() *InterceptQueue {
	return &InterceptQueue{
		pending: make(map[int64]*pendingRequest),
	}
}

func (q *InterceptQueue) IsEnabled() bool {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return q.enabled
}

func (q *InterceptQueue) SetEnabled(v bool) {
	q.mu.Lock()
	q.enabled = v
	q.mu.Unlock()
}

func (q *InterceptQueue) Hold(requestID int64, raw []byte) chan InterceptDecision {
	ch := make(chan InterceptDecision, 1)
	q.mu.Lock()
	q.pending[requestID] = &pendingRequest{requestID: requestID, raw: raw, decision: ch}
	q.mu.Unlock()
	return ch
}

func (q *InterceptQueue) Resolve(requestID int64, d InterceptDecision) bool {
	q.mu.Lock()
	p, ok := q.pending[requestID]
	if ok {
		delete(q.pending, requestID)
	}
	q.mu.Unlock()
	if ok {
		p.decision <- d
	}
	return ok
}

func (q *InterceptQueue) QueueLength() int {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return len(q.pending)
}

func (q *InterceptQueue) ListPending() []int64 {
	q.mu.RLock()
	defer q.mu.RUnlock()
	ids := make([]int64, 0, len(q.pending))
	for id := range q.pending {
		ids = append(ids, id)
	}
	return ids
}
