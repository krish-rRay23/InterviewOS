package store

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/interviewos/interviewos/backend/internal/ioep"
)

func GenerateUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func GenerateNonce(bytesCount int) string {
	b := make([]byte, bytesCount)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// Data models
type Organization struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	CreatedAt time.Time `json:"created_at"`
}

type Assessment struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	Title          string    `json:"title"`
	Mode           string    `json:"mode"`
	IsActive       bool      `json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
}

type AssessmentPolicy struct {
	ID                     string                 `json:"id"`
	AssessmentID           string                 `json:"assessment_id"`
	Version                int                    `json:"version"`
	MaxDisplays            int                    `json:"max_displays"`
	AllowExternalIDE       bool                   `json:"allow_external_ide"`
	AllowUSBStorage        bool                   `json:"allow_usb_storage"`
	StrictETW              bool                   `json:"strict_etw"`
	ProhibitedProcessNames []string               `json:"prohibited_process_names"`
	PermittedProcessNames  []string               `json:"permitted_process_names"`
	InvestigationBudgetUSD float64                `json:"investigation_budget_usd"`
	MaxAgentToolCalls      int                    `json:"max_agent_tool_calls"`
	CreatedAt              time.Time              `json:"created_at"`
}

type Candidate struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	FullName       string    `json:"full_name"`
	Email          string    `json:"email"`
	CreatedAt      time.Time `json:"created_at"`
}

type SessionState string

const (
	SessionStateInitializing SessionState = "INITIALIZING"
	SessionStateActive       SessionState = "ACTIVE"
	SessionStateInvestigating SessionState = "INVESTIGATING"
	SessionStateValidating   SessionState = "VALIDATING"
	SessionStateRecovering   SessionState = "RECOVERING"
	SessionStateCompleted    SessionState = "COMPLETED"
	SessionStateInvalidated  SessionState = "INVALIDATED"
)

type IntegrityState string

const (
	IntegrityStateVerified                IntegrityState = "VERIFIED"
	IntegrityStateReviewConditionResolved IntegrityState = "REVIEW_CONDITION_RESOLVED"
	IntegrityStatePolicyBreachConfirmed   IntegrityState = "POLICY_BREACH_CONFIRMED"
	IntegrityStateInconclusive            IntegrityState = "INCONCLUSIVE"
	IntegrityStateSessionIncomplete       IntegrityState = "SESSION_INCOMPLETE"
)

type TechnicalResult string

const (
	TechnicalResultPassed     TechnicalResult = "PASSED"
	TechnicalResultFailed     TechnicalResult = "FAILED"
	TechnicalResultIncomplete TechnicalResult = "INCOMPLETE"
)

type Session struct {
	ID              string          `json:"id"`
	AssessmentID    string          `json:"assessment_id"`
	CandidateID     string          `json:"candidate_id"`
	SessionState    SessionState    `json:"session_state"`
	IntegrityState  IntegrityState  `json:"integrity_state"`
	TechnicalResult TechnicalResult `json:"technical_result"`
	LastSequence    int64           `json:"last_sequence"`
	LastEventHash   string          `json:"last_event_hash"`
	EnrolledAt      *time.Time      `json:"enrolled_at,omitempty"`
	StartedAt       *time.Time      `json:"started_at,omitempty"`
	ClosedAt        *time.Time      `json:"closed_at,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
}

type SessionChallenge struct {
	ID                 string    `json:"id"`
	SessionID          string    `json:"session_id"`
	ServerNonce        string    `json:"server_nonce"`
	ClientNonce        string    `json:"client_nonce,omitempty"`
	ChallengeSignature string    `json:"challenge_signature,omitempty"`
	IsVerified         bool      `json:"is_verified"`
	ExpiresAt          time.Time `json:"expires_at"`
	CreatedAt          time.Time `json:"created_at"`
}

type OutboxMessage struct {
	ID            string                 `json:"id"`
	AggregateType string                 `json:"aggregate_type"`
	AggregateID   string                 `json:"aggregate_id"`
	EventType     string                 `json:"event_type"`
	Payload       map[string]interface{} `json:"payload"`
	IsPublished   bool                   `json:"is_published"`
	CreatedAt     time.Time              `json:"created_at"`
}

