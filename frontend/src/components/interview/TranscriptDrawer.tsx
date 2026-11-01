import React from 'react';
import { X, Sparkles, User, Clock, FileText, CheckCircle2 } from 'lucide-react';
import { PersistentInterviewTurn } from '../../types';

interface TranscriptDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  turns: PersistentInterviewTurn[];
  activeInterviewerText?: string;
}

export const TranscriptDrawer: React.FC<TranscriptDrawerProps> = ({
  isOpen,
  onClose,
  turns,
  activeInterviewerText,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-zinc-950/95 border-l border-borderCol shadow-2xl z-50 flex flex-col backdrop-blur-xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-borderCol flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-sky-400" />
          <h3 className="font-semibold text-sm text-zinc-100">Live Interview Transcript</h3>
          <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] text-zinc-300 font-mono">
            {turns.length} Turns
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Transcript Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
        {turns.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 space-y-2">
            <Clock className="w-8 h-8 mx-auto text-zinc-600" />
            <p>No conversation turns recorded yet.</p>
            <p className="text-[11px]">Turns will appear here in real time as the interview proceeds.</p>
          </div>
        ) : (
          turns.map((t, idx) => {
            const isAI = t.speaker === 'INTERVIEWER';
            return (
              <div
                key={t.id || `turn-${idx}`}
                className={`p-3.5 rounded-xl border space-y-2 transition-all ${
                  isAI
                    ? 'bg-zinc-900/80 border-sky-900/40 text-zinc-200'
                    : 'bg-zinc-900/40 border-emerald-900/40 text-zinc-100'
                }`}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5 font-semibold">
                    {isAI ? (
                      <>
                        <Sparkles className="w-3 h-3 text-sky-400" />
                        <span className="text-sky-300">AI Interviewer</span>
                      </>
                    ) : (
                      <>
                        <User className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Candidate</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-zinc-500 font-mono">
                    <span className="uppercase">{t.detected_language}</span>
                    <span>#{t.turn_number || idx + 1}</span>
                  </div>
                </div>

                <p className="leading-relaxed text-zinc-200 text-xs">{t.transcript}</p>

                {t.technical_concepts && t.technical_concepts.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {t.technical_concepts.map((concept) => (
                      <span
                        key={concept}
                        className="px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/50 text-cyan-400 font-mono text-[9px]"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Current In-Flight Interviewer Sentence */}
        {activeInterviewerText && (
          <div className="p-3.5 rounded-xl border border-sky-700/60 bg-sky-950/20 text-sky-100 space-y-1.5 animate-pulse">
            <div className="flex items-center gap-1.5 text-[10px] text-sky-400 font-semibold">
              <Sparkles className="w-3 h-3" />
              <span>AI Interviewer (Speaking)</span>
            </div>
            <p className="text-xs leading-relaxed">{activeInterviewerText}</p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3.5 border-t border-borderCol bg-zinc-900/50 text-[11px] text-zinc-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>RFC 9162 Verifiable Journal</span>
        </span>
        <span className="text-zinc-500 font-mono text-[10px]">Session Bound</span>
      </div>
    </div>
  );
};
