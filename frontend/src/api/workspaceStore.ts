import { Organization, Assessment, Candidate, Session, Role, LabRunHistory } from '../types';

const STORAGE_KEYS = {
  AUTH_TOKEN: 'interviewos_auth_token',
  USER_ROLE: 'interviewos_user_role',
  USER_ID: 'interviewos_user_id',
  ORG_ID: 'interviewos_org_id',
  WORKSPACE_ORGS: 'interviewos_workspace_orgs',
  WORKSPACE_ASMTS: 'interviewos_workspace_asmts',
  WORKSPACE_CANDS: 'interviewos_workspace_cands',
  WORKSPACE_SESSIONS: 'interviewos_workspace_sessions',
  LAB_HISTORY: 'interviewos_lab_history',
};

export const workspaceStore = {
  // --- Auth Session ---
  getAuthToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  },
  setAuthToken(token: string) {
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  },
  clearAuthToken() {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  getCurrentRole(): Role {
    const r = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
    if (r && ['CANDIDATE', 'INTERVIEWER', 'ASSESSMENT_ADMIN', 'ORG_ADMIN', 'SYSTEM_OPERATOR'].includes(r)) {
      return r as Role;
    }
    return 'ORG_ADMIN';
  },
  setCurrentRole(role: Role) {
    localStorage.setItem(STORAGE_KEYS.USER_ROLE, role);
  },

  getUserId(): string {
    return localStorage.getItem(STORAGE_KEYS.USER_ID) || 'usr_dev_admin';
  },
  setUserId(userId: string) {
    localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
  },

  getOrgId(): string {
    return localStorage.getItem(STORAGE_KEYS.ORG_ID) || 'org_acme_default';
  },
  setOrgId(orgId: string) {
    localStorage.setItem(STORAGE_KEYS.ORG_ID, orgId);
  },

  // --- Local Workspace Index ---
  getOrganizations(): Organization[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WORKSPACE_ORGS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveOrganization(org: Organization) {
    const list = this.getOrganizations().filter(o => o.id !== org.id);
    list.unshift(org);
    localStorage.setItem(STORAGE_KEYS.WORKSPACE_ORGS, JSON.stringify(list));
  },

  getAssessments(): Assessment[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WORKSPACE_ASMTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveAssessment(asmt: Assessment) {
    const list = this.getAssessments().filter(a => a.id !== asmt.id);
    list.unshift(asmt);
    localStorage.setItem(STORAGE_KEYS.WORKSPACE_ASMTS, JSON.stringify(list));
  },

  getCandidates(): Candidate[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WORKSPACE_CANDS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveCandidate(cand: Candidate) {
    const list = this.getCandidates().filter(c => c.id !== cand.id);
    list.unshift(cand);
    localStorage.setItem(STORAGE_KEYS.WORKSPACE_CANDS, JSON.stringify(list));
  },

  getSessions(): Session[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WORKSPACE_SESSIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveSession(sess: Session) {
    const list = this.getSessions().filter(s => s.id !== sess.id);
    list.unshift(sess);
    localStorage.setItem(STORAGE_KEYS.WORKSPACE_SESSIONS, JSON.stringify(list));
  },

  // --- System Lab History ---
  getLabHistory(): LabRunHistory[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LAB_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveLabRun(run: LabRunHistory) {
    const list = this.getLabHistory();
    list.unshift(run);
    localStorage.setItem(STORAGE_KEYS.LAB_HISTORY, JSON.stringify(list.slice(0, 20))); // Keep last 20
  },
};
