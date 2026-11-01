import React, { useRef, useEffect } from 'react';
import { Sparkles, User, Volume2, ShieldCheck } from 'lucide-react';

interface LiveCaptionsProps {
  interviewerText: string;
  candidateLiveText: string;
  isCandidateSpeaking: boolean;
  isInterviewerSpeaking: boolean;
  detectedLanguage?: string;
  onReplayAudio?: () => void;
}

export const LiveCaptions: React.FC<LiveCaptionsProps> = ({
  interviewerText,
  candidateLiveText,
  isCandidateSpeaking,
  isInterviewerSpeaking,
  detectedLanguage = 'en',
  onReplayAudio,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [interviewerText, candidateLiveText]);

  return (
    <div className="w-full max-w-3xl mx-auto rounded bg-cardBg/95 border-2 border-borderCol shadow-pixel-sm backdrop-blur-md p-4 space-y-3">
      {/* Header Info */}
      <div className="flex items-center justify-between text-[11px] pb-2 border-b border-borderCol">
        <div className="flex items-center gap-2 text-accentTeal font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-accentTeal" />
          <span className="font-pixel text-[9px] uppercase tracking-wider text-accentTeal">REAL-TIME CAPTION STREAM</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded-none bg-cardSurface border border-borderCol text-accentCyan font-mono text-[10px] uppercase">
            LANG: {detectedLanguage}
          </span>
          {onReplayAudio && interviewerText && (
            <button
              onClick={onReplayAudio}
              className="flex items-center gap-1 font-mono text-zinc-400 hover:text-accentCyan transition-colors text-[10px]"
              title="Replay last spoken sentence"
            >
              <Volume2 className="w-3 h-3" />
              <span>REPLAY</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Dialogue Box */}
      <div ref={scrollRef} className="space-y-4 max-h-[160px] overflow-y-auto pr-1 text-xs">
        {/* Interviewer Turn */}
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-none bg-cardSurface border border-accentCyan/40 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-3.5 h-3.5 text-accentCyan" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-pixel text-[9px] text-accentCyan tracking-wide">AI INTERVIEWER</span>
              {isInterviewerSpeaking && (
                <span className="flex items-center gap-1 font-mono text-[10px] text-accentCyan">
                  <span className="w-1.5 h-1.5 rounded-none bg-accentCyan animate-pulse" />
                  SPEAKING
                </span>
              )}
            </div>
            <p className="text-zinc-200 text-sm leading-relaxed font-sans">
              {interviewerText || 'Waiting for interview to begin...'}
            </p>
          </div>
        </div>

        {/* Candidate Turn / Live Interim Transcript */}
        {(candidateLiveText || isCandidateSpeaking) && (
          <div className="flex items-start gap-3 pt-2 border-t border-borderCol/60">
            <div className="w-7 h-7 rounded-none bg-cardSurface border border-accentTeal/40 flex items-center justify-center shrink-0 mt-0.5">
              <User className="w-3.5 h-3.5 text-accentTeal" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-pixel text-[9px] text-accentTeal tracking-wide">YOU (CANDIDATE)</span>
                {isCandidateSpeaking && (
                  <span className="flex items-center gap-1 font-mono text-[10px] text-accentTeal">
                    <span className="w-1.5 h-1.5 rounded-none bg-accentTeal animate-pulse" />
                    LISTENING
                  </span>
                )}
              </div>
              <p
                className={`text-sm leading-relaxed font-sans ${
                  isCandidateSpeaking ? 'text-zinc-400 italic' : 'text-zinc-100'
                }`}
              >
                {candidateLiveText || 'Listening to your response...'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
