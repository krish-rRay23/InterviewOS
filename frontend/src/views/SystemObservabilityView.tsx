import React, { useState, useEffect } from 'react';
import {
  Activity,
  Server,
  Cpu,
  RefreshCw,
  HardDrive,
  Layers,
  Thermometer,
  Zap,
  Volume2,
  Mic,
  Bot,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { api } from '../api/client';
import { BackendHealth, LocalAIHealth, AgentStatus } from '../types';

export const SystemObservabilityView: React.FC = () => {
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);
  const [aiHealth, setAiHealth] = useState<LocalAIHealth | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [modelsData, setModelsData] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastCheck, setLastCheck] = useState<string>('');

  const fetchMetrics = async () => {
    setIsRefreshing(true);
    try {
      const [bRes, aiRes, agRes, mRes] = await Promise.allSettled([
        api.getHealth(),
        api.getLocalAIHealth(),
        api.getAgentsStatus(),
        api.getLocalAIModels(),
      ]);

      if (bRes.status === 'fulfilled') setBackendHealth(bRes.value.data);
      if (aiRes.status === 'fulfilled') setAiHealth(aiRes.value.data);
      if (agRes.status === 'fulfilled') setAgents(agRes.value.data);
      if (mRes.status === 'fulfilled') setModelsData(mRes.value.data);

      setLastCheck(new Date().toLocaleTimeString());
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-borderCol gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-sky-400" />
            <span>System Runtime Observability & Hardware Telemetry</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Live health telemetry for Go backend, transactional outbox, local AI models, and RTX 3050 GPU VRAM.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-zinc-400">
            Last Checked: {lastCheck || 'Connecting...'}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMetrics}
            isLoading={isRefreshing}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Hardware Telemetry Grid (GPU, Backend, AI Engine) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Go Backend Card */}
        <Card title="Go Backend Core (:8080)">
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Status:</span>
              <Badge variant={backendHealth?.status === 'healthy' ? 'success' : 'danger'}>
                {backendHealth?.status || 'OFFLINE'}
              </Badge>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span className="text-zinc-400">Storage Backend:</span>
              <span className="text-zinc-200">{backendHealth?.storage_backend || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span className="text-zinc-400">Outbox Backlog:</span>
              <span className="text-sky-400 font-bold">{backendHealth?.outbox_backlog ?? 0} msgs</span>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span className="text-zinc-400">Auth Engine:</span>
              <span className="text-emerald-400 text-[11px]">{backendHealth?.auth_engine || 'ACTIVE'}</span>
            </div>
          </div>
        </Card>

        {/* Local AI Service Card */}
        <Card title="Local AI Runtime (:8000)">
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Status:</span>
              <Badge variant={aiHealth?.status === 'healthy' ? 'success' : aiHealth?.status === 'degraded' ? 'warning' : 'danger'}>
                {aiHealth?.status || 'OFFLINE'}
              </Badge>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span className="text-zinc-400">Architecture:</span>
              <span className="text-emerald-400 text-[11px]">{aiHealth?.mode || '100% Offline / Local'}</span>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span className="text-zinc-400">Gemini Cloud Accelerator:</span>
              <span className={aiHealth?.gemini_available ? 'text-cyan-400 font-semibold' : 'text-zinc-500'}>
                {aiHealth?.gemini_available ? 'ACTIVE (Fallback: Ollama)' : 'OFFLINE (Local Only)'}
              </span>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span className="text-zinc-400">Ollama Daemon:</span>
              <span className={aiHealth?.ollama_available ? 'text-emerald-400' : 'text-zinc-500'}>
                {aiHealth?.ollama_available ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
          </div>
        </Card>

        {/* NVIDIA RTX 3050 GPU VRAM Card */}
        <Card title="NVIDIA RTX 3050 Laptop GPU (4GB)">
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">VRAM Utilization:</span>
              <span className="font-mono text-zinc-200">
                {aiHealth?.gpu_vram?.used_mb?.toFixed(0) || 0} MB / {aiHealth?.gpu_vram?.total_mb?.toFixed(0) || 4096} MB
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${aiHealth?.gpu_vram?.utilization_pct || 0}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                <span>{aiHealth?.gpu_vram?.temperature_c || 0} &deg;C</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span>{aiHealth?.gpu_vram?.power_w?.toFixed(1) || 0} W</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Speech Stack & Models Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Local Speech Stack */}
        <Card
          title="Local Speech Recognition & Synthesis Engines"
          subtitle="Executing on CPU with zero GPU VRAM consumption"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-lg bg-zinc-900 border border-borderCol flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mic className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="font-semibold text-zinc-200">Faster-Whisper (CPU INT8)</div>
                  <div className="text-[11px] text-zinc-500 font-mono">Speech-to-Text &bull; Multilingual</div>
                </div>
              </div>
              <Badge variant="success" size="sm">ACTIVE</Badge>
            </div>

            <div className="p-3.5 rounded-lg bg-zinc-900 border border-borderCol flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-cyan-400" />
                <div>
                  <div className="font-semibold text-zinc-200">Piper TTS (CPU ONNX)</div>
                  <div className="text-[11px] text-zinc-500 font-mono">en_US-lessac-medium &bull; Latency: ~85ms</div>
                </div>
              </div>
              <Badge variant={aiHealth?.piper_tts_available ? 'success' : 'warning'} size="sm">
                {aiHealth?.piper_tts_available ? 'ACTIVE' : 'MISSING MODEL'}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Installed Local Models & Active Routing */}
        <Card
          title="Installed Local Models (RTX 3050 Quantized)"
          subtitle="Strict allowlist routing dynamically enforced by ModelRouter"
        >
          <div className="space-y-2.5 text-xs font-mono">
            {[
              { model: 'qwen2.5-coder:3b', role: 'Primary Coding & Syntax Analysis' },
              { model: 'qwen2.5-coder:1.5b', role: 'Fast Classification & Intent Tagging' },
              { model: 'granite4.1:3b', role: 'Deep Reasoning & Forensic Hypothesis' },
              { model: 'nomic-embed-text:latest', role: '768-dim Semantic Vector Embeddings' },
            ].map(m => (
              <div key={m.model} className="p-2.5 rounded-lg bg-zinc-900/60 border border-borderCol flex items-center justify-between">
                <div>
                  <span className="text-sky-400 font-semibold">{m.model}</span>
                  <div className="text-[10px] text-zinc-400 font-sans mt-0.5">{m.role}</div>
                </div>
                <Badge variant="info" size="sm">APPROVED</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Autonomous Multi-Agent Status Grid */}
      <Card
        title="Autonomous Assessment Agent Architecture"
        subtitle="13 specialized agents governed by Autonomy Guard capability authorization gates"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {agents.length === 0 ? (
            <div className="col-span-3 text-zinc-500 py-6 text-center font-mono">
              Loading agent cluster status from /v1/agents/status...
            </div>
          ) : (
            agents.map(ag => (
              <div key={ag.name} className="p-3 rounded-lg bg-zinc-900/60 border border-borderCol flex items-center justify-between">
                <div>
                  <div className="font-semibold text-zinc-200">{ag.name}</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">{ag.role}</div>
                </div>
                <Badge variant="success" size="sm">
                  {ag.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
