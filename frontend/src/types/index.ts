// Core Data Types for InterviewOS Web Application
// Aligned strictly with Backend Go and Local AI FastAPI contracts

export type Role =
  | 'CANDIDATE'
  | 'INTERVIEWER'
  | 'ASSESSMENT_ADMIN'
  | 'ORG_ADMIN'
  | 'SYSTEM_OPERATOR';

export interface AuthTokenRequest {
  user_id: string;
  org_id: string;
  session_id?: string;
  role: Role;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  role: Role;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export type AssessmentMode = 'AI_PROHIBITED' | 'AI_COLLABORATIVE' | 'UNRESTRICTED';

export interface Assessment {
  id: string;
  organization_id: string;
  title: string;
  mode: AssessmentMode;
  created_at: string;
}

export interface AssessmentPolicy {
  version: number;
  max_displays: number;
  allow_external_ide: boolean;
  allow_usb_storage: boolean;
  strict_etw: boolean;
  prohibited_process_names: string[];
  permitted_process_names: string[];
  investigation_budget_usd: number;
  max_agent_tool_calls: number;
}

export interface Candidate {
  id: string;
  organization_id: string;
  full_name: string;
  email: string;
  created_at: string;
}

export type SessionState =
  | 'PENDING_ENROLLMENT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'TERMINATED'
  | 'INVALIDATED';

export type TechnicalResult = 'PENDING' | 'PASSED' | 'FAILED' | 'INCOMPLETE';

export type IntegrityState =
  | 'VERIFIED'
  | 'REVIEW_CONDITION_RESOLVED'
  | 'POLICY_BREACH_CONFIRMED'
  | 'INCONCLUSIVE';

export interface Session {
  id: string;
  assessment_id: string;
  candidate_id: string;
  session_state: SessionState;
  technical_result: TechnicalResult;
  created_at: string;
  closed_at?: string;
}

export interface SessionManifest {
  session_id: string;
  assessment_id: string;
  candidate_id: string;
  policy: AssessmentPolicy;
  status: string;
}

export interface SessionStatus {
  session_id: string;
  session_state: SessionState;
  technical_result: TechnicalResult;
  enrolled: boolean;
  total_events: number;
  unprocessed_events: number;
  last_event_time: string | null;
  last_heartbeat_time: string | null;
}

export interface TechnicalScore {
  session_id?: string;
  code_correctness_pct: number;
  code_complexity_pct: number;
  interview_competency_pct: number;
  adaptive_challenge_pct: number;
  total_score_pct: number;
  scored_at?: string;
}

export interface SubmissionRequest {
  language: string;
  source_code: string;
}

export interface SubmissionResponse {
  status: string;
  session_id: string;
  test_cases_passed: number;
  total_test_cases: number;
  all_passed: boolean;
  execution_time_ms: number;
  technical_score: TechnicalScore;
}

export interface SessionReport {
  session_id: string;
  assessment_id: string;
  candidate_id: string;
  technical_result: TechnicalResult;
  technical_score: TechnicalScore;
  integrity_state: IntegrityState;
  session_state: SessionState;
  total_events: number;
  breaches_detected: number;
  cleared_anomalies: number;
  investigations: InvestigationCase[];
  generated_at: string;
}

export interface EvidenceEvent {
  event_id: string;
  session_id: string;
  sequence: number;
  event_type: string;
  client_time: string;
  monotonic_timestamp_ns: number;
  source_collector: string;
  policy_version: number;
  payload: Record<string, any>;
  previous_event_hash: string;
  current_event_hash: string;
}

export interface InvestigationCase {
  investigation_id: string;
  session_id: string;
  hypothesis: string;
  supporting_evidence: string[];
  contradictory_evidence: string[];
  missing_evidence: string[];
  investigation_steps_executed: string[];
  conclusion_summary: string;
  recommended_action: string;
  confidence_score: number;
  resolved: boolean;
  completed_at_utc: string;
}

export interface ReviewDecisionRequest {
  decision: 'APPROVED' | 'OVERRULED' | 'INCONCLUSIVE';
  notes: string;
}

export interface ReviewDecisionResponse {
  review_id: string;
  decision: string;
  logged_at: string;
}

export interface AgentStatus {
  name: string;
  role: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
}

export interface BackendHealth {
  status: 'healthy' | 'degraded' | 'offline';
  storage_backend: 'MemoryStore' | 'PostgreSQL' | string;
  outbox_backlog: number;
  timestamp: string;
  auth_engine?: string;
  owasp_baseline?: string;
}

// Local AI Types
export interface GPUVRAMInfo {
  device_name: string;
  total_mb: number;
  used_mb: number;
  free_mb: number;
  utilization_pct: number;
  temperature_c: number;
  power_w: number;
}

export interface LocalAIHealth {
  status: 'healthy' | 'degraded' | 'offline';
  mode: string;
  allow_cloud_ai: boolean;
  ollama_available: boolean;
  installed_ollama_models?: Array<{ name: string; size_gb?: number }>;
  piper_tts_available: boolean;
  whisper_stt_available: boolean;
  gpu_vram: GPUVRAMInfo;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  task_type?: string;
  model?: string;
  temperature?: number;
  top_p?: number;
  num_ctx?: number;
  stream?: boolean;
}

export interface ChatResponse {
  model_used: string;
  task_type: string;
  response: string;
  tokens_per_sec: number;
  eval_count: number;
  elapsed_seconds: number;
}

export interface TranscribeResponse {
  transcript: string;
  detected_language: string;
  language_probability: number;
  duration_seconds: number;
  segments: Array<{
    start: number;
    end: number;
    text: string;
    confidence: number;
  }>;
}

// Local Browser Index
export interface WorkspaceIndex {
  organizations: Organization[];
  assessments: Assessment[];
  candidates: Candidate[];
  sessions: Session[];
}

// System Lab Types
export interface DiagnosticStepResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED' | 'RUNNING';
  duration_ms: number;
  http_status?: number;
  request_url?: string;
  payload?: any;
  error?: string;
  timestamp: string;
}

export interface LabRunHistory {
  id: string;
  name: string;
  timestamp: string;
  status: 'PASS' | 'FAIL';
  duration_ms: number;
  steps: DiagnosticStepResult[];
}
