import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  PlusCircle,
  Users,
  Code2,
  FileCheck,
  ExternalLink,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  FlaskConical,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { workspaceStore } from '../api/workspaceStore';
import { api } from '../api/client';
import { BackendHealth, Assessment, Candidate, Session } from '../types';

export const OrganizationView: React.FC = () => {
  const navigate = useNavigate();

  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    // Load local index
    setAssessments(workspaceStore.getAssessments());
    setCandidates(workspaceStore.getCandidates());
    setSessions(workspaceStore.getSessions());

    // Fetch live backend metrics
    api.getHealth()
      .then(res => setHealth(res.data))
      .catch(() => setHealth(null));
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-borderCol">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-sky-400" />
            <span>Organization Management & Recruiter Dashboard</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage assessment policies, register candidates, track live sessions, and review evaluated code submissions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/lab')}
            icon={<FlaskConical className="w-3.5 h-3.5 text-cyan-400" />}
          >
            System Lab Walkthrough
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/org/assessments/new')}
            icon={<PlusCircle className="w-4 h-4" />}
          >
            Create Assessment
          </Button>
        </div>
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-cardBg border border-borderCol rounded-xl p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
            <span>Assessments</span>
            <FileCheck className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-100 mt-2 font-mono">
            {assessments.length}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Locally indexed & verified</div>
        </div>

        <div className="bg-cardBg border border-borderCol rounded-xl p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
            <span>Candidates</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-100 mt-2 font-mono">
            {candidates.length}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Registered participants</div>
        </div>

        <div className="bg-cardBg border border-borderCol rounded-xl p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
            <span>Active Sessions</span>
            <Code2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-100 mt-2 font-mono">
            {sessions.length}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Lifecycle sessions</div>
        </div>

        <div className="bg-cardBg border border-borderCol rounded-xl p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
            <span>Storage Engine</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-base font-bold text-zinc-200 mt-2 truncate font-mono">
            {health?.storage_backend || 'Checking...'}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Backlog: {health ? `${health.outbox_backlog} msgs` : 'N/A'}
          </div>
        </div>
      </div>

      {/* Recent Sessions Table */}
      <Card
        title="Candidate Assessment Sessions"
        subtitle="Live sessions created through the API. Click any session to enter the candidate, reviewer, or investigation view."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/org/assessments/new')}
            icon={<PlusCircle className="w-3.5 h-3.5" />}
          >
            New Session
          </Button>
        }
      >
        {sessions.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-borderCol flex items-center justify-center text-zinc-500 mx-auto">
              <Code2 className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-zinc-200">No Assessment Sessions Created Yet</div>
            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
              Use the Assessment Wizard or the System Lab to create your first organization, assessment, candidate, and session.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/org/assessments/new')}
              >
                Launch Assessment Wizard
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/lab')}
              >
                Run 1-Click Lab Test
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-borderCol/80 text-zinc-400 font-mono text-[11px]">
                  <th className="pb-3 font-semibold">Session ID</th>
                  <th className="pb-3 font-semibold">Assessment</th>
                  <th className="pb-3 font-semibold">Candidate</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Technical Result</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderCol/50">
                {sessions.map((sess) => {
                  const asmt = assessments.find(a => a.id === sess.assessment_id);
                  const cand = candidates.find(c => c.id === sess.candidate_id);

                  return (
                    <tr key={sess.id} className="hover:bg-zinc-900/40 transition">
                      <td className="py-3 font-mono text-sky-400 font-medium">
                        {sess.id.slice(0, 20)}...
                      </td>
                      <td className="py-3 text-zinc-200">
                        {asmt ? asmt.title : sess.assessment_id.slice(0, 16)}
                      </td>
                      <td className="py-3 text-zinc-300">
                        {cand ? cand.full_name : sess.candidate_id.slice(0, 16)}
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={sess.session_state === 'COMPLETED' ? 'success' : 'neutral'}
                          size="sm"
                        >
                          {sess.session_state}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={
                            sess.technical_result === 'PASSED'
                              ? 'success'
                              : sess.technical_result === 'FAILED'
                              ? 'danger'
                              : 'warning'
                          }
                          size="sm"
                        >
                          {sess.technical_result}
                        </Badge>
                      </td>
                      <td className="py-3 text-right space-x-1.5 font-mono">
                        <button
                          onClick={() => navigate(`/candidate/${sess.id}`)}
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sky-400 transition"
                          title="Open Candidate Workspace"
                        >
                          Candidate
                        </button>
                        <button
                          onClick={() => navigate(`/reviewer/${sess.id}`)}
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-400 transition"
                          title="Open Reviewer Portal"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => navigate(`/investigation/${sess.id}`)}
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-purple-400 transition"
                          title="Open Investigation Console"
                        >
                          Forensics
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Two Column Section: Assessments & Candidates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Assessments List */}
        <Card
          title="Configured Assessments"
          subtitle="Policy templates and evaluation modes"
        >
          {assessments.length === 0 ? (
            <div className="text-xs text-zinc-500 py-6 text-center font-mono">
              No assessments created yet. Click "Create Assessment" above.
            </div>
          ) : (
            <div className="space-y-2.5">
              {assessments.map(a => (
                <div key={a.id} className="p-3 rounded-lg bg-zinc-900/60 border border-borderCol flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-zinc-200">{a.title}</div>
                    <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      ID: {a.id.slice(0, 18)}...
                    </div>
                  </div>
                  <Badge variant={a.mode === 'AI_PROHIBITED' ? 'warning' : 'info'} size="sm">
                    {a.mode}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Registered Candidates */}
        <Card
          title="Registered Candidates"
          subtitle="Enrolled participants linked to assessments"
        >
          {candidates.length === 0 ? (
            <div className="text-xs text-zinc-500 py-6 text-center font-mono">
              No candidates registered yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {candidates.map(c => (
                <div key={c.id} className="p-3 rounded-lg bg-zinc-900/60 border border-borderCol flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-zinc-200">{c.full_name}</div>
                    <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                      {c.email}
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-500">
                    {new Date(c.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
