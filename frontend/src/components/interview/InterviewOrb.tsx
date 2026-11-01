import React, { useEffect, useRef } from 'react';
import { InterviewState } from '../../types';

interface InterviewOrbProps {
  state: InterviewState;
  audioLevel?: number; // 0.0 to 1.0 (from Web Audio AnalyserNode RMS)
  subtitle?: string;
  size?: number;
}

interface Particle3D {
  x: number;
  y: number;
  z: number;
  baseRadius: number;
  theta: number;
  phi: number;
  speed: number;
  colorType: 'cyan' | 'teal' | 'blue' | 'amber';
  size: number;
  filamentLen: number;
}

export const InterviewOrb: React.FC<InterviewOrbProps> = ({
  state,
  audioLevel = 0.0,
  subtitle,
  size = 280,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // High DPI scaling
    const dpr = window.devicePixelRatio || 1;
    const canvasDim = size * 1.5;
    canvas.width = canvasDim * dpr;
    canvas.height = canvasDim * dpr;
    ctx.scale(dpr, dpr);

    let animationFrameId: number;
    let time = 0;

    // Generate ~1400 3D spherical particles and curved filaments
    const PARTICLE_COUNT = 1400;
    const particles: Particle3D[] = [];
    const sphereRadius = size * 0.35;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Fibonacci sphere distribution for uniform spherical density
      const y = 1 - (i / (PARTICLE_COUNT - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const theta = goldenAngle * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      // Color distribution: deep teal, electric cyan, muted blue, and warm amber lower highlight
      let colorType: 'cyan' | 'teal' | 'blue' | 'amber' = 'cyan';
      if (y < -0.25 && x > -0.2) {
        // Lower circumference warm amber highlight (inspired by reference)
        colorType = Math.random() < 0.65 ? 'amber' : 'teal';
      } else {
        const rand = Math.random();
        if (rand < 0.45) colorType = 'cyan';
        else if (rand < 0.8) colorType = 'teal';
        else colorType = 'blue';
      }

      particles.push({
        x: x * sphereRadius,
        y: y * sphereRadius,
        z: z * sphereRadius,
        baseRadius: sphereRadius,
        theta,
        phi: Math.asin(y),
        speed: 0.008 + Math.random() * 0.012,
        colorType,
        size: 0.8 + Math.random() * 1.6,
        filamentLen: 2 + Math.random() * 6,
      });
    }

    const render = () => {
      time += prefersReducedMotion ? 0.005 : 0.025;
      ctx.clearRect(0, 0, canvasDim, canvasDim);

      const centerX = canvasDim / 2;
      const centerY = canvasDim / 2;

      // 1. Human Heartbeat Pulse Calculation
      // Double peak pulse: Lub (primary expansion) - Dub (secondary smaller pulse) - Pause
      const heartbeatCycle = (time * 1.1) % (Math.PI * 2);
      let heartbeatScale = 1.0;
      let heartbeatGlow = 0.0;

      if (heartbeatCycle < 0.35) {
        // Primary Lub pulse
        const p1 = Math.sin((heartbeatCycle / 0.35) * Math.PI);
        heartbeatScale += p1 * 0.055;
        heartbeatGlow += p1 * 0.3;
      } else if (heartbeatCycle > 0.45 && heartbeatCycle < 0.75) {
        // Secondary Dub pulse
        const p2 = Math.sin(((heartbeatCycle - 0.45) / 0.3) * Math.PI);
        heartbeatScale += p2 * 0.03;
        heartbeatGlow += p2 * 0.18;
      }

      // 2. Audio and State Reactivity
      let stateScale = 1.0;
      let rotationSpeed = 0.008;
      let dynamicGlow = 0.0;

      switch (state) {
        case 'LISTENING':
          stateScale += Math.min(audioLevel * 0.4, 0.35);
          dynamicGlow = Math.min(audioLevel * 0.8, 0.6);
          break;
        case 'SPEAKING':
          const speechPulse = Math.sin(time * 3.5) * 0.06;
          stateScale += speechPulse + Math.min(audioLevel * 0.45, 0.35);
          dynamicGlow = 0.4 + Math.sin(time * 2.5) * 0.2;
          rotationSpeed = 0.02;
          break;
        case 'THINKING':
        case 'PROCESSING':
          rotationSpeed = 0.035;
          heartbeatScale += Math.sin(time * 5.0) * 0.04;
          dynamicGlow = 0.3;
          break;
        case 'TRANSCRIBING':
          rotationSpeed = 0.025;
          break;
        case 'INTERRUPTED':
          stateScale *= 0.95;
          dynamicGlow = 0.5;
          break;
        case 'PAUSED':
          rotationSpeed = 0.002;
          break;
        case 'COMPLETED':
          stateScale = 1.02;
          dynamicGlow = 0.25;
          break;
        case 'CANCELLED':
        case 'FAILED':
          stateScale = 0.9;
          break;
      }

      const totalScale = heartbeatScale * stateScale;
      const rotAngleY = time * rotationSpeed;
      const rotAngleX = Math.sin(time * 0.4) * 0.25;

      // 3. Render Atmospheric Outer Glow
      const ambientRadius = sphereRadius * totalScale * 1.6;
      const glowGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        sphereRadius * 0.3,
        centerX,
        centerY,
        ambientRadius
      );

      if (state === 'FAILED') {
        glowGrad.addColorStop(0, 'rgba(244, 63, 94, 0.25)');
        glowGrad.addColorStop(0.6, 'rgba(225, 29, 72, 0.06)');
        glowGrad.addColorStop(1, 'rgba(5, 7, 13, 0)');
      } else {
        glowGrad.addColorStop(0, `rgba(0, 242, 254, ${0.15 + heartbeatGlow * 0.2 + dynamicGlow * 0.2})`);
        glowGrad.addColorStop(0.55, `rgba(5, 213, 178, ${0.08 + dynamicGlow * 0.1})`);
        glowGrad.addColorStop(0.85, 'rgba(245, 158, 11, 0.03)');
        glowGrad.addColorStop(1, 'rgba(5, 7, 13, 0)');
      }

      ctx.beginPath();
      ctx.arc(centerX, centerY, ambientRadius, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();

      // 4. Transform, Project, and Sort Particles (Back to Front)
      const projected = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Wave surface perturbation
        const wave = Math.sin(p.phi * 4 + time * 2) * (2 + audioLevel * 8);
        const currentR = (p.baseRadius + wave) * totalScale;

        // Spherical coords with active rotation
        const currentTheta = p.theta + rotAngleY;
        const currentPhi = p.phi + rotAngleX;

        const x = Math.cos(currentTheta) * Math.cos(currentPhi) * currentR;
        const y = Math.sin(currentPhi) * currentR;
        const z = Math.sin(currentTheta) * Math.cos(currentPhi) * currentR;

        // 3D Perspective Projection
        const fov = 340;
        const perspective = fov / (fov + z);
        const projX = centerX + x * perspective;
        const projY = centerY + y * perspective;
        const projSize = Math.max(0.4, p.size * perspective);

        // Alpha calculation based on depth (Z)
        const depthAlpha = Math.max(0.1, (z + currentR) / (currentR * 2));

        projected.push({
          x: projX,
          y: projY,
          z,
          size: projSize,
          alpha: depthAlpha,
          colorType: p.colorType,
          filamentLen: p.filamentLen * perspective,
          tangentAngle: currentTheta + Math.PI / 2,
        });
      }

      // Sort by Z for realistic depth layering
      projected.sort((a, b) => a.z - b.z);

      // 5. Draw Deep Central Depth Sphere
      const coreGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        sphereRadius * totalScale * 0.95
      );
      coreGrad.addColorStop(0, 'rgba(4, 8, 18, 0.95)');
      coreGrad.addColorStop(0.7, 'rgba(6, 16, 32, 0.85)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0.2)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, sphereRadius * totalScale * 0.95, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // 6. Draw 3D Filament Strands and Glowing Particles
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];

        let colorBase = '0, 242, 254'; // cyan
        if (state === 'FAILED') {
          colorBase = '244, 63, 94';
        } else if (p.colorType === 'amber') {
          colorBase = '245, 158, 11';
        } else if (p.colorType === 'teal') {
          colorBase = '5, 213, 178';
        } else if (p.colorType === 'blue') {
          colorBase = '2, 132, 199';
        }

        const effectiveAlpha = Math.min(1.0, p.alpha * (0.45 + heartbeatGlow + dynamicGlow));

        // Draw short curved filament strand
        ctx.beginPath();
        const startX = p.x - Math.cos(p.tangentAngle) * p.filamentLen;
        const startY = p.y - Math.sin(p.tangentAngle) * p.filamentLen;
        ctx.moveTo(startX, startY);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = `rgba(${colorBase}, ${effectiveAlpha * 0.65})`;
        ctx.lineWidth = Math.max(0.6, p.size * 0.8);
        ctx.stroke();

        // Draw particle node
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${colorBase}, ${effectiveAlpha})`;
        ctx.fill();
      }

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
        return { label: 'LISTENING', detail: 'Microphone active. Turn-taking is automatic.' };
      case 'TRANSCRIBING':
        return { label: 'UNDERSTANDING', detail: 'Local Faster-Whisper ASR processing speech...' };
      case 'THINKING':
      case 'PROCESSING':
        return { label: 'ANALYZING', detail: 'Local Qwen 2.5-Coder evaluating technical reasoning...' };
      case 'SPEAKING':
        return { label: 'SPEAKING', detail: 'Piper TTS audio stream playing (interrupt anytime)' };
      case 'INTERRUPTED':
        return { label: 'INTERRUPTED', detail: 'Audio halted. Listening to your follow-up...' };
      case 'PAUSED':
        return { label: 'PAUSED', detail: 'Interview suspended. Click Resume when ready.' };
      case 'ENDING':
      case 'COMPLETED':
        return { label: 'CONCLUDED', detail: 'Cryptographic transcript sealed. Summary generated.' };
      case 'CANCELLED':
        return { label: 'CANCELLED', detail: 'Interview cancelled. Prior finalized turns preserved.' };
      case 'FAILED':
        return { label: 'SYSTEM ALERT', detail: 'Audio hardware or local service unavailable.' };
      default:
        return { label: 'READY', detail: 'Click Start Voice Interview Call to commence' };
    }
  };

  const statusInfo = getStateDescription(state);

  return (
    <div className="flex flex-col items-center justify-center select-none py-2">
      <div className="relative flex items-center justify-center">
        <canvas
          ref={canvasRef}
          style={{ width: `${size * 1.5}px`, height: `${size * 1.5}px` }}
        />
      </div>

      <div className="text-center mt-1 space-y-1 z-10">
        <div className="text-xs font-mono font-bold tracking-widest text-zinc-100 flex items-center justify-center gap-2">
          {state === 'LISTENING' && <span className="w-1.5 h-1.5 bg-accentCyan animate-ping" />}
          {state === 'SPEAKING' && <span className="w-1.5 h-1.5 bg-accentTeal animate-pulse" />}
          {state === 'THINKING' && <span className="w-1.5 h-1.5 bg-accentAmber animate-spin" />}
          <span className="font-pixel text-[10px] tracking-wider text-accentCyan">
            {statusInfo.label}
          </span>
        </div>
        <p className="text-[11px] font-mono text-zinc-400 max-w-sm">
          {subtitle || statusInfo.detail}
        </p>
      </div>
    </div>
  );
};
