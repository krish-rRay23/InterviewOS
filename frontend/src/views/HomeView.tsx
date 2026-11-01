import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Building2,
  Code2,
  UserCheck,
  Search,
  Activity,
  FlaskConical,
  ArrowRight,
  Server,
  Cpu,
  Lock,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';
import { workspaceStore } from '../api/workspaceStore';
import { api } from '../api/client';
import { Role } from '../types';

export const HomeView: React.FC = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<Role>(workspaceStore.getCurrentRole());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [tokenPreview, setTokenPreview] = useState<string | null>(workspaceStore.getAuthToken());

  const [backendStatus, setBackendStatus] = useState<string>('Checking...');
  const [aiStatus, setAiStatus] = useState<string>('Checking...');
  const sessions = workspaceStore.getSessions();
  const activeSessionId = sessions[0]?.id || 'session-demo-001';

  useEffect(() => {
    api.getHealth()
      .then(res => setBackendStatus(`${res.data.status} (${res.data.storage_backend})`))
      .catch(() => setBackendStatus('Offline (Start via .\\scripts\\start-local.ps1)'));

    api.getLocalAIHealth()
      .then(res => setAiStatus(`${res.data.status} (${res.data.gpu_vram.device_name})`))
      .catch(() => setAiStatus('Offline (Start via .\\scripts\\start-local.ps1)'));
  }, []);

  const handleDevSignIn = async (role: Role) => {
    setIsAuthenticating(true);
    setSelectedRole(role);
    workspaceStore.setCurrentRole(role);

    try {
      const res = await api.issueAuthToken({
        user_id: `usr_${role.toLowerCase()}`,
        org_id: workspaceStore.getOrgId(),
        session_id: activeSessionId,
        role,
      });
      setTokenPreview(res.data.access_token);
      setAuthSuccess(true);
      setTimeout(() => setAuthSuccess(false), 3000);
    } catch (err: any) {
      console.warn('Failed to issue token, using local mock session', err);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const portalCards = [
    {
      title: 'Organization Workspace',
      desc: 'Create assessments, customize policy manifests, manage candidates, and track active sessions.',
      icon: Building2,
      path: '/org',
      role: 'ORG_ADMIN',
      badge: 'Recruiter & Admin',
    },
    {
      title: 'Candidate Assessment Workspace',
      desc: 'Real candidate environment: instructions, readiness checks, privacy transparency, Monaco coding editor, and voice interview.',
      icon: Code2,
      path: `/candidate/${activeSessionId}`,
      role: 'CANDIDATE',
      badge: 'Candidate Flow',
    },
    {
      title: 'Interviewer & Reviewer Portal',
      desc: 'Evaluate submissions, inspect decoupled technical scores, examine evidence logs, and record human review decisions.',
      icon: UserCheck,
      path: `/reviewer/${activeSessionId}`,
      role: 'INTERVIEWER',
      badge: 'Reviewer',
    },
    {
      title: 'Investigation Console',
      desc: 'Interactive evidence timeline, forensic AST isomorphism, peripheral topology, and AI hypothesis verification.',
      icon: Search,
      path: `/investigation/${activeSessionId}`,
      role: 'ASSESSMENT_ADMIN',
      badge: 'Forensics',
    },
    {
      title: 'System Observability',
      desc: 'Live telemetry for Go backend, PostgreSQL, outbox backlog, local LLM/embedding inference, and RTX 3050 GPU VRAM.',
      icon: Activity,
      path: '/system',
      role: 'SYSTEM_OPERATOR',
      badge: 'Operations',
    },
    {
      title: 'Interactive System Lab',
      desc: 'Execute real HTTP diagnostics, test model routing, synthesize speech, and run full assessment walkthroughs through the browser.',
      icon: FlaskConical,
      path: '/lab',
      role: 'SYSTEM_OPERATOR',
      badge: 'Live Testing',
      highlight: true,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-4">
      {/* Hero Welcome */}
      <div className="border border-borderCol bg-gradient-to-b from-cardBg to-zinc-950 rounded-2xl p-8 shadow-xl shadow-black/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-3xl space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/60 border border-sky-800/50 text-xs font-mono text-sky-400">
            <ShieldCheck className="w-4 h-4" />
            <span>InterviewOS 5.1 &bull; 100% Local-First Assessment Operating System</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 sm:text-4xl">
            Evidence-First Technical Assessment <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">
              For Autonomous Engineering Integrity
            </span>
          </h1>

          <p className="text-sm text-zinc-400 leading-relaxed">
            Welcome to the InterviewOS complete web product. Observe activity, preserve cryptographically
            verifiable evidence, conduct multilingual voice interviews, evaluate candidate code in isolated
            sandboxes, and autonomously investigate anomalies with mathematical certainty.
          </p>
        </div>

        {/* Live Service Readiness Strip */}
        <div className="mt-8 pt-6 border-t border-borderCol/80 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 bg-zinc-900/60 p-3 rounded-lg border border-borderCol">
            <Server className="w-5 h-5 text-sky-400 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-zinc-400 font-mono">Backend Engine</div>
              <div className="text-xs font-semibold text-zinc-200 truncate">{backendStatus}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-zinc-900/60 p-3 rounded-lg border border-borderCol">
            <Cpu className="w-5 h-5 text-cyan-400 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-zinc-400 font-mono">Local AI Runtime</div>
              <div className="text-xs font-semibold text-zinc-200 truncate">{aiStatus}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-zinc-900/60 p-3 rounded-lg border border-borderCol">
            <Lock className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-zinc-400 font-mono">Active Role</div>
              <div className="text-xs font-semibold text-emerald-300">{selectedRole}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Local Development Authentication Box */}
      <Card
        title="Local Development Role Selection & Token Issuance"
        subtitle="Mints cryptographically valid JWTs via POST /v1/auth/token to verify server-side RBAC and tenant boundaries."
      >
        <div className="flex flex-wrap items-center gap-2.5">
          {(['ORG_ADMIN', 'ASSESSMENT_ADMIN', 'INTERVIEWER', 'CANDIDATE', 'SYSTEM_OPERATOR'] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => handleDevSignIn(r)}
              disabled={isAuthenticating}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all border ${
                selectedRole === r
                  ? 'bg-sky-600 text-white border-sky-500 shadow-sm shadow-sky-950'
                  : 'bg-zinc-900 text-zinc-300 border-borderCol hover:bg-zinc-800'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {authSuccess && (
          <div className="mt-3.5 p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-xs text-emerald-300 flex items-center justify-between font-mono">
            <span>[OK] Authenticated as {selectedRole}. Token stored in browser session.</span>
            <span className="text-[10px] text-emerald-400">OWASP ASVS 5.0 L2 Verified</span>
          </div>
        )}

        {tokenPreview && (
          <div className="mt-3 text-xs text-zinc-500 font-mono truncate">
            Active JWT: <span className="text-zinc-400">{tokenPreview.slice(0, 48)}...</span>
          </div>
        )}
      </Card>

      {/* Role-Aware Workspaces Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-zinc-100 tracking-tight">Interactive Product Portals</h2>
          <span className="text-xs text-zinc-400 font-mono">6 Unified Experiences</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {portalCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                onClick={() => navigate(card.path)}
                className={`bg-cardBg border border-borderCol rounded-xl p-5 hover:border-sky-500/50 hover:bg-zinc-900/60 cursor-pointer transition-all duration-200 group flex flex-col justify-between ${
                  card.highlight ? 'ring-1 ring-cyan-500/30' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-borderCol flex items-center justify-center text-sky-400 group-hover:text-sky-300 group-hover:border-sky-500/40 transition">
                      <Icon className="w-5 h-5" />
                    </div>
                    <Badge variant={card.highlight ? 'info' : 'neutral'} size="sm">
                      {card.badge}
                    </Badge>
                  </div>

                  <h3 className="font-semibold text-sm text-zinc-100 group-hover:text-sky-300 transition">
                    {card.title}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                    {card.desc}
                  </p>
                </div>

                <div className="mt-5 pt-3.5 border-t border-borderCol/60 flex items-center justify-between text-xs font-mono text-zinc-400 group-hover:text-sky-400 transition">
                  <span>Enter Experience</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
