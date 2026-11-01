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
    <div className="w-full max-w-3xl mx-auto rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-2xl backdrop-blur-md p-5 space-y-4">
      {/* Header Info */}
      <div className="flex items-center justify-between text-[11px] pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2 text-zinc-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Real-Time Verbatim Speech Captions</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded bg-zinc-800 text-sky-400 font-mono text-[10px] uppercase">
            Language: {detectedLanguage}
          </span>
          {onReplayAudio && interviewerText && (
            <button
              onClick={onReplayAudio}
              className="flex items-center gap-1 text-zinc-400 hover:text-cyan-400 transition-colors text-[10px]"
              title="Replay last spoken sentence"
            >
              <Volume2 className="w-3 h-3" />
              <span>Replay</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Dialogue Box */}
      <div ref={scrollRef} className="space-y-4 max-h-[160px] overflow-y-auto pr-1 text-xs">
        {/* Interviewer Turn */}
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-sky-950/80 border border-sky-800/60 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sky-300 text-[11px]">AI Interviewer</span>
              {isInterviewerSpeaking && (
                <span className="flex items-center gap-1 text-[10px] text-sky-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
                  Speaking
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
          <div className="flex items-start gap-3 pt-2 border-t border-zinc-800/40">
            <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center shrink-0 mt-0.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-emerald-400 text-[11px]">You (Candidate)</span>
                {isCandidateSpeaking && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Listening
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
