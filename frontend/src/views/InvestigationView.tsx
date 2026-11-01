import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Search,
  ShieldAlert,
  Clock,
  Layers,
  FileText,
  Filter,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Hash,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { JsonViewer } from '../components/common/JsonViewer';
import { api } from '../api/client';
import { EvidenceEvent, InvestigationCase } from '../types';

export const InvestigationView: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();

  const [evidenceList, setEvidenceList] = useState<EvidenceEvent[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationCase[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EvidenceEvent | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);

    Promise.all([
      api.getSessionEvidence(sessionId).then(res => res.data).catch(() => [] as EvidenceEvent[]),
      api.getSessionInvestigations(sessionId).then(res => res.data).catch(() => [] as InvestigationCase[]),
    ]).then(([evs, invs]) => {
      const realEvs = evs || [];
      setEvidenceList(realEvs);
      setSelectedEvent(realEvs.length > 0 ? realEvs[0] : null);
      setInvestigations(invs || []);
    }).finally(() => setLoading(false));
  }, [sessionId]);

  const filteredEvidence = evidenceList.filter((e) => {
    if (selectedCategory === 'ALL') return true;
    return e.event_type.includes(selectedCategory);
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-borderCol gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2.5">
            <Search className="w-5 h-5 text-accentCyan" />
            <span className="font-pixel text-xs tracking-wider text-zinc-100">FORENSIC EVIDENCE & INVESTIGATION CONSOLE</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-mono">
            Auditable session timeline, cryptographic hash-chain provenance, and autonomous investigator findings.
          </p>
        </div>

        <Badge variant="purple" size="sm">
          SESSION: {sessionId?.slice(0, 18)}...
        </Badge>
      </div>

      {/* Autonomous Investigation Hypotheses Banner */}
      <Card
        title="Autonomous Behavioral Investigation Cases"
        subtitle="Hypotheses evaluated by the BehavioralInvestigator agent with evidence grounding."
      >
        <div className="space-y-3">
          {investigations.length === 0 ? (
            <div className="p-6 border-2 border-borderCol bg-cardSurface/60 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-accentTeal mx-auto" />
              <div className="font-pixel text-[10px] text-zinc-200 uppercase">No Behavioral Incidents Detected</div>
              <p className="font-mono text-xs text-zinc-400">
                The session has maintained policy compliance. No anomalous device connections, process spawns, or display changes triggered an autonomous investigation case.
              </p>
            </div>
          ) : (
            investigations.map((inv) => (
              <div
                key={inv.investigation_id}
                className="p-4 rounded-none bg-cardSurface border-2 border-borderCol space-y-3 text-xs shadow-pixel-sm font-mono"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-200 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-accentCyan" />
                    <span className="font-pixel text-[9px] text-accentCyan">CASE ID: {inv.investigation_id}</span>
                  </span>
                  <Badge
                    variant={inv.recommended_action === 'NO_ACTION_BENIGN' ? 'success' : 'warning'}
                    size="sm"
                  >
                    {inv.recommended_action}
                  </Badge>
                </div>

                <div>
                  <span className="text-zinc-400 font-pixel text-[9px]">HYPOTHESIS:</span>
                  <p className="text-zinc-100 font-medium mt-0.5 leading-relaxed font-sans text-xs">{inv.hypothesis}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-[10px] pt-2 border-t border-borderCol">
                  <div>
                    <span className="text-zinc-500">Supporting Evidence:</span>
                    <div className="text-accentCyan mt-0.5">{inv.supporting_evidence.join(', ') || 'None'}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500">Missing Evidence:</span>
                    <div className="text-zinc-400 mt-0.5">{inv.missing_evidence.join(', ') || 'None'}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500">Confidence Score:</span>
                    <div className="text-accentTeal mt-0.5 font-bold">{(inv.confidence_score * 100).toFixed(1)}%</div>
                  </div>
                </div>

                <div className="bg-cardBg p-2.5 rounded-none border border-borderCol text-[10px] text-zinc-400">
                  <span className="font-pixel text-[9px] text-zinc-300">INVESTIGATOR STEPS: </span>
                  {inv.investigation_steps_executed.join(' • ')}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Two Column Layout: Evidence Timeline & Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Sequential Timeline */}
        <div className="lg:col-span-7 space-y-3">
          <Card
            title="Observable Event Timeline"
            subtitle={`Monotonic hash-chained sequence (Showing ${filteredEvidence.length} events)`}
            action={
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <Filter className="w-3.5 h-3.5 text-zinc-400" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-cardSurface border border-borderCol rounded-none px-2 py-0.5 text-zinc-300 focus:outline-none focus:border-accentCyan cursor-pointer text-xs"
                >
                  <option value="ALL">ALL TYPES</option>
                  <option value="PROCESS">PROCESS</option>
                  <option value="DEVICE">DEVICE</option>
                  <option value="DISPLAY">DISPLAY</option>
                  <option value="NETWORK">NETWORK</option>
                </select>
              </div>
            }
          >
            {filteredEvidence.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 space-y-2">
                <Layers className="w-8 h-8 mx-auto text-zinc-600" />
                <p className="font-pixel text-[9px] uppercase">No observable events recorded</p>
                <p className="font-mono text-xs">Events stream here as candidate interactions occur.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {filteredEvidence.map((evt) => {
                  const isSelected = selectedEvent?.event_id === evt.event_id;
                  return (
                    <div
                      key={evt.event_id}
                      onClick={() => setSelectedEvent(evt)}
                      className={`p-3 rounded-none border-2 transition-all cursor-pointer font-mono text-xs ${
                        isSelected
                          ? 'bg-cardSurface border-accentCyan text-zinc-100 shadow-pixel-sm'
                          : 'bg-cardBg border-borderCol hover:border-zinc-700 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-accentCyan">#{evt.sequence}</span>
                          <span className="font-semibold text-zinc-200">{evt.event_type}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(evt.client_time).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-1 text-[10px] text-zinc-400">
                        <span>Collector: {evt.source_collector}</span>
                        <span className="font-mono text-zinc-500">
                          Hash: {evt.current_event_hash.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Cryptographic Provenance & Payload Inspector */}
        <div className="lg:col-span-5 space-y-3">
          <Card
            title="Cryptographic Provenance"
            subtitle="RFC 9162 SHA-256 Merkle hash chain inspector"
          >
            {selectedEvent ? (
              <div className="space-y-4 text-xs font-mono">
                <div className="p-3 bg-cardSurface border border-borderCol space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">Event ID:</span>
                    <span className="text-accentCyan font-bold">{selectedEvent.event_id}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">Policy Version:</span>
                    <span className="text-zinc-200">v{selectedEvent.policy_version}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">Monotonic NS:</span>
                    <span className="text-zinc-300">{selectedEvent.monotonic_timestamp_ns.toLocaleString()} ns</span>
                  </div>
                </div>

                {/* Hash Chain Links */}
                <div className="space-y-2">
                  <div className="text-[10px] font-pixel text-zinc-400 uppercase">PREVIOUS EVENT HASH (Hn-1)</div>
                  <div className="p-2 bg-cardSurface/50 border border-borderCol break-all text-[10px] text-zinc-400">
                    {selectedEvent.previous_event_hash}
                  </div>

                  <div className="text-[10px] font-pixel text-accentCyan uppercase pt-1">CURRENT EVENT HASH (Hn)</div>
                  <div className="p-2 bg-cardSurface border border-accentCyan/50 break-all text-[10px] text-accentCyan font-bold">
                    {selectedEvent.current_event_hash}
                  </div>
                </div>

                {/* Structured Payload Viewer */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center gap-1.5 text-zinc-300 text-[11px] font-semibold">
                    <FileText className="w-3.5 h-3.5 text-accentCyan" />
                    <span className="font-pixel text-[9px]">EVENT PAYLOAD:</span>
                  </div>
                  <div className="max-h-[220px] overflow-y-auto">
                    <JsonViewer data={selectedEvent.payload} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-zinc-500 font-mono text-xs">
                Select an event from the timeline to inspect its cryptographic hash chain and payload.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