type AgentTask struct {
	TaskID             string                 `json:"task_id"`
	SessionID          string                 `json:"session_id"`
	RequestingAgent    string                 `json:"requesting_agent"`
	TargetAgent        string                 `json:"target_agent"`
	Objective          string                 `json:"objective"`
	CapabilityToken    string                 `json:"capability_token"`
	MaxToolCalls       int                    `json:"max_tool_calls"`
	ToolCallsUsed      int                    `json:"tool_calls_used"`
	DeadlineUTC        time.Time              `json:"deadline_utc"`
	EvidenceReferences []string               `json:"evidence_references"`
	Status             string                 `json:"status"` // PENDING, IN_PROGRESS, COMPLETED, REJECTED_UNAUTHORIZED, TIMED_OUT, FAILED
	ResultPayload      map[string]interface{} `json:"result_payload,omitempty"`
	CreatedAt          time.Time              `json:"created_at"`
}

type InvestigationCase struct {
	ID                    string    `json:"id"`
	SessionID             string    `json:"session_id"`
	Hypothesis            string    `json:"hypothesis"`
	Status                string    `json:"status"`
	SupportingEvidence    []string  `json:"supporting_evidence"`
	ContradictoryEvidence []string  `json:"contradictory_evidence"`
	MissingEvidence       []string  `json:"missing_evidence"`
	RecommendedAction     string    `json:"recommended_action"`
	ConfidenceScore       float64   `json:"confidence_score"`
	Resolved              bool      `json:"resolved"`
	CreatedAt             time.Time `json:"created_at"`
}

type TechnicalScore struct {
	SessionID              string    `json:"session_id"`
	CodeCorrectnessPct     float64   `json:"code_correctness_pct"`
	CodeComplexityPct      float64   `json:"code_complexity_pct"`
	InterviewCompetencyPct float64   `json:"interview_competency_pct"`
	AdaptiveChallengePct   float64   `json:"adaptive_challenge_pct"`
	TotalScorePct          float64   `json:"total_score_pct"`
	ScoredAt               time.Time `json:"scored_at"`
}

type MemoryStore struct {
	mu             sync.RWMutex
	organizations  map[string]Organization
	assessments    map[string]Assessment
	policies       map[string]map[int]AssessmentPolicy // assessmentID -> version -> policy
	candidates     map[string]Candidate
	sessions       map[string]Session
	sessionKeys    map[string]ioep.SessionEnrollmentRecord // sessionID -> enrollment
	challenges     map[string]SessionChallenge             // sessionID -> challenge
	batches        map[string]ioep.SignedEvidenceBatch     // batchID -> batch
	sessionBatches map[string][]string                     // sessionID -> []batchID
	events         map[string]ioep.SessionEvent            // eventID -> event
	sessionEvents  map[string][]ioep.SessionEvent          // sessionID -> []event
	outbox         []OutboxMessage
	agentTasks     map[string]AgentTask
	investigations map[string]InvestigationCase
	technicalScores map[string]TechnicalScore
	submissions     []CodeSubmission
	seenNonces     map[string]bool
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		organizations:  make(map[string]Organization),
		assessments:    make(map[string]Assessment),
		policies:       make(map[string]map[int]AssessmentPolicy),
		candidates:     make(map[string]Candidate),
		sessions:       make(map[string]Session),
		sessionKeys:    make(map[string]ioep.SessionEnrollmentRecord),
		challenges:     make(map[string]SessionChallenge),
		batches:        make(map[string]ioep.SignedEvidenceBatch),
		sessionBatches: make(map[string][]string),
		events:         make(map[string]ioep.SessionEvent),
		sessionEvents:  make(map[string][]ioep.SessionEvent),
		outbox:         make([]OutboxMessage, 0),
		agentTasks:     make(map[string]AgentTask),
		investigations: make(map[string]InvestigationCase),
		technicalScores: make(map[string]TechnicalScore),
		submissions:     make([]CodeSubmission, 0),
		seenNonces:     make(map[string]bool),
	}
}

// Store methods with thread safety and transaction semantics

func (s *MemoryStore) CreateOrganization(name, slug string) Organization {
	s.mu.Lock()
	defer s.mu.Unlock()
	org := Organization{
		ID:        GenerateUUID(),
		Name:      name,
		Slug:      slug,
		CreatedAt: time.Now().UTC(),
	}
	s.organizations[org.ID] = org
	return org
}

