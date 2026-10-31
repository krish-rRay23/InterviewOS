-- InterviewOS Master Database Schema
-- Version 1.0 (PostgreSQL 14+)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations & Clients
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_name VARCHAR(255) NOT NULL,
    api_key_hash VARCHAR(64) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Assessments & Policies
CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    mode VARCHAR(50) NOT NULL DEFAULT 'AI_PROHIBITED',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assessment_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    max_displays INT DEFAULT 1,
    allow_external_ide BOOLEAN DEFAULT FALSE,
    allow_usb_storage BOOLEAN DEFAULT FALSE,
    strict_etw BOOLEAN DEFAULT TRUE,
    prohibited_process_names JSONB DEFAULT '[]'::jsonb,
    permitted_process_names JSONB DEFAULT '[]'::jsonb,
    investigation_budget_usd NUMERIC(10, 4) DEFAULT 2.5000,
    max_agent_tool_calls INT DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assessment_id, version)
);

-- 3. Candidates & Sessions
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    session_state VARCHAR(50) NOT NULL DEFAULT 'INITIALIZING',
    integrity_state VARCHAR(50) NOT NULL DEFAULT 'INCONCLUSIVE',
    technical_result VARCHAR(50) NOT NULL DEFAULT 'INCOMPLETE',
    enrolled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. IOEP Cryptographic Endpoint Enrollment & Keys
CREATE TABLE IF NOT EXISTS session_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    public_key_pem TEXT NOT NULL,
    key_algorithm VARCHAR(50) NOT NULL DEFAULT 'ECDSA_P256_SHA256',
    key_protection_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    server_nonce VARCHAR(128) NOT NULL,
    client_nonce VARCHAR(128),
    challenge_signature TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Evidence Batches & Checkpoints
CREATE TABLE IF NOT EXISTS event_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    sequence_start BIGINT NOT NULL,
    sequence_end BIGINT NOT NULL,
    event_count INT NOT NULL,
    merkle_root VARCHAR(64) NOT NULL,
    previous_batch_hash VARCHAR(64) NOT NULL,
    signature TEXT NOT NULL,
    trust_status VARCHAR(50) NOT NULL DEFAULT 'VERIFIED',
    signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
    hash_chain_valid BOOLEAN NOT NULL DEFAULT FALSE,
    merkle_root_valid BOOLEAN NOT NULL DEFAULT FALSE,
    sequence_continuous BOOLEAN NOT NULL DEFAULT FALSE,
    created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_batches_session_seq ON event_batches(session_id, sequence_start, sequence_end);

CREATE TABLE IF NOT EXISTS session_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(64) UNIQUE NOT NULL,
    batch_id UUID REFERENCES event_batches(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    sequence BIGINT NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    client_time_utc TIMESTAMP WITH TIME ZONE NOT NULL,
    monotonic_timestamp_ns BIGINT NOT NULL,
    source_collector VARCHAR(64) NOT NULL,
    collector_version VARCHAR(32) NOT NULL,
    policy_version INT NOT NULL,
    payload JSONB NOT NULL,
    previous_event_hash VARCHAR(64) NOT NULL,
    current_event_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, sequence)
);
CREATE INDEX IF NOT EXISTS idx_events_session_seq ON session_events(session_id, sequence);
CREATE INDEX IF NOT EXISTS idx_events_type ON session_events(event_type);

-- 6. Collector Telemetry & Health
CREATE TABLE IF NOT EXISTS collector_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    collector_type VARCHAR(64) NOT NULL,
    healthy BOOLEAN NOT NULL DEFAULT TRUE,
    last_error TEXT,
    events_emitted BIGINT DEFAULT 0,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    description TEXT,
    device_class VARCHAR(100),
    category VARCHAR(50),
    is_connected BOOLEAN DEFAULT TRUE,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS display_observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    display_count INT NOT NULL DEFAULT 1,
    topology_summary JSONB,
    observed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS network_observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    adapter_count INT NOT NULL DEFAULT 1,
    ip_addresses JSONB,
    observed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Multi-Agent Registry, Tasks & Autonomy Guard
CREATE TABLE IF NOT EXISTS agent_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_capabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
    capability_name VARCHAR(100) NOT NULL,
    is_granted BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, capability_name)
);

CREATE TABLE IF NOT EXISTS agent_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    requesting_agent VARCHAR(100) NOT NULL,
    target_agent VARCHAR(100) NOT NULL,
    objective TEXT NOT NULL,
    capability_token VARCHAR(128) NOT NULL,
    max_tool_calls INT DEFAULT 5,
    tool_calls_used INT DEFAULT 0,
    deadline_utc TIMESTAMP WITH TIME ZONE NOT NULL,
    evidence_references JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    result_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Autonomous Investigations & Findings
CREATE TABLE IF NOT EXISTS investigation_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    hypothesis TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    recommended_action VARCHAR(50),
    confidence_score NUMERIC(5, 4),
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS investigation_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    investigation_id UUID NOT NULL REFERENCES investigation_cases(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- SUPPORTING, CONTRADICTORY, MISSING
    evidence_ref VARCHAR(255) NOT NULL,
    detail TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Assessment Submissions, Forensics & Scores
CREATE TABLE IF NOT EXISTS code_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    language VARCHAR(20) NOT NULL,
    source_code TEXT NOT NULL,
    test_cases_passed INT DEFAULT 0,
    total_test_cases INT DEFAULT 0,
    execution_time_ms BIGINT DEFAULT 0,
    peak_memory_bytes BIGINT DEFAULT 0,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS similarity_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_a_id UUID NOT NULL REFERENCES code_submissions(id) ON DELETE CASCADE,
    submission_b_id UUID NOT NULL REFERENCES code_submissions(id) ON DELETE CASCADE,
    similarity_score NUMERIC(5, 4) NOT NULL,
    ast_distance NUMERIC(5, 4),
    token_overlap NUMERIC(5, 4),
    analysis_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interview_turns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    speaker VARCHAR(20) NOT NULL, -- AGENT, CANDIDATE
    language_detected VARCHAR(20) NOT NULL, -- en, hi, hinglish
    original_transcript TEXT NOT NULL,
    normalized_transcript TEXT,
    turn_order INT NOT NULL,
    audio_duration_seconds NUMERIC(8, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS technical_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    code_correctness_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    code_complexity_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    interview_competency_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    adaptive_challenge_pct NUMERIC(5, 2) DEFAULT 0.00,
    total_score_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    scored_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assessment_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID UNIQUE NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    technical_result VARCHAR(50) NOT NULL, -- PASSED, FAILED, INCOMPLETE
    technical_score_pct NUMERIC(5, 2) NOT NULL,
    integrity_state VARCHAR(50) NOT NULL, -- VERIFIED, REVIEW_CONDITION_RESOLVED, POLICY_BREACH_CONFIRMED, INCONCLUSIVE, SESSION_INCOMPLETE
    evidence_report_url TEXT,
    finalized_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Transactional Outbox for Redis Streams & Telemetry
CREATE TABLE IF NOT EXISTS transactional_outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON transactional_outbox(is_published, created_at);

-- 11. Security Audit, Governance & Model Registry
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_type VARCHAR(50) NOT NULL, -- AGENT, USER, SYSTEM
    actor_id VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS model_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    version VARCHAR(50) NOT NULL,
    purpose VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

