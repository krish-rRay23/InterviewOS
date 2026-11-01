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
    <div className="flex min-h-screen bg-darkBg text-zinc-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r-2 border-borderCol bg-cardBg/95 flex flex-col justify-between flex-shrink-0 z-20 backdrop-blur-md">
        <div>
          {/* Logo Header */}
          <div className="p-4 border-b-2 border-borderCol flex items-center gap-3 bg-cardSurface/40">
            <div className="w-9 h-9 rounded-none bg-cardSurface border-2 border-accentCyan flex items-center justify-center text-accentCyan shadow-pixel-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-pixel text-xs tracking-wider text-zinc-100 flex items-center gap-1.5">
                INTERVIEW<span className="text-accentCyan">OS</span>
              </div>
              <div className="text-[9px] font-mono text-accentTeal tracking-wider mt-0.5">
                v6.0 FINAL RELEASE
              </div>
            </div>
          </div>

          {/* Role Context Selector */}
          <div className="p-3 mx-3 mt-3.5 rounded-none bg-cardSurface border border-borderCol text-xs shadow-pixel-sm">
            <div className="text-[9px] font-pixel uppercase text-zinc-400 mb-1.5 flex items-center justify-between">
              <span>ACTIVE ROLE</span>
              <span className="w-1.5 h-1.5 rounded-none bg-accentTeal animate-pulse" />
            </div>
            <div className="relative">
              <select
                value={currentRole}
                onChange={(e) => handleRoleChange(e.target.value as Role)}
                aria-label="Local Dev Role"
                className="w-full bg-cardBg border border-borderCol rounded-none px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-accentCyan transition appearance-none cursor-pointer"
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
          <nav className="p-3 space-y-1.5 mt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-none text-xs font-mono transition-all ${
                      isActive
                        ? 'bg-cardSurface text-accentCyan border-2 border-accentCyan shadow-pixel-sm font-semibold'
                        : item.highlight
                        ? 'text-accentCyan hover:bg-cardSurface/60 hover:text-white border border-accentCyan/30'
                        : 'text-zinc-400 hover:bg-cardSurface/60 hover:text-zinc-100 border border-transparent'
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
        <div className="p-3 m-3 rounded-none bg-cardSurface/90 border-2 border-borderCol text-xs space-y-2 shadow-pixel-sm font-mono">
          <div className="text-[9px] font-pixel uppercase text-zinc-400 flex items-center justify-between">
            <span>CORE SERVICES</span>
            <Layers className="w-3 h-3 text-accentCyan" />
          </div>

          {/* Backend Status */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Server className="w-3.5 h-3.5 text-zinc-400" />
              Go Backend :8080
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[9px] font-pixel px-1.5 py-0.5 rounded-none border ${
                backendHealth === 'healthy'
                  ? 'text-accentTeal bg-cardBg border-accentTeal/60'
                  : 'text-accentRose bg-cardBg border-accentRose/60'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-none ${
                  backendHealth === 'healthy' ? 'bg-accentTeal' : 'bg-accentRose'
                }`}
              />
              {backendHealth.toUpperCase()}
            </span>
          </div>

          {/* Local AI Status */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Cpu className="w-3.5 h-3.5 text-zinc-400" />
              Local AI :8000
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[9px] font-pixel px-1.5 py-0.5 rounded-none border ${
                aiHealth === 'healthy'
                  ? 'text-accentTeal bg-cardBg border-accentTeal/60'
                  : aiHealth === 'degraded'
                  ? 'text-accentAmber bg-cardBg border-accentAmber/60'
                  : 'text-accentRose bg-cardBg border-accentRose/60'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-none ${
                  aiHealth === 'healthy'
                    ? 'bg-accentTeal'
                    : aiHealth === 'degraded'
                    ? 'bg-accentAmber'
                    : 'bg-accentRose'
                }`}
              />
              {aiHealth.toUpperCase()}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Context Bar */}
        <header className="h-14 border-b-2 border-borderCol bg-cardBg/90 px-6 flex items-center justify-between flex-shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-pixel uppercase text-zinc-400">SESSION:</span>
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
                className="bg-cardSurface border border-borderCol rounded-none px-2.5 py-1 text-xs font-mono text-accentCyan focus:outline-none focus:border-accentCyan cursor-pointer"
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
              MODE: <span className="text-accentTeal font-semibold">100% OFFLINE / LOCAL-FIRST</span>
            </span>
            <div className="h-4 w-px bg-borderCol" />
            <button
              onClick={() => navigate('/lab')}
              className="text-xs font-mono text-accentCyan hover:text-[#38f9d7] flex items-center gap-1.5 transition"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>LAUNCH LAB</span>
            </button>
          </div>
        </header>

        {/* Child Workspace Route Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
};
