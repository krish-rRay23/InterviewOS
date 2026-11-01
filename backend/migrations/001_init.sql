-- InterviewOS PostgreSQL Schema Migration 001
-- Production-grade durable relational persistence with strict ACID semantics,
-- foreign keys, foreign constraints, JSONB payloads, and indexing.

CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assessments (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    mode VARCHAR(64) NOT NULL DEFAULT 'TRADITIONAL_CODING',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assessment_policies (
    id VARCHAR(64) PRIMARY KEY,
    assessment_id VARCHAR(64) NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    version INT NOT NULL,
    max_displays INT NOT NULL DEFAULT 1,
    allow_external_ide BOOLEAN NOT NULL DEFAULT FALSE,
    allow_usb_storage BOOLEAN NOT NULL DEFAULT FALSE,
    allow_bluetooth_devices BOOLEAN NOT NULL DEFAULT FALSE,
    allow_external_capture_hw BOOLEAN NOT NULL DEFAULT FALSE,
    strict_etw BOOLEAN NOT NULL DEFAULT TRUE,
    prohibited_processes JSONB NOT NULL DEFAULT '[]',
    permitted_processes JSONB NOT NULL DEFAULT '[]',
    investigation_budget_usd NUMERIC(8,2) NOT NULL DEFAULT 2.50,
    max_agent_tool_calls INT NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_assessment_policy_version UNIQUE (assessment_id, version)
);

CREATE TABLE IF NOT EXISTS candidates (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY,
    assessment_id VARCHAR(64) NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    candidate_id VARCHAR(64) NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    session_state VARCHAR(64) NOT NULL DEFAULT 'INITIALIZING',
    integrity_state VARCHAR(64) NOT NULL DEFAULT 'INCONCLUSIVE',
    technical_result VARCHAR(64) NOT NULL DEFAULT 'INCOMPLETE',
    last_sequence BIGINT NOT NULL DEFAULT 0,
    last_event_hash VARCHAR(128) NOT NULL,
    enrolled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_challenges (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    server_nonce VARCHAR(128) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_enrollments (
    session_id VARCHAR(64) PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
    public_key_hex TEXT NOT NULL,
    key_algorithm VARCHAR(64) NOT NULL DEFAULT 'ECDSA_P256_SHA256',
    windows_cng_container VARCHAR(255),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidence_batches (
    batch_id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    sequence_start BIGINT NOT NULL,
    sequence_end BIGINT NOT NULL,
    event_count INT NOT NULL,
    merkle_root VARCHAR(128) NOT NULL,
    batch_signature TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_events (
    event_id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    batch_id VARCHAR(64) NOT NULL REFERENCES evidence_batches(batch_id) ON DELETE CASCADE,
    sequence BIGINT NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    timestamp_utc TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    prev_event_hash VARCHAR(128) NOT NULL,
    current_event_hash VARCHAR(128) NOT NULL,
    provenance JSONB NOT NULL DEFAULT '{}',
    confidence NUMERIC(4,3) NOT NULL DEFAULT 1.000,
    CONSTRAINT uq_session_sequence UNIQUE (session_id, sequence)
);

CREATE TABLE IF NOT EXISTS outbox_messages (
    id VARCHAR(64) PRIMARY KEY,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_tasks (
    task_id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    agent_name VARCHAR(64) NOT NULL,
    task_type VARCHAR(64) NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'PENDING',
    capability_token TEXT,
    input_payload JSONB NOT NULL DEFAULT '{}',
    output_payload JSONB NOT NULL DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investigation_cases (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    hypothesis TEXT NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'OPEN',
    supporting_evidence JSONB NOT NULL DEFAULT '[]',
    contradictory_evidence JSONB NOT NULL DEFAULT '[]',
    missing_evidence JSONB NOT NULL DEFAULT '[]',
    recommended_action VARCHAR(64) NOT NULL,
    confidence_score NUMERIC(4,3) NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS technical_scores (
    session_id VARCHAR(64) PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
    code_correctness_pct NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    code_complexity_pct NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    interview_competency_pct NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    adaptive_challenge_pct NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    total_score_pct NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS code_submissions (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    language VARCHAR(32) NOT NULL,
    source_code TEXT NOT NULL,
    test_cases_passed INT NOT NULL DEFAULT 0,
    total_test_cases INT NOT NULL DEFAULT 0,
    execution_time_ms BIGINT NOT NULL DEFAULT 0,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interview_turns (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    turn_number INT NOT NULL,
    speaker VARCHAR(32) NOT NULL,
    transcript TEXT NOT NULL,
    detected_language VARCHAR(32) NOT NULL DEFAULT 'en',
    technical_concepts JSONB NOT NULL DEFAULT '[]',
    is_finalized BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_session_turn UNIQUE (session_id, turn_number)
);

CREATE TABLE IF NOT EXISTS interview_summaries (
    session_id VARCHAR(64) PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
    overall_competency_pct NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    topics_covered JSONB NOT NULL DEFAULT '[]',
    summary_narrative TEXT NOT NULL,
    evaluation_details JSONB NOT NULL DEFAULT '{}',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performant telemetry querying and outbox polling
CREATE INDEX IF NOT EXISTS idx_sessions_assessment ON sessions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_sessions_candidate ON sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_session_events_session_seq ON session_events(session_id, sequence);
CREATE INDEX IF NOT EXISTS idx_evidence_batches_session ON evidence_batches(session_id);
CREATE INDEX IF NOT EXISTS idx_outbox_unpub ON outbox_messages(is_published, created_at) WHERE NOT is_published;
CREATE INDEX IF NOT EXISTS idx_agent_tasks_session ON agent_tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_investigation_cases_session ON investigation_cases(session_id);
CREATE INDEX IF NOT EXISTS idx_code_submissions_session ON code_submissions(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_turns_session ON interview_turns(session_id, turn_number);
