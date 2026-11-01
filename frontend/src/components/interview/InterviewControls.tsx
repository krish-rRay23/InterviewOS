import React from 'react';
import {
  Mic,
  MicOff,
  Square,
  XOctagon,
  FileText,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../common/Button';
import { InterviewState } from '../../types';

interface InterviewControlsProps {
  state: InterviewState;
  isMuted: boolean;
  isCaptionsVisible: boolean;
  isTranscriptOpen: boolean;
  onToggleMute: () => void;
  onToggleCaptions: () => void;
  onToggleTranscript: () => void;
  onStartInterview: () => void;
  onStopInterview: () => void;
  onCancelInterview: () => void;
  onReplayLastAudio?: () => void;
}

export const InterviewControls: React.FC<InterviewControlsProps> = ({
  state,
  isMuted,
  isCaptionsVisible,
  isTranscriptOpen,
  onToggleMute,
  onToggleCaptions,
  onToggleTranscript,
  onStartInterview,
  onStopInterview,
  onCancelInterview,
  onReplayLastAudio,
}) => {
  const isInterviewActive =
    state !== 'IDLE' &&
    state !== 'COMPLETED' &&
    state !== 'CANCELLED' &&
    state !== 'FAILED';

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 pt-4 select-none font-mono">
      {!isInterviewActive ? (
        <Button
          variant="primary"
          size="lg"
          onClick={onStartInterview}
          icon={<Play className="w-4 h-4 fill-current text-darkBg" />}
          className="shadow-pixel px-8 font-pixel text-[10px] tracking-wider uppercase border-2 border-accentCyan"
        >
          Initialize Voice Interview Call
        </Button>
      ) : (
        <>
          {/* Microphone Mute Toggle */}
          <Button
            variant={isMuted ? 'danger' : 'outline'}
            size="md"
            onClick={onToggleMute}
            icon={isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-accentTeal" />}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            className="border-2 border-borderCol hover:border-accentCyan text-xs"
          >
            {isMuted ? 'UNMUTE MIC' : 'MUTE MIC'}
          </Button>

          {/* Captions Toggle */}
          <Button
            variant={isCaptionsVisible ? 'secondary' : 'outline'}
            size="md"
            onClick={onToggleCaptions}
            icon={isCaptionsVisible ? <Volume2 className="w-4 h-4 text-accentCyan" /> : <VolumeX className="w-4 h-4" />}
            className="border-2 border-borderCol hover:border-accentCyan text-xs"
          >
            CAPTIONS
          </Button>

          {/* Transcript Drawer Toggle */}
          <Button
            variant={isTranscriptOpen ? 'secondary' : 'outline'}
            size="md"
            onClick={onToggleTranscript}
            icon={<FileText className="w-4 h-4 text-accentCyan" />}
            className="border-2 border-borderCol hover:border-accentCyan text-xs"
          >
            TRANSCRIPT
          </Button>

          {/* Replay Audio */}
          {onReplayLastAudio && (
            <Button
              variant="outline"
              size="md"
              onClick={onReplayLastAudio}
              icon={<RotateCcw className="w-4 h-4 text-zinc-300" />}
              title="Replay last spoken statement"
              className="border-2 border-borderCol hover:border-accentCyan text-xs"
            >
              REPLAY
            </Button>
          )}

          {/* Explicit Graceful Stop Interview */}
          <Button
            variant="secondary"
            size="md"
            onClick={onStopInterview}
            icon={<Square className="w-4 h-4 text-accentAmber fill-current" />}
            title="Conclude interview gracefully and generate evaluation report"
            className="border-2 border-accentAmber/60 hover:border-accentAmber text-accentAmber text-xs font-mono"
          >
            CONCLUDE INTERVIEW
          </Button>

          {/* Explicit Cancel Interview */}
          <Button
            variant="danger"
            size="md"
            onClick={onCancelInterview}
            icon={<XOctagon className="w-4 h-4" />}
            title="Cancel interview immediately without completion evaluation"
            className="border-2 border-accentRose/60 hover:border-accentRose text-xs"
          >
            ABORT INTERVIEW
          </Button>
        </>
      )}
    </div>
  );
};
