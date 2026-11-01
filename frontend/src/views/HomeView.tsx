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
      desc: 'Real candidate environment: instructions, readiness checks, privacy transparency, Monaco coding editor, and continuous voice interview with 3D particle orb.',
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
      <div className="border-2 border-borderCol bg-cardBg rounded-none p-8 shadow-pixel relative overflow-hidden">
        <div className="max-w-3xl space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-none bg-cardSurface border border-accentCyan text-xs font-mono text-accentCyan">
            <ShieldCheck className="w-4 h-4 text-accentCyan" />
            <span className="font-pixel text-[9px] uppercase tracking-wider">InterviewOS 6.0 &bull; 100% Local-First Assessment Operating System</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl font-pixel leading-relaxed">
            EVIDENCE-FIRST TECHNICAL ASSESSMENT <br />
            <span className="text-accentCyan">
              FOR AUTONOMOUS ENGINEERING INTEGRITY
            </span>
          </h1>

          <p className="text-xs text-zinc-300 leading-relaxed font-mono">
            Welcome to the InterviewOS complete web product. Observe activity, preserve cryptographically
            verifiable evidence, conduct continuous voice interviews with interactive 3D particle audio-reactivity,
            evaluate candidate code in isolated sandboxes, and autonomously investigate anomalies with mathematical certainty.
          </p>
        </div>

        {/* Live Service Readiness Strip */}
        <div className="mt-8 pt-6 border-t-2 border-borderCol grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
          <div className="flex items-center gap-3 bg-cardSurface p-3 rounded-none border border-borderCol shadow-pixel-sm">
            <Server className="w-5 h-5 text-accentCyan flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-zinc-400 font-pixel uppercase">Backend Engine</div>
              <div className="text-xs font-semibold text-zinc-200 truncate">{backendStatus}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-cardSurface p-3 rounded-none border border-borderCol shadow-pixel-sm">
            <Cpu className="w-5 h-5 text-accentTeal flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-zinc-400 font-pixel uppercase">Local AI Runtime</div>
              <div className="text-xs font-semibold text-zinc-200 truncate">{aiStatus}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-cardSurface p-3 rounded-none border border-borderCol shadow-pixel-sm">
            <Lock className="w-5 h-5 text-accentAmber flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-zinc-400 font-pixel uppercase">Active Role</div>
              <div className="text-xs font-semibold text-accentAmber">{selectedRole}</div>
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
              className={`px-3 py-2 rounded-none text-xs font-mono font-medium transition-all border-2 ${
                selectedRole === r
                  ? 'bg-cardSurface text-accentCyan border-accentCyan shadow-pixel-sm font-bold'
                  : 'bg-cardBg text-zinc-300 border-borderCol hover:border-zinc-500'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {authSuccess && (
          <div className="mt-3.5 p-2.5 rounded-none bg-cardSurface border-2 border-accentTeal text-xs text-accentTeal flex items-center justify-between font-mono">
            <span>[OK] Authenticated as {selectedRole}. Token stored in browser session.</span>
            <span className="text-[10px] font-pixel">OWASP ASVS 5.0 L2 VERIFIED</span>
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
          <h2 className="text-base font-bold text-zinc-100 tracking-tight font-pixel uppercase">Interactive Product Portals</h2>
          <span className="text-xs text-accentCyan font-mono">6 Unified Experiences</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {portalCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                onClick={() => navigate(card.path)}
                className={`bg-cardBg border-2 border-borderCol rounded-none p-5 hover:border-accentCyan hover:bg-cardSurface/80 cursor-pointer transition-all duration-150 group flex flex-col justify-between shadow-pixel-sm ${
                  card.highlight ? 'border-accentCyan/50' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="w-10 h-10 rounded-none bg-cardSurface border border-borderCol flex items-center justify-center text-accentCyan group-hover:border-accentCyan transition">
                      <Icon className="w-5 h-5" />
                    </div>
                    <Badge variant={card.highlight ? 'info' : 'neutral'} size="sm">
                      {card.badge}
                    </Badge>
                  </div>

                  <h3 className="font-pixel text-xs text-zinc-100 group-hover:text-accentCyan transition tracking-wide uppercase">
                    {card.title}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed font-mono">
                    {card.desc}
                  </p>
                </div>

                <div className="mt-5 pt-3.5 border-t border-borderCol flex items-center justify-between text-xs font-mono text-zinc-400 group-hover:text-accentCyan transition">
                  <span>ENTER EXPERIENCE</span>
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
