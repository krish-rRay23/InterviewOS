import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  Building2,
  Code2,
  UserCheck,
  Search,
  Activity,
  FlaskConical,
  PlusCircle,
  Cpu,
  Server,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { workspaceStore } from '../../api/workspaceStore';
import { api } from '../../api/client';
import { Role } from '../../types';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentRole, setCurrentRole] = useState<Role>(workspaceStore.getCurrentRole());
  const [backendHealth, setBackendHealth] = useState<'healthy' | 'offline' | 'checking'>('checking');
  const [aiHealth, setAiHealth] = useState<'healthy' | 'degraded' | 'offline' | 'checking'>('checking');
  const [sessions, setSessions] = useState(workspaceStore.getSessions());
  const [activeSessionId, setActiveSessionId] = useState<string>(
    sessions[0]?.id || 'session-live-001'
  );

  // Poll health state periodically
  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const res = await api.getHealth();
        if (mounted) setBackendHealth(res.data.status === 'healthy' ? 'healthy' : 'offline');
      } catch {
        if (mounted) setBackendHealth('offline');
      }

      try {
        const res = await api.getLocalAIHealth();
        if (mounted) setAiHealth(res.data.status);
      } catch {
        if (mounted) setAiHealth('offline');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000); // Every 15s
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Update sessions list on storage changes
  useEffect(() => {
    const list = workspaceStore.getSessions();
    setSessions(list);
    if (list.length > 0 && !list.find(s => s.id === activeSessionId)) {
      setActiveSessionId(list[0].id);
    }
  }, [location.pathname]);

  const handleRoleChange = async (newRole: Role) => {
    setCurrentRole(newRole);
    workspaceStore.setCurrentRole(newRole);
    try {
      await api.issueAuthToken({
        user_id: workspaceStore.getUserId(),
        org_id: workspaceStore.getOrgId(),
        session_id: activeSessionId,
        role: newRole,
      });
    } catch {
      // Local dev token fallback
    }
  };

  const navItems = [
    { label: 'Overview', to: '/org', icon: Building2 },
    { label: 'Create Assessment', to: '/org/assessments/new', icon: PlusCircle },
    { label: 'Candidate Portal', to: `/candidate/${activeSessionId}`, icon: Code2 },
    { label: 'Reviewer Portal', to: `/reviewer/${activeSessionId}`, icon: UserCheck },
    { label: 'Investigation Console', to: `/investigation/${activeSessionId}`, icon: Search },
    { label: 'System Observability', to: '/system', icon: Activity },
    { label: 'System Lab', to: '/lab', icon: FlaskConical, highlight: true },
  ];

  return (
    <div className="flex min-h-screen bg-darkBg text-zinc-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-borderCol bg-zinc-950/80 flex flex-col justify-between flex-shrink-0 z-20">
        <div>
          {/* Logo Header */}
          <div className="p-5 border-b border-borderCol flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shadow-sm shadow-sky-950">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm tracking-wide text-zinc-100 flex items-center gap-1.5">
                INTERVIEW<span className="text-sky-400">OS</span>
              </div>
              <div className="text-[10px] font-mono text-zinc-400 tracking-wider">
                v5.1 PRODUCT SUITE
              </div>
            </div>
          </div>

          {/* Role Context Selector */}
          <div className="p-3.5 mx-3 mt-3.5 rounded-lg bg-cardBg border border-borderCol/90 text-xs">
            <div className="text-[11px] font-mono uppercase text-zinc-400 mb-1.5 flex items-center justify-between">
              <span>Local Dev Role</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="relative">
              <select
                value={currentRole}
                onChange={(e) => handleRoleChange(e.target.value as Role)}
                aria-label="Local Dev Role"
                className="w-full bg-zinc-900 border border-borderCol rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-200 focus:outline-none focus:border-sky-500 transition appearance-none cursor-pointer"
              >
                <option value="ORG_ADMIN">Org Admin (Recruiter)</option>
                <option value="ASSESSMENT_ADMIN">Assessment Admin</option>
                <option value="INTERVIEWER">Interviewer / Reviewer</option>
                <option value="CANDIDATE">Candidate</option>
                <option value="SYSTEM_OPERATOR">System Operator</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 mt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-sky-600/15 text-sky-400 border border-sky-500/30 shadow-sm shadow-sky-950/40'
                        : item.highlight
                        ? 'text-cyan-300 hover:bg-cyan-950/20 hover:text-cyan-200 border border-cyan-800/20'
                        : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-100'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Connectivity Status */}
        <div className="p-3.5 m-3 rounded-lg bg-zinc-900/60 border border-borderCol text-xs space-y-2">
          <div className="text-[10px] font-mono uppercase text-zinc-400 flex items-center justify-between">
            <span>Service Status</span>
            <Layers className="w-3 h-3 text-zinc-400" />
          </div>

          {/* Backend Status */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Server className="w-3.5 h-3.5 text-zinc-400" />
              Backend :8080
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                backendHealth === 'healthy'
                  ? 'text-emerald-400 bg-emerald-950/50'
                  : 'text-rose-400 bg-rose-950/50'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  backendHealth === 'healthy' ? 'bg-emerald-400' : 'bg-rose-400'
                }`}
              />
              {backendHealth}
            </span>
          </div>

          {/* Local AI Status */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Cpu className="w-3.5 h-3.5 text-zinc-400" />
              Local AI :8000
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                aiHealth === 'healthy'
                  ? 'text-emerald-400 bg-emerald-950/50'
                  : aiHealth === 'degraded'
                  ? 'text-amber-400 bg-amber-950/50'
                  : 'text-rose-400 bg-rose-950/50'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  aiHealth === 'healthy'
                    ? 'bg-emerald-400'
                    : aiHealth === 'degraded'
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
              />
              {aiHealth}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Context Bar */}
        <header className="h-14 border-b border-borderCol bg-zinc-950/50 px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase text-zinc-400">Context Session:</span>
            {sessions.length > 0 ? (
              <select
                value={activeSessionId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setActiveSessionId(newId);
                  // Update path if on candidate or reviewer route
                  if (location.pathname.startsWith('/candidate/')) {
                    navigate(`/candidate/${newId}`);
                  } else if (location.pathname.startsWith('/reviewer/')) {
                    navigate(`/reviewer/${newId}`);
                  } else if (location.pathname.startsWith('/investigation/')) {
                    navigate(`/investigation/${newId}`);
                  }
                }}
                aria-label="Context Session"
                className="bg-cardBg border border-borderCol rounded-md px-2.5 py-1 text-xs font-mono text-sky-400 focus:outline-none focus:border-sky-500"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id.slice(0, 24)}... ({s.session_state})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-mono text-zinc-400">
                No active session (create in Wizard or Lab)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 font-mono">
              Mode: <span className="text-zinc-200">100% Offline / Local-First</span>
            </span>
            <div className="h-4 w-px bg-borderCol" />
            <button
              onClick={() => navigate('/lab')}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Launch Lab</span>
            </button>
          </div>
        </header>

        {/* Child Workspace Route Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
};
