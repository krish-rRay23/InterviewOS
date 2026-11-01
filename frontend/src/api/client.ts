import {
  AuthTokenRequest,
  AuthTokenResponse,
  Organization,
  Assessment,
  AssessmentPolicy,
  Candidate,
  Session,
  SessionManifest,
  SessionStatus,
  SubmissionRequest,
  SubmissionResponse,
  SessionReport,
  EvidenceEvent,
  InvestigationCase,
  ReviewDecisionRequest,
  ReviewDecisionResponse,
  AgentStatus,
  BackendHealth,
  LocalAIHealth,
  ChatRequest,
  ChatResponse,
  TranscribeResponse,
} from '../types';
import { workspaceStore } from './workspaceStore';

// In Vite development, relative `/api` and `/ai` routes use Vite proxy to avoid CORS.
// Direct absolute URLs can also be configured via environment variables.
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const LOCAL_AI_BASE = import.meta.env.VITE_LOCAL_AI_BASE_URL || '/ai';

interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

export interface ApiCallMetric<T> {
  data: T;
  durationMs: number;
  status: number;
  url: string;
}

async function request<T>(url: string, options: FetchOptions = {}): Promise<ApiCallMetric<T>> {
  const { timeoutMs = 15000, headers = {}, ...rest } = options;
  const token = workspaceStore.getAuthToken();

  const reqHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string>),
  };

  if (token && !reqHeaders.Authorization) {
    reqHeaders.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const start = performance.now();
  try {
    const res = await fetch(url, {
      ...rest,
      headers: reqHeaders,
      signal: controller.signal,
    });
    const durationMs = Math.round(performance.now() - start);

    if (!res.ok) {
      let errDetail = `${res.status} ${res.statusText}`;
      try {
        const errJson = await res.json();
        errDetail = errJson.error || errJson.detail || errDetail;
      } catch {
        // Not JSON
      }
      throw new Error(`API Error [${res.status}]: ${errDetail}`);
    }

    const contentType = res.headers.get('content-type') || '';
    let data: any;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = (await res.text()) as any;
    }

    return {
      data: data as T,
      durationMs,
      status: res.status,
      url,
    };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    if (err.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms for ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  // --- Go Backend API ---
  async getHealth(): Promise<ApiCallMetric<BackendHealth>> {
    return request<BackendHealth>(`${API_BASE}/health`);
  },

  async issueAuthToken(req: AuthTokenRequest): Promise<ApiCallMetric<AuthTokenResponse>> {
    const res = await request<AuthTokenResponse>(`${API_BASE}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (res.data?.access_token) {
      workspaceStore.setAuthToken(res.data.access_token);
      workspaceStore.setCurrentRole(req.role);
    }
    return res;
  },

  async createOrganization(req: { name: string; slug: string }): Promise<ApiCallMetric<Organization>> {
    const res = await request<Organization>(`${API_BASE}/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    workspaceStore.saveOrganization(res.data);
    return res;
  },

  async createAssessment(req: {
    organization_id: string;
    title: string;
    mode: string;
  }): Promise<ApiCallMetric<Assessment>> {
    const res = await request<Assessment>(`${API_BASE}/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    workspaceStore.saveAssessment(res.data);
    return res;
  },

  async savePolicy(assessmentId: string, policy: AssessmentPolicy): Promise<ApiCallMetric<AssessmentPolicy>> {
    return request<AssessmentPolicy>(`${API_BASE}/assessments/${assessmentId}/policies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(policy),
    });
  },

  async getPolicy(assessmentId: string, version: number): Promise<ApiCallMetric<AssessmentPolicy>> {
    return request<AssessmentPolicy>(`${API_BASE}/assessments/${assessmentId}/policies/${version}`);
  },

  async createCandidate(req: {
    organization_id: string;
    full_name: string;
    email: string;
  }): Promise<ApiCallMetric<Candidate>> {
    const res = await request<Candidate>(`${API_BASE}/candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    workspaceStore.saveCandidate(res.data);
    return res;
  },

  async createSession(req: {
    assessment_id: string;
    candidate_id: string;
  }): Promise<ApiCallMetric<Session>> {
    const res = await request<Session>(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    workspaceStore.saveSession(res.data);
    return res;
  },

  async getSessionManifest(sessionId: string): Promise<ApiCallMetric<SessionManifest>> {
    return request<SessionManifest>(`${API_BASE}/sessions/${sessionId}/manifest`);
  },

  async getSessionStatus(sessionId: string): Promise<ApiCallMetric<SessionStatus>> {
    return request<SessionStatus>(`${API_BASE}/sessions/${sessionId}/status`);
  },

  async closeSession(sessionId: string): Promise<ApiCallMetric<{ session_id: string; status: string }>> {
    return request<{ session_id: string; status: string }>(`${API_BASE}/sessions/${sessionId}/close`, {
      method: 'POST',
    });
  },

  async submitCode(sessionId: string, req: SubmissionRequest): Promise<ApiCallMetric<SubmissionResponse>> {
    return request<SubmissionResponse>(`${API_BASE}/sessions/${sessionId}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  },

  async getSessionReport(sessionId: string): Promise<ApiCallMetric<SessionReport>> {
    return request<SessionReport>(`${API_BASE}/sessions/${sessionId}/report`);
  },

  async getSessionEvidence(sessionId: string): Promise<ApiCallMetric<EvidenceEvent[]>> {
    return request<EvidenceEvent[]>(`${API_BASE}/sessions/${sessionId}/evidence`);
  },

  async getSessionInvestigations(sessionId: string): Promise<ApiCallMetric<InvestigationCase[]>> {
    return request<InvestigationCase[]>(`${API_BASE}/sessions/${sessionId}/investigations`);
  },

  async reviewDecision(reviewId: string, req: ReviewDecisionRequest): Promise<ApiCallMetric<ReviewDecisionResponse>> {
    return request<ReviewDecisionResponse>(`${API_BASE}/reviews/${reviewId}/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  },

  async getAgentsStatus(): Promise<ApiCallMetric<AgentStatus[]>> {
    return request<AgentStatus[]>(`${API_BASE}/agents/status`);
  },

  // --- Local AI Service API ---
  async getLocalAIHealth(): Promise<ApiCallMetric<LocalAIHealth>> {
    return request<LocalAIHealth>(`${LOCAL_AI_BASE}/health`);
  },

  async getLocalAIModels(): Promise<ApiCallMetric<any>> {
    return request<any>(`${LOCAL_AI_BASE}/models`);
  },

  async getLocalAIMetrics(): Promise<ApiCallMetric<any>> {
    return request<any>(`${LOCAL_AI_BASE}/metrics`);
  },

  async chatCompletion(req: ChatRequest): Promise<ApiCallMetric<ChatResponse>> {
    return request<ChatResponse>(`${LOCAL_AI_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      timeoutMs: 45000, // LLM inferences may take up to 25s
    });
  },

  async transcribeAudio(audioBlob: Blob, language: string = 'auto'): Promise<ApiCallMetric<TranscribeResponse>> {
    const formData = new FormData();
    formData.append('file', audioBlob, 'candidate_turn.wav');
    formData.append('language', language);

    const start = performance.now();
    const res = await fetch(`${LOCAL_AI_BASE}/transcribe`, {
      method: 'POST',
      body: formData,
    });
    const durationMs = Math.round(performance.now() - start);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Transcription failed [${res.status}]: ${errText}`);
    }

    const data = await res.json();
    return {
      data,
      durationMs,
      status: res.status,
      url: `${LOCAL_AI_BASE}/transcribe`,
    };
  },

  async synthesizeSpeech(text: string, language: string = 'en'): Promise<{ audioBlob: Blob; durationMs: number }> {
    const start = performance.now();
    const res = await fetch(`${LOCAL_AI_BASE}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }),
    });
    const durationMs = Math.round(performance.now() - start);

    if (!res.ok) {
      let errDetail = `${res.status} ${res.statusText}`;
      try {
        const errJson = await res.json();
        errDetail = errJson.detail || errDetail;
      } catch {}
      throw new Error(`Speech synthesis failed [${res.status}]: ${errDetail}`);
    }

    const audioBlob = await res.blob();
    return { audioBlob, durationMs };
  },

  async generateEmbeddings(texts: string[]): Promise<ApiCallMetric<any>> {
    return request<any>(`${LOCAL_AI_BASE}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts, task_type: 'document' }),
    });
  },
};
