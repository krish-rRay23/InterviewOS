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
    <div className="flex flex-wrap items-center justify-center gap-3 pt-4 select-none">
      {!isInterviewActive ? (
        <Button
          variant="primary"
          size="lg"
          onClick={onStartInterview}
          icon={<Play className="w-4 h-4 fill-current" />}
          className="shadow-lg shadow-sky-500/20 px-8"
        >
          Start Voice Interview Call
        </Button>
      ) : (
        <>
          {/* Microphone Mute Toggle */}
          <Button
            variant={isMuted ? 'danger' : 'outline'}
            size="md"
            onClick={onToggleMute}
            icon={isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? 'Muted' : 'Mute'}
          </Button>

          {/* Captions Toggle */}
          <Button
            variant={isCaptionsVisible ? 'secondary' : 'outline'}
            size="md"
            onClick={onToggleCaptions}
            icon={isCaptionsVisible ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
          >
            Captions
          </Button>

          {/* Transcript Drawer Toggle */}
          <Button
            variant={isTranscriptOpen ? 'secondary' : 'outline'}
            size="md"
            onClick={onToggleTranscript}
            icon={<FileText className="w-4 h-4 text-sky-400" />}
          >
            Transcript
          </Button>

          {/* Replay Audio */}
          {onReplayLastAudio && (
            <Button
              variant="outline"
              size="md"
              onClick={onReplayLastAudio}
              icon={<RotateCcw className="w-4 h-4 text-zinc-300" />}
              title="Replay last spoken statement"
            >
              Replay
            </Button>
          )}

          {/* Explicit Graceful Stop Interview */}
          <Button
            variant="secondary"
            size="md"
            onClick={onStopInterview}
            icon={<Square className="w-4 h-4 text-amber-400 fill-current" />}
            title="Conclude interview gracefully and generate evaluation report"
            className="border-amber-800/60 hover:border-amber-600 text-amber-200"
          >
            Stop Interview
          </Button>

          {/* Explicit Cancel Interview */}
          <Button
            variant="danger"
            size="md"
            onClick={onCancelInterview}
            icon={<XOctagon className="w-4 h-4" />}
            title="Cancel interview immediately without completion evaluation"
          >
            Cancel Interview
          </Button>
        </>
      )}
    </div>
  );
};
