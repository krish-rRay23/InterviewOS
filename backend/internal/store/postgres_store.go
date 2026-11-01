package store

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"

	_ "github.com/lib/pq"
	"github.com/interviewos/interviewos/backend/internal/ioep"
)

// PostgresStore implements durable relational persistence for InterviewOS
type PostgresStore struct {
	db *sql.DB
}

// NewPostgresStore creates, configures, and migrates a connection pool to PostgreSQL
func NewPostgresStore(databaseURL string) (*PostgresStore, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	// Configure production connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(2 * time.Minute)

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("failed to ping postgres: %w", err)
	}

	store := &PostgresStore{db: db}
	if err := store.runMigrations(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("failed to run database migrations: %w", err)
	}

	return store, nil
}

func (s *PostgresStore) runMigrations() error {
	migrationSQL, err := os.ReadFile("migrations/001_init.sql")
	if err != nil {
		migrationSQL, err = os.ReadFile("../migrations/001_init.sql")
	}
	if err != nil {
		migrationSQL, err = os.ReadFile("../../migrations/001_init.sql")
	}
	if err != nil {
		return fmt.Errorf("migration file 001_init.sql not found: %w", err)
	}

	_, err = s.db.Exec(string(migrationSQL))
	return err
}

func (s *PostgresStore) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

func (s *PostgresStore) StorageType() string {
	return "POSTGRESQL_DURABLE"
}

func (s *PostgresStore) CreateOrganization(name, slug string) Organization {
	org := Organization{
		ID:        GenerateUUID(),
		Name:      name,
		Slug:      slug,
		CreatedAt: time.Now().UTC(),
	}
	query := `INSERT INTO organizations (id, name, slug, created_at) VALUES ($1, $2, $3, $4)`
	_, _ = s.db.Exec(query, org.ID, org.Name, org.Slug, org.CreatedAt)
	return org
}

func (s *PostgresStore) GetOrganization(id string) (Organization, bool) {
	var org Organization
	query := `SELECT id, name, slug, created_at FROM organizations WHERE id = $1`
	err := s.db.QueryRow(query, id).Scan(&org.ID, &org.Name, &org.Slug, &org.CreatedAt)
	if err != nil {
		return Organization{}, false
	}
	return org, true
}

