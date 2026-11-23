import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
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

interface VideoCallModalProps {
  lessonId: string;
  scenario: VideoCallScenario;
  soundEnabled: boolean;
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
  onComplete,
  onClose,
}) => {
  const [stage, setStage] = useState<CallStage>('ringing');
  const [turnIndex, setTurnIndex] = useState(0);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [backdropFailed, setBackdropFailed] = useState(false);
  const [isCharacterSpeaking, setIsCharacterSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [micNote, setMicNote] = useState<string | null>(null);
  const [reactionBanner, setReactionBanner] = useState<string | null>(null);
  const [turnRecords, setTurnRecords] = useState<CompletedTurnRecord[]>([]);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef('');
  const mountedRef = useRef(true);
  const speakingTimerRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const speechSupported = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);

  const currentTurn = scenario.turns[turnIndex] ?? scenario.turns[0];
  const totalTurns = scenario.turns.length;

  const totalSpokenWords = useMemo(
    () => turnRecords.reduce((sum, rec) => sum + rec.wordCount, 0),
    [turnRecords]
  );
  const xpStats = useMemo(() => calculateVideoCallXp(totalSpokenWords), [totalSpokenWords]);

  const stopRecognition = useCallback(() => {
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
      const estimatedMs = Math.min(4800, Math.max(1600, arabicText.length * 52));
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

  // Speak the character's current Arabic prompt when entering a turn
  useEffect(() => {
    if (stage !== 'active' || !currentTurn) return;
    setLiveTranscript('');
    transcriptRef.current = '';
    setReactionBanner(null);
    setIsAdvancing(false);
    // If SpeechRecognition is unavailable (e.g., restricted WebView), open quick-reply chips automatically
    if (!speechSupported) {
      setShowSuggestions(true);
    }
    const speakDelay = window.setTimeout(() => {
      if (mountedRef.current) {
        speakCharacterLine(currentTurn.characterAr);
      }
    }, 240);
    return () => window.clearTimeout(speakDelay);
  }, [stage, turnIndex, currentTurn, speechSupported, speakCharacterLine]);

  const submitTurnReply = useCallback(
    (replyText: string) => {
      if (!currentTurn || isAdvancing) return;
      const cleaned = replyText.trim();
      if (!cleaned) return;

      stopRecognition();
      const words = Math.max(1, countSpokenArabicWords(cleaned));

      playTone('correct', soundEnabled);
      setIsAdvancing(true);
      setLiveTranscript(cleaned);
      setReactionBanner(currentTurn.reactionAr);
      setTurnRecords((prev) => [
        ...prev,
        {
          turnIndex,
          characterAr: currentTurn.characterAr,
          userReplyAr: cleaned,
          wordCount: words,
        },
      ]);

      speakCharacterLine(currentTurn.reactionAr);

      advanceTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        if (turnIndex + 1 < totalTurns) {
          setTurnIndex((idx) => idx + 1);
        } else {
          playTone('complete', soundEnabled);
          setStage('summary');
        }
      }, 1550);
    },
    [currentTurn, isAdvancing, stopRecognition, soundEnabled, turnIndex, totalTurns, speakCharacterLine]
  );

  const handleToggleSpeak = useCallback(() => {
    if (isAdvancing) return;

    if (isListening) {
      const captured = transcriptRef.current.trim();
      stopRecognition();
      if (captured) {
        submitTurnReply(captured);
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

    try {
      const recognition = new Ctor();
      recognition.lang = 'ar-SA';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;

      recognition.onstart = () => {
        if (!mountedRef.current) return;
        setIsListening(true);
        playTone('tap', soundEnabled);
      };

      recognition.onresult = (ev: SpeechRecognitionEventLike) => {
        if (!mountedRef.current) return;
        let combined = '';
        let hasFinal = false;
        for (let i = 0; i < ev.results.length; i++) {
          const item = ev.results[i];
          if (item && item[0]?.transcript) {
            combined += (combined ? ' ' : '') + item[0].transcript.trim();
          }
          if (item?.isFinal) hasFinal = true;
        }
        transcriptRef.current = combined.trim();
        setLiveTranscript(combined.trim());

        if (hasFinal && combined.trim()) {
          submitTurnReply(combined.trim());
        }
      };

      recognition.onerror = (ev: SpeechRecognitionErrorEventLike) => {
        if (!mountedRef.current) return;
        stopRecognition();
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          setMicNote('മൈക്ക് അനുമതി ലഭിച്ചില്ല — താഴെയുള്ള അറബി മറുപടികൾ ടാപ്പ് ചെയ്ത് തുടരാം.');
        } else if (ev.error === 'no-speech') {
          setMicNote('ശബ്ദം കേട്ടില്ല — വീണ്ടും 🎤 അമർത്തുകയോ താഴെയുള്ള മറുപടി തിരഞ്ഞെടുക്കുകയോ ചെയ്യൂ.');
        } else {
          setMicNote('ശബ്ദം തിരിച്ചറിയാൻ കഴിഞ്ഞില്ല — വീണ്ടും ശ്രമിക്കുകയോ താഴെയുള്ള മറുപടി ടാപ്പ് ചെയ്യുകയോ ചെയ്യൂ.');
        }
        setShowSuggestions(true);
      };

      recognition.onend = () => {
        if (!mountedRef.current) return;
        const captured = transcriptRef.current.trim();
        setIsListening(false);
        recognitionRef.current = null;
        if (captured && !isAdvancing) {
          submitTurnReply(captured);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      stopRecognition();
      setMicNote('മൈക്ക് തുടങ്ങാൻ കഴിഞ്ഞില്ല — താഴെയുള്ള അറബി മറുപടികൾ ടാപ്പ് ചെയ്ത് സംസാരിക്കാം.');
      setShowSuggestions(true);
    }
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
      {stage === 'active' && currentTurn && (
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

          {/* Center Animated Character Portrait & Optional Subtitles */}
          <div
            data-scroll-container="true"
            className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 flex flex-col"
          >
            <div className="my-auto w-full flex flex-col items-center gap-4">
            {/* Large Animated Arab Character Portrait */}
            <div className="relative flex flex-col items-center shrink-0">
              <div className="relative flex items-center justify-center">
                {isCharacterSpeaking && (
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute w-44 h-44 sm:w-48 sm:h-48 rounded-full bg-amber-400/25 animate-ping"
                      style={{ animationDuration: '1.4s' }}
                    />
                    <span
                      aria-hidden="true"
                      className="absolute w-38 h-38 sm:w-42 sm:h-42 rounded-full border-2 border-amber-300/70 animate-pulse"
                    />
                  </>
                )}
                {isListening && (
                  <span
                    aria-hidden="true"
                    className="absolute w-44 h-44 sm:w-48 sm:h-48 rounded-full border-4 border-sky-400/75 animate-pulse"
                  />
                )}
                <button
                  type="button"
                  aria-label="ചോദ്യം വീണ്ടും കേൾക്കുക"
                  onClick={() => speakCharacterLine(currentTurn.characterAr)}
                  className={`relative w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-gradient-to-b from-amber-50 via-amber-100 to-amber-300 border-4 shadow-2xl flex items-center justify-center text-7xl sm:text-8xl transition-transform duration-300 ${
                    isCharacterSpeaking
                      ? 'border-amber-300 scale-105'
                      : isListening
                        ? 'border-sky-400 scale-100'
                        : 'border-white/90 hover:scale-[1.03]'
                  }`}
                >
                  <span aria-hidden="true">{scenario.characterAvatar}</span>
                </button>
              </div>

              {/* Subtle status label */}
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/65 backdrop-blur-md border border-white/15 text-xs font-bold text-white/95">
                {isCharacterSpeaking ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-amber-300 animate-pulse" aria-hidden="true" />
                    <span>{scenario.characterNameMl} സംസാരിക്കുന്നു...</span>
                  </>
                ) : isListening ? (
                  <>
                    <Mic className="w-3.5 h-3.5 text-sky-400 animate-pulse" aria-hidden="true" />
                    <span>കേൾക്കുന്നു... അറബിയിൽ സംസാരിക്കൂ!</span>
                  </>
                ) : reactionBanner ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#58CC02]" aria-hidden="true" />
                    <span className="font-arabic text-base text-emerald-200">{reactionBanner}</span>
                  </>
                ) : (
                  <span>മറുപടി പറയാൻ 🎤 അമർത്തുക</span>
                )}
              </div>
            </div>

            {/* Optional Subtitle Reveal Card */}
            {showSubtitles && (
              <div
                data-testid="video-call-subtitles"
                className="w-full max-w-lg bg-slate-950/78 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-center space-y-1.5 shadow-xl animate-pop"
              >
                <div
                  dir="rtl"
                  lang="ar"
                  className="font-arabic text-2xl sm:text-3xl font-bold text-white leading-relaxed"
                >
                  {currentTurn.characterAr}
                </div>
                <div className="text-xs font-bold text-sky-300">{currentTurn.characterTr}</div>
                <div className="text-xs sm:text-sm font-semibold text-amber-100/95">
                  {currentTurn.characterMl}
                </div>
              </div>
            )}

            {/* Live Spoken Arabic Transcript Pill */}
            {liveTranscript && (
              <div
                data-testid="video-call-live-transcript"
                className="w-full max-w-lg bg-sky-950/80 backdrop-blur-md border border-sky-400/45 rounded-2xl px-4 py-3 text-center space-y-1 shadow-lg animate-pop"
              >
                <div className="text-[11px] font-extrabold text-sky-300 uppercase tracking-wide">
                  നിങ്ങൾ പറഞ്ഞത് ({countSpokenArabicWords(liveTranscript)} വാക്കുകൾ)
                </div>
                <div dir="rtl" lang="ar" className="font-arabic text-xl sm:text-2xl font-bold text-white">
                  {liveTranscript}
                </div>
              </div>
            )}

            {/* Friendly Mic Fallback Note */}
            {micNote && (
              <div className="w-full max-w-lg bg-amber-950/80 border border-amber-400/40 rounded-xl px-3.5 py-2 text-xs font-bold text-amber-100 text-center">
                {micNote}
              </div>
            )}

            {/* Suggested Arabic Replies Drawer (Helpful for Learners & WebView Fallback) */}
            {showSuggestions && !isAdvancing && (
              <div
                data-testid="video-call-suggestions"
                className="w-full max-w-lg bg-slate-950/80 backdrop-blur-md border border-white/15 rounded-2xl p-3 space-y-2 shadow-xl"
              >
                <div className="flex items-center justify-between text-[11px] font-extrabold text-amber-200 px-1">
                  <span>💡 പറയാവുന്ന അറബി മറുപടികൾ (കൂടുതൽ വാക്കുകൾ = കൂടുതൽ XP)</span>
                </div>
                <div className="space-y-2">
                  {currentTurn.suggestedReplies.map((reply, rIdx) => {
                    const wc = countSpokenArabicWords(reply.ar);
                    return (
                      <button
                        key={rIdx}
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
                    speakCharacterLine(currentTurn.characterAr);
                  }}
                  className="btn-3d w-14 h-14 rounded-2xl bg-slate-900/85 hover:bg-slate-800 border border-white/20 border-b-4 border-b-slate-950 text-white flex flex-col items-center justify-center gap-0.5 shrink-0"
                >
                  <RotateCcw className="w-5 h-5" aria-hidden="true" />
                  <span className="text-[10px] font-extrabold text-white/80">വീണ്ടും</span>
                </button>

                {/* Bottom-Center: Large Sky-Blue TAP TO SPEAK Microphone Button */}
                <button
                  type="button"
                  data-testid="video-call-speak-btn"
                  disabled={isAdvancing}
                  onClick={handleToggleSpeak}
                  className={`btn-3d flex-1 h-16 px-5 rounded-2xl border-b-[5px] font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl transition whitespace-nowrap ${
                    isListening
                      ? 'bg-rose-500 hover:bg-rose-600 border-rose-700 text-white ring-4 ring-rose-400/40'
                      : 'bg-[#1CB0F6] hover:bg-[#17A2E6] border-[#0284C7] text-white'
                  } disabled:opacity-60`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-5 h-5 shrink-0" aria-hidden="true" />
                      <span>നിർത്തുക · STOP</span>
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
                      : 'bg-slate-900/85 hover:bg-slate-800 border-white/20 border-b-slate-950 text-white'
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
          <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl border-2 border-b-4 border-slate-200 p-6 sm:p-7 shadow-2xl space-y-5 animate-pop">
            <div className="text-center space-y-2">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-amber-100 to-sky-100 border-4 border-amber-300 flex items-center justify-center text-5xl shadow-md">
                {scenario.characterAvatar}
              </div>
              <div className="text-xs font-extrabold uppercase tracking-wide text-[#0284C7]">
                📹 വീഡിയോ കോൾ പൂർത്തിയായി
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900">
                ഗംഭീര സംഭാഷണം!
              </h3>
              <p className="text-xs sm:text-sm font-medium text-slate-600">
                {scenario.characterNameMl} ({scenario.characterNameEn}) ഉമായി {totalTurns} ഘട്ടങ്ങളും വിജയകരമായി പൂർത്തിയാക്കി.
              </p>
            </div>

            {/* Proportional XP Breakdown */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-2xl bg-sky-50 border border-sky-200 p-3">
                <div className="text-[11px] font-extrabold text-[#0369A1]">അറബി വാക്കുകൾ</div>
                <div
                  data-testid="video-call-summary-words"
                  className="text-2xl font-extrabold text-slate-900 font-latin tabular-nums mt-0.5"
                >
                  {xpStats.spokenWords}
                </div>
              </div>
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3">
                <div className="text-[11px] font-extrabold text-amber-700">വേഡ് ബോണസ്</div>
                <div className="text-2xl font-extrabold text-amber-600 font-latin tabular-nums mt-0.5">
                  +{xpStats.bonusXp}
                </div>
              </div>
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3">
                <div className="text-[11px] font-extrabold text-[#357A00]">ആകെ XP</div>
                <div
                  data-testid="video-call-summary-xp"
                  className="text-2xl font-extrabold text-[#357A00] font-latin tabular-nums mt-0.5"
                >
                  +{xpStats.totalXp}
                </div>
              </div>
            </div>

            <div className="text-center text-xs font-bold text-slate-500 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
              ✨ കൂടുതൽ അറബി വാക്കുകൾ ഉപയോഗിക്കൂ, കൂടുതൽ XP നേടൂ! (Base +{xpStats.baseXp} XP + {xpStats.spokenWords} × 2 XP)
            </div>

            {/* Compact Conversation Recap */}
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
              {turnRecords.map((rec, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 flex items-center justify-between gap-2"
                >
                  <span className="text-[11px] font-extrabold text-[#0284C7] font-latin tabular-nums shrink-0">
                    #{i + 1} · {rec.wordCount}w
                  </span>
                  <span dir="rtl" lang="ar" className="font-arabic text-base font-bold text-slate-800 truncate">
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
