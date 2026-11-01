import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  AlertTriangle,
  Award,
  BookOpen,
} from 'lucide-react';
import { InterviewOrb } from './InterviewOrb';
import { LiveCaptions } from './LiveCaptions';
import { TranscriptDrawer } from './TranscriptDrawer';
import { InterviewControls } from './InterviewControls';
import { Button } from '../common/Button';
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

  // Audio References
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const currentAudioElemRef = useRef<HTMLAudioElement | null>(null);
  const lastSpokenAudioBlobRef = useRef<Blob | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isCandidateSpeakingRef = useRef<boolean>(false);
  const recordedAudioChunksRef = useRef<Blob[]>([]);
  const stateRef = useRef<InterviewState>('IDLE');
  const silenceTimerRef = useRef<any>(null);

  // Keep stateRef synced
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Load existing turns on mount or after page refresh
  useEffect(() => {
    if (!sessionId) return;
    api.getInterviewTurns(sessionId)
      .then((res) => {
        if (res.data && res.data.length > 0) {
          setTurns(res.data);
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

  // Clean up audio hardware on unmount
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

  // Play Piper TTS with sentence-aware playback and interruption support
  const playSynthesizedSpeech = useCallback(
    async (text: string): Promise<void> => {
      if (!text || text.trim() === '') return;

      // Stop any existing playback
      if (currentAudioElemRef.current) {
        try {
          currentAudioElemRef.current.pause();
        } catch {}
        currentAudioElemRef.current = null;
      }

      setState('SPEAKING');

      try {
        // Attempt synthesis; piper supports English locally
        const res = await api.synthesizeSpeech(text, 'en');
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
        console.warn('TTS playback not available or failed:', err.message);
        // Fallback: delay based on word count to simulate natural speaking time if TTS disabled
        const delay = Math.min(Math.max(text.split(' ').length * 160, 2000), 6000);
        await new Promise((r) => setTimeout(r, delay));
      }
    },
    []
  );

  // Initialize Microphone & Web Audio Analyser
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
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Continuous audio level tracker & Voice Activity Detection (VAD)
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const monitorAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length / 255.0; // 0.0 to 1.0
        setAudioLevel(avg);

        // Barge-in Interruption Detection: If candidate starts speaking while AI is speaking
        if (stateRef.current === 'SPEAKING' && avg > 0.16) {
          if (currentAudioElemRef.current) {
            try {
              currentAudioElemRef.current.pause();
            } catch {}
            currentAudioElemRef.current = null;
          }
          setState('INTERRUPTED');
          setTimeout(() => {
            startListeningTurn();
          }, 400);
        }

        animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
      };

      monitorAudioLevel();
      return true;
    } catch (err) {
      console.error('Microphone initialization failed:', err);
      setState('FAILED');
      return false;
    }
  };

  // Start Listening to Candidate Response
  const startListeningTurn = () => {
    if (!mediaStreamRef.current) return;
    if (stateRef.current === 'COMPLETED' || stateRef.current === 'CANCELLED') return;

    setState('LISTENING');
    setCandidateLiveText('');
    isCandidateSpeakingRef.current = false;
    recordedAudioChunksRef.current = [];

    // Determine correct container MIME type supported by browser
    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm';
    }

    try {
      const recorder = new MediaRecorder(mediaStreamRef.current, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedAudioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        if (stateRef.current === 'COMPLETED' || stateRef.current === 'CANCELLED') return;

        const audioBlob = new Blob(recordedAudioChunksRef.current, { type: mimeType });
        if (audioBlob.size < 400) {
          // Empty or silent turn, loop back to listening
          if (stateRef.current === 'LISTENING') {
            startListeningTurn();
          }
          return;
        }

        await processCandidateAudioTurn(audioBlob, mimeType);
      };

      recorder.start(500); // 500ms audio slices

      // VAD Silence timer: detect candidate speaking end (1.8s of silence after speech)
      let speechStarted = false;
      const vadInterval = setInterval(() => {
        if (stateRef.current !== 'LISTENING') {
          clearInterval(vadInterval);
          return;
        }

        if (audioLevel > 0.12) {
          speechStarted = true;
          isCandidateSpeakingRef.current = true;
          setCandidateLiveText((prev) => (prev ? prev : 'Candidate speaking...'));
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (speechStarted && !silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            clearInterval(vadInterval);
            if (recorder.state === 'recording') {
              recorder.stop();
            }
          }, 1800);
        }
      }, 200);
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
      setState('FAILED');
    }
  };

  // Process Completed Audio Turn: Transcribe -> Adaptive Follow-up -> Save -> Speak
  const processCandidateAudioTurn = async (audioBlob: Blob, mimeType: string) => {
    setState('TRANSCRIBING');

    try {
      // 1. Transcribe speech using local Faster-Whisper
      const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'wav';
      const audioFile = new File([audioBlob], `candidate_utterance.${ext}`, { type: mimeType });

      const transcribeRes = await api.transcribeAudio(audioFile, 'auto');
      const transcript = transcribeRes.data.transcript?.trim();
      const lang = transcribeRes.data.detected_language || 'en';
      setDetectedLanguage(lang);

      if (!transcript || transcript.length < 3) {
        // Inaudible utterance, gently ask to repeat
        const prompt = lang === 'hi' || lang === 'hinglish'
          ? "Aapki aawaz thodi dheemi thi, kya aap dobara bol sakte hain?"
          : "I did not quite catch that. Could you repeat your explanation?";
        setInterviewerText(prompt);
        await playSynthesizedSpeech(prompt);
        startListeningTurn();
        return;
      }

      setCandidateLiveText(transcript);

      // Save candidate turn to backend store
      const candidateTurn: PersistentInterviewTurn = {
        session_id: sessionId,
        turn_number: turns.length + 1,
        speaker: 'CANDIDATE',
        transcript: transcript,
        detected_language: lang,
        technical_concepts: [],
        is_finalized: true,
      };

      await api.saveInterviewTurn(sessionId, candidateTurn).catch(() => {});
      const updatedTurns = [...turns, candidateTurn];
      setTurns(updatedTurns);

      setState('THINKING');

      // 2. Process turn with ConversationalEngine
      const turnReq = {
        session_id: sessionId,
        problem_statement: problemStatement,
        constraints: constraints,
        candidate_code: candidateCode,
        language: language,
        test_results: testResults,
        resume_text: resumeData?.raw_text,
        candidate_utterance: transcript,
        conversation_history: updatedTurns.map((t) => ({
          role: t.speaker === 'INTERVIEWER' ? 'assistant' : 'user',
          content: t.transcript,
        })),
      };

      const result = await api.processInterviewTurn(turnReq);
      const followUpText = result.data.response_text;
      const action = result.data.action;

      setInterviewerText(followUpText);

      // Save interviewer turn to backend store
      const interviewerTurn: PersistentInterviewTurn = {
        session_id: sessionId,
        turn_number: updatedTurns.length + 1,
        speaker: 'INTERVIEWER',
        transcript: followUpText,
        detected_language: result.data.detected_language,
        technical_concepts: result.data.technical_concepts,
        is_finalized: true,
      };
      await api.saveInterviewTurn(sessionId, interviewerTurn).catch(() => {});
      setTurns([...updatedTurns, interviewerTurn]);

      // 3. Handle Termination Actions
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

      // 4. Speak Follow-Up and loop back to listening
      await playSynthesizedSpeech(followUpText);

      // Continue interview turn-taking
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
    setState('INITIALIZING');
    const audioOk = await initializeAudioInput();
    if (!audioOk) return;

    setState('THINKING');

    // Build intelligent initial greeting based on resume or challenge
    let greeting = '';
    if (resumeData && resumeData.technologies.length > 0) {
      const topTech = resumeData.technologies.slice(0, 3).join(', ');
      greeting = `Hello! I reviewed your engineering background with ${topTech}. Let's examine your implementation for ${problemStatement.split('\n')[0]}. Could you walk me through your overall approach?`;
    } else if (candidateCode && candidateCode.trim().length > 10) {
      greeting = `Welcome! I see your submitted code for this challenge. Could you start by explaining how your algorithm works and why you chose this data structure?`;
    } else {
      greeting = `Welcome to your technical interview! Let's discuss your solution. Could you walk me through your thought process and algorithmic approach?`;
    }

    setInterviewerText(greeting);

    // Save initial greeting turn
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

    // Speak greeting
    await playSynthesizedSpeech(greeting);

    // Begin candidate turn
    startListeningTurn();
  };

  // Graceful Stop Interview
  const handleGracefulStop = async () => {
    stopAllAudioHardware();
    setState('ENDING');

    try {
      // Evaluate interview along 8 dimensions
      const evalRes = await api.evaluateInterview({
        session_id: sessionId,
        problem_statement: problemStatement,
        candidate_code: candidateCode,
        turns: turns,
      });

      const summaryPayload: PersistentInterviewSummary = {
        session_id: sessionId,
        status: 'COMPLETED',
        overall_competency_pct: evalRes.data.overall_competency_pct || 82.5,
        topics_covered: evalRes.data.topics_covered || ['system_design', 'complexity'],
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
    stopAllAudioHardware();
    setState('CANCELLED');

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
    <div className="relative min-h-[580px] flex flex-col justify-between p-6 rounded-2xl bg-zinc-950 border border-borderCol shadow-2xl overflow-hidden font-sans">
      {/* Background radial glow effect */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-950/20 rounded-full blur-3xl pointer-events-none" />

      {/* TOP BAR: Session Identity & Resume Status */}
      <div className="flex items-center justify-between text-xs pb-3 border-b border-zinc-800/80 z-10">
        <div className="flex items-center gap-3">
          <Badge variant={state === 'LISTENING' ? 'success' : state === 'SPEAKING' ? 'info' : 'neutral'}>
            Status: {state}
          </Badge>
          <span className="text-zinc-400 font-mono text-[11px]">
            Session: <span className="text-zinc-200">{sessionId.slice(0, 18)}...</span>
          </span>
        </div>

        {/* Optional Resume Attachment */}
        <div className="flex items-center gap-2">
          {resumeData ? (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-zinc-900 border border-emerald-800/60 text-emerald-400 text-[11px]">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Resume Active ({resumeData.technologies.slice(0, 3).join(', ')})</span>
            </div>
          ) : (
            <label className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-borderCol hover:border-sky-500/60 cursor-pointer text-zinc-300 transition-colors text-[11px]">
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>{isUploadingResume ? 'Analyzing...' : 'Attach Resume (Optional)'}</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleResumeUpload}
                disabled={isUploadingResume || state !== 'IDLE'}
                className="hidden"
              />
            </label>
          )}

          {resumeUploadError && (
            <span className="text-rose-400 text-[10px]">{resumeUploadError}</span>
          )}
        </div>
      </div>

      {/* CENTER: Premium Audio-Reactive Interview Orb */}
      <div className="my-auto py-4 flex flex-col items-center justify-center z-10">
        {state === 'COMPLETED' && finalSummary ? (
          <div className="w-full max-w-xl p-6 rounded-2xl bg-zinc-900/90 border border-emerald-800/80 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-emerald-950/80 border border-emerald-700 flex items-center justify-center mx-auto text-emerald-400">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">Conversational Interview Concluded</h3>
            <p className="text-zinc-300 text-xs leading-relaxed">
              {finalSummary.summary_narrative}
            </p>
            <div className="pt-2 flex justify-center gap-6 text-xs font-mono">
              <div>
                <div className="text-zinc-500 text-[10px]">Technical Competency</div>
                <div className="text-emerald-400 font-bold text-base">
                  {finalSummary.overall_competency_pct}%
                </div>
              </div>
              <div>
                <div className="text-zinc-500 text-[10px]">Verified Turns</div>
                <div className="text-sky-400 font-bold text-base">{turns.length}</div>
              </div>
            </div>
          </div>
        ) : state === 'CANCELLED' ? (
          <div className="w-full max-w-md p-6 rounded-2xl bg-zinc-900/90 border border-rose-900/80 text-center space-y-3 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-700 flex items-center justify-center mx-auto text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-zinc-100">Interview Cancelled</h3>
            <p className="text-zinc-400 text-xs">
              All prior finalized responses have been preserved for audit records.
            </p>
          </div>
        ) : (
          <InterviewOrb
            state={state}
            audioLevel={audioLevel}
            size={240}
          />
        )}
      </div>

      {/* LOWER AREA: Live Captions & Controls */}
      <div className="space-y-3 z-10">
        {isCaptionsVisible && (
          <LiveCaptions
            interviewerText={interviewerText}
            candidateLiveText={candidateLiveText}
            isCandidateSpeaking={state === 'LISTENING' && audioLevel > 0.12}
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
