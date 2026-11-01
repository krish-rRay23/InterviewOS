import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  Building2,
  FileCheck,
  Shield,
  UserPlus,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  Code2,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { api } from '../api/client';
import { workspaceStore } from '../api/workspaceStore';
import { AssessmentPolicy, AssessmentMode } from '../types';

export const AssessmentWizardView: React.FC = () => {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Form State
  const [orgName, setOrgName] = useState<string>('Acme Engineering Corp');
  const [orgSlug, setOrgSlug] = useState<string>('acme-eng');
  const [createdOrgId, setCreatedOrgId] = useState<string>('');

  const [assessmentTitle, setAssessmentTitle] = useState<string>('Senior Backend Systems Engineer');
  const [assessmentMode, setAssessmentMode] = useState<AssessmentMode>('AI_PROHIBITED');
  const [createdAssessmentId, setCreatedAssessmentId] = useState<string>('');

  const [policy, setPolicy] = useState<AssessmentPolicy>({
    version: 1,
    max_displays: 1,
    allow_external_ide: false,
    allow_usb_storage: false,
    strict_etw: true,
    prohibited_process_names: ['anydesk.exe', 'teamviewer.exe', 'vncserver.exe'],
    permitted_process_names: ['code.exe'],
    investigation_budget_usd: 5.0,
    max_agent_tool_calls: 25,
  });

  const [candName, setCandName] = useState<string>('Alex Mercer');
  const [candEmail, setCandEmail] = useState<string>('alex.mercer@example.com');
  const [createdCandId, setCreatedCandId] = useState<string>('');

  const [createdSessionId, setCreatedSessionId] = useState<string>('');

  // Step 1: Create Organization
  const handleStep1 = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.createOrganization({ name: orgName, slug: orgSlug });
      setCreatedOrgId(res.data.id);
      workspaceStore.setOrgId(res.data.id);
      setCurrentStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Create Assessment
  const handleStep2 = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.createAssessment({
        organization_id: createdOrgId,
        title: assessmentTitle,
        mode: assessmentMode,
      });
      setCreatedAssessmentId(res.data.id);
      setCurrentStep(3);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create assessment');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Save Policy Manifest
  const handleStep3 = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await api.savePolicy(createdAssessmentId, policy);
      setCurrentStep(4);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save policy');
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Register Candidate
  const handleStep4 = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.createCandidate({
        organization_id: createdOrgId,
        full_name: candName,
        email: candEmail,
      });
      setCreatedCandId(res.data.id);

      // Now immediately create session
      const sessRes = await api.createSession({
        assessment_id: createdAssessmentId,
        candidate_id: res.data.id,
      });
      setCreatedSessionId(sessRes.data.id);
      setCurrentStep(5);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register candidate or create session');
    } finally {
      setLoading(false);
    }
  };

  const copySessionLink = () => {
    const link = `${window.location.origin}/candidate/${createdSessionId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Wizard Header */}
      <div className="flex items-center justify-between pb-3 border-b border-borderCol">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-sky-400" />
            <span>Assessment Creation Wizard</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Step-by-step creation of Organization, Assessment, Policy Manifest, Candidate, and Session.
          </p>
        </div>

        <Badge variant="info" size="sm">
          Step {currentStep} of 5
        </Badge>
      </div>

      {/* Progress Stepper */}
      <div className="grid grid-cols-5 gap-2 text-center text-xs font-mono">
        {[
          { num: 1, label: 'Org' },
          { num: 2, label: 'Assessment' },
          { num: 3, label: 'Policy' },
          { num: 4, label: 'Candidate' },
          { num: 5, label: 'Ready' },
        ].map((s) => (
          <div
            key={s.num}
            className={`py-2 px-1 rounded-lg border transition ${
              currentStep === s.num
                ? 'bg-sky-600/20 text-sky-300 border-sky-500/60 font-semibold'
                : currentStep > s.num
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                : 'bg-zinc-900/40 text-zinc-500 border-borderCol'
            }`}
          >
            {s.num}. {s.label}
          </div>
        ))}
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-xs text-rose-300 font-mono">
          [Error] {errorMsg}
        </div>
      )}

      {/* Step 1: Organization */}
      {currentStep === 1 && (
        <Card
          title="Step 1: Organization Details"
          subtitle="Define or select the hiring tenant entity."
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Organization Name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full bg-zinc-900 border border-borderCol rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-sky-500"
                placeholder="e.g. Acme Corporation"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">URL Identifier (Slug)</label>
              <input
                type="text"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value)}
                className="w-full bg-zinc-900 border border-borderCol rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-sky-500"
                placeholder="acme-corp"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="primary"
                onClick={handleStep1}
                isLoading={loading}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Create Organization & Continue
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Assessment */}
      {currentStep === 2 && (
        <Card
          title="Step 2: Assessment Title & Mode"
          subtitle="Configure the evaluation criteria and AI collaboration boundaries."
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Assessment Title</label>
              <input
                type="text"
                value={assessmentTitle}
                onChange={(e) => setAssessmentTitle(e.target.value)}
                className="w-full bg-zinc-900 border border-borderCol rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-sky-500"
                placeholder="e.g. Senior Distributed Systems Engineer"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Assessment Mode</label>
              <select
                value={assessmentMode}
                onChange={(e) => setAssessmentMode(e.target.value as AssessmentMode)}
                className="w-full bg-zinc-900 border border-borderCol rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-sky-500"
              >
                <option value="AI_PROHIBITED">AI_PROHIBITED — Strict independent problem solving</option>
                <option value="AI_COLLABORATIVE">AI_COLLABORATIVE — AI assistant permitted with forensic tracking</option>
                <option value="UNRESTRICTED">UNRESTRICTED — Open web and environment access</option>
              </select>
            </div>

            <div className="pt-2 flex justify-between">
              <Button variant="ghost" onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <Button
                variant="primary"
                onClick={handleStep2}
                isLoading={loading}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Create Assessment & Continue
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 3: Policy Manifest */}
      {currentStep === 3 && (
        <Card
          title="Step 3: Endpoint Policy Manifest"
          subtitle="Deterministic parameters enforced by the native Windows endpoint runtime."
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Max Displays</label>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={policy.max_displays}
                  onChange={(e) => setPolicy({ ...policy, max_displays: parseInt(e.target.value) || 1 })}
                  className="w-full bg-zinc-900 border border-borderCol rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Investigation Budget (USD)</label>
                <input
                  type="number"
                  step="0.5"
                  value={policy.investigation_budget_usd}
                  onChange={(e) => setPolicy({ ...policy, investigation_budget_usd: parseFloat(e.target.value) || 5.0 })}
                  className="w-full bg-zinc-900 border border-borderCol rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.allow_external_ide}
                  onChange={(e) => setPolicy({ ...policy, allow_external_ide: e.target.checked })}
                  className="rounded border-zinc-700 bg-zinc-900 text-sky-500 focus:ring-0"
                />
                <span className="text-zinc-300">Allow External Desktop IDE (e.g. VS Code, Visual Studio)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.allow_usb_storage}
                  onChange={(e) => setPolicy({ ...policy, allow_usb_storage: e.target.checked })}
                  className="rounded border-zinc-700 bg-zinc-900 text-sky-500 focus:ring-0"
                />
                <span className="text-zinc-300">Allow USB Storage Devices</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.strict_etw}
                  onChange={(e) => setPolicy({ ...policy, strict_etw: e.target.checked })}
                  className="rounded border-zinc-700 bg-zinc-900 text-sky-500 focus:ring-0"
                />
                <span className="text-zinc-300">Strict ETW Kernel Process Lifecycle Monitoring</span>
              </label>
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Prohibited Processes (Comma-separated)</label>
              <input
                type="text"
                value={policy.prohibited_process_names.join(', ')}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    prohibited_process_names: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
                className="w-full bg-zinc-900 border border-borderCol rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="pt-2 flex justify-between">
              <Button variant="ghost" onClick={() => setCurrentStep(2)}>
                Back
              </Button>
              <Button
                variant="primary"
                onClick={handleStep3}
                isLoading={loading}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Save Policy Manifest & Continue
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 4: Candidate Registration */}
      {currentStep === 4 && (
        <Card
          title="Step 4: Register Candidate & Create Session"
          subtitle="Enrolls the candidate and generates their unique cryptographic session token."
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Candidate Full Name</label>
              <input
                type="text"
                value={candName}
                onChange={(e) => setCandName(e.target.value)}
                className="w-full bg-zinc-900 border border-borderCol rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-sky-500"
                placeholder="e.g. Alex Mercer"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Candidate Email Address</label>
              <input
                type="email"
                value={candEmail}
                onChange={(e) => setCandEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-borderCol rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-sky-500"
                placeholder="alex.mercer@example.com"
              />
            </div>

            <div className="pt-2 flex justify-between">
              <Button variant="ghost" onClick={() => setCurrentStep(3)}>
                Back
              </Button>
              <Button
                variant="primary"
                onClick={handleStep4}
                isLoading={loading}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Register Candidate & Generate Session
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 5: Confirmation */}
      {currentStep === 5 && (
        <Card
          title="Assessment Session Successfully Created"
          subtitle="All entities have been created on the live server and indexed locally."
        >
          <div className="space-y-5 text-xs">
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-emerald-300 text-sm">
                  Candidate Session Active & Ready
                </div>
                <div className="text-zinc-300 mt-1 leading-relaxed">
                  The candidate can now enter the assessment portal using the dedicated session link.
                </div>
              </div>
            </div>

            <div className="space-y-2 font-mono text-[11px] bg-zinc-900/80 p-4 rounded-xl border border-borderCol">
              <div className="flex justify-between py-1 border-b border-borderCol/50">
                <span className="text-zinc-400">Session ID:</span>
                <span className="text-sky-400 font-semibold">{createdSessionId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-borderCol/50">
                <span className="text-zinc-400">Assessment ID:</span>
                <span className="text-zinc-200">{createdAssessmentId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-borderCol/50">
                <span className="text-zinc-400">Candidate ID:</span>
                <span className="text-zinc-200">{createdCandId}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">Organization ID:</span>
                <span className="text-zinc-200">{createdOrgId}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={copySessionLink}
                icon={copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                className="flex-1"
              >
                {copiedLink ? 'Copied Candidate Link!' : 'Copy Candidate Link'}
              </Button>

              <Button
                variant="primary"
                onClick={() => navigate(`/candidate/${createdSessionId}`)}
                icon={<Code2 className="w-4 h-4" />}
                className="flex-1"
              >
                Open Candidate Workspace
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
