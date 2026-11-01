import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Cpu,
  Server,
  Layers,
  Code2,
  Volume2,
  Mic,
  Search,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { JsonViewer } from '../components/common/JsonViewer';
import { api } from '../api/client';
import { workspaceStore } from '../api/workspaceStore';
import { DiagnosticStepResult, LabRunHistory } from '../types';

export const SystemLabView: React.FC = () => {
  const [isRunningWalkthrough, setIsRunningWalkthrough] = useState<boolean>(false);
  const [walkthroughSteps, setWalkthroughSteps] = useState<DiagnosticStepResult[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<DiagnosticStepResult | null>(null);

  // Individual Diagnostic Tool States
  const [chatPrompt, setChatPrompt] = useState<string>('Write a one-line C++20 concept check for std::integral.');
  const [chatResponse, setChatResponse] = useState<any>(null);
  const [isChatRunning, setIsChatRunning] = useState<boolean>(false);

  const [ttsInput, setTtsInput] = useState<string>('System Lab diagnostic speech synthesis test.');
  const [isTtsRunning, setIsTtsRunning] = useState<boolean>(false);

  const [embedInput, setEmbedInput] = useState<string>('Candidate utilized two pointers with linear time complexity.');
  const [embedResult, setEmbedResult] = useState<any>(null);
  const [isEmbedRunning, setIsEmbedRunning] = useState<boolean>(false);

  // Test Run History
  const [history, setHistory] = useState<LabRunHistory[]>(workspaceStore.getLabHistory());

  // 1-Click Master Assessment Walkthrough
  const handleRunFullWalkthrough = async () => {
    setIsRunningWalkthrough(true);
    const steps: DiagnosticStepResult[] = [];
    const runId = `run_${Date.now()}`;
    const startTime = performance.now();

    const addStep = (step: DiagnosticStepResult) => {
      steps.push(step);
      setWalkthroughSteps([...steps]);
      setSelectedInspection(step);
    };

    try {
      // Step 1: Health & Ping
      const t0 = performance.now();
      try {
        const hRes = await api.getHealth();
        addStep({
          name: '1. Backend Health Check',
          status: 'PASS',
          duration_ms: Math.round(performance.now() - t0),
          http_status: hRes.status,
          request_url: hRes.url,
          payload: hRes.data,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        addStep({
          name: '1. Backend Health Check',
          status: 'FAIL',
          duration_ms: Math.round(performance.now() - t0),
          error: err.message,
          timestamp: new Date().toISOString(),
        });
        throw err;
      }

      // Step 2: Auth Token
      const t1 = performance.now();
      try {
        const tokenRes = await api.issueAuthToken({
          user_id: 'usr_lab_runner',
          org_id: 'org_lab_test',
          role: 'SYSTEM_OPERATOR',
        });
        addStep({
          name: '2. JWT Auth Token Issuance',
          status: 'PASS',
          duration_ms: Math.round(performance.now() - t1),
          http_status: tokenRes.status,
          request_url: tokenRes.url,
          payload: { role: tokenRes.data.role, expires_in: tokenRes.data.expires_in, token_preview: `${tokenRes.data.access_token.slice(0, 30)}...` },
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        addStep({
          name: '2. JWT Auth Token Issuance',
          status: 'FAIL',
          duration_ms: Math.round(performance.now() - t1),
          error: err.message,
          timestamp: new Date().toISOString(),
        });
      }

      // Step 3: Create Organization
      const t2 = performance.now();
      let orgId = '';
      try {
        const orgRes = await api.createOrganization({
          name: `Lab Test Org ${Date.now()}`,
          slug: `lab-org-${Date.now()}`,
        });
        orgId = orgRes.data.id;
        addStep({
          name: '3. Create Organization',
          status: 'PASS',
          duration_ms: Math.round(performance.now() - t2),
          http_status: orgRes.status,
          request_url: orgRes.url,
          payload: orgRes.data,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        addStep({
          name: '3. Create Organization',
          status: 'FAIL',
          duration_ms: Math.round(performance.now() - t2),
          error: err.message,
          timestamp: new Date().toISOString(),
        });
        throw err;
      }

      // Step 4: Create Assessment
      const t3 = performance.now();
      let asmtId = '';
      try {
        const asmtRes = await api.createAssessment({
          organization_id: orgId,
          title: 'Algorithmic Systems Benchmark',
          mode: 'AI_PROHIBITED',
        });
        asmtId = asmtRes.data.id;
        addStep({
          name: '4. Create Assessment',
          status: 'PASS',
          duration_ms: Math.round(performance.now() - t3),
          http_status: asmtRes.status,
          request_url: asmtRes.url,
          payload: asmtRes.data,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        addStep({
          name: '4. Create Assessment',
          status: 'FAIL',
          duration_ms: Math.round(performance.now() - t3),
          error: err.message,
          timestamp: new Date().toISOString(),
        });
        throw err;
      }

      // Step 5: Save Policy Manifest
      const t4 = performance.now();
      try {
        const polRes = await api.savePolicy(asmtId, {
          version: 1,
          max_displays: 1,
          allow_external_ide: false,
          allow_usb_storage: false,
          strict_etw: true,
          prohibited_process_names: ['anydesk.exe', 'teamviewer.exe'],
          permitted_process_names: ['code.exe'],
          investigation_budget_usd: 5.0,
          max_agent_tool_calls: 25,
        });
        addStep({
          name: '5. Save Policy Manifest',
          status: 'PASS',
          duration_ms: Math.round(performance.now() - t4),
          http_status: polRes.status,
          request_url: polRes.url,
          payload: polRes.data,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        addStep({
          name: '5. Save Policy Manifest',
          status: 'FAIL',
          duration_ms: Math.round(performance.now() - t4),
          error: err.message,
          timestamp: new Date().toISOString(),
        });
      }

      // Step 6: Create Candidate
      const t5 = performance.now();
      let candId = '';
      try {
        const candRes = await api.createCandidate({
          organization_id: orgId,
          full_name: 'Diagnostic Candidate',
          email: `diag.${Date.now()}@interviewos.dev`,
        });
        candId = candRes.data.id;
        addStep({
          name: '6. Register Candidate',
          status: 'PASS',
          duration_ms: Math.round(performance.now() - t5),
          http_status: candRes.status,
          request_url: candRes.url,
          payload: candRes.data,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        addStep({
          name: '6. Register Candidate',
          status: 'FAIL',
          duration_ms: Math.round(performance.now() - t5),
          error: err.message,
          timestamp: new Date().toISOString(),
        });
        throw err;
      }

      // Step 7: Create Session
      const t6 = performance.now();
      let sessId = '';
      try {
        const sessRes = await api.createSession({
          assessment_id: asmtId,
          candidate_id: candId,
        });
        sessId = sessRes.data.id;
        addStep({
          name: '7. Create Session',
          status: 'PASS',
          duration_ms: Math.round(performance.now() - t6),
          http_status: sessRes.status,
          request_url: sessRes.url,
          payload: sessRes.data,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        addStep({
          name: '7. Create Session',
          status: 'FAIL',
          duration_ms: Math.round(performance.now() - t6),
          error: err.message,
          timestamp: new Date().toISOString(),
        });
        throw err;
      }

      // Step 8: Fetch Manifest
      const t7 = performance.now();
      try {
        const manRes = await api.getSessionManifest(sessId);
        addStep({
          name: '8. Fetch Session Manifest',
          status: 'PASS',
          duration_ms: Math.round(performance.now() - t7),
          http_status: manRes.status,
          request_url: manRes.url,
          payload: manRes.data,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        addStep({
          name: '8. Fetch Session Manifest',
          status: 'FAIL',
          duration_ms: Math.round(performance.now() - t7),
          error: err.message,
          timestamp: new Date().toISOString(),
        });
      }

      // Step 9: Code Submission & Sandboxed Execution
      const t8 = performance.now();
      try {
        const subRes = await api.submitCode(sessId, {
          language: 'python',
          source_code: `def solve(): return 42\n`,
        });
        addStep({
          name: '9. Submit Code & Evaluate',
          status: 'PASS',
          duration_ms: Math.round(performance.now() - t8),
          http_status: subRes.status,
          request_url: subRes.url,
          payload: subRes.data,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        addStep({
          name: '9. Submit Code & Evaluate',
          status: 'FAIL',
          duration_ms: Math.round(performance.now() - t8),
          error: err.message,
          timestamp: new Date().toISOString(),
        });
      }

      // Step 10: Conversational Voice Turn & Evaluation Lifecycle
      const t9 = performance.now();
      try {
        const turnRes = await api.processInterviewTurn({
          session_id: sessId,
          problem_statement: 'Two Sum algorithmic evaluation',
          candidate_utterance: 'I used a hash map to achieve linear O(n) runtime.',
          conversation_history: [],
        });
        await api.saveInterviewTurn(sessId, {
          turn_number: 1,
          speaker: 'CANDIDATE',
          transcript: 'I used a hash map to achieve linear O(n) runtime.',
          detected_language: turnRes.data.detected_language,
          technical_concepts: turnRes.data.technical_concepts,
          is_finalized: true,
        });
        await api.saveInterviewTurn(sessId, {
          turn_number: 2,
          speaker: 'INTERVIEWER',
          transcript: turnRes.data.response_text,
          detected_language: turnRes.data.detected_language,
          technical_concepts: turnRes.data.technical_concepts,
          is_finalized: true,
        });
        addStep({
          name: '10. Conversational Voice Turn & Reasoning',
          status: 'PASS',
          duration_ms: Math.round(performance.now() - t9),
          http_status: turnRes.status,
          request_url: turnRes.url,
          payload: turnRes.data,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        addStep({
          name: '10. Conversational Voice Turn & Reasoning',
          status: 'FAIL',
          duration_ms: Math.round(performance.now() - t9),
          error: err.message,
          timestamp: new Date().toISOString(),
        });
      }

      // Step 11: Fetch Verification Report
      const t10 = performance.now();
      try {
        const repRes = await api.getSessionReport(sessId);
        addStep({
          name: '11. Fetch Verification Report',
          status: 'PASS',
          duration_ms: Math.round(performance.now() - t10),
          http_status: repRes.status,
          request_url: repRes.url,
          payload: repRes.data,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        addStep({
          name: '11. Fetch Verification Report',
          status: 'FAIL',
          duration_ms: Math.round(performance.now() - t10),
          error: err.message,
          timestamp: new Date().toISOString(),
        });
      }

      // Record History
      const totalDuration = Math.round(performance.now() - startTime);
      const isOverallPass = steps.every(s => s.status === 'PASS');
      const historyItem: LabRunHistory = {
        id: runId,
        name: 'Full Assessment Walkthrough',
        timestamp: new Date().toLocaleString(),
        status: isOverallPass ? 'PASS' : 'FAIL',
        duration_ms: totalDuration,
        steps,
      };
      workspaceStore.saveLabRun(historyItem);
      setHistory(workspaceStore.getLabHistory());
    } finally {
      setIsRunningWalkthrough(false);
    }
  };

  // Individual Diagnostic: Chat Inference
  const handleTestChat = async () => {
    setIsChatRunning(true);
    setChatResponse(null);
    try {
      const res = await api.chatCompletion({
        task_type: 'code_generation',
        messages: [
          { role: 'system', content: 'You are a C++ systems architect.' },
          { role: 'user', content: chatPrompt },
        ],
      });
      setChatResponse(res.data);
    } catch (err: any) {
      setChatResponse({ error: err.message });
    } finally {
      setIsChatRunning(false);
    }
  };

  // Individual Diagnostic: TTS Synthesis
  const handleTestTts = async () => {
    setIsTtsRunning(true);
    try {
      const { audioBlob, durationMs } = await api.synthesizeSpeech(ttsInput, 'en');
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audio.play();
    } catch (err: any) {
      alert(`TTS Diagnostic Notice: ${err.message}`);
    } finally {
      setIsTtsRunning(false);
    }
  };

  // Individual Diagnostic: Vector Embeddings
  const handleTestEmbed = async () => {
    setIsEmbedRunning(true);
    setEmbedResult(null);
    try {
      const res = await api.generateEmbeddings([embedInput]);
      setEmbedResult(res.data);
    } catch (err: any) {
      setEmbedResult({ error: err.message });
    } finally {
      setIsEmbedRunning(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-borderCol gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2.5">
            <FlaskConical className="w-5 h-5 text-cyan-400" />
            <span>Interactive System Lab & Live Service Diagnostics</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Execute real HTTP calls against the running local cluster, inspect payloads, and test failure boundaries directly through the browser.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleRunFullWalkthrough}
          isLoading={isRunningWalkthrough}
          icon={<Play className="w-4 h-4" />}
        >
          Run Full Assessment Walkthrough
        </Button>
      </div>

      {/* Full Walkthrough Execution Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Step-by-Step Status List */}
        <div className="lg:col-span-6 space-y-3">
          <Card
            title="Live Walkthrough Execution Pipeline"
            subtitle="Executes 10 sequential API calls across the running backend."
          >
            {walkthroughSteps.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-borderCol flex items-center justify-center text-zinc-500 mx-auto">
                  <Play className="w-5 h-5" />
                </div>
                <div className="text-xs text-zinc-400">
                  Click <strong className="text-sky-400">Run Full Assessment Walkthrough</strong> above to execute all 10 live API steps.
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {walkthroughSteps.map((st) => (
                  <div
                    key={st.name}
                    onClick={() => setSelectedInspection(st)}
                    className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between cursor-pointer transition ${
                      selectedInspection?.name === st.name
                        ? 'bg-zinc-900 border-sky-500/80 shadow-sm shadow-sky-950'
                        : 'bg-zinc-950/60 border-borderCol hover:bg-zinc-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {st.status === 'PASS' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      )}
                      <span className="text-zinc-200 font-medium">{st.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-400">{st.duration_ms} ms</span>
                      <Badge variant={st.status === 'PASS' ? 'success' : 'danger'} size="sm">
                        {st.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Technical Request & Payload Inspector */}
        <div className="lg:col-span-6 space-y-3">
          <Card
            title="Technical Request & Response Inspector"
            subtitle="Inspect live method, endpoint, timing, and raw server payload."
          >
            {selectedInspection ? (
              <div className="space-y-3 font-mono text-xs">
                <div className="bg-zinc-900/60 p-3 rounded-lg border border-borderCol space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Operation:</span>
                    <span className="text-zinc-200 font-semibold">{selectedInspection.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Endpoint:</span>
                    <span className="text-sky-400">{selectedInspection.request_url || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Duration:</span>
                    <span className="text-emerald-400">{selectedInspection.duration_ms} ms</span>
                  </div>
                  {selectedInspection.http_status && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">HTTP Status:</span>
                      <span className="text-zinc-200">{selectedInspection.http_status} OK</span>
                    </div>
                  )}
                </div>

                {selectedInspection.error ? (
                  <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-[11px]">
                    Error: {selectedInspection.error}
                  </div>
                ) : (
                  <JsonViewer
                    data={selectedInspection.payload}
                    title="Response Payload"
                    maxHeight="max-h-64"
                  />
                )}
              </div>
            ) : (
              <div className="text-xs text-zinc-500 py-12 text-center font-mono">
                Run walkthrough or select a step to inspect raw HTTP payloads.
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Individual Local AI Diagnostic Tools Grid */}
      <div>
        <h2 className="text-base font-bold text-zinc-100 tracking-tight mb-4 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-sky-400" />
          <span>Local AI Standalone Diagnostics</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Tool 1: Chat Completion */}
          <Card
            title="1. Local LLM Chat (Qwen/Granite)"
            subtitle="Invokes POST /chat via Ollama"
          >
            <div className="space-y-3 text-xs">
              <input
                type="text"
                value={chatPrompt}
                onChange={(e) => setChatPrompt(e.target.value)}
                className="w-full bg-zinc-900 border border-borderCol rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none"
                placeholder="Enter prompt..."
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleTestChat}
                isLoading={isChatRunning}
                className="w-full"
                icon={<Send className="w-3.5 h-3.5" />}
              >
                Execute Chat (Ollama)
              </Button>

              {chatResponse && (
                <div className="font-mono text-[11px] bg-zinc-950 p-2.5 rounded border border-borderCol max-h-36 overflow-y-auto text-zinc-300">
                  {chatResponse.response || JSON.stringify(chatResponse)}
                </div>
              )}
            </div>
          </Card>

          {/* Tool 2: Speech Synthesis */}
          <Card
            title="2. Local Piper TTS (CPU ONNX)"
            subtitle="Invokes POST /synthesize (~85ms)"
          >
            <div className="space-y-3 text-xs">
              <input
                type="text"
                value={ttsInput}
                onChange={(e) => setTtsInput(e.target.value)}
                className="w-full bg-zinc-900 border border-borderCol rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleTestTts}
                isLoading={isTtsRunning}
                className="w-full"
                icon={<Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
              >
                Synthesize & Play Audio
              </Button>
              <div className="text-[10px] text-zinc-500 font-mono text-center">
                Uses en_US-lessac voice on CPU (0 VRAM).
              </div>
            </div>
          </Card>

          {/* Tool 3: Vector Embeddings */}
          <Card
            title="3. Vector Embeddings (Nomic 768d)"
            subtitle="Invokes POST /embed"
          >
            <div className="space-y-3 text-xs">
              <input
                type="text"
                value={embedInput}
                onChange={(e) => setEmbedInput(e.target.value)}
                className="w-full bg-zinc-900 border border-borderCol rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleTestEmbed}
                isLoading={isEmbedRunning}
                className="w-full"
                icon={<Layers className="w-3.5 h-3.5 text-purple-400" />}
              >
                Generate 768d Vector
              </Button>

              {embedResult && (
                <div className="font-mono text-[11px] bg-zinc-950 p-2.5 rounded border border-borderCol text-zinc-300">
                  Dimensions: {embedResult.dimensions || 768} &bull; Model: {embedResult.model || 'nomic'}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Historical Test Runs */}
      {history.length > 0 && (
        <Card
          title="Diagnostic Test Run History"
          subtitle="Previous live integration walkthroughs recorded in browser storage."
        >
          <div className="overflow-x-auto text-xs font-mono">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-borderCol text-zinc-400 text-[11px]">
                  <th className="pb-2">Run ID</th>
                  <th className="pb-2">Test Name</th>
                  <th className="pb-2">Timestamp</th>
                  <th className="pb-2">Duration</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderCol/50">
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-zinc-900/40">
                    <td className="py-2.5 text-sky-400">{h.id}</td>
                    <td className="py-2.5 text-zinc-200">{h.name}</td>
                    <td className="py-2.5 text-zinc-400">{h.timestamp}</td>
                    <td className="py-2.5 text-zinc-300">{h.duration_ms} ms</td>
                    <td className="py-2.5">
                      <Badge variant={h.status === 'PASS' ? 'success' : 'danger'} size="sm">
                        {h.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