func (s *MemoryStore) GetOrganization(id string) (Organization, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	org, ok := s.organizations[id]
	return org, ok
}

func (s *MemoryStore) CreateAssessment(orgID, title, mode string) (Assessment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.organizations[orgID]; !ok {
		return Assessment{}, errors.New("organization not found")
	}
	asmt := Assessment{
		ID:             GenerateUUID(),
		OrganizationID: orgID,
		Title:          title,
		Mode:           mode,
		IsActive:       true,
		CreatedAt:      time.Now().UTC(),
	}
	s.assessments[asmt.ID] = asmt
	return asmt, nil
}

func (s *MemoryStore) GetAssessment(id string) (Assessment, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	asmt, ok := s.assessments[id]
	return asmt, ok
}

func (s *MemoryStore) SavePolicy(policy AssessmentPolicy) AssessmentPolicy {
	s.mu.Lock()
	defer s.mu.Unlock()
	if policy.ID == "" {
		policy.ID = GenerateUUID()
	}
	policy.CreatedAt = time.Now().UTC()
	if _, ok := s.policies[policy.AssessmentID]; !ok {
		s.policies[policy.AssessmentID] = make(map[int]AssessmentPolicy)
	}
	s.policies[policy.AssessmentID][policy.Version] = policy
	return policy
}

func (s *MemoryStore) GetPolicy(assessmentID string, version int) (AssessmentPolicy, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	vers, ok := s.policies[assessmentID]
	if !ok {
		return AssessmentPolicy{}, false
	}
	pol, ok := vers[version]
	return pol, ok
}

func (s *MemoryStore) CreateCandidate(orgID, fullName, email string) Candidate {
	s.mu.Lock()
	defer s.mu.Unlock()
	c := Candidate{
		ID:             GenerateUUID(),
		OrganizationID: orgID,
		FullName:       fullName,
		Email:          email,
		CreatedAt:      time.Now().UTC(),
	}
	s.candidates[c.ID] = c
	return c
}

func (s *MemoryStore) CreateSession(assessmentID, candidateID string) (Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.assessments[assessmentID]; !ok {
		return Session{}, errors.New("assessment not found")
	}
	if _, ok := s.candidates[candidateID]; !ok {
		return Session{}, errors.New("candidate not found")
	}

	sessionID := GenerateUUID()
	now := time.Now().UTC()
	sess := Session{
		ID:              sessionID,
		AssessmentID:    assessmentID,
		CandidateID:     candidateID,
		SessionState:    SessionStateInitializing,
		IntegrityState:  IntegrityStateInconclusive,
		TechnicalResult: TechnicalResultIncomplete,
		LastSequence:    0,
		LastEventHash:   ioep.GenesisHash(sessionID),
		CreatedAt:       now,
	}
	s.sessions[sess.ID] = sess

	// Create initial server challenge
	chal := SessionChallenge{
		ID:          GenerateUUID(),
		SessionID:   sess.ID,
		ServerNonce: GenerateNonce(32),
		ExpiresAt:   now.Add(15 * time.Minute),
		CreatedAt:   now,
	}
	s.challenges[sess.ID] = chal

	return sess, nil
}

func (s *MemoryStore) GetSession(id string) (Session, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sess, ok := s.sessions[id]
	return sess, ok
}

func (s *MemoryStore) UpdateSession(sess Session) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[sess.ID] = sess
}

func (s *MemoryStore) GetChallenge(sessionID string) (SessionChallenge, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	chal, ok := s.challenges[sessionID]
	return chal, ok
}

func (s *MemoryStore) SaveEnrollment(rec ioep.SessionEnrollmentRecord) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessionKeys[rec.SessionID] = rec

	if sess, ok := s.sessions[rec.SessionID]; ok {
		sess.SessionState = SessionStateActive
		now := time.Now().UTC()
		sess.EnrolledAt = &now
		sess.StartedAt = &now
		s.sessions[rec.SessionID] = sess
	}
}

func (s *MemoryStore) GetEnrollment(sessionID string) (ioep.SessionEnrollmentRecord, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	rec, ok := s.sessionKeys[sessionID]
	return rec, ok
}

