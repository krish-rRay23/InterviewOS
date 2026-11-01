package store

import (
	"github.com/interviewos/interviewos/backend/internal/ioep"
)

// Store defines the persistent storage interface for InterviewOS.
// Implemented by MemoryStore (for fast local dev/testing) and PostgresStore (for durable production persistence).
type Store interface {
	// Organization & Tenancy
	CreateOrganization(name, slug string) Organization
	GetOrganization(id string) (Organization, bool)

	// Assessment & Policy
	CreateAssessment(orgID, title, mode string) (Assessment, error)
	GetAssessment(id string) (Assessment, bool)
	SavePolicy(policy AssessmentPolicy) AssessmentPolicy
	GetPolicy(assessmentID string, version int) (AssessmentPolicy, bool)

	// Candidate Management
	CreateCandidate(orgID, fullName, email string) Candidate
	GetCandidate(id string) (Candidate, bool)

	// Session & IOEP Cryptographic Lifecycle
	CreateSession(assessmentID, candidateID string) (Session, error)
	GetSession(id string) (Session, bool)
	UpdateSession(sess Session)
	GetChallenge(sessionID string) (SessionChallenge, bool)
	SaveEnrollment(rec ioep.SessionEnrollmentRecord)
	GetEnrollment(sessionID string) (ioep.SessionEnrollmentRecord, bool)

	// Evidence Journal & Batch Ingestion
	SaveBatch(batch ioep.SignedEvidenceBatch) error
	GetSessionEvents(sessionID string) []ioep.SessionEvent

	// Multi-Agent Task Orchestration & Investigations
	SaveTask(task AgentTask)
	GetTasks(sessionID string) []AgentTask
	SaveInvestigation(inv InvestigationCase)
	GetInvestigations(sessionID string) []InvestigationCase

	// Technical Evaluation & Code Submissions
	SaveTechnicalScore(score TechnicalScore)
	GetTechnicalScore(sessionID string) (TechnicalScore, bool)
	SaveSubmission(sub CodeSubmission)
	GetSubmissions(sessionID string) []CodeSubmission

	// Transactional Outbox (Guaranteed At-Least-Once Delivery to Redis Streams)
	GetUnpublishedOutboxMessages() []OutboxMessage
	MarkOutboxMessagePublished(id string)

	// Lifecycle
	Close() error
	StorageType() string
}
