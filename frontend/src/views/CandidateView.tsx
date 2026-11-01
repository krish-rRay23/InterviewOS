import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
  Code2,
  CheckCircle2,
  AlertCircle,
  Play,
  Mic,
  MicOff,
  Volume2,
  Lock,
  ArrowRight,
  ShieldCheck,
  Server,
  Cpu,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { api } from '../api/client';
import { workspaceStore } from '../api/workspaceStore';
import {
  SessionStatus,
  SessionManifest,
  SubmissionResponse,
} from '../types';

export const CandidateView: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [activeStage, setActiveStage] = useState<number>(1);
  const [manifest, setManifest] = useState<SessionManifest | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);

  // Stage 2: Readiness check states
  const [readiness, setReadiness] = useState({
    backend: 'checking',
    backendLatency: 0,
    aiService: 'checking',
    aiLatency: 0,
    micPermission: 'checking',
  });

  // Stage 3: Transparency consent
  const [hasConsented, setHasConsented] = useState<boolean>(false);

  // Stage 4: Coding Workspace
  const [selectedLanguage, setSelectedLanguage] = useState<string>('python');
  const [sourceCode, setSourceCode] = useState<string>(
    `import sys

def two_sum(nums, target):
    """
    Find two numbers in nums that add up to target and return their indices.
    Optimal Time Complexity: O(n)
    Space Complexity: O(n)
    """
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []

if __name__ == "__main__":
    # Test case execution
    result = two_sum([2, 7, 11, 15], 9)
    print(f"Indices: {result}")
`
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResponse | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Stage 5: Voice Interview
  const [interviewQuestion, setInterviewQuestion] = useState<string>(
    'Please explain your algorithmic approach to two_sum, analyzing its time and space complexity, and how hash collisions would be mitigated in worst-case distribution.'
  );
  const [candidateResponseText, setCandidateResponseText] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Stage 6: Completion
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [isClosed, setIsClosed] = useState<boolean>(false);

  // Load session manifest & status
  useEffect(() => {
    if (!sessionId) return;

    api.getSessionManifest(sessionId)
      .then(res => setManifest(res.data))
      .catch(() => {
        // Fallback demo manifest if session was created purely locally
        setManifest({
          session_id: sessionId,
          assessment_id: 'asmt-standard-demo',
          candidate_id: 'cand-standard-demo',
          policy: {
            version: 1,
            max_displays: 1,
            allow_external_ide: false,
            allow_usb_storage: false,
            strict_etw: true,
            prohibited_process_names: ['anydesk.exe', 'teamviewer.exe'],
            permitted_process_names: ['code.exe'],
            investigation_budget_usd: 5.0,
            max_agent_tool_calls: 25,
          },
          status: 'ACTIVE',
        });
      });

    api.getSessionStatus(sessionId)
      .then(res => setSessionStatus(res.data))
      .catch(() => null);
  }, [sessionId]);

  // Stage 2 Readiness Check execution
  const runReadinessChecks = async () => {
    setReadiness(prev => ({ ...prev, backend: 'checking', aiService: 'checking', micPermission: 'checking' }));

    // Check Backend
    try {
      const res = await api.getHealth();
      setReadiness(prev => ({
        ...prev,
        backend: res.data.status === 'healthy' ? 'pass' : 'fail',
        backendLatency: res.durationMs,
      }));
    } catch {
      setReadiness(prev => ({ ...prev, backend: 'fail', backendLatency: 0 }));
    }

    // Check Local AI
    try {
      const res = await api.getLocalAIHealth();
      setReadiness(prev => ({
        ...prev,
        aiService: res.data.status === 'healthy' || res.data.status === 'degraded' ? 'pass' : 'fail',
        aiLatency: res.durationMs,
      }));
    } catch {
      setReadiness(prev => ({ ...prev, aiService: 'fail', aiLatency: 0 }));
    }

    // Check Microphone
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setReadiness(prev => ({ ...prev, micPermission: 'pass' }));
    } catch {
      setReadiness(prev => ({ ...prev, micPermission: 'fail' }));
    }
  };

  useEffect(() => {
    if (activeStage === 2) {
      runReadinessChecks();
    }
  }, [activeStage]);

  // Handle Code Submission
  const handleSubmitCode = async () => {
    if (!sessionId) return;
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const res = await api.submitCode(sessionId, {
        language: selectedLanguage,
        source_code: sourceCode,
      });
      setSubmissionResult(res.data);
    } catch (err: any) {
      setSubmissionError(err.message || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Voice Recording: Start
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setIsTranscribing(true);
        try {
          const res = await api.transcribeAudio(audioBlob, 'en');
          if (res.data.transcript) {
            setCandidateResponseText(prev =>
              prev ? `${prev} ${res.data.transcript}` : res.data.transcript
            );
          }
        } catch (err: any) {
          console.error('Transcription error', err);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('Microphone access denied or audio device not found.');
    }
  };

  // Voice Recording: Stop
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
    }
  };

  // TTS Speech Synthesis Playback
  const handleSynthesizeQuestion = async () => {
    setIsSynthesizing(true);
    try {
      const { audioBlob } = await api.synthesizeSpeech(interviewQuestion, 'en');
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      const audio = new Audio(url);
      audio.play();
    } catch (err: any) {
      alert(`Speech synthesis notice: ${err.message}`);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Close Session
  const handleCloseSession = async () => {
    if (!sessionId) return;
    setIsClosing(true);
    try {
      await api.closeSession(sessionId);
      setIsClosed(true);
    } catch {
      setIsClosed(true);
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Session Breadcrumb Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-borderCol gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-zinc-100 font-mono tracking-tight">
              Candidate Workspace
            </h1>
            <Badge variant="info" size="sm">
              Session: {sessionId?.slice(0, 16)}...
            </Badge>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Technical Assessment Environment with Observable Trust Grounding.
          </p>
        </div>

        {/* Stepper Navigation */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          {[
            { num: 1, label: 'Invite' },
            { num: 2, label: 'Readiness' },
            { num: 3, label: 'Transparency' },
            { num: 4, label: 'Coding' },
            { num: 5, label: 'Interview' },
            { num: 6, label: 'Complete' },
          ].map((s) => (
            <button
              key={s.num}
              onClick={() => setActiveStage(s.num)}
              className={`px-2.5 py-1 rounded border text-[11px] transition ${
                activeStage === s.num
                  ? 'bg-sky-600/20 text-sky-300 border-sky-500/50 font-semibold'
                  : activeStage > s.num
                  ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/30'
                  : 'bg-zinc-900/40 text-zinc-500 border-borderCol'
              }`}
            >
              {s.num}. {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* STAGE 1: INVITATION & INSTRUCTIONS */}
      {activeStage === 1 && (
        <Card
          title="Technical Assessment Overview & Guidelines"
          subtitle="Please review the assessment instructions before beginning the session."
        >
          <div className="space-y-5 text-xs">
            <div className="p-4 rounded-xl bg-zinc-900 border border-borderCol space-y-3">
              <h3 className="font-semibold text-zinc-100 text-sm">
                Candidate Assessment Protocol
              </h3>
              <p className="text-zinc-300 leading-relaxed">
                You are entering a verified, evidence-grounded assessment session. This platform evaluates
                not just static code output, but algorithmic problem-solving comprehension, complexity
                analysis, and code explanation.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-zinc-400">
                <li>Write a clean, optimal solution using the integrated code editor.</li>
                <li>Verify your solution against provided example unit tests.</li>
                <li>Complete the subsequent interactive technical question turn.</li>
                <li>Your submission is cryptographically signed and sealed into an evidence journal.</li>
              </ul>
            </div>

            <div className="flex justify-end">
              <Button
                variant="primary"
                onClick={() => setActiveStage(2)}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Proceed to Environment Readiness Check
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* STAGE 2: READINESS CHECK */}
      {activeStage === 2 && (
        <Card
          title="Stage 2: Environment Readiness Verification"
          subtitle="Validating backend communication, local AI inference, and browser media device permissions."
        >
          <div className="space-y-4 text-xs">
            <div className="space-y-3">
              {/* Backend Check */}
              <div className="p-3.5 rounded-lg bg-zinc-900 border border-borderCol flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className="w-4 h-4 text-sky-400" />
                  <div>
                    <div className="font-semibold text-zinc-200">Go Backend API (:8080)</div>
                    <div className="text-[11px] text-zinc-500 font-mono">
                      Latency: {readiness.backendLatency} ms
                    </div>
                  </div>
                </div>
                <Badge
                  variant={readiness.backend === 'pass' ? 'success' : readiness.backend === 'fail' ? 'danger' : 'neutral'}
                  size="sm"
                >
                  {readiness.backend === 'pass' ? 'CONNECTED' : readiness.backend === 'fail' ? 'OFFLINE' : 'CHECKING...'}
                </Badge>
              </div>

              {/* Local AI Check */}
              <div className="p-3.5 rounded-lg bg-zinc-900 border border-borderCol flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="font-semibold text-zinc-200">Local AI Inference Service (:8000)</div>
                    <div className="text-[11px] text-zinc-500 font-mono">
                      Latency: {readiness.aiLatency} ms
                    </div>
                  </div>
                </div>
                <Badge
                  variant={readiness.aiService === 'pass' ? 'success' : readiness.aiService === 'fail' ? 'warning' : 'neutral'}
                  size="sm"
                >
                  {readiness.aiService === 'pass' ? 'READY (OFFLINE)' : readiness.aiService === 'fail' ? 'UNAVAILABLE' : 'CHECKING...'}
                </Badge>
              </div>

              {/* Microphone Check */}
              <div className="p-3.5 rounded-lg bg-zinc-900 border border-borderCol flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mic className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="font-semibold text-zinc-200">Browser Audio & Microphone</div>
                    <div className="text-[11px] text-zinc-500 font-mono">
                      Web Audio API Device Access
                    </div>
                  </div>
                </div>
                <Badge
                  variant={readiness.micPermission === 'pass' ? 'success' : readiness.micPermission === 'fail' ? 'warning' : 'neutral'}
                  size="sm"
                >
                  {readiness.micPermission === 'pass' ? 'GRANTED' : readiness.micPermission === 'fail' ? 'DENIED / MISSING' : 'REQUESTING...'}
                </Badge>
              </div>
            </div>

            <div className="pt-2 flex justify-between">
              <Button variant="outline" size="sm" onClick={runReadinessChecks}>
                Re-check Devices
              </Button>
              <Button
                variant="primary"
                onClick={() => setActiveStage(3)}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Continue to Privacy & Transparency
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* STAGE 3: TRANSPARENCY & PRIVACY CONSENT */}
      {activeStage === 3 && (
        <Card
          title="Stage 3: Monitoring Transparency & Privacy Guarantees"
          subtitle="InterviewOS guarantees complete clarity on what telemetry is observed versus what is protected."
        >
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* What IS observed */}
              <div className="p-4 rounded-xl bg-zinc-900 border border-borderCol space-y-2.5">
                <div className="font-semibold text-sky-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Telemetry Categories Observed</span>
                </div>
                <ul className="space-y-1.5 text-zinc-300">
                  <li className="flex items-start gap-2">
                    <span className="text-sky-400 font-bold">&bull;</span>
                    <span>Process Lifecycle: Application startup/termination events (classification against policy).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-sky-400 font-bold">&bull;</span>
                    <span>Peripheral Connections: USB storage, bluetooth bridges, and secondary adapters.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-sky-400 font-bold">&bull;</span>
                    <span>Display Topology: Monitored monitor counts and primary resolution toggles.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-sky-400 font-bold">&bull;</span>
                    <span>Network Interfaces: Tunnel adapters, remote desktop protocols (RDP).</span>
                  </li>
                </ul>
              </div>

              {/* What is NOT collected */}
              <div className="p-4 rounded-xl bg-zinc-900 border border-borderCol space-y-2.5">
                <div className="font-semibold text-emerald-400 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  <span>Privacy Guarantees (NEVER Collected)</span>
                </div>
                <ul className="space-y-1.5 text-zinc-300">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">&bull;</span>
                    <span>No Keystroke Logging: Your typing cadence and keystrokes are completely private.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">&bull;</span>
                    <span>No File Scanning: Personal documents and filesystem directories are never inspected.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">&bull;</span>
                    <span>No Arbitrary Memory Dumping: Process RAM memory is never extracted.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">&bull;</span>
                    <span>No Ambient Audio: Microphone is only active when you explicitly press record.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-sky-950/30 border border-sky-800/40 text-sky-300 flex items-center gap-3">
              <input
                type="checkbox"
                id="consentCheck"
                checked={hasConsented}
                onChange={(e) => setHasConsented(e.target.checked)}
                className="w-4 h-4 rounded border-sky-700 bg-zinc-900 text-sky-500 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="consentCheck" className="cursor-pointer text-xs leading-relaxed select-none">
                I have read the telemetry disclosures and consent to endpoint session observation within these strict privacy boundaries.
              </label>
            </div>

            <div className="flex justify-between pt-1">
              <Button variant="ghost" onClick={() => setActiveStage(2)}>
                Back
              </Button>
              <Button
                variant="primary"
                disabled={!hasConsented}
                onClick={() => setActiveStage(4)}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Enter Coding Assessment
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* STAGE 4: CODING WORKSPACE */}
      {activeStage === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Problem Statement Left Panel */}
          <div className="lg:col-span-5 space-y-4">
            <Card
              title="Algorithmic Challenge: Two Sum"
              subtitle="Target time complexity: O(n) | Language: Python 3 / C++20"
            >
              <div className="space-y-4 text-xs text-zinc-300 leading-relaxed">
                <div>
                  <h4 className="font-semibold text-zinc-100 mb-1">Problem Description</h4>
                  <p>
                    Given an array of integers <code className="text-sky-300 bg-zinc-900 px-1 py-0.5 rounded">nums</code> and an
                    integer <code className="text-sky-300 bg-zinc-900 px-1 py-0.5 rounded">target</code>, return indices of the two
                    numbers such that they add up to <code className="text-sky-300 bg-zinc-900 px-1 py-0.5 rounded">target</code>.
                  </p>
                  <p className="mt-1">
                    You may assume that each input would have exactly one solution, and you may not use the same element twice.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-zinc-900 border border-borderCol font-mono text-[11px] space-y-2">
                  <div className="text-zinc-400 font-semibold">Example 1:</div>
                  <div>Input: nums = [2, 7, 11, 15], target = 9</div>
                  <div className="text-emerald-400">Output: [0, 1]</div>
                  <div className="text-zinc-500 text-[10px]">Explanation: nums[0] + nums[1] == 9, so we return [0, 1].</div>
                </div>

                <div>
                  <h4 className="font-semibold text-zinc-100 mb-1">Constraints:</h4>
                  <ul className="list-disc pl-4 space-y-0.5 text-zinc-400 font-mono text-[11px]">
                    <li>2 &le; nums.length &le; 10,000</li>
                    <li>-10^9 &le; nums[i] &le; 10^9</li>
                    <li>-10^9 &le; target &le; 10^9</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Test Results Display */}
            {submissionResult && (
              <Card title="Execution & Rubric Evaluation">
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Test Cases Passed:</span>
                    <Badge variant={submissionResult.all_passed ? 'success' : 'warning'}>
                      {submissionResult.test_cases_passed} / {submissionResult.total_test_cases} Passed
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Execution Time:</span>
                    <span className="font-mono text-zinc-200">{submissionResult.execution_time_ms} ms</span>
                  </div>

                  {submissionResult.technical_score && (
                    <div className="pt-2 border-t border-borderCol space-y-1.5 font-mono text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Code Correctness:</span>
                        <span className="text-emerald-400">{submissionResult.technical_score.code_correctness_pct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Complexity Score:</span>
                        <span className="text-sky-400">{submissionResult.technical_score.code_complexity_pct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Total Score:</span>
                        <span className="text-zinc-100 font-bold">{submissionResult.technical_score.total_score_pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setActiveStage(5)}
                      className="w-full"
                      icon={<ArrowRight className="w-4 h-4" />}
                    >
                      Proceed to Voice Interview Question
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {submissionError && (
              <div className="p-3.5 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-300 font-mono">
                [Execution Notice] {submissionError}
              </div>
            )}
          </div>

          {/* Monaco Editor Right Panel */}
          <div className="lg:col-span-7 space-y-3">
            <div className="bg-cardBg border border-borderCol rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-zinc-400">Language:</span>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="bg-zinc-900 border border-borderCol rounded px-2 py-1 text-sky-400 font-mono text-xs focus:outline-none"
                >
                  <option value="python">Python 3.11</option>
                  <option value="cpp">C++20</option>
                </select>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmitCode}
                isLoading={isSubmitting}
                icon={<Play className="w-3.5 h-3.5" />}
              >
                Run & Submit Code
              </Button>
            </div>

            {/* Monaco Editor Component */}
            <div className="h-[480px] rounded-xl overflow-hidden border border-borderCol bg-zinc-950 shadow-inner">
              <Editor
                height="100%"
                language={selectedLanguage === 'cpp' ? 'cpp' : 'python'}
                theme="vs-dark"
                value={sourceCode}
                onChange={(val) => setSourceCode(val || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, monospace',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 4,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* STAGE 5: VOICE INTERVIEW QUESTION */}
      {activeStage === 5 && (
        <Card
          title="Stage 5: Multilingual Technical Voice Interview"
          subtitle="Explain your thought process. Use text input or microphone recording for live transcription."
        >
          <div className="space-y-5 text-xs">
            {/* Question Card */}
            <div className="p-4 rounded-xl bg-zinc-900 border border-borderCol space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sky-400 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Interview Prompt</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSynthesizeQuestion}
                  isLoading={isSynthesizing}
                  icon={<Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
                >
                  Listen Question (TTS)
                </Button>
              </div>

              <p className="text-zinc-200 text-sm leading-relaxed">
                "{interviewQuestion}"
              </p>
            </div>

            {/* Audio Recorder & Input */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-zinc-300 font-medium">Your Explanation:</label>
                <div className="flex items-center gap-2">
                  {isRecording ? (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={stopRecording}
                      icon={<MicOff className="w-3.5 h-3.5 animate-pulse" />}
                    >
                      Stop Recording & Transcribe
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={startRecording}
                      isLoading={isTranscribing}
                      icon={<Mic className="w-3.5 h-3.5 text-emerald-400" />}
                    >
                      Record Voice (Whisper STT)
                    </Button>
                  )}
                </div>
              </div>

              <textarea
                value={candidateResponseText}
                onChange={(e) => setCandidateResponseText(e.target.value)}
                rows={5}
                className="w-full bg-zinc-900 border border-borderCol rounded-xl p-3.5 text-zinc-100 font-sans focus:outline-none focus:border-sky-500 leading-relaxed"
                placeholder="Type your technical explanation here, or speak into the microphone to transcribe automatically..."
              />
            </div>

            <div className="pt-2 flex justify-between">
              <Button variant="ghost" onClick={() => setActiveStage(4)}>
                Back to Code
              </Button>
              <Button
                variant="primary"
                onClick={() => setActiveStage(6)}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Complete Assessment Session
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* STAGE 6: ASSESSMENT COMPLETION */}
      {activeStage === 6 && (
        <Card
          title="Stage 6: Assessment Finalization"
          subtitle="Sealing the cryptographic evidence journal and closing the assessment session."
        >
          <div className="space-y-5 text-xs">
            <div className="p-5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-base">
                <CheckCircle2 className="w-5 h-5" />
                <span>Assessment Submitted Successfully</span>
              </div>
              <p className="text-zinc-300 leading-relaxed">
                Your code implementation and interview responses have been processed through the isolated
                evaluation runtime. Cryptographic evidence hashes have been sealed into the session journal.
              </p>
            </div>

            <div className="bg-zinc-900/80 p-4 rounded-xl border border-borderCol space-y-2 font-mono text-[11px]">
              <div className="flex justify-between py-1 border-b border-borderCol/50">
                <span className="text-zinc-400">Session ID:</span>
                <span className="text-sky-400">{sessionId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-borderCol/50">
                <span className="text-zinc-400">Technical Score:</span>
                <span className="text-zinc-100 font-bold">
                  {submissionResult?.technical_score ? `${submissionResult.technical_score.total_score_pct.toFixed(1)}%` : 'Evaluated'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">Session State:</span>
                <span className="text-emerald-400 font-semibold">
                  {isClosed ? 'COMPLETED' : 'ACTIVE'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              {!isClosed ? (
                <Button
                  variant="primary"
                  onClick={handleCloseSession}
                  isLoading={isClosing}
                  className="flex-1"
                >
                  Close & Seal Assessment Session
                </Button>
              ) : (
                <div className="p-3 bg-zinc-900 rounded-lg text-emerald-400 font-mono text-center flex-1">
                  Session Closed & Signed. Thank you!
                </div>
              )}

              <Button
                variant="outline"
                onClick={() => navigate(`/reviewer/${sessionId}`)}
                icon={<ExternalLink className="w-4 h-4" />}
                className="flex-1"
              >
                Inspect in Reviewer Portal
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
