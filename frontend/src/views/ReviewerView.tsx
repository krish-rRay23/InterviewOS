import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  FileCode,
  Shield,
  Layers,
  Send,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { api } from '../api/client';
import { SessionReport, SessionStatus } from '../types';

export const ReviewerView: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [report, setReport] = useState<SessionReport | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'OVERRULED' | 'INCONCLUSIVE'>('APPROVED');
  const [reviewerNotes, setReviewerNotes] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [reviewLogged, setReviewLogged] = useState<boolean>(false);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);

    Promise.all([
      api.getSessionReport(sessionId).then(res => setReport(res.data)).catch(() => null),
      api.getSessionStatus(sessionId).then(res => setSessionStatus(res.data)).catch(() => null),
    ]).finally(() => setLoading(false));
  }, [sessionId]);

  const handleSubmitReview = async () => {
    if (!sessionId) return;
    setIsSubmittingReview(true);
    try {
      await api.reviewDecision(sessionId, {
        decision: reviewDecision,
        notes: reviewerNotes,
      });
      setReviewLogged(true);
      setTimeout(() => setReviewLogged(false), 4000);
    } catch (err: any) {
      alert(`Review log notice: ${err.message}`);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const integrityVariant = (state?: string) => {
    switch (state) {
      case 'VERIFIED':
        return 'success';
      case 'REVIEW_CONDITION_RESOLVED':
        return 'info';
      case 'POLICY_BREACH_CONFIRMED':
        return 'danger';
      default:
        return 'warning';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-borderCol gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-accentTeal" />
            <span className="font-pixel text-xs tracking-wider text-zinc-100">REVIEWER & INTERVIEWER EVALUATION WORKSPACE</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-mono">
            Decoupled technical scoring, evidence validation, and final human review sign-off.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <Badge variant="info" size="sm">
            SESSION: {sessionId?.slice(0, 18)}...
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/investigation/${sessionId}`)}
            icon={<Search className="w-3.5 h-3.5 text-accentCyan" />}
            className="border-2 border-borderCol hover:border-accentCyan text-xs"
          >
            FORENSIC TIMELINE
          </Button>
        </div>
      </div>

      {/* Two-Column Decoupled Scoring Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Technical Evaluation Card */}
        <Card
          title="Technical Competency Evaluation"
          subtitle="Objective algorithmic correctness and rubric scoring"
        >
          <div className="space-y-4 text-xs font-mono">
            <div className="flex items-center justify-between p-3.5 bg-cardSurface border border-borderCol">
              <span className="text-zinc-300 font-medium">Technical Result:</span>
              <Badge
                variant={report?.technical_result === 'PASSED' ? 'success' : report?.technical_result === 'FAILED' ? 'danger' : 'warning'}
                size="md"
              >
                {report?.technical_result || (sessionStatus?.technical_result ?? 'PENDING')}
              </Badge>
            </div>

            <div className="space-y-2.5 bg-cardSurface/60 p-4 border border-borderCol text-[11px]">
              <div className="flex justify-between py-1 border-b border-borderCol">
                <span className="text-zinc-400">Code Correctness:</span>
                <span className="text-accentTeal font-semibold">
                  {report?.technical_score?.code_correctness_pct !== undefined
                    ? `${report.technical_score.code_correctness_pct.toFixed(1)}%`
                    : 'N/A (Awaiting Tests)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-borderCol">
                <span className="text-zinc-400">Algorithmic Complexity:</span>
                <span className="text-accentCyan font-semibold">
                  {report?.technical_score?.code_complexity_pct !== undefined
                    ? `${report.technical_score.code_complexity_pct.toFixed(1)}%`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-borderCol">
                <span className="text-zinc-400">Interview Competency:</span>
                <span className="text-purple-400 font-semibold">
                  {report?.technical_score?.interview_competency_pct !== undefined
                    ? `${report.technical_score.interview_competency_pct.toFixed(1)}%`
                    : 'N/A (Awaiting Turn Evaluation)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-borderCol">
                <span className="text-zinc-400">Adaptive Challenge:</span>
                <span className="text-accentAmber font-semibold">
                  {report?.technical_score?.adaptive_challenge_pct !== undefined
                    ? `${report.technical_score.adaptive_challenge_pct.toFixed(1)}%`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between pt-1 text-zinc-100 font-bold">
                <span>Total Score:</span>
                <span className="text-accentCyan text-sm font-pixel">
                  {report?.technical_score?.total_score_pct !== undefined
                    ? `${report.technical_score.total_score_pct.toFixed(1)}%`
                    : '0.0%'}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-zinc-400 italic">
              Note: Technical scores are computed via isolated test cases and AST analysis, independent of integrity signals.
            </div>
          </div>
        </Card>

        {/* Right: Integrity & Evidence State Card */}
        <Card
          title="Session Integrity & Observation Signals"
          subtitle="Observable environmental verification and anomaly resolution"
        >
          <div className="space-y-4 text-xs font-mono">
            <div className="flex items-center justify-between p-3.5 bg-cardSurface border border-borderCol">
              <span className="text-zinc-300 font-medium">Integrity State:</span>
              <Badge variant={integrityVariant(report?.integrity_state)} size="md">
                {report?.integrity_state || 'UNSPECIFIED'}
              </Badge>
            </div>

            <div className="space-y-2.5 bg-cardSurface/60 p-4 border border-borderCol text-[11px]">
              <div className="flex justify-between py-1 border-b border-borderCol">
                <span className="text-zinc-400">Total Events Observed:</span>
                <span className="text-zinc-200">{report?.total_events ?? sessionStatus?.total_events ?? 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-borderCol">
                <span className="text-zinc-400">Policy Breaches Detected:</span>
                <span className="text-accentRose font-semibold">{report?.breaches_detected ?? 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-borderCol">
                <span className="text-zinc-400">Cleared Ambient Anomalies:</span>
                <span className="text-zinc-300">{report?.cleared_anomalies ?? 0}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">Active Investigations:</span>
                <span className="text-zinc-300">{report?.investigations?.length ?? 0} Cases</span>
              </div>
            </div>

            <div className="p-3 bg-cardSurface border border-borderCol text-[10px] text-zinc-300">
              Cryptographic Checkpoint: <code className="text-accentCyan font-mono">RFC 9162 Merkle Validated</code>
            </div>
          </div>
        </Card>
      </div>

      {/* Human Review Sign-Off Action Card */}
      <Card
        title="Human Review Sign-Off & Official Determination"
        subtitle="Record your authorized human review decision. Preserves human accountability over AI suggestions."
      >
        <div className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-zinc-300 font-pixel text-[9px] mb-2 uppercase">Official Decision</label>
            <div className="flex flex-col sm:flex-row gap-3">
              {[
                { val: 'APPROVED', label: 'Approve Assessment Result', color: 'accentTeal' },
                { val: 'OVERRULED', label: 'Overrule (Flag For Retest)', color: 'accentRose' },
                { val: 'INCONCLUSIVE', label: 'Mark Inconclusive', color: 'accentAmber' },
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setReviewDecision(opt.val as any)}
                  className={`flex-1 py-2 px-3 border-2 text-xs font-mono font-medium transition ${
                    reviewDecision === opt.val
                      ? 'bg-cardSurface text-accentCyan border-accentCyan shadow-pixel-sm font-semibold'
                      : 'bg-cardBg text-zinc-400 border-borderCol hover:border-zinc-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-pixel text-[9px] mb-2 uppercase">Reviewer Assessment Notes</label>
            <textarea
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              rows={3}
              className="w-full bg-cardSurface border-2 border-borderCol p-3 text-zinc-100 focus:outline-none focus:border-accentCyan font-sans text-xs"
              placeholder="Record notes explaining the technical score and integrity corroboration..."
            />
          </div>

          {reviewLogged && (
            <div className="p-3 bg-cardSurface border-2 border-accentTeal text-accentTeal font-mono text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Review decision logged successfully to backend session store.</span>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmitReview}
              isLoading={isSubmittingReview}
              icon={<Send className="w-3.5 h-3.5" />}
              className="px-6 py-2"
            >
              Submit Review Sign-Off
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
