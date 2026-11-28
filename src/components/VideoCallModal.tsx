import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageSquareText,
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  Sparkles,
  Subtitles,
  Volume2,
} from 'lucide-react';
import type { SessionResult, VideoCallReplySuggestion, VideoCallScenario } from '../types/learning';
import {
  calculateVideoCallXp,
  collectVideoCallArabicTexts,
  countSpokenArabicWords,
  evaluateSessionOutcome,
} from '../utils/learningEngine';
import { playTone, preloadArabicAudioBatch, speakArabic, stopArabicAudio } from '../utils/audio';
import {
  mergeSpeechTranscripts,
  requestDynamicVideoCallReply,
  type VideoCallChatEntry,
} from '../utils/videoCallConversation';

interface VideoCallModalProps {
  lessonId: string;
  scenario: VideoCallScenario;
  soundEnabled: boolean;
  learnerName?: string;
  onComplete: (result: SessionResult) => void;
  onClose: () => void;
}

type CallStage = 'ringing' | 'active' | 'summary';

interface CompletedTurnRecord {
  turnIndex: number;
  characterAr: string;
  userReplyAr: string;
  wordCount: number;
}

interface ActivePromptState {
  ar: string;
  tr: string;
  ml: string;
}

interface LiveChatBubble {
  id: string;
  speaker: 'character' | 'user';
  ar: string;
  tr?: string;
  ml?: string;
  wordCount?: number;
  xpEarned?: number;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function playSoftRingChime(soundEnabled: boolean): void {
  if (!soundEnabled || typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.22);
      gain.gain.setValueAtTime(0.0001, now + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.06, now + i * 0.22 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.22 + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.22);
      osc.stop(now + i * 0.22 + 0.22);
    });
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
  } catch {
    // Ignore autoplay-blocked Web Audio
  }
}