func (s *PostgresStore) CreateAssessment(orgID, title, mode string) (Assessment, error) {
	asmt := Assessment{
		ID:             GenerateUUID(),
		OrganizationID: orgID,
		Title:          title,
		Mode:           mode,
		IsActive:       true,
		CreatedAt:      time.Now().UTC(),
	}
	query := `INSERT INTO assessments (id, organization_id, title, mode, is_active, created_at) VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := s.db.Exec(query, asmt.ID, asmt.OrganizationID, asmt.Title, asmt.Mode, asmt.IsActive, asmt.CreatedAt)
	if err != nil {
		return Assessment{}, err
	}
	return asmt, nil
}

func (s *PostgresStore) GetAssessment(id string) (Assessment, bool) {
	var asmt Assessment
	query := `SELECT id, organization_id, title, mode, is_active, created_at FROM assessments WHERE id = $1`
	err := s.db.QueryRow(query, id).Scan(&asmt.ID, &asmt.OrganizationID, &asmt.Title, &asmt.Mode, &asmt.IsActive, &asmt.CreatedAt)
	if err != nil {
		return Assessment{}, false
	}
	return asmt, true
}

func (s *PostgresStore) SavePolicy(policy AssessmentPolicy) AssessmentPolicy {
	if policy.ID == "" {
		policy.ID = GenerateUUID()
	}
	policy.CreatedAt = time.Now().UTC()

	prohibJSON, _ := json.Marshal(policy.ProhibitedProcessNames)
	permitJSON, _ := json.Marshal(policy.PermittedProcessNames)

	query := `
		INSERT INTO assessment_policies (
			id, assessment_id, version, max_displays, allow_external_ide, allow_usb_storage,
			allow_bluetooth_devices, allow_external_capture_hw, strict_etw, prohibited_processes,
			permitted_processes, investigation_budget_usd, max_agent_tool_calls, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		ON CONFLICT (assessment_id, version) DO UPDATE SET
			max_displays = EXCLUDED.max_displays,
			allow_external_ide = EXCLUDED.allow_external_ide,
			allow_usb_storage = EXCLUDED.allow_usb_storage,
			allow_bluetooth_devices = EXCLUDED.allow_bluetooth_devices,
			allow_external_capture_hw = EXCLUDED.allow_external_capture_hw,
			strict_etw = EXCLUDED.strict_etw,
			prohibited_processes = EXCLUDED.prohibited_processes,
			permitted_processes = EXCLUDED.permitted_processes,
			investigation_budget_usd = EXCLUDED.investigation_budget_usd,
			max_agent_tool_calls = EXCLUDED.max_agent_tool_calls
	`
	_, _ = s.db.Exec(query,
		policy.ID, policy.AssessmentID, policy.Version, policy.MaxDisplays, policy.AllowExternalIDE,
		policy.AllowUSBStorage, policy.AllowBluetoothDevices, policy.AllowExternalCaptureHW,
		policy.StrictETW, string(prohibJSON), string(permitJSON),
		policy.InvestigationBudgetUSD, policy.MaxAgentToolCalls, policy.CreatedAt,
	)
	return policy
}

func (s *PostgresStore) GetPolicy(assessmentID string, version int) (AssessmentPolicy, bool) {
	var pol AssessmentPolicy
	var prohibJSON, permitJSON string
	query := `
		SELECT id, assessment_id, version, max_displays, allow_external_ide, allow_usb_storage,
		       allow_bluetooth_devices, allow_external_capture_hw, strict_etw, prohibited_processes,
		       permitted_processes, investigation_budget_usd, max_agent_tool_calls, created_at
		FROM assessment_policies WHERE assessment_id = $1 AND version = $2
	`
	err := s.db.QueryRow(query, assessmentID, version).Scan(
		&pol.ID, &pol.AssessmentID, &pol.Version, &pol.MaxDisplays, &pol.AllowExternalIDE,
		&pol.AllowUSBStorage, &pol.AllowBluetoothDevices, &pol.AllowExternalCaptureHW,
		&pol.StrictETW, &prohibJSON, &permitJSON, &pol.InvestigationBudgetUSD,
		&pol.MaxAgentToolCalls, &pol.CreatedAt,
	)
	if err != nil {
		return AssessmentPolicy{}, false
	}
	_ = json.Unmarshal([]byte(prohibJSON), &pol.ProhibitedProcessNames)
	_ = json.Unmarshal([]byte(permitJSON), &pol.PermittedProcessNames)
	return pol, true
}

func (s *PostgresStore) CreateCandidate(orgID, fullName, email string) Candidate {
	cand := Candidate{
		ID:             GenerateUUID(),
		OrganizationID: orgID,
		FullName:       fullName,
		Email:          email,
		CreatedAt:      time.Now().UTC(),
	}
	query := `INSERT INTO candidates (id, organization_id, full_name, email, created_at) VALUES ($1, $2, $3, $4, $5)`
	_, _ = s.db.Exec(query, cand.ID, cand.OrganizationID, cand.FullName, cand.Email, cand.CreatedAt)
	return cand
}

func (s *PostgresStore) GetCandidate(id string) (Candidate, bool) {
	var cand Candidate
	query := `SELECT id, organization_id, full_name, email, created_at FROM candidates WHERE id = $1`
	err := s.db.QueryRow(query, id).Scan(&cand.ID, &cand.OrganizationID, &cand.FullName, &cand.Email, &cand.CreatedAt)
	if err != nil {
		return Candidate{}, false
	}
	return cand, true
}

func (s *PostgresStore) CreateSession(assessmentID, candidateID string) (Session, error) {
	if _, ok := s.GetAssessment(assessmentID); !ok {
		return Session{}, errors.New("assessment not found")
	}
	if _, ok := s.GetCandidate(candidateID); !ok {
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

	query := `
		INSERT INTO sessions (
			id, assessment_id, candidate_id, session_state, integrity_state, technical_result,
			last_sequence, last_event_hash, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := s.db.Exec(query, sess.ID, sess.AssessmentID, sess.CandidateID, sess.SessionState,
		sess.IntegrityState, sess.TechnicalResult, sess.LastSequence, sess.LastEventHash, sess.CreatedAt)
	if err != nil {
		return Session{}, err
	}

	// Create initial challenge
	chal := SessionChallenge{
		ID:          GenerateUUID(),
		SessionID:   sess.ID,
		ServerNonce: GenerateNonce(32),
		ExpiresAt:   now.Add(15 * time.Minute),
		CreatedAt:   now,
	}
	chalQuery := `INSERT INTO session_challenges (id, session_id, server_nonce, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)`
	_, _ = s.db.Exec(chalQuery, chal.ID, chal.SessionID, chal.ServerNonce, chal.ExpiresAt, chal.CreatedAt)

	return sess, nil
}

func (s *PostgresStore) GetSession(id string) (Session, bool) {
	var sess Session
	query := `
		SELECT id, assessment_id, candidate_id, session_state, integrity_state, technical_result,
		       last_sequence, last_event_hash, enrolled_at, started_at, closed_at, created_at
		FROM sessions WHERE id = $1
	`
	err := s.db.QueryRow(query, id).Scan(
		&sess.ID, &sess.AssessmentID, &sess.CandidateID, &sess.SessionState,
		&sess.IntegrityState, &sess.TechnicalResult, &sess.LastSequence,
		&sess.LastEventHash, &sess.EnrolledAt, &sess.StartedAt, &sess.ClosedAt, &sess.CreatedAt,
	)
	if err != nil {
		return Session{}, false
	}
	return sess, true
}

func (s *PostgresStore) UpdateSession(sess Session) {
	query := `
		UPDATE sessions SET
			session_state = $2, integrity_state = $3, technical_result = $4,
			last_sequence = $5, last_event_hash = $6, enrolled_at = $7,
			started_at = $8, closed_at = $9
		WHERE id = $1
	`
	_, _ = s.db.Exec(query,
		sess.ID, sess.SessionState, sess.IntegrityState, sess.TechnicalResult,
		sess.LastSequence, sess.LastEventHash, sess.EnrolledAt, sess.StartedAt, sess.ClosedAt,
	)
}

func (s *PostgresStore) GetChallenge(sessionID string) (SessionChallenge, bool) {
	var chal SessionChallenge
	query := `SELECT id, session_id, server_nonce, expires_at, created_at FROM session_challenges WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`
	err := s.db.QueryRow(query, sessionID).Scan(&chal.ID, &chal.SessionID, &chal.ServerNonce, &chal.ExpiresAt, &chal.CreatedAt)
	if err != nil {
		return SessionChallenge{}, false
	}
	return chal, true
}

func (s *PostgresStore) SaveEnrollment(rec ioep.SessionEnrollmentRecord) {
	tx, err := s.db.Begin()
	if err != nil {
		return
	}
	defer tx.Rollback()

	query := `
		INSERT INTO session_enrollments (session_id, public_key_hex, key_algorithm, windows_cng_container, enrolled_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (session_id) DO UPDATE SET
			public_key_hex = EXCLUDED.public_key_hex,
			key_algorithm = EXCLUDED.key_algorithm,
			windows_cng_container = EXCLUDED.windows_cng_container
	`
	_, err = tx.Exec(query, rec.SessionID, rec.PublicKeyPEM, rec.KeyAlgorithm, string(rec.KeyProtectionType), rec.EnrolledAtUTC)
	if err != nil {
		return
	}

	now := time.Now().UTC()
	updateSess := `
		UPDATE sessions SET session_state = $2, enrolled_at = $3, started_at = $4 WHERE id = $1
	`
	_, _ = tx.Exec(updateSess, rec.SessionID, SessionStateActive, now, now)
	_ = tx.Commit()
}

func (s *PostgresStore) GetEnrollment(sessionID string) (ioep.SessionEnrollmentRecord, bool) {
	var rec ioep.SessionEnrollmentRecord
	var keyProt string
	query := `SELECT session_id, public_key_hex, key_algorithm, windows_cng_container, enrolled_at FROM session_enrollments WHERE session_id = $1`
	err := s.db.QueryRow(query, sessionID).Scan(&rec.SessionID, &rec.PublicKeyPEM, &rec.KeyAlgorithm, &keyProt, &rec.EnrolledAtUTC)
	if err != nil {
		return ioep.SessionEnrollmentRecord{}, false
	}
	rec.KeyProtectionType = ioep.KeyProtectionType(keyProt)
	return rec, true
}

// SaveBatch executes atomic transactional ingestion of evidence batches, events, outbox messages, and watermark updates
func (s *PostgresStore) SaveBatch(batch ioep.SignedEvidenceBatch) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// 1. Idempotent check
	var exists bool
	checkQuery := `SELECT EXISTS(SELECT 1 FROM evidence_batches WHERE batch_id = $1)`
	if err := tx.QueryRow(checkQuery, batch.BatchID).Scan(&exists); err == nil && exists {
		return nil // Batch already durably stored
	}

	// 2. Insert Batch Header
	batchQuery := `
		INSERT INTO evidence_batches (batch_id, session_id, sequence_start, sequence_end, event_count, merkle_root, batch_signature, received_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err = tx.Exec(batchQuery, batch.BatchID, batch.SessionID, batch.SequenceStart, batch.SequenceEnd, batch.EventCount, batch.MerkleRoot, batch.Signature, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("failed to insert batch: %w", err)
	}

	// 3. Insert Events
	eventQuery := `
		INSERT INTO session_events (
			event_id, session_id, batch_id, sequence, event_type, timestamp_utc, payload,
			prev_event_hash, current_event_hash, provenance, confidence
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (session_id, sequence) DO NOTHING
	`
	for _, ev := range batch.Events {
		payloadJSON, _ := json.Marshal(ev.Payload)
		provenanceJSON, _ := json.Marshal(map[string]interface{}{
			"source":  ev.SourceCollector,
			"version": ev.CollectorVersion,
		})
		_, err = tx.Exec(eventQuery,
			ev.EventID, batch.SessionID, batch.BatchID, ev.Sequence, string(ev.EventType),
			ev.ClientTimeUTC, string(payloadJSON), ev.PreviousEventHash, ev.CurrentEventHash,
			string(provenanceJSON), 1.0,
		)
		if err != nil {
			return fmt.Errorf("failed to insert event %s: %w", ev.EventID, err)
		}
	}

	// 4. Update Session Watermark
	lastHash := ""
	if len(batch.Events) > 0 {
		lastHash = batch.Events[len(batch.Events)-1].CurrentEventHash
	}
	updateSess := `
		UPDATE sessions SET last_sequence = $2, last_event_hash = CASE WHEN $3 <> '' THEN $3 ELSE last_event_hash END WHERE id = $1
	`
	_, err = tx.Exec(updateSess, batch.SessionID, batch.SequenceEnd, lastHash)
	if err != nil {
		return fmt.Errorf("failed to update session sequence: %w", err)
	}

	// 5. Append Outbox Message for Guaranteed Delivery
	outboxID := GenerateUUID()
	outboxPayload, _ := json.Marshal(map[string]interface{}{
		"batch_id":       batch.BatchID,
		"sequence_start": batch.SequenceStart,
		"sequence_end":   batch.SequenceEnd,
		"event_count":    batch.EventCount,
		"merkle_root":    batch.MerkleRoot,
	})
	outboxQuery := `
		INSERT INTO outbox_messages (id, aggregate_type, aggregate_id, event_type, payload, is_published, created_at)
		VALUES ($1, $2, $3, $4, $5, FALSE, $6)
	`
	_, err = tx.Exec(outboxQuery, outboxID, "SESSION", batch.SessionID, "EVIDENCE_BATCH_VERIFIED", string(outboxPayload), time.Now().UTC())
	if err != nil {
		return fmt.Errorf("failed to append outbox record: %w", err)
	}

	return tx.Commit()
}

func (s *PostgresStore) GetSessionEvents(sessionID string) []ioep.SessionEvent {
	query := `
		SELECT event_id, sequence, event_type, timestamp_utc, payload, prev_event_hash, current_event_hash, provenance
		FROM session_events WHERE session_id = $1 ORDER BY sequence ASC
	`
	rows, err := s.db.Query(query, sessionID)
	if err != nil {
		return []ioep.SessionEvent{}
	}
	defer rows.Close()

	var events []ioep.SessionEvent
	for rows.Next() {
		var ev ioep.SessionEvent
		var payloadJSON, provenanceJSON, evType string
		err := rows.Scan(
			&ev.EventID, &ev.Sequence, &evType, &ev.ClientTimeUTC,
			&payloadJSON, &ev.PreviousEventHash, &ev.CurrentEventHash,
			&provenanceJSON,
		)
		if err == nil {
			ev.EventType = ioep.EventType(evType)
			ev.SessionID = sessionID
			_ = json.Unmarshal([]byte(payloadJSON), &ev.Payload)
			var prov map[string]interface{}
			if err := json.Unmarshal([]byte(provenanceJSON), &prov); err == nil {
				if src, ok := prov["source"].(string); ok {
					ev.SourceCollector = ioep.CollectorType(src)
				}
				if ver, ok := prov["version"].(string); ok {
					ev.CollectorVersion = ver
				}
			}
			events = append(events, ev)
		}
	}
	return events
}

func (s *PostgresStore) SaveTask(task AgentTask) {
	resultJSON, _ := json.Marshal(task.ResultPayload)
	evidenceJSON, _ := json.Marshal(task.EvidenceReferences)
	query := `
		INSERT INTO agent_tasks (task_id, session_id, agent_name, task_type, status, capability_token, input_payload, output_payload, error_message, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (task_id) DO UPDATE SET
			status = EXCLUDED.status,
			output_payload = EXCLUDED.output_payload,
			error_message = EXCLUDED.error_message
	`
	_, _ = s.db.Exec(query, task.TaskID, task.SessionID, task.TargetAgent, task.Objective, task.Status, task.CapabilityToken, string(evidenceJSON), string(resultJSON), "", task.CreatedAt)
}

func (s *PostgresStore) GetTasks(sessionID string) []AgentTask {
	var rows *sql.Rows
	var err error
	if sessionID != "" {
		rows, err = s.db.Query(`SELECT task_id, session_id, agent_name, task_type, status, capability_token, input_payload, output_payload, created_at FROM agent_tasks WHERE session_id = $1 ORDER BY created_at ASC`, sessionID)
	} else {
		rows, err = s.db.Query(`SELECT task_id, session_id, agent_name, task_type, status, capability_token, input_payload, output_payload, created_at FROM agent_tasks ORDER BY created_at ASC`)
	}
	if err != nil {
		return []AgentTask{}
	}
	defer rows.Close()

	var tasks []AgentTask
	for rows.Next() {
		var t AgentTask
		var inJSON, outJSON string
		err := rows.Scan(&t.TaskID, &t.SessionID, &t.TargetAgent, &t.Objective, &t.Status, &t.CapabilityToken, &inJSON, &outJSON, &t.CreatedAt)
		if err == nil {
			_ = json.Unmarshal([]byte(inJSON), &t.EvidenceReferences)
			_ = json.Unmarshal([]byte(outJSON), &t.ResultPayload)
			tasks = append(tasks, t)
		}
	}
	return tasks
}

func (s *PostgresStore) SaveInvestigation(inv InvestigationCase) {
	suppJSON, _ := json.Marshal(inv.SupportingEvidence)
	contraJSON, _ := json.Marshal(inv.ContradictoryEvidence)
	missJSON, _ := json.Marshal(inv.MissingEvidence)

	query := `
		INSERT INTO investigation_cases (id, session_id, hypothesis, status, supporting_evidence, contradictory_evidence, missing_evidence, recommended_action, confidence_score, resolved, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (id) DO UPDATE SET
			status = EXCLUDED.status,
			resolved = EXCLUDED.resolved,
			confidence_score = EXCLUDED.confidence_score
	`
	_, _ = s.db.Exec(query, inv.ID, inv.SessionID, inv.Hypothesis, inv.Status, string(suppJSON), string(contraJSON), string(missJSON), inv.RecommendedAction, inv.ConfidenceScore, inv.Resolved, inv.CreatedAt)
}

func (s *PostgresStore) GetInvestigations(sessionID string) []InvestigationCase {
	var rows *sql.Rows
	var err error
	if sessionID != "" {
		rows, err = s.db.Query(`SELECT id, session_id, hypothesis, status, supporting_evidence, contradictory_evidence, missing_evidence, recommended_action, confidence_score, resolved, created_at FROM investigation_cases WHERE session_id = $1 ORDER BY created_at ASC`, sessionID)
	} else {
		rows, err = s.db.Query(`SELECT id, session_id, hypothesis, status, supporting_evidence, contradictory_evidence, missing_evidence, recommended_action, confidence_score, resolved, created_at FROM investigation_cases ORDER BY created_at ASC`)
	}
	if err != nil {
		return []InvestigationCase{}
	}
	defer rows.Close()

	var list []InvestigationCase
	for rows.Next() {
		var inv InvestigationCase
		var suppJSON, contraJSON, missJSON string
		err := rows.Scan(&inv.ID, &inv.SessionID, &inv.Hypothesis, &inv.Status, &suppJSON, &contraJSON, &missJSON, &inv.RecommendedAction, &inv.ConfidenceScore, &inv.Resolved, &inv.CreatedAt)
		if err == nil {
			_ = json.Unmarshal([]byte(suppJSON), &inv.SupportingEvidence)
			_ = json.Unmarshal([]byte(contraJSON), &inv.ContradictoryEvidence)
			_ = json.Unmarshal([]byte(missJSON), &inv.MissingEvidence)
			list = append(list, inv)
		}
	}
	return list
}

func (s *PostgresStore) SaveTechnicalScore(score TechnicalScore) {
	query := `
		INSERT INTO technical_scores (session_id, code_correctness_pct, code_complexity_pct, interview_competency_pct, adaptive_challenge_pct, total_score_pct, scored_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (session_id) DO UPDATE SET
			code_correctness_pct = EXCLUDED.code_correctness_pct,
			code_complexity_pct = EXCLUDED.code_complexity_pct,
			interview_competency_pct = EXCLUDED.interview_competency_pct,
			adaptive_challenge_pct = EXCLUDED.adaptive_challenge_pct,
			total_score_pct = EXCLUDED.total_score_pct,
			scored_at = EXCLUDED.scored_at
	`
	_, _ = s.db.Exec(query, score.SessionID, score.CodeCorrectnessPct, score.CodeComplexityPct, score.InterviewCompetencyPct, score.AdaptiveChallengePct, score.TotalScorePct, score.ScoredAt)
}

func (s *PostgresStore) GetTechnicalScore(sessionID string) (TechnicalScore, bool) {
	var sc TechnicalScore
	query := `SELECT session_id, code_correctness_pct, code_complexity_pct, interview_competency_pct, adaptive_challenge_pct, total_score_pct, scored_at FROM technical_scores WHERE session_id = $1`
	err := s.db.QueryRow(query, sessionID).Scan(&sc.SessionID, &sc.CodeCorrectnessPct, &sc.CodeComplexityPct, &sc.InterviewCompetencyPct, &sc.AdaptiveChallengePct, &sc.TotalScorePct, &sc.ScoredAt)
	if err != nil {
		return TechnicalScore{}, false
	}
	return sc, true
}

func (s *PostgresStore) SaveSubmission(sub CodeSubmission) {
	if sub.ID == "" {
		sub.ID = GenerateUUID()
	}
	sub.SubmittedAt = time.Now().UTC()
	query := `
		INSERT INTO code_submissions (id, session_id, language, source_code, test_cases_passed, total_test_cases, execution_time_ms, submitted_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, _ = s.db.Exec(query, sub.ID, sub.SessionID, sub.Language, sub.SourceCode, sub.TestCasesPassed, sub.TotalTestCases, sub.ExecutionTimeMS, sub.SubmittedAt)
}

func (s *PostgresStore) GetSubmissions(sessionID string) []CodeSubmission {
	query := `
		SELECT id, session_id, language, source_code, test_cases_passed, total_test_cases, execution_time_ms, submitted_at
		FROM code_submissions WHERE session_id = $1 ORDER BY submitted_at ASC
	`
	rows, err := s.db.Query(query, sessionID)
	if err != nil {
		return []CodeSubmission{}
	}
	defer rows.Close()

	var list []CodeSubmission
	for rows.Next() {
		var sub CodeSubmission
		err := rows.Scan(&sub.ID, &sub.SessionID, &sub.Language, &sub.SourceCode, &sub.TestCasesPassed, &sub.TotalTestCases, &sub.ExecutionTimeMS, &sub.SubmittedAt)
		if err == nil {
			list = append(list, sub)
		}
	}
	return list
}

func (s *PostgresStore) GetUnpublishedOutboxMessages() []OutboxMessage {
	query := `
		SELECT id, aggregate_type, aggregate_id, event_type, payload, is_published, created_at
		FROM outbox_messages WHERE is_published = FALSE ORDER BY created_at ASC LIMIT 100
	`
	rows, err := s.db.Query(query)
	if err != nil {
		return []OutboxMessage{}
	}
	defer rows.Close()

	var msgs []OutboxMessage
	for rows.Next() {
		var m OutboxMessage
		var payloadJSON string
		err := rows.Scan(&m.ID, &m.AggregateType, &m.AggregateID, &m.EventType, &payloadJSON, &m.IsPublished, &m.CreatedAt)
		if err == nil {
			_ = json.Unmarshal([]byte(payloadJSON), &m.Payload)
			msgs = append(msgs, m)
		}
	}
	return msgs
}

func (s *PostgresStore) MarkOutboxMessagePublished(id string) {
	now := time.Now().UTC()
	query := `UPDATE outbox_messages SET is_published = TRUE, published_at = $2 WHERE id = $1`
	_, _ = s.db.Exec(query, id, now)
}

func (s *PostgresStore) SaveInterviewTurn(turn InterviewTurn) {
	if turn.ID == "" {
		turn.ID = GenerateUUID()
	}
	if turn.CreatedAt.IsZero() {
		turn.CreatedAt = time.Now().UTC()
	}
	conceptsJSON, _ := json.Marshal(turn.TechnicalConcepts)
	query := `
		INSERT INTO interview_turns (id, session_id, turn_number, speaker, transcript, detected_language, technical_concepts, is_finalized, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, _ = s.db.Exec(query, turn.ID, turn.SessionID, turn.TurnNumber, turn.Speaker, turn.Transcript, turn.DetectedLanguage, string(conceptsJSON), turn.IsFinalized, turn.CreatedAt)
}

func (s *PostgresStore) GetInterviewTurns(sessionID string) []InterviewTurn {
	query := `
		SELECT id, session_id, turn_number, speaker, transcript, detected_language, technical_concepts, is_finalized, created_at
		FROM interview_turns WHERE session_id = $1 ORDER BY turn_number ASC, created_at ASC
	`
	rows, err := s.db.Query(query, sessionID)
	if err != nil {
		return []InterviewTurn{}
	}
	defer rows.Close()

	var turns []InterviewTurn
	for rows.Next() {
		var t InterviewTurn
		var conceptsJSON string
		err := rows.Scan(&t.ID, &t.SessionID, &t.TurnNumber, &t.Speaker, &t.Transcript, &t.DetectedLanguage, &conceptsJSON, &t.IsFinalized, &t.CreatedAt)
		if err == nil {
			_ = json.Unmarshal([]byte(conceptsJSON), &t.TechnicalConcepts)
			turns = append(turns, t)
		}
	}
	return turns
}

func (s *PostgresStore) SaveInterviewSummary(summary InterviewSummary) {
	if summary.GeneratedAt.IsZero() {
		summary.GeneratedAt = time.Now().UTC()
	}
	topicsJSON, _ := json.Marshal(summary.TopicsCovered)
	evalJSON, _ := json.Marshal(summary.EvaluationDetails)
	query := `
		INSERT INTO interview_summaries (session_id, status, overall_competency_pct, topics_covered, summary_narrative, evaluation_details, generated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (session_id) DO UPDATE SET
			status = EXCLUDED.status,
			overall_competency_pct = EXCLUDED.overall_competency_pct,
			topics_covered = EXCLUDED.topics_covered,
			summary_narrative = EXCLUDED.summary_narrative,
			evaluation_details = EXCLUDED.evaluation_details,
			generated_at = EXCLUDED.generated_at
	`
	_, _ = s.db.Exec(query, summary.SessionID, summary.Status, summary.OverallCompetencyPct, string(topicsJSON), summary.SummaryNarrative, string(evalJSON), summary.GeneratedAt)
}

func (s *PostgresStore) GetInterviewSummary(sessionID string) (InterviewSummary, bool) {
	var sm InterviewSummary
	var topicsJSON, evalJSON string
	query := `
		SELECT session_id, status, overall_competency_pct, topics_covered, summary_narrative, evaluation_details, generated_at
		FROM interview_summaries WHERE session_id = $1
	`
	err := s.db.QueryRow(query, sessionID).Scan(&sm.SessionID, &sm.Status, &sm.OverallCompetencyPct, &topicsJSON, &sm.SummaryNarrative, &evalJSON, &sm.GeneratedAt)
	if err != nil {
		return InterviewSummary{}, false
	}
	_ = json.Unmarshal([]byte(topicsJSON), &sm.TopicsCovered)
	_ = json.Unmarshal([]byte(evalJSON), &sm.EvaluationDetails)
	return sm, true
}
