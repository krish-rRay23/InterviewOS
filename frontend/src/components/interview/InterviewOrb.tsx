import React, { useEffect, useRef } from 'react';
import { InterviewState } from '../../types';

interface InterviewOrbProps {
  state: InterviewState;
  audioLevel?: number; // 0.0 to 1.0 (from Web Audio AnalyserNode)
  subtitle?: string;
  size?: number;
}

export const InterviewOrb: React.FC<InterviewOrbProps> = ({
  state,
  audioLevel = 0.0,
  subtitle,
  size = 260,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let step = 0;

    const render = () => {
      step += 0.035;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = (size / 2) * 0.58;

      // Dynamic amplitude based on real audio level and interview state
      let activeBoost = 0;
      let primaryColor = 'rgba(14, 165, 233, '; // Sky blue (default/ready)
      let secondaryColor = 'rgba(6, 182, 212, '; // Cyan

      switch (state) {
        case 'LISTENING':
          activeBoost = Math.max(audioLevel * 45, Math.sin(step * 2.5) * 8);
          primaryColor = 'rgba(16, 185, 129, '; // Emerald
          secondaryColor = 'rgba(52, 211, 153, ';
          break;
        case 'SPEAKING':
          activeBoost = Math.sin(step * 3) * 18 + Math.cos(step * 1.8) * 12;
          primaryColor = 'rgba(2, 132, 199, '; // Rich Ocean
          secondaryColor = 'rgba(99, 102, 241, '; // Indigo
          break;
        case 'THINKING':
        case 'PROCESSING':
          activeBoost = Math.sin(step * 4) * 12;
          primaryColor = 'rgba(168, 85, 247, '; // Purple
          secondaryColor = 'rgba(236, 72, 153, '; // Pink
          break;
        case 'TRANSCRIBING':
          activeBoost = Math.cos(step * 3) * 10;
          primaryColor = 'rgba(245, 158, 11, '; // Amber
          secondaryColor = 'rgba(251, 191, 36, ';
          break;
        case 'INTERRUPTED':
          activeBoost = 4;
          primaryColor = 'rgba(244, 63, 94, '; // Rose
          secondaryColor = 'rgba(251, 113, 133, ';
          break;
        case 'PAUSED':
          activeBoost = 0;
          primaryColor = 'rgba(113, 113, 122, '; // Zinc
          secondaryColor = 'rgba(161, 161, 170, ';
          break;
        case 'COMPLETED':
          activeBoost = 2;
          primaryColor = 'rgba(16, 185, 129, '; // Green
          secondaryColor = 'rgba(20, 184, 166, ';
          break;
        case 'CANCELLED':
        case 'FAILED':
          activeBoost = 0;
          primaryColor = 'rgba(239, 68, 68, '; // Red
          secondaryColor = 'rgba(185, 28, 28, ';
          break;
        default: // IDLE, READY, INITIALIZING
          activeBoost = Math.sin(step * 1.2) * 5;
          primaryColor = 'rgba(14, 165, 233, ';
          secondaryColor = 'rgba(6, 182, 212, ';
      }

      const effectiveRadius = baseRadius + activeBoost;

      // Outer ambient glow ring
      const outerGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        effectiveRadius * 0.4,
        centerX,
        centerY,
        effectiveRadius * 1.55
      );
      outerGrad.addColorStop(0, primaryColor + '0.45)');
      outerGrad.addColorStop(0.65, secondaryColor + '0.15)');
      outerGrad.addColorStop(1, 'rgba(9, 9, 11, 0)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, effectiveRadius * 1.55, 0, Math.PI * 2);
      ctx.fillStyle = outerGrad;
      ctx.fill();

      // Fluid harmonic wave layers
      const waves = 4;
      for (let i = 0; i < waves; i++) {
        ctx.beginPath();
        const waveOffset = (i * Math.PI) / 2;
        const radiusScale = 0.88 + i * 0.05;

        for (let angle = 0; angle <= Math.PI * 2; angle += 0.05) {
          const wobble =
            Math.sin(angle * 5 + step * 2 + waveOffset) * (3 + activeBoost * 0.3) +
            Math.cos(angle * 3 - step * 1.5) * (2 + activeBoost * 0.2);

          const r = effectiveRadius * radiusScale + wobble;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          if (angle === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.strokeStyle = primaryColor + (0.35 - i * 0.07) + ')';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Core sphere gradient
      const coreGrad = ctx.createRadialGradient(
        centerX - effectiveRadius * 0.25,
        centerY - effectiveRadius * 0.25,
        effectiveRadius * 0.1,
        centerX,
        centerY,
        effectiveRadius
      );
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.3, secondaryColor + '0.9)');
      coreGrad.addColorStop(0.75, primaryColor + '0.75)');
      coreGrad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, effectiveRadius, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.shadowColor = primaryColor + '0.8)';
      ctx.shadowBlur = 24 + activeBoost;
      ctx.fill();
      ctx.shadowBlur = 0;

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [state, audioLevel, size]);

  const getStateDescription = (st: InterviewState): { label: string; detail: string } => {
    switch (st) {
      case 'LISTENING':
        return { label: 'Listening...', detail: 'Speak naturally. Turn-taking is automatic.' };
      case 'TRANSCRIBING':
        return { label: 'Transcribing speech', detail: 'Faster-Whisper STT processing...' };
      case 'THINKING':
      case 'PROCESSING':
        return { label: 'Analyzing response', detail: 'Local Qwen 2.5-Coder reasoning...' };
      case 'SPEAKING':
        return { label: 'Speaking follow-up', detail: 'Piper TTS audio stream playing (interrupt anytime)' };
      case 'INTERRUPTED':
        return { label: 'Interrupted', detail: 'Stopping audio playback and listening...' };
      case 'PAUSED':
        return { label: 'Interview Paused', detail: 'Click Resume when ready' };
      case 'ENDING':
      case 'COMPLETED':
        return { label: 'Interview Concluded', detail: 'Persisting verbatim transcript & evaluation summary' };
      case 'CANCELLED':
        return { label: 'Interview Cancelled', detail: 'Prior responses preserved for audit' };
      case 'FAILED':
        return { label: 'Engine Error', detail: 'Microphone or local AI runtime unavailable' };
      default:
        return { label: 'Ready to Begin', detail: 'Click Start Voice Interview to commence' };
    }
  };

  const statusInfo = getStateDescription(state);

  return (
    <div className="flex flex-col items-center justify-center select-none">
      <div className="relative flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={size * 1.4}
          height={size * 1.4}
          style={{ width: `${size * 1.4}px`, height: `${size * 1.4}px` }}
        />
      </div>

      <div className="text-center mt-2 space-y-1">
        <div className="text-sm font-semibold tracking-wide text-zinc-100 flex items-center justify-center gap-2">
          {state === 'LISTENING' && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
          {state === 'SPEAKING' && <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />}
          {state === 'THINKING' && <span className="w-2 h-2 rounded-full bg-purple-400 animate-spin" />}
          <span>{statusInfo.label}</span>
        </div>
        <p className="text-[11px] text-zinc-400 max-w-sm">
          {subtitle || statusInfo.detail}
        </p>
      </div>
    </div>
  );
};