func (s *MemoryStore) SaveBatch(batch ioep.SignedEvidenceBatch) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check idempotency: if batch already persisted, return nil
	if _, exists := s.batches[batch.BatchID]; exists {
		return nil
	}

	s.batches[batch.BatchID] = batch
	s.sessionBatches[batch.SessionID] = append(s.sessionBatches[batch.SessionID], batch.BatchID)

	for _, ev := range batch.Events {
		s.events[ev.EventID] = ev
		s.sessionEvents[batch.SessionID] = append(s.sessionEvents[batch.SessionID], ev)
	}

	// Update session watermark
	if sess, ok := s.sessions[batch.SessionID]; ok {
		sess.LastSequence = batch.SequenceEnd
		if len(batch.Events) > 0 {
			sess.LastEventHash = batch.Events[len(batch.Events)-1].CurrentEventHash
		}
		s.sessions[batch.SessionID] = sess
	}

	// Add outbox message for distribution
	s.outbox = append(s.outbox, OutboxMessage{
		ID:            GenerateUUID(),
		AggregateType: "SESSION",
		AggregateID:   batch.SessionID,
		EventType:     "EVIDENCE_BATCH_VERIFIED",
		Payload: map[string]interface{}{
			"batch_id":       batch.BatchID,
			"sequence_start": batch.SequenceStart,
			"sequence_end":   batch.SequenceEnd,
			"event_count":    batch.EventCount,
			"merkle_root":    batch.MerkleRoot,
		},
		IsPublished: false,
		CreatedAt:   time.Now().UTC(),
	})

	return nil
}

func (s *MemoryStore) GetSessionEvents(sessionID string) []ioep.SessionEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	evts, ok := s.sessionEvents[sessionID]
	if !ok {
		return []ioep.SessionEvent{}
	}
	res := make([]ioep.SessionEvent, len(evts))
	copy(res, evts)
	return res
}

func (s *MemoryStore) SaveTask(task AgentTask) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.agentTasks[task.TaskID] = task
}

func (s *MemoryStore) GetTasks(sessionID string) []AgentTask {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var res []AgentTask
	for _, t := range s.agentTasks {
		if sessionID == "" || t.SessionID == sessionID {
			res = append(res, t)
		}
	}
	return res
}

func (s *MemoryStore) SaveInvestigation(inv InvestigationCase) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.investigations[inv.ID] = inv
}

func (s *MemoryStore) GetInvestigations(sessionID string) []InvestigationCase {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var res []InvestigationCase
	for _, inv := range s.investigations {
		if sessionID == "" || inv.SessionID == sessionID {
			res = append(res, inv)
		}
	}
	return res
}

func (s *MemoryStore) SaveTechnicalScore(score TechnicalScore) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.technicalScores[score.SessionID] = score
}

func (s *MemoryStore) GetTechnicalScore(sessionID string) (TechnicalScore, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	score, ok := s.technicalScores[sessionID]
	return score, ok
}

func (s *MemoryStore) GetUnpublishedOutboxMessages() []OutboxMessage {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var unpub []OutboxMessage
	for _, m := range s.outbox {
		if !m.IsPublished {
			unpub = append(unpub, m)
		}
	}
	return unpub
}

func (s *MemoryStore) MarkOutboxMessagePublished(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.outbox {
		if s.outbox[i].ID == id {
			s.outbox[i].IsPublished = true
			break
		}
	}
}

type CodeSubmission struct {
	ID               string    `json:"id"`
	SessionID        string    `json:"session_id"`
	Language         string    `json:"language"`
	SourceCode       string    `json:"source_code"`
	TestCasesPassed  int       `json:"test_cases_passed"`
	TotalTestCases   int       `json:"total_test_cases"`
	ExecutionTimeMS  int64     `json:"execution_time_ms"`
	SubmittedAt      time.Time `json:"submitted_at"`
}

func (s *MemoryStore) SaveSubmission(sub CodeSubmission) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if sub.ID == "" {
		sub.ID = GenerateUUID()
	}
	sub.SubmittedAt = time.Now().UTC()
	s.submissions = append(s.submissions, sub)
}

func (s *MemoryStore) GetSubmissions(sessionID string) []CodeSubmission {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var res []CodeSubmission
	for _, sub := range s.submissions {
		if sub.SessionID == sessionID {
			res = append(res, sub)
		}
	}
	return res
}


