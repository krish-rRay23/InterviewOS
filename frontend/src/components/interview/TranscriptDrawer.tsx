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
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-cardBg/98 border-l-2 border-borderCol shadow-pixel z-50 flex flex-col backdrop-blur-xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b-2 border-borderCol flex items-center justify-between bg-cardSurface/60">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-accentCyan" />
          <h3 className="font-pixel text-[10px] text-zinc-100 tracking-wide uppercase">Live Transcript Log</h3>
          <span className="px-2 py-0.5 rounded-none bg-cardSurface border border-borderCol text-[9px] text-accentTeal font-mono">
            {turns.length} TURNS
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-none border border-borderCol text-zinc-400 hover:text-accentCyan hover:border-accentCyan bg-cardSurface transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Transcript Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs font-sans">
        {turns.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 space-y-2">
            <Clock className="w-8 h-8 mx-auto text-zinc-600" />
            <p className="font-pixel text-[9px] uppercase text-zinc-400">No conversation turns recorded</p>
            <p className="text-[11px] font-mono">Turns stream here in real time as the interview proceeds.</p>
          </div>
        ) : (
          turns.map((t, idx) => {
            const isAI = t.speaker === 'INTERVIEWER';
            return (
              <div
                key={t.id || `turn-${idx}`}
                className={`p-3 rounded-none border-2 space-y-2 transition-all ${
                  isAI
                    ? 'bg-cardSurface/80 border-accentCyan/30 text-zinc-200'
                    : 'bg-cardBg/60 border-accentTeal/30 text-zinc-100'
                }`}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5 font-semibold">
                    {isAI ? (
                      <>
                        <Sparkles className="w-3 h-3 text-accentCyan" />
                        <span className="font-pixel text-[9px] text-accentCyan">AI INTERVIEWER</span>
                      </>
                    ) : (
                      <>
                        <User className="w-3 h-3 text-accentTeal" />
                        <span className="font-pixel text-[9px] text-accentTeal">CANDIDATE</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-zinc-500 font-mono text-[9px]">
                    <span className="uppercase">{t.detected_language}</span>
                    <span>TURN #{t.turn_number || idx + 1}</span>
                  </div>
                </div>

                <p className="leading-relaxed text-zinc-200 text-xs font-mono">{t.transcript}</p>

                {t.technical_concepts && t.technical_concepts.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {t.technical_concepts.map((concept) => (
                      <span
                        key={concept}
                        className="px-1.5 py-0.5 rounded-none bg-cardBg border border-borderCol text-accentCyan font-mono text-[9px]"
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
          <div className="p-3 rounded-none border-2 border-accentCyan/60 bg-cardSurface/90 text-accentCyan space-y-1.5 animate-pulse">
            <div className="flex items-center gap-1.5 text-[9px] text-accentCyan font-pixel">
              <Sparkles className="w-3 h-3" />
              <span>AI INTERVIEWER (TRANSMITTING)</span>
            </div>
            <p className="text-xs leading-relaxed font-mono">{activeInterviewerText}</p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t-2 border-borderCol bg-cardSurface/60 text-[10px] text-zinc-400 flex items-center justify-between font-mono">
        <span className="flex items-center gap-1.5 text-accentTeal">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>RFC 9162 VERIFIED JOURNAL</span>
        </span>
        <span className="text-zinc-500">IMMUTABLE LOG</span>
      </div>
    </div>
  );
};
