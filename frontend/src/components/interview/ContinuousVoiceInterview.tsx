import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  AlertTriangle,
  Award,
  BookOpen,
  Activity,
  Server,
  Cpu,
  Mic,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { InterviewOrb } from './InterviewOrb';
import { LiveCaptions } from './LiveCaptions';
import { TranscriptDrawer } from './TranscriptDrawer';
import { InterviewControls } from './InterviewControls';
import { Badge } from '../common/Badge';
import { api } from '../../api/client';
import {
  InterviewState,
  PersistentInterviewTurn,
  PersistentInterviewSummary,
  ResumeParseResult,
} from '../../types';

interface ContinuousVoiceInterviewProps {
  sessionId: string;
  problemStatement: string;
  constraints?: string[];
  candidateCode?: string;
  language?: string;
  testResults?: any;
  onInterviewCompleted?: (summary: PersistentInterviewSummary) => void;
  onInterviewCancelled?: () => void;
}

export const ContinuousVoiceInterview: React.FC<ContinuousVoiceInterviewProps> = ({
  sessionId,
  problemStatement,
  constraints = [],
  candidateCode = '',
  language = 'python',
  testResults = null,
  onInterviewCompleted,
  onInterviewCancelled,
}) => {
  // State Machine
  const [state, setState] = useState<InterviewState>('IDLE');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCaptionsVisible, setIsCaptionsVisible] = useState<boolean>(true);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);

  // Health and Readiness
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [localAIOnline, setLocalAIOnline] = useState<boolean>(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);

  // Resume State
  const [resumeData, setResumeData] = useState<ResumeParseResult | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState<boolean>(false);
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(null);

  // Transcript and Dialogue
  const [turns, setTurns] = useState<PersistentInterviewTurn[]>([]);
  const [interviewerText, setInterviewerText] = useState<string>('');
  const [candidateLiveText, setCandidateLiveText] = useState<string>('');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('en');
  const [finalSummary, setFinalSummary] = useState<PersistentInterviewSummary | null>(null);

  // Diagnostic Telemetry
  const [diagRMS, setDiagRMS] = useState<number>(0);
  const [diagVAD, setDiagVAD] = useState<string>('SILENCE');
  const [diagLastASRLatency, setDiagLastASRLatency] = useState<number>(0);
  const [diagLastLLMLatency, setDiagLastLLMLatency] = useState<number>(0);

  // Authoritative Mutable References (Eliminates Stale React Closures)
  const stateRef = useRef<InterviewState>('IDLE');
  const turnsRef = useRef<PersistentInterviewTurn[]>([]);
  const audioLevelRef = useRef<number>(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const currentAudioElemRef = useRef<HTMLAudioElement | null>(null);
  const lastSpokenAudioBlobRef = useRef<Blob | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordedAudioChunksRef = useRef<Blob[]>([]);
  const isCandidateSpeakingRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<any>(null);
  const speechDetectedInTurnRef = useRef<boolean>(false);

  // Synchronize Authoritative References
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  // Check Backend and Local AI Service Readiness
  const checkServiceReadiness = async (): Promise<boolean> => {
    let bkOk = false;
    let aiOk = false;
    let errMsg = '';

    try {
      const bkHealth = await api.getBackendHealth();
      bkOk = bkHealth.status === 200 && bkHealth.data.status === 'healthy';
      setBackendOnline(bkOk);
    } catch {
      bkOk = false;
      setBackendOnline(false);
      errMsg += 'Go Backend (:8080) is offline. ';
    }

    try {
      const aiHealth = await api.getLocalAIHealth();
      aiOk = aiHealth.status === 200 && aiHealth.data.status === 'healthy';
      setLocalAIOnline(aiOk);
    } catch {
      aiOk = false;
      setLocalAIOnline(false);
      errMsg += 'Local AI Service (:8000) is offline.';
    }

    if (!bkOk || !aiOk) {
      setReadinessError(errMsg.trim());
      return false;
    }

    setReadinessError(null);
    return true;
  };

  useEffect(() => {
    checkServiceReadiness();
    const interval = setInterval(checkServiceReadiness, 5000);
    return () => clearInterval(interval);
  }, []);

  // Load existing turns on mount or after browser refresh
  useEffect(() => {
    if (!sessionId) return;
    api.getInterviewTurns(sessionId)
      .then((res) => {
        if (res.data && res.data.length > 0) {
          setTurns(res.data);
          turnsRef.current = res.data;
          const lastTurn = res.data[res.data.length - 1];
          if (lastTurn.speaker === 'INTERVIEWER') {
            setInterviewerText(lastTurn.transcript);
          }
        }
      })
      .catch(() => {});

    api.getInterviewSummary(sessionId)
      .then((res) => {
        if (res.data) {
          setFinalSummary(res.data);
          setState(res.data.status === 'COMPLETED' ? 'COMPLETED' : 'CANCELLED');
        }
      })
      .catch(() => {});
  }, [sessionId]);

  // Clean up all audio resources on unmount
  useEffect(() => {
    return () => {
      stopAllAudioHardware();
    };
  }, []);

  const stopAllAudioHardware = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    if (currentAudioElemRef.current) {
      try {
        currentAudioElemRef.current.pause();
      } catch {}
      currentAudioElemRef.current = null;
    }
  };

  // Resume Upload Handler
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingResume(true);
    setResumeUploadError(null);

    try {
      const res = await api.parseResume(file);
      setResumeData(res.data);
    } catch (err: any) {
      setResumeUploadError(err.message || 'Failed to parse resume');
    } finally {
      setIsUploadingResume(false);
    }
  };

  // Play Piper TTS with interruption and cancel safety
  const playSynthesizedSpeech = useCallback(
    async (text: string): Promise<void> => {
      if (!text || text.trim() === '') return;
      if (stateRef.current === 'COMPLETED' || stateRef.current === 'CANCELLED') return;

      // Stop any existing playback
      if (currentAudioElemRef.current) {
        try {
          currentAudioElemRef.current.pause();
        } catch {}
        currentAudioElemRef.current = null;
      }

      setState('SPEAKING');

      try {
        const res = await api.synthesizeSpeech(text, 'en');
        const curr = stateRef.current as InterviewState;
        if (curr === 'COMPLETED' || curr === 'CANCELLED') return;

        lastSpokenAudioBlobRef.current = res.audioBlob;
        const audioUrl = URL.createObjectURL(res.audioBlob);
        const audio = new Audio(audioUrl);
        currentAudioElemRef.current = audio;

        await new Promise<void>((resolve) => {
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            currentAudioElemRef.current = null;
            resolve();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            currentAudioElemRef.current = null;
            resolve();
          };
          audio.play().catch(() => {
            resolve();
          });
        });
      } catch (err: any) {
        console.warn('TTS playback failed or not available:', err.message);
        // Fallback delay to allow reading without fake audio simulation
        await new Promise((r) => setTimeout(r, 1200));
      }
    },
    []
  );

  // Initialize Microphone & Web Audio Time-Domain RMS
  const initializeAudioInput = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Time-domain RMS speech detection with adaptive ambient noise tracking
      const timeData = new Float32Array(analyser.fftSize);

      const monitorAudioStream = () => {
        analyser.getFloatTimeDomainData(timeData);

        // Compute Root-Mean-Square (RMS) amplitude
        let sumSquares = 0;
        for (let i = 0; i < timeData.length; i++) {
          sumSquares += timeData[i] * timeData[i];
        }
        const rms = Math.sqrt(sumSquares / timeData.length);
        const normalizedLevel = Math.min(rms * 5.0, 1.0); // 0.0 to 1.0

        audioLevelRef.current = normalizedLevel;
        setAudioLevel(normalizedLevel);
        setDiagRMS(Math.round(rms * 1000) / 1000);

        // Dynamic Speech Detection Hysteresis Threshold
        const SPEECH_ONSET_THRESHOLD = 0.025;
        const isSpeakingNow = rms > SPEECH_ONSET_THRESHOLD;
        setDiagVAD(isSpeakingNow ? 'ACTIVE_SPEECH' : 'SILENCE');

        // Barge-in Interruption: Stop AI if candidate speaks during SPEAKING state
        if (stateRef.current === 'SPEAKING' && isSpeakingNow) {
          if (currentAudioElemRef.current) {
            try {
              currentAudioElemRef.current.pause();
            } catch {}
            currentAudioElemRef.current = null;
          }
          setState('INTERRUPTED');
          setTimeout(() => {
            startListeningTurn();
          }, 350);
        }

        animationFrameRef.current = requestAnimationFrame(monitorAudioStream);
      };

      monitorAudioStream();
      return true;
    } catch (err: any) {
      console.error('Microphone initialization failed:', err);
      setState('FAILED');
      setReadinessError(`Microphone access error: ${err.message}`);
      return false;
    }
  };

  // Start Listening Turn with Guaranteed Non-Stale References
  const startListeningTurn = () => {
    if (!mediaStreamRef.current) return;
    if (stateRef.current === 'COMPLETED' || stateRef.current === 'CANCELLED') return;

    setState('LISTENING');
    setCandidateLiveText('');
    isCandidateSpeakingRef.current = false;
    speechDetectedInTurnRef.current = false;
    recordedAudioChunksRef.current = [];

    // Select container format supported by browser
    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
    }

    try {
      const recorder = new MediaRecorder(mediaStreamRef.current, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedAudioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const curr = stateRef.current as InterviewState;
        if (curr === 'COMPLETED' || curr === 'CANCELLED') return;

        const chunks = recordedAudioChunksRef.current;
        const totalSize = chunks.reduce((acc, c) => acc + c.size, 0);

        if (totalSize < 500 || !speechDetectedInTurnRef.current) {
          // No audible speech detected in this turn slice; loop cleanly back to listening
          if (stateRef.current === 'LISTENING') {
            startListeningTurn();
          }
          return;
        }

        const audioBlob = new Blob(chunks, { type: mimeType });
        await processCandidateAudioTurn(audioBlob, mimeType);
      };

      recorder.start(400); // 400ms chunk intervals

      // Time-domain VAD Interval checking silence duration
      const vadCheckInterval = setInterval(() => {
        if (stateRef.current !== 'LISTENING') {
          clearInterval(vadCheckInterval);
          return;
        }

        const currentRMS = audioLevelRef.current;
        if (currentRMS > 0.04) {
          speechDetectedInTurnRef.current = true;
          isCandidateSpeakingRef.current = true;
          setCandidateLiveText((prev) => (prev ? prev : 'Listening to your response...'));

          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (speechDetectedInTurnRef.current && !silenceTimerRef.current) {
          // 1.8s of silence after speech confirms utterance completion
          silenceTimerRef.current = setTimeout(() => {
            clearInterval(vadCheckInterval);
            if (recorder && recorder.state === 'recording') {
              recorder.stop();
            }
          }, 1800);
        }
      }, 150);
    } catch (err: any) {
      console.error('Failed to start MediaRecorder:', err);
      setState('FAILED');
    }
  };

  // Process Completed Utterance Slice
  const processCandidateAudioTurn = async (audioBlob: Blob, mimeType: string) => {
    setState('TRANSCRIBING');
    const asrStart = performance.now();

    try {
      // 1. Transcribe speech using Faster-Whisper with PyAV container decoding
      const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'wav';
      const audioFile = new File([audioBlob], `candidate_utterance.${ext}`, { type: mimeType });

      const transcribeRes = await api.transcribeAudio(audioFile, 'auto');
      const asrLatency = Math.round(performance.now() - asrStart);
      setDiagLastASRLatency(asrLatency);

      const transcript = transcribeRes.data.transcript?.trim();
      const lang = transcribeRes.data.detected_language || 'en';
      setDetectedLanguage(lang);

      if (!transcript || transcript.length < 3) {
        // Inaudible sound slice; prompt candidate gently
        const prompt = lang === 'hi' || lang === 'hinglish'
          ? "Aapki aawaz clear nahi thi, kya aap dobara bol sakte hain?"
          : "I did not quite catch that. Could you please repeat your explanation?";
        setInterviewerText(prompt);
        await playSynthesizedSpeech(prompt);
        startListeningTurn();
        return;
      }

      setCandidateLiveText(transcript);

      // Save candidate turn to backend durable store
      const currentList = turnsRef.current;
      const candidateTurn: PersistentInterviewTurn = {
        session_id: sessionId,
        turn_number: currentList.length + 1,
        speaker: 'CANDIDATE',
        transcript: transcript,
        detected_language: lang,
        technical_concepts: [],
        is_finalized: true,
      };

      await api.saveInterviewTurn(sessionId, candidateTurn).catch(() => {});
      const updatedList = [...currentList, candidateTurn];
      setTurns(updatedList);
      turnsRef.current = updatedList;

      setState('THINKING');
      const llmStart = performance.now();

      // 2. Generate Contextual AI Response
      const turnReq = {
        session_id: sessionId,
        problem_statement: problemStatement,
        constraints: constraints,
        candidate_code: candidateCode,
        language: language,
        test_results: testResults,
        resume_text: resumeData?.raw_text,
        resume_data: resumeData || undefined,
        candidate_utterance: transcript,
        conversation_history: updatedList.map((t) => ({
          role: t.speaker === 'INTERVIEWER' ? 'assistant' : 'user',
          content: t.transcript,
        })),
      };

      const result = await api.processInterviewTurn(turnReq);
      setDiagLastLLMLatency(Math.round(performance.now() - llmStart));

      const followUpText = result.data.response_text;
      const action = result.data.action;

      setInterviewerText(followUpText);

      // Save interviewer turn to backend durable store
      const interviewerTurn: PersistentInterviewTurn = {
        session_id: sessionId,
        turn_number: updatedList.length + 1,
        speaker: 'INTERVIEWER',
        transcript: followUpText,
        detected_language: result.data.detected_language,
        technical_concepts: result.data.technical_concepts,
        is_finalized: true,
      };

      await api.saveInterviewTurn(sessionId, interviewerTurn).catch(() => {});
      const finalList = [...updatedList, interviewerTurn];
      setTurns(finalList);
      turnsRef.current = finalList;

      // 3. Handle Explicit Conversational Actions
      if (action === 'END_INTERVIEW') {
        await playSynthesizedSpeech(followUpText);
        await handleGracefulStop();
        return;
      }

      if (action === 'CANCEL_INTERVIEW') {
        await playSynthesizedSpeech(followUpText);
        await handleExplicitCancel();
        return;
      }

      // 4. Synthesize & Play Interviewer Speech
      await playSynthesizedSpeech(followUpText);

      // 5. Loop back to candidate turn automatically
      if (stateRef.current !== 'COMPLETED' && stateRef.current !== 'CANCELLED') {
        startListeningTurn();
      }
    } catch (err: any) {
      console.error('Error during turn processing:', err);
      setState('LISTENING');
      startListeningTurn();
    }
  };

  // Start Voice Interview Call
  const handleStartInterview = async () => {
    const ready = await checkServiceReadiness();
    if (!ready) return;

    setState('INITIALIZING');
    const audioOk = await initializeAudioInput();
    if (!audioOk) return;

    setState('THINKING');

    // Contextual Initial Greeting grounded in candidate background and challenge
    let greeting = '';
    if (resumeData && resumeData.technologies.length > 0) {
      const topTech = resumeData.technologies.slice(0, 3).join(', ');
      greeting = `Welcome! I reviewed your engineering background with ${topTech}. Let's examine your implementation for ${problemStatement.split('\n')[0]}. Could you walk me through your overall approach?`;
    } else if (candidateCode && candidateCode.trim().length > 10) {
      greeting = `Hello! I see your submitted implementation for this challenge. Could you start by explaining how your algorithm works and why you chose this data structure?`;
    } else {
      greeting = `Welcome to your technical interview! Let's discuss your solution. Could you walk me through your thought process and algorithmic approach?`;
    }

    setInterviewerText(greeting);

    // Persist Initial Greeting Turn
    const greetingTurn: PersistentInterviewTurn = {
      session_id: sessionId,
      turn_number: 1,
      speaker: 'INTERVIEWER',
      transcript: greeting,
      detected_language: 'en',
      technical_concepts: ['algorithmic_approach'],
      is_finalized: true,
    };

    await api.saveInterviewTurn(sessionId, greetingTurn).catch(() => {});
    setTurns([greetingTurn]);
    turnsRef.current = [greetingTurn];

    // Play greeting audio
    await playSynthesizedSpeech(greeting);

    // Begin candidate turn
    startListeningTurn();
  };

  // Graceful Stop Interview
  const handleGracefulStop = async () => {
    setState('ENDING');
    stopAllAudioHardware();

    try {
      const evalRes = await api.evaluateInterview({
        session_id: sessionId,
        problem_statement: problemStatement,
        candidate_code: candidateCode,
        turns: turnsRef.current,
      });

      const summaryPayload: PersistentInterviewSummary = {
        session_id: sessionId,
        status: 'COMPLETED',
        overall_competency_pct: evalRes.data.overall_competency_pct || 0.0,
        topics_covered: evalRes.data.topics_covered || [],
        summary_narrative: evalRes.data.summary_narrative || 'Interview completed successfully.',
        evaluation_details: evalRes.data,
      };

      await api.saveInterviewSummary(sessionId, summaryPayload).catch(() => {});
      setFinalSummary(summaryPayload);
      setState('COMPLETED');
      onInterviewCompleted?.(summaryPayload);
    } catch (err) {
      console.error('Failed to generate interview summary:', err);
      setState('COMPLETED');
    }
  };

  // Explicit Cancel Interview
  const handleExplicitCancel = async () => {
    setState('CANCELLED');
    stopAllAudioHardware();

    const summaryPayload: PersistentInterviewSummary = {
      session_id: sessionId,
      status: 'CANCELLED',
      overall_competency_pct: 0.0,
      topics_covered: [],
      summary_narrative: 'Candidate cancelled the conversational interview before completion.',
    };

    await api.saveInterviewSummary(sessionId, summaryPayload).catch(() => {});
    setFinalSummary(summaryPayload);
    onInterviewCancelled?.();
  };

  const handleToggleMute = () => {
    if (mediaStreamRef.current) {
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
      }
    }
  };

  return (
    <div className="relative min-h-[620px] flex flex-col justify-between p-6 rounded-xl bg-cardBg border border-borderCol shadow-pixel-md overflow-hidden font-sans">
      {/* Subtle Starfield & Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-accentCyan/5 rounded-full blur-3xl pointer-events-none" />

      {/* TOP STATUS BAR: Session, Connectivity & Diagnostics */}
      <div className="flex items-center justify-between text-xs pb-3 border-b border-borderCol z-10">
        <div className="flex items-center gap-3">
          <Badge variant={state === 'LISTENING' ? 'success' : state === 'SPEAKING' ? 'info' : 'neutral'}>
            {state}
          </Badge>
          <span className="text-zinc-400 font-mono text-[11px]">
            Session: <span className="text-zinc-200">{sessionId.slice(0, 18)}...</span>
          </span>

          {/* Service Readiness Indicators */}
          <div className="flex items-center gap-2 pl-2 border-l border-borderCol text-[10px] font-mono">
            <span className={`flex items-center gap-1 ${backendOnline ? 'text-accentTeal' : 'text-accentRose'}`}>
              <Server className="w-3 h-3" />
              Go :8080 {backendOnline ? 'OK' : 'OFFLINE'}
            </span>
            <span className={`flex items-center gap-1 ${localAIOnline ? 'text-accentTeal' : 'text-accentRose'}`}>
              <Cpu className="w-3 h-3" />
              AI :8000 {localAIOnline ? 'OK' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Right Actions: Resume Attachment & Diagnostics Toggle */}
        <div className="flex items-center gap-2">
          {resumeData ? (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-cardSurface border border-accentTeal/50 text-accentTeal font-mono text-[11px]">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Resume Active ({resumeData.technologies.slice(0, 3).join(', ')})</span>
            </div>
          ) : (
            <label className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cardSurface border border-borderCol hover:border-accentCyan/60 cursor-pointer text-zinc-300 transition-colors font-mono text-[11px]">
              <Upload className="w-3.5 h-3.5 text-accentCyan" />
              <span>{isUploadingResume ? 'Analyzing...' : 'Attach Resume'}</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleResumeUpload}
                disabled={isUploadingResume || state !== 'IDLE'}
                className="hidden"
              />
            </label>
          )}

          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="p-1.5 rounded bg-cardSurface border border-borderCol hover:border-accentCyan text-zinc-400 hover:text-accentCyan transition-colors"
            title="Toggle Audio & Service Diagnostics"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Service Warning Banner if offline */}
      {readinessError && (
        <div className="my-2 p-2.5 rounded bg-rose-950/60 border border-accentRose text-rose-300 font-mono text-xs flex items-center gap-2 z-10">
          <AlertTriangle className="w-4 h-4 text-accentRose shrink-0" />
          <span>[SYSTEM ALERT] {readinessError} Start interview disabled until dependencies are online.</span>
        </div>
      )}

      {/* Live Audio & Engine Diagnostic Drawer */}
      {showDiagnostics && (
        <div className="my-2 p-3 rounded bg-cardSurface border border-borderCol text-[11px] font-mono grid grid-cols-2 sm:grid-cols-4 gap-3 z-10 text-zinc-300 shadow-inner">
          <div>
            <span className="text-zinc-500">Audio RMS:</span>{' '}
            <span className="text-accentCyan font-bold">{diagRMS}</span>
          </div>
          <div>
            <span className="text-zinc-500">VAD State:</span>{' '}
            <span className={diagVAD === 'ACTIVE_SPEECH' ? 'text-accentTeal font-bold' : 'text-zinc-400'}>
              {diagVAD}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">ASR Latency:</span>{' '}
            <span className="text-zinc-200">{diagLastASRLatency} ms</span>
          </div>
          <div>
            <span className="text-zinc-500">LLM Latency:</span>{' '}
            <span className="text-zinc-200">{diagLastLLMLatency} ms</span>
          </div>
        </div>
      )}

      {/* CENTER: Premium 3D Particle Heartbeat Orb */}
      <div className="my-auto py-2 flex flex-col items-center justify-center z-10">
        {state === 'COMPLETED' && finalSummary ? (
          <div className="w-full max-w-xl p-6 rounded-xl bg-cardSurface border border-accentTeal/80 text-center space-y-4 shadow-pixel-md">
            <div className="w-12 h-12 rounded-full bg-accentTeal/10 border border-accentTeal flex items-center justify-center mx-auto text-accentTeal">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold font-pixel text-accentTeal">INTERVIEW CONCLUDED</h3>
            <p className="text-zinc-300 text-xs leading-relaxed font-sans">
              {finalSummary.summary_narrative}
            </p>
            <div className="pt-2 flex justify-center gap-8 text-xs font-mono">
              <div>
                <div className="text-zinc-500 text-[10px]">Technical Competency</div>
                <div className="text-accentTeal font-bold text-lg">
                  {finalSummary.overall_competency_pct}%
                </div>
              </div>
              <div>
                <div className="text-zinc-500 text-[10px]">Verified Turns</div>
                <div className="text-accentCyan font-bold text-lg">{turns.length}</div>
              </div>
            </div>
          </div>
        ) : state === 'CANCELLED' ? (
          <div className="w-full max-w-md p-6 rounded-xl bg-cardSurface border border-accentRose/80 text-center space-y-3 shadow-pixel-md">
            <div className="w-12 h-12 rounded-full bg-accentRose/10 border border-accentRose flex items-center justify-center mx-auto text-accentRose">
              <XCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold font-pixel text-accentRose">INTERVIEW CANCELLED</h3>
            <p className="text-zinc-400 text-xs font-mono">
              All prior finalized responses have been preserved for audit.
            </p>
          </div>
        ) : (
          <InterviewOrb
            state={state}
            audioLevel={audioLevel}
            size={280}
          />
        )}
      </div>

      {/* LOWER AREA: Live Captions & Controls */}
      <div className="space-y-3 z-10">
        {isCaptionsVisible && (
          <LiveCaptions
            interviewerText={interviewerText}
            candidateLiveText={candidateLiveText}
            isCandidateSpeaking={state === 'LISTENING' && audioLevel > 0.04}
            isInterviewerSpeaking={state === 'SPEAKING'}
            detectedLanguage={detectedLanguage}
            onReplayAudio={
              lastSpokenAudioBlobRef.current
                ? () => {
                    const audioUrl = URL.createObjectURL(lastSpokenAudioBlobRef.current!);
                    const audio = new Audio(audioUrl);
                    audio.play();
                  }
                : undefined
            }
          />
        )}

        {/* Action Controls */}
        <InterviewControls
          state={state}
          isMuted={isMuted}
          isCaptionsVisible={isCaptionsVisible}
          isTranscriptOpen={isTranscriptOpen}
          onToggleMute={handleToggleMute}
          onToggleCaptions={() => setIsCaptionsVisible(!isCaptionsVisible)}
          onToggleTranscript={() => setIsTranscriptOpen(!isTranscriptOpen)}
          onStartInterview={handleStartInterview}
          onStopInterview={handleGracefulStop}
          onCancelInterview={handleExplicitCancel}
          onReplayLastAudio={
            lastSpokenAudioBlobRef.current
              ? () => {
                  const audioUrl = URL.createObjectURL(lastSpokenAudioBlobRef.current!);
                  const audio = new Audio(audioUrl);
                  audio.play();
                }
              : undefined
          }
        />
      </div>

      {/* SLIDE-OUT TRANSCRIPT DRAWER */}
      <TranscriptDrawer
        isOpen={isTranscriptOpen}
        onClose={() => setIsTranscriptOpen(false)}
        turns={turns}
        activeInterviewerText={state === 'SPEAKING' ? interviewerText : undefined}
      />
    </div>
  );
};