export const VideoCallModal: React.FC<VideoCallModalProps> = ({
  lessonId,
  scenario,
  soundEnabled,
  learnerName,
  onComplete,
  onClose,
}) => {
  const initialTurn = scenario.turns[0];
  const [stage, setStage] = useState<CallStage>('ringing');
  const [turnIndex, setTurnIndex] = useState(0);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [backdropFailed, setBackdropFailed] = useState(false);
  const [isCharacterSpeaking, setIsCharacterSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [micNote, setMicNote] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [turnRecords, setTurnRecords] = useState<CompletedTurnRecord[]>([]);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [activePrompt, setActivePrompt] = useState<ActivePromptState>(() => ({
    ar: initialTurn?.characterAr ?? '',
    tr: initialTurn?.characterTr ?? '',
    ml: initialTurn?.characterMl ?? '',
  }));
  const [activeHints, setActiveHints] = useState<VideoCallReplySuggestion[]>(
    () => initialTurn?.suggestedReplies ?? []
  );
  const [chatMessages, setChatMessages] = useState<LiveChatBubble[]>(() =>
    initialTurn
      ? [
          {
            id: 'opening-0',
            speaker: 'character',
            ar: initialTurn.characterAr,
            tr: initialTurn.characterTr,
            ml: initialTurn.characterMl,
          },
        ]
      : []
  );

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef('');
  const committedTranscriptRef = useRef('');
  const sessionSegmentRef = useRef('');
  const manualStopRequestedRef = useRef(false);
  const isListeningRef = useRef(false);
  const mountedRef = useRef(true);
  const greetedRef = useRef(false);
  const historyRef = useRef<VideoCallChatEntry[]>(
    initialTurn ? [{ speaker: 'character', text: initialTurn.characterAr }] : []
  );
  const speakingTimerRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const speechSupported = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);

  const totalTurns = scenario.turns.length;

  const totalSpokenWords = useMemo(
    () => turnRecords.reduce((sum, rec) => sum + rec.wordCount, 0),
    [turnRecords]
  );
  const xpStats = useMemo(() => calculateVideoCallXp(totalSpokenWords), [totalSpokenWords]);

  const stopRecognition = useCallback(() => {
    manualStopRequestedRef.current = true;
    isListeningRef.current = false;
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      rec.onstart = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        // Ignore already stopped recognition
      }
    }
    setIsListening(false);
  }, []);

  const clearTimers = useCallback(() => {
    if (speakingTimerRef.current !== null) {
      window.clearTimeout(speakingTimerRef.current);
      speakingTimerRef.current = null;
    }
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    preloadArabicAudioBatch(collectVideoCallArabicTexts(scenario));
    return () => {
      mountedRef.current = false;
      clearTimers();
      stopRecognition();
      stopArabicAudio();
    };
  }, [scenario, clearTimers, stopRecognition]);

  const speakCharacterLine = useCallback(
    (arabicText: string) => {
      if (!arabicText) return;
      if (speakingTimerRef.current !== null) {
        window.clearTimeout(speakingTimerRef.current);
      }
      setIsCharacterSpeaking(true);
      speakArabic(arabicText, soundEnabled, 0.96);
      const estimatedMs = Math.min(5400, Math.max(1600, arabicText.length * 52));
      speakingTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) setIsCharacterSpeaking(false);
      }, estimatedMs);
    },
    [soundEnabled]
  );

  // Ringing screen auto-connect + soft chime
  useEffect(() => {
    if (stage !== 'ringing') return;
    playSoftRingChime(soundEnabled);
    const ringAgain = window.setTimeout(() => playSoftRingChime(soundEnabled), 950);
    const connectTimer = window.setTimeout(() => {
      if (mountedRef.current) {
        setStage('active');
      }
    }, 2100);
    return () => {
      window.clearTimeout(ringAgain);
      window.clearTimeout(connectTimer);
    };
  }, [stage, soundEnabled]);

  // Speak the opening Arabic greeting once when the call connects
  useEffect(() => {
    if (stage !== 'active' || greetedRef.current) return;
    greetedRef.current = true;
    if (!speechSupported) {
      setShowSuggestions(true);
    }
    const openingLine = initialTurn?.characterAr ?? '';
    if (!openingLine) return;
    const speakDelay = window.setTimeout(() => {
      if (mountedRef.current) {
        speakCharacterLine(openingLine);
      }
    }, 240);
    return () => window.clearTimeout(speakDelay);
  }, [stage, initialTurn, speechSupported, speakCharacterLine]);

  const submitTurnReply = useCallback(
    async (replyText: string) => {
      if (isAdvancing) return;
      const cleaned = replyText.trim();
      if (!cleaned) return;

      stopRecognition();
      const words = Math.max(1, countSpokenArabicWords(cleaned));
      const turnXp = Math.min(16, Math.max(2, words * 2));

      playTone('correct', soundEnabled);
      setIsAdvancing(true);
      setIsThinking(true);
      setLiveTranscript('');
      transcriptRef.current = '';
      setMicNote(null);
      setApiError(null);

      const prevHistory = historyRef.current;
      const userBubbleId = `user-${turnIndex}-${Date.now()}`;
      const userEntry: VideoCallChatEntry = { speaker: 'user', text: cleaned };
      const updatedHistory = [...prevHistory, userEntry];
      historyRef.current = updatedHistory;

      setChatMessages((prev) => [
        ...prev.slice(-4),
        {
          id: userBubbleId,
          speaker: 'user',
          ar: cleaned,
          wordCount: words,
          xpEarned: turnXp,
        },
      ]);

      setTurnRecords((prev) => [
        ...prev,
        {
          turnIndex,
          characterAr: activePrompt.ar,
          userReplyAr: cleaned,
          wordCount: words,
        },
      ]);

      try {
        const dynamicReply = await requestDynamicVideoCallReply({
          userSpokenText: cleaned,
          scenario,
          turnIndex,
          history: updatedHistory,
          learnerName,
        });

        if (!mountedRef.current) return;

        historyRef.current = [
          ...historyRef.current,
          { speaker: 'character', text: dynamicReply.replyArabic },
        ];

        setActivePrompt({
          ar: dynamicReply.replyArabic,
          tr: dynamicReply.replyTransliteration,
          ml: dynamicReply.replyMalayalam,
        });
        setActiveHints(dynamicReply.nextHints);
        setChatMessages((prev) => [
          ...prev.slice(-4),
          {
            id: `char-${turnIndex + 1}-${Date.now()}`,
            speaker: 'character',
            ar: dynamicReply.replyArabic,
            tr: dynamicReply.replyTransliteration,
            ml: dynamicReply.replyMalayalam,
          },
        ]);
        setIsThinking(false);
        speakCharacterLine(dynamicReply.replyArabic);

        if (!dynamicReply.isFinalTurn) {
          setTurnIndex((idx) => Math.min(totalTurns - 1, idx + 1));
          setIsAdvancing(false);
        } else {
          advanceTimerRef.current = window.setTimeout(() => {
            if (!mountedRef.current) return;
            playTone('complete', soundEnabled);
            setStage('summary');
            setIsAdvancing(false);
          }, 2200);
        }
      } catch (err) {
        if (!mountedRef.current) return;
        historyRef.current = prevHistory;
        setChatMessages((prev) => prev.filter((m) => m.id !== userBubbleId));
        setTurnRecords((prev) => prev.slice(0, -1));
        setIsThinking(false);
        setIsAdvancing(false);
        playTone('wrong', soundEnabled);
        setApiError(
          err instanceof Error
            ? err.message
            : 'Gemini API കണക്ഷൻ പരാജയപ്പെട്ടു. പ്രൊഫൈലിൽ API Key പരിശോധിക്കുക.'
        );
      }
    },
    [
      isAdvancing,
      stopRecognition,
      soundEnabled,
      turnIndex,
      activePrompt.ar,
      scenario,
      learnerName,
      speakCharacterLine,
      totalTurns,
    ]
  );

  const handleToggleSpeak = useCallback(() => {
    if (isAdvancing) return;

    // Explicit manual STOP & SEND: only submit when the user taps Stop
    if (isListening || isListeningRef.current) {
      const captured = (
        transcriptRef.current ||
        mergeSpeechTranscripts(committedTranscriptRef.current, sessionSegmentRef.current, '')
      ).trim();
      stopRecognition();
      committedTranscriptRef.current = '';
      sessionSegmentRef.current = '';
      if (captured) {
        submitTurnReply(captured);
      } else {
        setLiveTranscript('');
        transcriptRef.current = '';
        setMicNote('ഒന്നും റെക്കോർഡ് ആയില്ല — വീണ്ടും 🎤 അമർത്തി സംസാരിക്കൂ, പൂർത്തിയായാൽ ⏹ അമർത്തൂ.');
      }
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setMicNote('ഈ ബ്രൗസറിൽ മൈക്രോഫോൺ ലഭ്യമല്ല — താഴെയുള്ള അറബി മറുപടികൾ ടാപ്പ് ചെയ്ത് സംസാരിക്കാം.');
      setShowSuggestions(true);
      playTone('tap', soundEnabled);
      return;
    }

    stopArabicAudio();
    setIsCharacterSpeaking(false);
    setMicNote(null);
    setLiveTranscript('');
    transcriptRef.current = '';
    committedTranscriptRef.current = '';
    sessionSegmentRef.current = '';
    manualStopRequestedRef.current = false;
    let playedStartTone = false;

    const startContinuousSegment = () => {
      if (!mountedRef.current || manualStopRequestedRef.current) return;
      try {
        const recognition = new Ctor();
        recognition.lang = 'ar-SA';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;

        recognition.onstart = () => {
          if (!mountedRef.current || manualStopRequestedRef.current) return;
          isListeningRef.current = true;
          setIsListening(true);
          if (!playedStartTone) {
            playedStartTone = true;
            playTone('tap', soundEnabled);
          }
        };

        recognition.onresult = (ev: SpeechRecognitionEventLike) => {
          if (!mountedRef.current || manualStopRequestedRef.current) return;
          let sessionFinal = '';
          let sessionInterim = '';
          for (let i = 0; i < ev.results.length; i++) {
            const item = ev.results[i];
            const text = item?.[0]?.transcript?.trim() ?? '';
            if (!text) continue;
            if (item.isFinal) {
              sessionFinal += (sessionFinal ? ' ' : '') + text;
            } else {
              sessionInterim += (sessionInterim ? ' ' : '') + text;
            }
          }
          sessionSegmentRef.current = mergeSpeechTranscripts('', sessionFinal, sessionInterim);
          const accumulated = mergeSpeechTranscripts(
            committedTranscriptRef.current,
            sessionFinal,
            sessionInterim
          );
          transcriptRef.current = accumulated;
          setLiveTranscript(accumulated);
          // Never auto-submit on isFinal or pauses — wait for explicit STOP & SEND tap!
        };

        recognition.onerror = (ev: SpeechRecognitionErrorEventLike) => {
          if (!mountedRef.current || manualStopRequestedRef.current) return;
          // Ignore brief silence/no-speech errors so thinking/breathing pauses never cut off the user
          if (ev.error === 'no-speech' || ev.error === 'aborted') {
            return;
          }
          stopRecognition();
          if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
            setMicNote('മൈക്ക് അനുമതി ലഭിച്ചില്ല — താഴെയുള്ള അറബി മറുപടികൾ ടാപ്പ് ചെയ്ത് തുടരാം.');
          } else {
            setMicNote('ശബ്ദം തിരിച്ചറിയാൻ കഴിഞ്ഞില്ല — വീണ്ടും 🎤 അമർത്തുകയോ താഴെയുള്ള മറുപടി ടാപ്പ് ചെയ്യുകയോ ചെയ്യൂ.');
          }
          setShowSuggestions(true);
        };

        recognition.onend = () => {
          if (!mountedRef.current) return;
          // Preserve all words spoken before any browser silence timeout
          if (sessionSegmentRef.current) {
            committedTranscriptRef.current = mergeSpeechTranscripts(
              committedTranscriptRef.current,
              sessionSegmentRef.current,
              ''
            );
            sessionSegmentRef.current = '';
            transcriptRef.current = committedTranscriptRef.current;
            setLiveTranscript(committedTranscriptRef.current);
          }
          // If the user has NOT explicitly tapped Stop, seamlessly keep listening across pauses
          if (!manualStopRequestedRef.current && isListeningRef.current) {
            recognitionRef.current = null;
            startContinuousSegment();
            return;
          }
          recognitionRef.current = null;
          isListeningRef.current = false;
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        isListeningRef.current = true;
        setIsListening(true);
        recognition.start();
      } catch {
        stopRecognition();
        setMicNote('മൈക്ക് തുടങ്ങാൻ കഴിഞ്ഞില്ല — താഴെയുള്ള അറബി മറുപടികൾ ടാപ്പ് ചെയ്ത് സംസാരിക്കാം.');
        setShowSuggestions(true);
      }
    };

    startContinuousSegment();
  }, [isAdvancing, isListening, stopRecognition, submitTurnReply, soundEnabled]);

  const handleQuickReply = (suggestion: VideoCallReplySuggestion) => {
    if (isAdvancing) return;
    playTone('tap', soundEnabled);
    submitTurnReply(suggestion.ar);
  };

  const handleEndCall = () => {
    clearTimers();
    stopRecognition();
    stopArabicAudio();
    playTone('tap', soundEnabled);
    onClose();
  };

  const handleFinishCall = () => {
    clearTimers();
    stopRecognition();
    stopArabicAudio();
    const result = evaluateSessionOutcome({
      mode: 'lesson',
      variant: 'video_call',
      lessonId,
      targetUnitIndex: null,
      score: turnRecords.length,
      totalQuestions: totalTurns,
      xpReward: xpStats.totalXp,
    });
    result.subtitle = `${scenario.characterNameMl} (${scenario.characterNameEn}) ഉമായി ${xpStats.spokenWords} അറബി വാക്കുകൾ സംസാരിച്ചു! (+${xpStats.baseXp} Base + ${xpStats.bonusXp} Word Bonus XP)`;
    onComplete(result);
  };

  const progressPercent =
    stage === 'summary'
      ? 100
      : Math.round(((turnIndex + (isAdvancing ? 1 : 0)) / Math.max(1, totalTurns)) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${scenario.characterNameEn} വീഡിയോ കോൾ സംഭാഷണം`}
      data-testid="video-call-modal"
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#1C1410] text-white select-none"
    >
      {/* Warm Outdoor Arabian Café / Courtyard Backdrop */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              scenario.characterKey === 'tariq'
                ? 'radial-gradient(circle at 50% 25%, #D97706 0%, #7C2D12 52%, #1C1410 100%)'
                : 'radial-gradient(circle at 50% 25%, #EA580C 0%, #9A3412 50%, #1E1310 100%)',
          }}
        />
        {!backdropFailed && (
          <img
            src={scenario.backdropImage}
            alt=""
            aria-hidden="true"
            onError={() => setBackdropFailed(true)}
            className={`w-full h-full object-cover transition-transform duration-700 ${
              stage === 'ringing' ? 'scale-105 blur-[3px] opacity-55' : 'scale-100 opacity-90'
            }`}
          />
        )}
        {/* Measured top & bottom contrast scrims for WCAG AA legibility */}
        <div
          className="absolute inset-0"
          style={{
            background:
              stage === 'ringing'
                ? 'linear-gradient(180deg, rgba(15,12,10,0.68) 0%, rgba(15,12,10,0.45) 45%, rgba(15,12,10,0.86) 100%)'
                : 'linear-gradient(180deg, rgba(15,12,10,0.72) 0%, rgba(15,12,10,0.18) 38%, rgba(15,12,10,0.82) 78%, rgba(15,12,10,0.94) 100%)',
          }}
        />
      </div>

      {/* STAGE 1: REALISTIC CALLING SCREEN */}
      {stage === 'ringing' && (
        <div
          data-testid="video-call-ringing"
          className="relative z-10 flex-1 flex flex-col items-center justify-between px-6 py-10 max-w-lg mx-auto w-full text-center"
        >
          <div className="space-y-1.5 pt-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-extrabold tracking-wide text-amber-200 border border-white/20">
              <span>📹</span>
              <span>VIDEO CALL · യൂണിറ്റ് {scenario.unitNumber}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight pt-2">
              Calling {scenario.characterNameEn}...
            </h2>
            <p className="text-sm font-bold text-amber-100/90">
              {scenario.characterNameMl} ({scenario.characterNameAr}) വിളിക്കുന്നു...
            </p>
            <p className="text-xs font-medium text-white/75 pt-0.5">{scenario.sceneSettingMl}</p>
          </div>

          {/* Pulsing Avatar */}
          <div className="relative flex items-center justify-center my-6">
            <span
              aria-hidden="true"
              className="absolute w-44 h-44 rounded-full bg-amber-400/20 animate-ping"
              style={{ animationDuration: '1.8s' }}
            />
            <span
              aria-hidden="true"
              className="absolute w-36 h-36 rounded-full border-2 border-amber-300/45 animate-pulse"
            />
            <div className="relative w-32 h-32 rounded-full bg-gradient-to-b from-amber-100 to-amber-300 border-4 border-white shadow-2xl flex items-center justify-center text-7xl">
              <span aria-hidden="true">{scenario.characterAvatar}</span>
            </div>
          </div>

          {/* Tip + Answer / End Call */}
          <div className="w-full space-y-5 pb-2">
            <div className="bg-slate-950/65 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3.5 text-center space-y-1">
              <div className="text-sm font-extrabold text-amber-300">
                ✨ കൂടുതൽ അറബി വാക്കുകൾ ഉപയോഗിക്കൂ, കൂടുതൽ XP നേടൂ!
              </div>
              <div className="text-xs font-semibold text-white/80 font-latin">
                Use more Arabic words, get more XP!
              </div>
            </div>

            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                data-testid="video-call-end-btn"
                aria-label="കോൾ അവസാനിപ്പിക്കുക"
                onClick={handleEndCall}
                className="btn-3d w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 border-b-4 border-rose-800 text-white shadow-xl flex items-center justify-center"
              >
                <PhoneOff className="w-7 h-7" aria-hidden="true" />
              </button>

              <button
                type="button"
                data-testid="video-call-answer-now-btn"
                onClick={() => {
                  playTone('tap', soundEnabled);
                  setStage('active');
                }}
                className="btn-3d h-14 px-6 rounded-full bg-[#58CC02] hover:bg-[#4EB802] border-b-4 border-[#3E9400] text-white font-extrabold text-sm shadow-xl flex items-center gap-2 whitespace-nowrap"
              >
                <span>ഇപ്പോൾ തുടങ്ങുക</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 2: INTERACTIVE VIDEO CALL CONVERSATION SCREEN */}
      {stage === 'active' && (
        <div
          data-testid="video-call-active"
          className="relative z-10 flex-1 flex flex-col justify-between max-w-2xl mx-auto w-full h-full"
        >
          {/* Top Progress Bar & XP Word Counter */}
          <header className="px-4 sm:px-6 pt-4 pb-2 space-y-2.5 shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="കോൾ അവസാനിപ്പിക്കുക"
                onClick={handleEndCall}
                className="w-10 h-10 rounded-full bg-slate-950/60 hover:bg-slate-950/80 border border-white/15 text-white flex items-center justify-center shrink-0"
              >
                <PhoneOff className="w-4 h-4 text-rose-400" aria-hidden="true" />
              </button>

              <div className="flex-1 h-3 rounded-full bg-white/20 overflow-hidden backdrop-blur-xs">
                <div
                  className="h-full bg-gradient-to-r from-[#58CC02] to-[#38BDF8] rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(12, progressPercent)}%` }}
                />
              </div>

              <span className="text-xs font-extrabold text-white/95 font-latin tabular-nums shrink-0 bg-slate-950/55 px-2.5 py-1 rounded-full border border-white/15">
                {turnIndex + 1} / {totalTurns}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="inline-flex items-center gap-1.5 bg-slate-950/55 backdrop-blur-md px-3 py-1 rounded-full border border-white/15 font-bold text-amber-100">
                <span>{scenario.characterAvatar}</span>
                <span>{scenario.characterNameMl}</span>
                <span className="text-white/50">·</span>
                <span className="font-arabic text-sm text-white">{scenario.characterNameAr}</span>
              </div>

              <div
                data-testid="video-call-xp-pill"
                className="inline-flex items-center gap-1.5 bg-amber-500/25 backdrop-blur-md px-3 py-1 rounded-full border border-amber-300/40 font-extrabold text-amber-200 font-latin tabular-nums"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                <span>{totalSpokenWords} words</span>
                <span className="text-amber-300/60">·</span>
                <span className="text-white">+{xpStats.totalXp} XP</span>
              </div>
            </div>
          </header>

          {/* Center Animated Character Portrait, Live Speech Bubbles & Optional Subtitles */}
          <div
            data-scroll-container="true"
            className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 flex flex-col"
          >
            <div className="my-auto w-full flex flex-col items-center gap-3.5">
              {/* Large Animated Arab Character Portrait */}
              <div className="relative flex flex-col items-center shrink-0">
                <div className="relative flex items-center justify-center">
                  {isCharacterSpeaking && (
                    <>
                      <span
                        aria-hidden="true"
                        className="absolute w-40 h-40 sm:w-44 sm:h-44 rounded-full bg-amber-400/25 animate-ping"
                        style={{ animationDuration: '1.4s' }}
                      />
                      <span
                        aria-hidden="true"
                        className="absolute w-36 h-36 sm:w-40 sm:h-40 rounded-full border-2 border-amber-300/70 animate-pulse"
                      />
                    </>
                  )}
                  {isListening && (
                    <span
                      aria-hidden="true"
                      className="absolute w-40 h-40 sm:w-44 sm:h-44 rounded-full border-4 border-red-400/80 animate-pulse"
                    />
                  )}
                  <button
                    type="button"
                    aria-label="ചോദ്യം വീണ്ടും കേൾക്കുക"
                    onClick={() => speakCharacterLine(activePrompt.ar)}
                    className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-b from-amber-50 via-amber-100 to-amber-300 border-4 shadow-2xl flex items-center justify-center text-6xl sm:text-7xl transition-transform duration-300 ${
                      isCharacterSpeaking
                        ? 'border-amber-300 scale-105'
                        : isListening
                          ? 'border-red-400 scale-100'
                          : 'border-white/90 hover:scale-[1.03]'
                    }`}
                  >
                    <span aria-hidden="true">{scenario.characterAvatar}</span>
                  </button>
                </div>

                {/* Subtle status label */}
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/65 backdrop-blur-md border border-white/15 text-xs font-bold text-white/95">
                  {isThinking ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" aria-hidden="true" />
                      <span>{scenario.characterNameMl} മറുപടി പറയുന്നു...</span>
                    </>
                  ) : isCharacterSpeaking ? (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-amber-300 animate-pulse" aria-hidden="true" />
                      <span>{scenario.characterNameMl} സംസാരിക്കുന്നു...</span>
                    </>
                  ) : isListening ? (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
                      <span>റെക്കോർഡിംഗ്... പൂർത്തിയായാൽ ⏹ നിർത്തുക &amp; അയക്കുക അമർത്തുക</span>
                    </>
                  ) : (
                    <span>മറുപടി പറയാൻ 🎤 അമർത്തുക</span>
                  )}
                </div>
              </div>

              {/* Live Dynamic Conversation Bubbles (User Spoken Bubble + Character Dynamic Reply) */}
              {chatMessages.length > 0 && (
                <div
                  data-testid="video-call-chat-thread"
                  className="w-full max-w-lg space-y-2.5"
                >
                  {chatMessages.slice(-2).map((msg) =>
                    msg.speaker === 'user' ? (
                      <div key={msg.id} className="flex justify-end animate-pop">
                        <div
                          data-testid="video-call-user-bubble"
                          className="max-w-[88%] rounded-2xl rounded-br-md bg-[#0284C7]/90 backdrop-blur-md border border-sky-300/45 px-4 py-2.5 text-right shadow-lg"
                        >
                          <div className="flex items-center justify-end gap-2 text-[10px] font-extrabold text-sky-100/90 mb-0.5">
                            <span>നിങ്ങൾ</span>
                            {typeof msg.wordCount === 'number' && (
                              <span className="px-1.5 py-0.5 rounded-md bg-white/15 font-latin tabular-nums">
                                {msg.wordCount}w · +{msg.xpEarned ?? msg.wordCount * 2} XP
                              </span>
                            )}
                          </div>
                          <div
                            dir="rtl"
                            lang="ar"
                            className="font-arabic text-lg sm:text-xl font-bold text-white leading-relaxed"
                          >
                            {msg.ar}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div key={msg.id} className="flex justify-start animate-pop">
                        <button
                          type="button"
                          data-testid="video-call-character-bubble"
                          onClick={() => speakCharacterLine(msg.ar)}
                          aria-label="മറുപടി വീണ്ടും കേൾക്കുക"
                          className="max-w-[92%] text-left rounded-2xl rounded-bl-md bg-slate-950/80 hover:bg-slate-950/90 backdrop-blur-md border border-amber-300/35 px-4 py-3 shadow-xl transition space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] font-extrabold text-amber-200/95">
                            <span>
                              {scenario.characterAvatar} {scenario.characterNameMl}
                            </span>
                            <Volume2 className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" />
                          </div>
                          <div
                            dir="rtl"
                            lang="ar"
                            className="font-arabic text-xl sm:text-2xl font-bold text-white leading-relaxed text-right"
                          >
                            {msg.ar}
                          </div>
                          {showSubtitles && (msg.tr || msg.ml) && (
                            <div
                              data-testid="video-call-subtitles"
                              className="pt-1.5 mt-1 border-t border-white/15 space-y-0.5"
                            >
                              {msg.tr && <div className="text-xs font-bold text-sky-300">{msg.tr}</div>}
                              {msg.ml && (
                                <div className="text-xs sm:text-sm font-semibold text-amber-100/95">
                                  {msg.ml}
                                </div>
                              )}
                            </div>
                          )}
                        </button>
                      </div>
                    )
                  )}

                  {isThinking && (
                    <div className="flex justify-start animate-pulse">
                      <div className="rounded-2xl rounded-bl-md bg-slate-950/75 border border-white/20 px-4 py-2.5 text-xs font-bold text-amber-200">
                        {scenario.characterAvatar} {scenario.characterNameMl} ചിന്തിക്കുന്നു...
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Live Accumulated Speech Preview Box while Recording */}
              {(isListening || liveTranscript) && (
                <div
                  data-testid="video-call-live-transcript"
                  className="w-full max-w-lg bg-slate-950/85 backdrop-blur-md border-2 border-red-400/60 rounded-2xl px-4 py-3 text-center space-y-1.5 shadow-lg animate-pop"
                >
                  <div className="flex items-center justify-center gap-2 text-[11px] font-extrabold text-red-300 tracking-wide">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
                    <span>
                      തത്സമയ പ്രിവ്യൂ · {countSpokenArabicWords(liveTranscript)} അറബി വാക്കുകൾ
                    </span>
                  </div>
                  {liveTranscript ? (
                    <div
                      dir="rtl"
                      lang="ar"
                      className="font-arabic text-xl sm:text-2xl font-bold text-white leading-relaxed"
                    >
                      {liveTranscript}
                    </div>
                  ) : (
                    <div className="text-xs font-semibold text-white/75">
                      അറബിയിൽ സംസാരിക്കൂ... ചെറിയ ഇടവേളകളിൽ കട്ട് ആകില്ല. പൂർത്തിയായാൽ ⏹ അമർത്തുക.
                    </div>
                  )}
                </div>
              )}

              {/* Friendly Mic Fallback Note */}
              {micNote && (
                <div className="w-full max-w-lg bg-amber-950/80 border border-amber-400/40 rounded-xl px-3.5 py-2 text-xs font-bold text-amber-100 text-center">
                  {micNote}
                </div>
              )}

              {/* Direct Gemini API Error Alert */}
              {apiError && (
                <div
                  role="alert"
                  data-testid="video-call-error"
                  className="w-full max-w-lg bg-rose-950/90 border border-rose-400/60 rounded-xl px-4 py-3 text-xs font-bold text-rose-100 text-center break-words shadow-lg"
                >
                  ⚠️ {apiError}
                </div>
              )}

              {/* Dynamically Refreshed Suggested Arabic Replies Drawer */}
              {showSuggestions && !isAdvancing && activeHints.length > 0 && (
                <div
                  data-testid="video-call-suggestions"
                  className="w-full max-w-lg bg-slate-950/80 backdrop-blur-md border border-white/15 rounded-2xl p-3 space-y-2 shadow-xl"
                >
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-amber-200 px-1">
                    <span>💡 പറയാവുന്ന അറബി മറുപടികൾ (കൂടുതൽ വാക്കുകൾ = കൂടുതൽ XP)</span>
                  </div>
                  <div className="space-y-2">
                    {activeHints.map((reply, rIdx) => {
                      const wc = countSpokenArabicWords(reply.ar);
                      return (
                        <button
                          key={`${turnIndex}-${rIdx}`}
                          type="button"
                          data-testid={`video-call-quick-reply-${rIdx}`}
                          onClick={() => handleQuickReply(reply)}
                          className="w-full text-right bg-white/10 hover:bg-sky-500/25 border border-white/15 hover:border-sky-300/60 rounded-xl px-3.5 py-2.5 transition flex items-center justify-between gap-3"
                        >
                          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-200 text-[11px] font-extrabold font-latin tabular-nums">
                            +{wc * 2} XP
                          </span>
                          <div className="flex-1 min-w-0">
                            <div dir="rtl" lang="ar" className="font-arabic text-lg sm:text-xl font-bold text-white leading-snug">
                              {reply.ar}
                            </div>
                            <div dir="ltr" className="text-[11px] font-semibold text-white/75 truncate">
                              {reply.ml}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Call Controls Dock */}
          <footer className="px-4 sm:px-6 pt-3 pb-5 sm:pb-6 shrink-0">
            <div className="max-w-lg mx-auto space-y-3">
              {/* Helper Row: Show Reply Ideas Toggle */}
              <div className="flex justify-center">
                <button
                  type="button"
                  data-testid="video-call-ideas-toggle"
                  onClick={() => {
                    playTone('tap', soundEnabled);
                    setShowSuggestions((v) => !v);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold border transition whitespace-nowrap ${
                    showSuggestions
                      ? 'bg-amber-400/25 border-amber-300/60 text-amber-100'
                      : 'bg-slate-950/60 border-white/20 text-white/85 hover:bg-slate-900/80'
                  }`}
                >
                  <MessageSquareText className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{showSuggestions ? 'മറുപടി സൂചനകൾ മറയ്ക്കുക' : 'മറുപടി സൂചനകൾ കാണുക'}</span>
                </button>
              </div>

              {/* Primary 3-Zone Video Call Controls */}
              <div className="flex items-center justify-between gap-3">
                {/* Bottom-Left: Replay Button (↺) */}
                <button
                  type="button"
                  data-testid="video-call-replay-btn"
                  aria-label="ചോദ്യം വീണ്ടും കേൾക്കുക"
                  onClick={() => {
                    playTone('tap', soundEnabled);
                    speakCharacterLine(activePrompt.ar);
                  }}
                  className="btn-3d w-14 h-14 rounded-2xl bg-slate-900/85 hover:bg-slate-800 border border-white/20 border-b-4 border-b-slate-950 text-white flex flex-col items-center justify-center gap-0.5 shrink-0"
                >
                  <RotateCcw className="w-5 h-5" aria-hidden="true" />
                  <span className="text-[10px] font-extrabold text-white/80">വീണ്ടും</span>
                </button>

                {/* Bottom-Center: Large Sky-Blue TAP TO SPEAK / Pulsing Red STOP & SEND Button */}
                <button
                  type="button"
                  data-testid="video-call-speak-btn"
                  data-recording={isListening ? 'true' : 'false'}
                  disabled={isAdvancing}
                  onClick={handleToggleSpeak}
                  className={`btn-3d flex-1 h-16 px-4 sm:px-5 rounded-2xl border-b-[5px] font-extrabold text-xs sm:text-sm md:text-base flex items-center justify-center gap-2 shadow-xl transition ${
                    isListening
                      ? 'bg-red-600 hover:bg-red-700 border-red-800 text-white ring-4 ring-red-500/45 animate-pulse'
                      : 'bg-[#1CB0F6] hover:bg-[#17A2E6] border-[#0284C7] text-white'
                  } disabled:opacity-60`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 hidden" aria-hidden="true" />
                      <span className="leading-tight text-center">
                        ⏹ നിർത്തുക &amp; അയക്കുക <span className="font-latin">(STOP &amp; SEND)</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5 shrink-0" aria-hidden="true" />
                      <span>🎤 സംസാരിക്കുക</span>
                      <span className="hidden sm:inline text-xs font-bold opacity-90 font-latin">
                        (TAP TO SPEAK)
                      </span>
                    </>
                  )}
                </button>

                {/* Bottom-Right: Subtitle Reveal Toggle (CC) */}
                <button
                  type="button"
                  data-testid="video-call-subtitle-toggle"
                  aria-pressed={showSubtitles}
                  aria-label="സബ്ടൈറ്റിൽ കാണിക്കുക അല്ലെങ്കിൽ മറയ്ക്കുക"
                  onClick={() => {
                    playTone('tap', soundEnabled);
                    setShowSubtitles((v) => !v);
                  }}
                  className={`btn-3d w-14 h-14 rounded-2xl border border-b-4 flex flex-col items-center justify-center gap-0.5 shrink-0 transition ${
                    showSubtitles
                      ? 'bg-amber-400 border-amber-600 text-slate-950'
                      : 'bg-slate-900/85 hover:bg-slate-800 border-white/20 border-b-4 border-b-slate-950 text-white'
                  }`}
                >
                  <Subtitles className="w-5 h-5" aria-hidden="true" />
                  <span className="text-[10px] font-extrabold">CC</span>
                </button>
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* STAGE 3: CALL SUMMARY & PROPORTIONAL WORD-COUNT XP */}
      {stage === 'summary' && (
        <div
          data-testid="video-call-summary"
          data-scroll-container="true"
          className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-6 py-8 flex items-center justify-center"
        >
          <div className="w-full max-w-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl border-2 border-b-4 border-slate-200 dark:border-slate-700 p-6 sm:p-7 shadow-2xl space-y-5 animate-pop">
            <div className="text-center space-y-2">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-amber-100 to-sky-100 dark:from-amber-950/60 dark:to-sky-950/60 border-4 border-amber-300 dark:border-amber-600 flex items-center justify-center text-5xl shadow-md">
                {scenario.characterAvatar}
              </div>
              <div className="text-xs font-extrabold uppercase tracking-wide text-[#0284C7] dark:text-sky-400">
                📹 വീഡിയോ കോൾ പൂർത്തിയായി
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
                ഗംഭീര സംഭാഷണം!
              </h3>
              <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
                {scenario.characterNameMl} ({scenario.characterNameEn}) ഉമായി {totalTurns} ഘട്ടങ്ങളും വിജയകരമായി പൂർത്തിയാക്കി.
              </p>
            </div>

            {/* Proportional XP Breakdown */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-2xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 p-3">
                <div className="text-[11px] font-extrabold text-[#0369A1] dark:text-sky-300">അറബി വാക്കുകൾ</div>
                <div
                  data-testid="video-call-summary-words"
                  className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 font-latin tabular-nums mt-0.5"
                >
                  {xpStats.spokenWords}
                </div>
              </div>
              <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-3">
                <div className="text-[11px] font-extrabold text-amber-700 dark:text-amber-300">വേഡ് ബോണസ്</div>
                <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-latin tabular-nums mt-0.5">
                  +{xpStats.bonusXp}
                </div>
              </div>
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-3">
                <div className="text-[11px] font-extrabold text-[#357A00] dark:text-emerald-300">ആകെ XP</div>
                <div
                  data-testid="video-call-summary-xp"
                  className="text-2xl font-extrabold text-[#357A00] dark:text-emerald-400 font-latin tabular-nums mt-0.5"
                >
                  +{xpStats.totalXp}
                </div>
              </div>
            </div>

            <div className="text-center text-xs font-bold text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700">
              ✨ കൂടുതൽ അറബി വാക്കുകൾ ഉപയോഗിക്കൂ, കൂടുതൽ XP നേടൂ! (Base +{xpStats.baseXp} XP + {xpStats.spokenWords} × 2 XP)
            </div>

            {/* Compact Conversation Recap */}
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
              {turnRecords.map((rec, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 flex items-center justify-between gap-2"
                >
                  <span className="text-[11px] font-extrabold text-[#0284C7] dark:text-sky-400 font-latin tabular-nums shrink-0">
                    #{i + 1} · {rec.wordCount}w
                  </span>
                  <span dir="rtl" lang="ar" className="font-arabic text-base font-bold text-slate-800 dark:text-slate-100 truncate">
                    {rec.userReplyAr}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              data-testid="video-call-finish-btn"
              onClick={handleFinishCall}
              className="btn-3d w-full py-3.5 px-5 rounded-2xl bg-[#58CC02] hover:bg-[#4EB802] border-b-4 border-[#3E9400] text-white font-extrabold text-base shadow-md"
            >
              തുടരുക (+{xpStats.totalXp} XP)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
