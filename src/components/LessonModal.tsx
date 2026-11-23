import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Delete,
  Heart,
  Keyboard,
  Loader2,
  Lock,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Turtle,
  Volume2,
  X,
} from 'lucide-react';
import type { LessonQuestion, SessionConfig, SessionResult } from '../types/learning';
import {
  ARABIC_QUICK_KEYS,
  buildFilledSentence,
  enqueueMistakeForReview,
  evaluateQuestionAnswer,
  evaluateSessionOutcome,
  evaluateSpeechMatch,
  fisherYatesShuffle,
  isPodcastQuestion,
  MAX_HEARTS,
  MISTAKE_REVIEW_BANNER_TEXT,
  normalizeWordBankText,
  shouldShowArabicPromptCard,
  type SpeechEvaluationResult,
} from '../utils/learningEngine';
import {
  collectQuestionArabicTexts,
  getArabicAudioState,
  pauseArabicAudio,
  playTone,
  preloadArabicAudioBatch,
  resumeArabicAudio,
  speakArabic,
  stopArabicAudio,
  subscribeArabicAudioState,
  type ArabicAudioState,
} from '../utils/audio';

interface LessonModalProps {
  session: SessionConfig;
  soundEnabled: boolean;
  onHeartsChange: (hearts: number) => void;
  onRefillHearts: () => void;
  onComplete: (result: SessionResult) => void;
  onClose: () => void;
}

interface WordChip {
  idx: number;
  text: string;
}

interface SpeechRecognitionAltLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAltLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export const LessonModal: React.FC<LessonModalProps> = ({
  session,
  soundEnabled,
  onHeartsChange,
  onRefillHearts,
  onComplete,
  onClose,
}) => {
  const [questionQueue, setQuestionQueue] = useState<LessonQuestion[]>(() => [...session.questions]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [hearts, setHearts] = useState(session.initialHearts);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [wordBankSelected, setWordBankSelected] = useState<WordChip[]>([]);
  const [matchedPairIndices, setMatchedPairIndices] = useState<number[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [selectedRight, setSelectedRight] = useState<number | null>(null);
  const [wrongPairFlash, setWrongPairFlash] = useState<{ left: number; right: number } | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; detail: string } | null>(null);
  const [showOutOfHearts, setShowOutOfHearts] = useState(false);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [podcastSelectedWords, setPodcastSelectedWords] = useState<string[]>([]);
  const [podcastTranscriptOpen, setPodcastTranscriptOpen] = useState(false);
  const [dictationInput, setDictationInput] = useState('');
  const [quickKeysOpen, setQuickKeysOpen] = useState(true);
  const dictationInputRef = useRef<HTMLInputElement | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [speechEval, setSpeechEval] = useState<SpeechEvaluationResult | null>(null);
  const [speechStatus, setSpeechStatus] = useState<
    'idle' | 'unsupported' | 'denied' | 'no-speech' | 'retry'
  >('idle');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speakSettledRef = useRef(false);
  const [audioState, setAudioState] = useState<ArabicAudioState>(() => getArabicAudioState());

  const question = questionQueue[currentIndex];
  const progressPct = Math.round((currentIndex / questionQueue.length) * 100);
  const hideTranslit = Boolean(session.hideTranslit);
  const isLegendary = session.variant === 'legendary';
  const isPodcast = isPodcastQuestion(question);
  const isDictation = question.type === 'dictation';
  const isSpeak = question.type === 'speak';
  const showArabicPromptCard = shouldShowArabicPromptCard(question);
  const shouldGateTranslit =
    showArabicPromptCard &&
    'arabic' in question &&
    Boolean(question.arabic) &&
    Boolean(question.translit) &&
    question.arabic!.replace(/[\u064B-\u065F\u0670]/g, '').trim().length <= 2;

  const stopSpeechRecognition = () => {
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
        try {
          rec.stop();
        } catch {
          // Ignore stop errors
        }
      }
    }
    setIsListening(false);
  };

  // Subscribe to Cloud Arabic TTS playback state & clean up audio + speech recognition on unmount
  useEffect(() => {
    const unsub = subscribeArabicAudioState(setAudioState);
    return () => {
      unsub();
      stopArabicAudio();
      stopSpeechRecognition();
    };
  }, []);

  // Fisher-Yates shuffle for MCQ, Listen, Fill-in-the-Blank & Radio MCQ options
  const shuffledOptions = useMemo(() => {
    if (
      question.type !== 'mcq' &&
      question.type !== 'listen' &&
      question.type !== 'fill_blank' &&
      question.type !== 'radio_mcq'
    ) {
      return [];
    }
    return fisherYatesShuffle(question.options);
  }, [question, currentIndex]);

  const shuffledWordBank = useMemo(() => {
    if (question.type !== 'wordbank') return [];
    return fisherYatesShuffle(question.words.map((text, idx) => ({ idx, text })));
  }, [question, currentIndex]);

  const shuffledPodcastWords = useMemo(() => {
    if (question.type !== 'radio_select3') return [];
    return fisherYatesShuffle(question.words);
  }, [question, currentIndex]);

  const shuffledPairs = useMemo(() => {
    if (question.type !== 'pairs') return { left: [], right: [] };
    const left = fisherYatesShuffle(
      question.pairs.map((p, idx) => ({ idx, text: p.ar, tr: p.tr }))
    );
    const right = fisherYatesShuffle(
      question.pairs.map((p, idx) => ({ idx, text: p.ml }))
    );
    return { left, right };
  }, [question, currentIndex]);

  // Preload all Arabic audio clips in this question (prompt, options, word bank, pairs, podcast)
  useEffect(() => {
    preloadArabicAudioBatch(collectQuestionArabicTexts(question));
  }, [question]);

  // Auto-pronounce Arabic prompt for standard Arabic prompt cards, Podcast, Dictation, AND Speaking exercises
  useEffect(() => {
    if (
      (showArabicPromptCard || isPodcast || isDictation || isSpeak) &&
      'arabic' in question &&
      question.arabic
    ) {
      const sourceKey = isPodcast
        ? 'podcast-main'
        : isDictation
          ? 'dictation-normal'
          : isSpeak
            ? 'speak-normal'
            : 'lesson-normal';
      const timer = window.setTimeout(() => {
        speakArabic(question.arabic!, soundEnabled, 1.0, sourceKey);
      }, 140);
      return () => {
        window.clearTimeout(timer);
        stopArabicAudio();
      };
    }
    stopArabicAudio();
    return undefined;
  }, [currentIndex, question, showArabicPromptCard, isPodcast, isDictation, isSpeak, soundEnabled]);

  // Detect SpeechRecognition support upfront when a Speaking question loads
  useEffect(() => {
    if (isSpeak) {
      speakSettledRef.current = false;
      if (!getSpeechRecognitionCtor()) {
        setSpeechStatus('unsupported');
      } else {
        setSpeechStatus('idle');
      }
    }
    return () => {
      if (isSpeak) {
        stopSpeechRecognition();
      }
    };
  }, [currentIndex, isSpeak]);

  const deductHeart = () => {
    const next = Math.max(0, hearts - 1);
    setHearts(next);
    if (session.mode === 'lesson' && !isLegendary) {
      onHeartsChange(next);
    }
    if (next === 0) {
      window.setTimeout(() => setShowOutOfHearts(true), 320);
    }
  };

  const resetQuestionState = () => {
    stopSpeechRecognition();
    speakSettledRef.current = false;
    setSelectedOption(null);
    setWordBankSelected([]);
    setPodcastSelectedWords([]);
    setPodcastTranscriptOpen(false);
    setDictationInput('');
    setSpokenTranscript('');
    setSpeechEval(null);
    setSpeechStatus('idle');
    setMatchedPairIndices([]);
    setSelectedLeft(null);
    setSelectedRight(null);
    setWrongPairFlash(null);
    setFeedback(null);
    setHintRevealed(false);
  };

  const handleToggleSpeakMic = () => {
    if (question.type !== 'speak' || feedback) return;
    if (isListening) {
      playTone('tap', soundEnabled);
      try {
        recognitionRef.current?.stop();
      } catch {
        stopSpeechRecognition();
      }
      return;
    }

    const SpeechRec = getSpeechRecognitionCtor();
    if (!SpeechRec) {
      setSpeechStatus('unsupported');
      return;
    }

    stopArabicAudio();
    playTone('tap', soundEnabled);
    speakSettledRef.current = false;
    setSpeechStatus('idle');
    setSpokenTranscript('');
    setSpeechEval(null);

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'ar-SA';
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 3;
      recognitionRef.current = recognition;

      let latestTranscript = '';
      let latestEval: SpeechEvaluationResult | null = null;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        if (speakSettledRef.current) return;
        const primaryParts: string[] = [];
        const altCandidates: string[] = [];

        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (res && res.length > 0 && res[0]?.transcript) {
            primaryParts.push(res[0].transcript.trim());
          }
        }
        const combinedPrimary = primaryParts.join(' ').trim();
        if (combinedPrimary) altCandidates.push(combinedPrimary);

        // Also evaluate alternative hypotheses from the latest result segment
        const lastRes = event.results[event.results.length - 1];
        if (lastRes && lastRes.length > 1) {
          const prefix = primaryParts.slice(0, -1).join(' ').trim();
          for (let a = 1; a < lastRes.length; a++) {
            const altText = `${prefix} ${lastRes[a]?.transcript ?? ''}`.trim();
            if (altText) altCandidates.push(altText);
          }
        }

        let bestText = combinedPrimary;
        let bestResult = evaluateSpeechMatch(combinedPrimary, question.arabic);
        for (const cand of altCandidates) {
          const ev = evaluateSpeechMatch(cand, question.arabic);
          if (ev.ratio > bestResult.ratio) {
            bestResult = ev;
            bestText = cand;
          }
        }

        latestTranscript = bestText;
        latestEval = bestResult;
        setSpokenTranscript(bestText);
        setSpeechEval(bestResult);

        if (bestResult.matched) {
          speakSettledRef.current = true;
          stopSpeechRecognition();
          setScore((s) => s + 1);
          playTone('correct', soundEnabled);
          setFeedback({
            isCorrect: true,
            detail: `മികച്ച ഉച്ചാരണം! (${Math.round(bestResult.ratio * 100)}% പൊരുത്തപ്പെട്ടു)`,
          });
        }
      };

      recognition.onerror = (event) => {
        const code = event?.error ?? '';
        stopSpeechRecognition();
        if (speakSettledRef.current) return;
        if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') {
          setSpeechStatus('denied');
        } else if (code === 'no-speech') {
          setSpeechStatus('no-speech');
        } else if (code !== 'aborted') {
          setSpeechStatus('retry');
        }
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        setIsListening(false);
        if (speakSettledRef.current) return;
        if (latestTranscript && latestEval && !latestEval.matched) {
          setSpeechStatus('retry');
        }
      };

      recognition.start();
    } catch {
      stopSpeechRecognition();
      setSpeechStatus('unsupported');
    }
  };

  const handleSkipSpeak = () => {
    playTone('tap', soundEnabled);
    stopSpeechRecognition();
    stopArabicAudio();
    if (currentIndex + 1 < questionQueue.length) {
      setCurrentIndex((i) => i + 1);
      resetQuestionState();
    } else {
      const result = evaluateSessionOutcome({
        mode: session.mode,
        variant: session.variant,
        lessonId: session.lessonId,
        targetUnitIndex: session.targetUnitIndex,
        score,
        totalQuestions: questionQueue.length,
        xpReward: session.xpReward,
      });
      onComplete(result);
    }
  };

  const insertDictationText = (charToInsert: string) => {
    if (feedback) return;
    playTone('tap', soundEnabled);
    const el = dictationInputRef.current;
    if (el && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      setDictationInput((prev) => {
        const next = prev.slice(0, start) + charToInsert + prev.slice(end);
        window.requestAnimationFrame(() => {
          el.focus();
          const pos = start + charToInsert.length;
          el.setSelectionRange(pos, pos);
        });
        return next;
      });
    } else {
      setDictationInput((prev) => prev + charToInsert);
      el?.focus();
    }
  };

  const handleDictationBackspace = () => {
    if (feedback) return;
    playTone('tap', soundEnabled);
    const el = dictationInputRef.current;
    if (el && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      setDictationInput((prev) => {
        if (start !== end) {
          const next = prev.slice(0, start) + prev.slice(end);
          window.requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(start, start);
          });
          return next;
        }
        if (start === 0) return prev;
        const next = prev.slice(0, start - 1) + prev.slice(end);
        window.requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start - 1, start - 1);
        });
        return next;
      });
    } else {
      setDictationInput((prev) => prev.slice(0, -1));
      el?.focus();
    }
  };

  const handlePairSelection = (side: 'left' | 'right', pairIdx: number) => {
    if (question.type !== 'pairs' || feedback || matchedPairIndices.includes(pairIdx)) return;

    const nextLeft = side === 'left' ? pairIdx : selectedLeft;
    const nextRight = side === 'right' ? pairIdx : selectedRight;

    if (side === 'left') {
      setSelectedLeft(pairIdx);
      const pairObj = question.pairs[pairIdx];
      if (pairObj) speakArabic(pairObj.ar, soundEnabled, 1.0, 'lesson-pair');
    } else {
      setSelectedRight(pairIdx);
    }
    playTone('tap', soundEnabled);

    if (nextLeft !== null && nextRight !== null) {
      if (nextLeft === nextRight) {
        playTone('correct', soundEnabled);
        const updatedMatched = [...matchedPairIndices, nextLeft];
        setMatchedPairIndices(updatedMatched);
        setSelectedLeft(null);
        setSelectedRight(null);

        if (updatedMatched.length === question.pairs.length) {
          setScore((s) => s + 1);
          window.setTimeout(() => {
            setFeedback({
              isCorrect: true,
              detail: 'എല്ലാ ജോഡികളും കൃത്യമായി യോജിപ്പിച്ചു!',
            });
          }, 220);
        }
      } else {
        playTone('wrong', soundEnabled);
        setWrongPairFlash({ left: nextLeft, right: nextRight });
        deductHeart();
        window.setTimeout(() => {
          setWrongPairFlash(null);
          setSelectedLeft(null);
          setSelectedRight(null);
        }, 420);
      }
    }
  };

  const canCheck =
    !feedback &&
    (question.type === 'mcq' ||
    question.type === 'listen' ||
    question.type === 'fill_blank' ||
    question.type === 'radio_tf' ||
    question.type === 'radio_mcq'
      ? selectedOption !== null
      : question.type === 'wordbank'
        ? wordBankSelected.length > 0
        : question.type === 'radio_select3'
          ? podcastSelectedWords.length === 3
          : question.type === 'dictation'
            ? dictationInput.trim().length > 0
            : false);

  const handleCheck = () => {
    if (!canCheck) return;
    const evaluation = evaluateQuestionAnswer(
      question,
      question.type === 'dictation' ? dictationInput : selectedOption,
      question.type === 'radio_select3'
        ? podcastSelectedWords
        : wordBankSelected.map((w) => w.text)
    );
    if (isPodcast) {
      setPodcastTranscriptOpen(true);
    }
    if (evaluation.correct) {
      setScore((s) => s + 1);
      playTone('correct', soundEnabled);
      if (question.type === 'fill_blank') {
        const filled = buildFilledSentence(question.sentence, question.answer);
        window.setTimeout(() => {
          speakArabic(filled, soundEnabled, 1.0, 'lesson-filled');
        }, 160);
      }
      setFeedback({
        isCorrect: true,
        detail: question.isReview ? 'തെറ്റ് ശരിയാക്കി! മികച്ചത്!' : 'ശരിയായ ഉത്തരം!',
      });
    } else {
      playTone('wrong', soundEnabled);
      deductHeart();
      if (session.mode === 'lesson') {
        setQuestionQueue((prev) => enqueueMistakeForReview(prev, question, session.mode));
      }
      setFeedback({
        isCorrect: false,
        detail:
          session.mode === 'lesson'
            ? `ശരിയായ ഉത്തരം: ${evaluation.expectedDisplay} · ഈ ചോദ്യം അവസാനം വീണ്ടും വരും`
            : `ശരിയായ ഉത്തരം: ${evaluation.expectedDisplay}`,
      });
    }
  };

  const handleContinue = () => {
    playTone('tap', soundEnabled);
    if (hearts === 0) {
      setShowOutOfHearts(true);
      return;
    }

    if (currentIndex + 1 < questionQueue.length) {
      setCurrentIndex((i) => i + 1);
      resetQuestionState();
    } else {
      const result = evaluateSessionOutcome({
        mode: session.mode,
        variant: session.variant,
        lessonId: session.lessonId,
        targetUnitIndex: session.targetUnitIndex,
        score,
        totalQuestions: questionQueue.length,
        xpReward: session.xpReward,
      });
      onComplete(result);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={session.bannerText || session.lessonTitle || 'പാഠം'}
      className="fixed inset-0 z-50 bg-white flex flex-col"
    >
      {/* Top Progress & Hearts Bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              playTone('tap', soundEnabled);
              stopArabicAudio();
              stopSpeechRecognition();
              onClose();
            }}
            aria-label="പാഠം അടയ്ക്കുക"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>

          <div
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="പാഠ പുരോഗതി"
            className="flex-1 bg-slate-200 h-3.5 rounded-full overflow-hidden"
          >
            <div
              className="bg-[#4AA802] h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.max(progressPct, 4)}%` }}
            />
          </div>

          <span
            data-testid="lesson-progress-count"
            className="text-xs font-extrabold text-slate-600 font-latin tabular-nums shrink-0"
          >
            {currentIndex + 1} / {questionQueue.length}
          </span>

          <div
            className="flex items-center gap-1.5 font-extrabold text-rose-600 text-sm font-latin tabular-nums shrink-0"
            aria-label={`ശേഷിക്കുന്ന ഹാർട്ടുകൾ: ${hearts}`}
          >
            <Heart className="w-5 h-5 fill-rose-500 text-rose-500" aria-hidden="true" />
            <span>{hearts}</span>
          </div>
        </div>

        {question.isReview ? (
          <div
            data-testid="mistake-review-banner"
            className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white text-xs sm:text-sm font-extrabold text-center py-2 px-4 border-t border-orange-600/30 shadow-xs"
          >
            {MISTAKE_REVIEW_BANNER_TEXT}
          </div>
        ) : (
          session.bannerText && (
            <div
              className={
                isLegendary
                  ? 'bg-gradient-to-r from-purple-700 via-violet-600 to-amber-500 text-white text-xs sm:text-sm font-extrabold text-center py-2 px-4 border-t border-purple-800/30'
                  : 'bg-sky-50 text-[#0369A1] text-xs font-extrabold text-center py-1.5 border-t border-sky-100'
              }
            >
              {session.bannerText}
            </div>
          )
        )}
      </header>

      {/* Main Question Stage */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 min-h-full flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-500 font-latin tabular-nums">
              <span>
                ചോദ്യം {currentIndex + 1} / {questionQueue.length}
              </span>
              {question.isReview ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-extrabold">
                  🔄 തെറ്റിയ ചോദ്യം
                </span>
              ) : question.isSpacedRepetition ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-sky-100 text-sky-800 border border-sky-200 text-[11px] font-extrabold">
                  🧠 പുനരവലോകനം
                </span>
              ) : null}
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">
              {question.prompt}
            </h2>

            {showArabicPromptCard && 'arabic' in question && question.arabic && (
              <div
                data-testid="arabic-prompt-card"
                className="bg-sky-50/70 border border-sky-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-2 shrink-0">
                  {(() => {
                    const normalBusy = audioState.sourceId === 'lesson-normal';
                    const normalLoading = normalBusy && audioState.status === 'loading';
                    const normalPlaying = normalBusy && audioState.status === 'playing';
                    return (
                      <button
                        type="button"
                        aria-label="ഉച്ചാരണം കേൾക്കുക"
                        data-audio-state={normalBusy ? audioState.status : 'idle'}
                        onClick={() =>
                          speakArabic(question.arabic!, soundEnabled, 1.0, 'lesson-normal')
                        }
                        className={`btn-3d w-12 h-12 rounded-2xl bg-[#0284C7] border-b-4 border-[#0369A1] text-white flex items-center justify-center transition ${
                          normalBusy ? 'ring-4 ring-sky-300/70' : ''
                        } ${normalPlaying ? 'animate-pulse' : ''}`}
                      >
                        {normalLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Volume2 className="w-5 h-5" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })()}
                  {(() => {
                    const slowBusy = audioState.sourceId === 'lesson-slow';
                    const slowLoading = slowBusy && audioState.status === 'loading';
                    const slowPlaying = slowBusy && audioState.status === 'playing';
                    return (
                      <button
                        type="button"
                        aria-label="പതുക്കെ കേൾക്കുക"
                        title="പതുക്കെ കേൾക്കുക"
                        data-audio-state={slowBusy ? audioState.status : 'idle'}
                        onClick={() =>
                          speakArabic(question.arabic!, soundEnabled, 0.65, 'lesson-slow')
                        }
                        className={`btn-3d w-11 h-11 rounded-xl border-2 border-b-4 flex items-center justify-center transition ${
                          slowBusy
                            ? 'bg-sky-50 border-[#0284C7] text-[#0369A1] ring-4 ring-sky-200'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        } ${slowPlaying ? 'animate-pulse' : ''}`}
                      >
                        {slowLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Turtle className="w-5 h-5" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })()}
                </div>

                <div className="text-right flex-1 min-w-0">
                  <div className="font-arabic text-3xl sm:text-4xl font-bold text-slate-900">
                    {question.arabic}
                  </div>
                  {!hideTranslit &&
                    question.translit &&
                    (!shouldGateTranslit || hintRevealed || Boolean(feedback) ? (
                      <div className="text-sm font-bold text-[#0369A1] mt-1">
                        {question.translit}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          playTone('tap', soundEnabled);
                          setHintRevealed(true);
                        }}
                        className="mt-1.5 text-xs font-bold text-[#0369A1] hover:underline"
                      >
                        ഉച്ചാരണ സൂചന കാണുക
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Answer Zone */}
          <div className="my-auto py-2">
            {(question.type === 'mcq' || question.type === 'listen') && (
              <div
                data-testid="mcq-options"
                className={
                  question.isArabicOption ? 'grid grid-cols-2 gap-3.5' : 'space-y-3'
                }
              >
                {shuffledOptions.map((opt) => {
                  const isSelected = selectedOption === opt;
                  const optTr = question.optionTranslits?.[opt];
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={Boolean(feedback)}
                      aria-pressed={isSelected}
                      onClick={() => {
                        playTone('tap', soundEnabled);
                        if (question.isArabicOption) {
                          speakArabic(opt, soundEnabled, 1.0, 'lesson-option');
                        }
                        setSelectedOption(opt);
                      }}
                      className={`btn-3d w-full p-4 rounded-2xl border-2 border-b-4 font-bold transition ${
                        question.isArabicOption
                          ? 'py-5 text-center flex flex-col items-center justify-center gap-1'
                          : 'text-left text-base'
                      } ${
                        isSelected
                          ? 'border-[#0284C7] bg-sky-50 text-[#0369A1]'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={
                          question.isArabicOption
                            ? 'font-arabic text-2xl sm:text-3xl leading-normal'
                            : undefined
                        }
                      >
                        {opt}
                      </span>
                      {!hideTranslit && optTr && (
                        <span
                          dir="ltr"
                          className="text-xs font-bold text-[#0369A1] leading-snug"
                        >
                          {optTr}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {question.type === 'fill_blank' && (() => {
              const parts = question.sentence.split(/_+/);
              const beforeBlank = parts[0] ?? '';
              const afterBlank = parts[1] ?? '';
              const selectedTr = selectedOption ? question.optionTranslits?.[selectedOption] : null;
              const slotTone = feedback
                ? feedback.isCorrect
                  ? 'border-[#4AA802] bg-emerald-50 text-[#2E7D00]'
                  : 'border-rose-500 bg-rose-50 text-rose-700'
                : selectedOption
                  ? 'border-[#0284C7] bg-sky-50 text-[#0369A1]'
                  : 'border-slate-300 bg-slate-50/70 text-slate-400';

              return (
                <div className="space-y-6">
                  {/* Duolingo-style Character Avatar + Speech Bubble */}
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div
                      aria-hidden="true"
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-emerald-50 to-sky-50 border-2 border-b-4 border-sky-200 flex items-center justify-center text-4xl sm:text-5xl shrink-0 shadow-xs select-none"
                    >
                      {question.avatar ?? '🦉'}
                    </div>

                    <div
                      data-testid="fill-blank-bubble"
                      className="relative flex-1 bg-white border-2 border-b-4 border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs"
                    >
                      {/* Speech bubble pointer */}
                      <div
                        aria-hidden="true"
                        className="absolute -left-2.5 top-6 w-4 h-4 bg-white border-l-2 border-b-2 border-slate-200 rotate-45"
                      />

                      <div
                        dir="rtl"
                        className="font-arabic text-2xl sm:text-3xl font-bold text-slate-900 leading-[2.1] flex flex-wrap items-baseline gap-x-2.5 gap-y-2"
                      >
                        {beforeBlank.trim() && <span>{beforeBlank.trim()}</span>}
                        <span
                          data-testid="fill-blank-slot"
                          className={`inline-flex flex-col items-center justify-center align-middle min-w-[92px] sm:min-w-[108px] px-3 py-1 rounded-xl border-b-4 transition-all ${slotTone}`}
                        >
                          <span className="font-arabic text-2xl sm:text-3xl leading-snug">
                            {selectedOption ?? '\u00A0'}
                          </span>
                          {!hideTranslit && selectedTr && (
                            <span
                              dir="ltr"
                              className="font-sans text-[11px] font-extrabold leading-tight opacity-90"
                            >
                              {selectedTr}
                            </span>
                          )}
                        </span>
                        {afterBlank.trim() && <span>{afterBlank.trim()}</span>}
                      </div>

                      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <p className="text-xs sm:text-sm font-bold text-slate-600 leading-snug">
                          💡 {question.hintMl}
                        </p>
                        {feedback?.isCorrect && (
                          <button
                            type="button"
                            aria-label="പൂർണ്ണ വാക്യം വീണ്ടും കേൾക്കുക"
                            onClick={() =>
                              speakArabic(
                                buildFilledSentence(question.sentence, question.answer),
                                soundEnabled,
                                1.0,
                                'lesson-filled'
                              )
                            }
                            className="btn-3d w-9 h-9 rounded-xl bg-emerald-100 border-b-2 border-emerald-300 text-emerald-700 flex items-center justify-center shrink-0"
                          >
                            <Volume2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 3 Shuffled Arabic Choice Buttons */}
                  <div
                    data-testid="fill-blank-options"
                    className="grid grid-cols-3 gap-3"
                  >
                    {shuffledOptions.map((opt) => {
                      const isSelected = selectedOption === opt;
                      const optTr = question.optionTranslits?.[opt];
                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={Boolean(feedback)}
                          aria-pressed={isSelected}
                          onClick={() => {
                            playTone('tap', soundEnabled);
                            speakArabic(opt, soundEnabled, 1.0, 'lesson-option');
                            setSelectedOption(opt);
                          }}
                          className={`btn-3d w-full py-4 px-2.5 rounded-2xl border-2 border-b-4 font-bold flex flex-col items-center justify-center gap-1 transition ${
                            isSelected
                              ? 'border-[#0284C7] bg-sky-50 text-[#0369A1]'
                              : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                          }`}
                        >
                          <span className="font-arabic text-2xl sm:text-3xl leading-normal">
                            {opt}
                          </span>
                          {!hideTranslit && optTr && (
                            <span
                              dir="ltr"
                              className="text-xs font-bold text-[#0369A1] leading-snug"
                            >
                              {optTr}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {question.type === 'wordbank' && (
              <div className="space-y-6">
                <div
                  dir={question.isArabicWords ? 'rtl' : 'ltr'}
                  data-testid="wordbank-tray"
                  className="min-h-[82px] p-3.5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-wrap gap-2.5 items-center"
                >
                  {wordBankSelected.length === 0 ? (
                    <span className="text-xs sm:text-sm text-slate-500 font-semibold mx-auto">
                      താഴെ കാണുന്ന വാക്കുകളിൽ തൊട്ട് വാക്യം നിർമ്മിക്കുക
                    </span>
                  ) : (
                    wordBankSelected.map((chip, i) => {
                      const chipTr = question.wordTranslits?.[chip.text];
                      return (
                        <button
                          key={`${chip.idx}-${i}`}
                          type="button"
                          disabled={Boolean(feedback)}
                          aria-label={`${chip.text} നീക്കം ചെയ്യുക`}
                          title="നീക്കം ചെയ്യാൻ തൊടുക"
                          onClick={() => {
                            playTone('tap', soundEnabled);
                            setWordBankSelected((prev) => prev.filter((_, idx) => idx !== i));
                          }}
                          className="btn-3d group relative px-4 py-2 rounded-xl bg-white border-2 border-b-4 border-[#0284C7] hover:border-rose-400 hover:bg-rose-50/40 text-slate-900 font-bold flex flex-col items-center transition"
                        >
                          <span
                            className={
                              question.isArabicWords
                                ? 'font-arabic text-2xl leading-snug'
                                : 'text-sm sm:text-base'
                            }
                          >
                            {chip.text}
                          </span>
                          {!hideTranslit && chipTr && (
                            <span dir="ltr" className="text-[11px] font-bold text-[#0369A1]">
                              {chipTr}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
                {wordBankSelected.length > 0 && !feedback && (
                  <p className="text-[11px] text-slate-500 font-semibold text-center -mt-3">
                    വാക്ക് മാറ്റാൻ മുകളിലുള്ള ബോക്സിൽ തൊടുക
                  </p>
                )}

                <div
                  dir={question.isArabicWords ? 'rtl' : 'ltr'}
                  className="flex flex-wrap justify-center gap-2.5"
                >
                  {shuffledWordBank.map((chip) => {
                    const isUsed = wordBankSelected.some((w) => w.idx === chip.idx);
                    const chipTr = question.wordTranslits?.[chip.text];
                    return (
                      <button
                        key={chip.idx}
                        type="button"
                        disabled={isUsed || Boolean(feedback)}
                        onClick={() => {
                          playTone('tap', soundEnabled);
                          if (question.isArabicWords) {
                            speakArabic(chip.text, soundEnabled, 1.0, 'lesson-word');
                          }
                          setWordBankSelected((prev) => [...prev, chip]);
                        }}
                        className={`btn-3d px-4 py-2.5 rounded-xl border-2 border-b-4 font-bold transition flex flex-col items-center ${
                          isUsed
                            ? 'bg-slate-200 border-slate-200 text-transparent cursor-default'
                            : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={
                            question.isArabicWords
                              ? 'font-arabic text-2xl leading-snug'
                              : 'text-sm sm:text-base'
                          }
                        >
                          {chip.text}
                        </span>
                        {!hideTranslit && chipTr && (
                          <span
                            dir="ltr"
                            className={`text-[11px] font-bold ${
                              isUsed ? 'text-transparent' : 'text-[#0369A1]'
                            }`}
                          >
                            {chipTr}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {question.type === 'pairs' && (
              <div className="grid grid-cols-2 gap-3.5 sm:gap-5">
                <div className="space-y-3">
                  {shuffledPairs.left.map((item) => {
                    const isMatched = matchedPairIndices.includes(item.idx);
                    const isSelected = selectedLeft === item.idx;
                    const isWrong = wrongPairFlash?.left === item.idx;
                    return (
                      <button
                        key={`ar-${item.idx}`}
                        type="button"
                        disabled={isMatched}
                        onClick={() => handlePairSelection('left', item.idx)}
                        className={`btn-3d w-full px-3 py-3 min-h-[76px] rounded-2xl border-2 border-b-4 font-bold transition flex flex-col items-center justify-center gap-0.5 ${
                          isMatched
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 opacity-55 cursor-default'
                            : isWrong
                              ? 'border-rose-500 bg-rose-50 text-rose-700 animate-shake'
                              : isSelected
                                ? 'border-[#0284C7] bg-sky-50 text-[#0369A1]'
                                : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <span className="font-arabic text-xl sm:text-2xl leading-snug">
                          {item.text}
                        </span>
                        {!hideTranslit && item.tr && (
                          <span
                            dir="ltr"
                            className={`text-[11px] font-bold ${
                              isMatched ? 'text-emerald-700' : 'text-[#0369A1]'
                            }`}
                          >
                            {item.tr}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  {shuffledPairs.right.map((item) => {
                    const isMatched = matchedPairIndices.includes(item.idx);
                    const isSelected = selectedRight === item.idx;
                    const isWrong = wrongPairFlash?.right === item.idx;
                    return (
                      <button
                        key={`ml-${item.idx}`}
                        type="button"
                        disabled={isMatched}
                        onClick={() => handlePairSelection('right', item.idx)}
                        className={`btn-3d w-full p-4 min-h-[72px] rounded-2xl border-2 border-b-4 text-sm sm:text-base font-extrabold transition ${
                          isMatched
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 opacity-55 cursor-default'
                            : isWrong
                              ? 'border-rose-500 bg-rose-50 text-rose-700 animate-shake'
                              : isSelected
                                ? 'border-[#0284C7] bg-sky-50 text-[#0369A1]'
                                : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        {item.text}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(question.type === 'radio_tf' ||
              question.type === 'radio_select3' ||
              question.type === 'radio_mcq') && (() => {
              const isPlayingPodcast =
                audioState.sourceId === 'podcast-main' &&
                (audioState.status === 'playing' || audioState.status === 'loading');
              const isPausedPodcast =
                audioState.sourceId === 'podcast-main' && audioState.status === 'paused';
              const callerAvatar = question.callerAvatar ?? '🧕';
              const callerNameMl = question.callerNameMl ?? 'അതിഥി';
              const waveBars = [12, 20, 30, 18, 34, 24, 32, 16, 28, 34, 20, 26, 14, 22];

              const handlePlayPauseToggle = () => {
                playTone('tap', soundEnabled);
                if (isPlayingPodcast) {
                  pauseArabicAudio();
                } else if (isPausedPodcast) {
                  resumeArabicAudio(soundEnabled);
                } else {
                  speakArabic(question.arabic, soundEnabled, 1.0, 'podcast-main');
                }
              };

              const handleReplay = () => {
                playTone('tap', soundEnabled);
                speakArabic(question.arabic, soundEnabled, 1.0, 'podcast-main');
              };

              return (
                <div className="space-y-5" data-testid="podcast-studio">
                  {/* Shared Podcast Studio Header & Playback Bar */}
                  <div className="rounded-3xl border-2 border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 sm:p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200/80">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isPlayingPodcast ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                          ARABIC RADIO STUDIO · ഇദാഅത്തുൽ അറബിയ്യ
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-[#0369A1]">
                        {isPlayingPodcast ? 'ഓൺ എയർ' : isPausedPodcast ? 'താൽക്കാലികമായി നിർത്തി' : 'കേൾക്കൂ'}
                      </span>
                    </div>

                    {/* Studio Desk + Radio Host + Caller Speech Bubble */}
                    <div className="flex items-end justify-between gap-3 sm:gap-5 mb-4">
                      {/* Illustrated Arabic Radio Host at Studio Desk */}
                      <div className="flex flex-col items-center shrink-0">
                        <div className="relative flex items-end justify-center px-3 pt-1">
                          <span className="text-4xl sm:text-5xl leading-none" aria-hidden="true">
                            👳‍♂️
                          </span>
                          <span
                            className="text-2xl sm:text-3xl -ml-1.5 mb-0.5"
                            aria-hidden="true"
                          >
                            🎙️
                          </span>
                        </div>
                        <div className="w-28 sm:w-32 h-5 rounded-xl bg-slate-800 border-b-4 border-slate-950 flex items-center justify-center shadow-xs">
                          <span className="text-[9px] font-extrabold tracking-widest text-sky-300 uppercase">
                            ON AIR
                          </span>
                        </div>
                      </div>

                      {/* Caller / Guest Speech Bubble with Animated Sound Dots */}
                      <div className="flex-1 rounded-2xl rounded-bl-sm bg-sky-50 border-2 border-sky-200 px-3.5 py-3 flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-white border-2 border-sky-200 flex items-center justify-center text-2xl shrink-0">
                          <span aria-hidden="true">{callerAvatar}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-extrabold text-slate-800 truncate">
                            {callerNameMl} · കോളർ
                          </div>
                          <div
                            className="mt-1.5 flex items-center gap-1.5"
                            aria-label={isPlayingPodcast ? 'ഓഡിയോ പ്ലേ ചെയ്യുന്നു' : 'ഓഡിയോ തയ്യാറാണ്'}
                          >
                            {[0, 1, 2, 3].map((dotIdx) => (
                              <span
                                key={dotIdx}
                                style={{ animationDelay: `${dotIdx * 130}ms` }}
                                className={`w-2 h-2 rounded-full transition-colors ${
                                  isPlayingPodcast
                                    ? 'bg-[#1899D6] animate-bounce'
                                    : isPausedPodcast
                                      ? 'bg-amber-400'
                                      : 'bg-sky-300'
                                }`}
                              />
                            ))}
                            <span className="ml-1.5 text-[11px] font-bold text-slate-500">
                              {feedback ? 'ട്രാൻസ്ക്രിപ്റ്റ് ലഭ്യമാണ്' : 'ശ്രദ്ധിച്ച് കേൾക്കൂ'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Audio Waveform Playback Bar */}
                    <div className="rounded-2xl border-2 border-slate-200 bg-white p-2.5 flex items-center gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={handlePlayPauseToggle}
                        aria-label={isPlayingPodcast ? 'താൽക്കാലികമായി നിർത്തുക' : 'പ്ലേ ചെയ്യുക'}
                        className="btn-3d w-11 h-11 rounded-xl bg-[#1CB0F6] hover:bg-[#1899D6] border-b-4 border-[#1177A8] text-white flex items-center justify-center shrink-0"
                      >
                        {audioState.sourceId === 'podcast-main' && audioState.status === 'loading' ? (
                          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                        ) : isPlayingPodcast ? (
                          <Pause className="w-5 h-5 fill-current" aria-hidden="true" />
                        ) : (
                          <Play className="w-5 h-5 fill-current ml-0.5" aria-hidden="true" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleReplay}
                        aria-label="വീണ്ടും കേൾക്കുക"
                        title="വീണ്ടും കേൾക്കുക"
                        className="btn-3d w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 border-b-2 border-slate-300 text-slate-700 flex items-center justify-center shrink-0"
                      >
                        <RotateCcw className="w-4 h-4" aria-hidden="true" />
                      </button>

                      {/* Interactive Equalizer Waveform */}
                      <button
                        type="button"
                        onClick={handlePlayPauseToggle}
                        aria-label="ഓഡിയോ വേവ്ഫോം"
                        className="flex-1 h-10 px-2 rounded-xl bg-slate-50 hover:bg-sky-50/70 flex items-center justify-center gap-1 transition overflow-hidden"
                      >
                        <Volume2 className="w-4 h-4 text-[#1899D6] shrink-0 mr-1" aria-hidden="true" />
                        {waveBars.map((barHeight, idx) => (
                          <span
                            key={idx}
                            style={{
                              height: `${barHeight}px`,
                              animationDelay: `${idx * 75}ms`,
                            }}
                            className={`w-1 sm:w-1.5 rounded-full transition-all duration-200 ${
                              isPlayingPodcast
                                ? 'bg-[#1CB0F6] animate-pulse'
                                : isPausedPodcast
                                  ? 'bg-amber-400'
                                  : 'bg-slate-300'
                            }`}
                          />
                        ))}
                      </button>

                      {/* CC / Transcript Reveal Button (Locked until Check) */}
                      <button
                        type="button"
                        disabled={!feedback}
                        onClick={() => {
                          if (!feedback) return;
                          playTone('tap', soundEnabled);
                          setPodcastTranscriptOpen((prev) => !prev);
                        }}
                        aria-pressed={Boolean(feedback && podcastTranscriptOpen)}
                        title={feedback ? 'ട്രാൻസ്ക്രിപ്റ്റ് കാണുക/മറയ്ക്കുക' : 'പരിശോധിച്ച ശേഷം മാത്രം തുറക്കും'}
                        className={`btn-3d px-3 h-10 rounded-xl border-2 border-b-4 text-xs font-extrabold flex items-center gap-1.5 shrink-0 transition ${
                          !feedback
                            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                            : podcastTranscriptOpen
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {!feedback && <Lock className="w-3.5 h-3.5" aria-hidden="true" />}
                        <span>CC</span>
                      </button>
                    </div>

                    {/* Post-Check Vocalized Arabic Transcript + Malayalam Translation */}
                    {feedback && podcastTranscriptOpen && (
                      <div
                        data-testid="podcast-transcript"
                        className="mt-3.5 rounded-2xl border-2 border-amber-200 bg-amber-50/90 p-4 text-center space-y-1.5 animate-pop"
                      >
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800">
                          ട്രാൻസ്ക്രിപ്റ്റ് · TRANSCRIPT
                        </div>
                        <p
                          dir="rtl"
                          className="font-arabic text-2xl sm:text-3xl font-bold text-slate-900 leading-loose"
                        >
                          {question.transcriptAr}
                        </p>
                        {!hideTranslit && question.translit && (
                          <p className="text-xs font-bold text-amber-800">
                            {question.translit}
                          </p>
                        )}
                        <p className="text-sm font-extrabold text-slate-700 pt-1">
                          {question.transcriptMl}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Format 1: Podcast True / False (radio_tf) */}
                  {question.type === 'radio_tf' && (
                    <div className="space-y-4">
                      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 sm:p-5 text-center">
                        <p className="text-base sm:text-lg font-extrabold text-slate-900 leading-relaxed">
                          {question.statementMl}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4" data-testid="radio-tf-options">
                        {[
                          { val: 'true', icon: '✔️', label: 'ശരി', sub: 'True' },
                          { val: 'false', icon: '✖️', label: 'തെറ്റ്', sub: 'False' },
                        ].map((item) => {
                          const isSelected = selectedOption === item.val;
                          const isCorrectOption = String(question.answer) === item.val;
                          let styleClass =
                            'border-slate-200 bg-white text-slate-900 hover:bg-slate-50';
                          if (feedback) {
                            if (isCorrectOption) {
                              styleClass = 'border-emerald-500 bg-emerald-50 text-emerald-900';
                            } else if (isSelected) {
                              styleClass = 'border-rose-500 bg-rose-50 text-rose-900';
                            }
                          } else if (isSelected) {
                            styleClass = 'border-[#1899D6] bg-sky-50 text-[#0369A1]';
                          }
                          return (
                            <button
                              key={item.val}
                              type="button"
                              disabled={Boolean(feedback)}
                              aria-pressed={isSelected}
                              onClick={() => {
                                playTone('tap', soundEnabled);
                                setSelectedOption(item.val);
                              }}
                              className={`btn-3d aspect-[5/4] sm:aspect-[4/3] max-h-36 w-full rounded-3xl border-2 border-b-4 flex flex-col items-center justify-center gap-1.5 font-extrabold transition ${styleClass}`}
                            >
                              <span className="text-3xl sm:text-4xl leading-none" aria-hidden="true">
                                {item.icon}
                              </span>
                              <span className="text-lg sm:text-xl">{item.label}</span>
                              <span className="text-xs font-bold opacity-70">{item.sub}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Format 2: Podcast Select 3 Words You Hear (radio_select3) */}
                  {question.type === 'radio_select3' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs sm:text-sm font-bold text-slate-500">
                          5 വാക്കുകളിൽ നിന്ന് 3 എണ്ണം തൊടുക
                        </span>
                        <span
                          data-testid="radio-select3-counter"
                          className={`text-xs sm:text-sm font-extrabold tabular-nums ${
                            podcastSelectedWords.length === 3
                              ? 'text-[#1899D6]'
                              : 'text-slate-600'
                          }`}
                        >
                          തിരഞ്ഞെടുത്തവ: {podcastSelectedWords.length} / 3
                        </span>
                      </div>

                      <div
                        dir="rtl"
                        data-testid="radio-select3-chips"
                        className="flex flex-wrap justify-center gap-3"
                      >
                        {shuffledPodcastWords.map((word) => {
                          const isPicked = podcastSelectedWords.includes(word);
                          const isSpokenAnswer = question.answers.some(
                            (ans) => normalizeWordBankText(ans) === normalizeWordBankText(word)
                          );
                          let chipStyle =
                            'bg-white border-slate-200 text-slate-900 hover:bg-slate-50';
                          if (feedback) {
                            if (isSpokenAnswer) {
                              chipStyle = 'bg-emerald-50 border-emerald-500 text-emerald-900';
                            } else if (isPicked) {
                              chipStyle = 'bg-rose-50 border-rose-500 text-rose-900';
                            } else {
                              chipStyle = 'bg-slate-50 border-slate-200 text-slate-400';
                            }
                          } else if (isPicked) {
                            chipStyle = 'bg-[#1899D6] border-[#1177A8] text-white';
                          }

                          return (
                            <button
                              key={word}
                              type="button"
                              disabled={Boolean(feedback)}
                              aria-pressed={isPicked}
                              onClick={() => {
                                playTone('tap', soundEnabled);
                                setPodcastSelectedWords((prev) => {
                                  if (prev.includes(word)) {
                                    return prev.filter((w) => w !== word);
                                  }
                                  if (prev.length >= 3) {
                                    return prev;
                                  }
                                  return [...prev, word];
                                });
                              }}
                              className={`btn-3d px-5 py-3 rounded-2xl border-2 border-b-4 font-arabic text-2xl sm:text-3xl font-bold flex items-center gap-2 transition ${chipStyle}`}
                            >
                              <span>{word}</span>
                              {feedback && isSpokenAnswer && (
                                <span className="text-sm font-sans font-extrabold" aria-hidden="true">
                                  ✓
                                </span>
                              )}
                              {feedback && isPicked && !isSpokenAnswer && (
                                <span className="text-sm font-sans font-extrabold" aria-hidden="true">
                                  ✕
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Format 3: Podcast Multiple Choice (radio_mcq) — 3 vertically stacked Malayalam choices */}
                  {question.type === 'radio_mcq' && (
                    <div className="space-y-3" data-testid="radio-mcq-options">
                      {shuffledOptions.map((opt, idx) => {
                        const isSelected = selectedOption === opt;
                        const isCorrectOpt = opt === question.answer;
                        let optStyle =
                          'border-slate-200 bg-white text-slate-800 hover:bg-slate-50';
                        if (feedback) {
                          if (isCorrectOpt) {
                            optStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900';
                          } else if (isSelected) {
                            optStyle = 'border-rose-500 bg-rose-50 text-rose-900';
                          }
                        } else if (isSelected) {
                          optStyle = 'border-[#1899D6] bg-sky-50 text-[#0369A1]';
                        }

                        return (
                          <button
                            key={opt}
                            type="button"
                            disabled={Boolean(feedback)}
                            aria-pressed={isSelected}
                            onClick={() => {
                              playTone('tap', soundEnabled);
                              setSelectedOption(opt);
                            }}
                            className={`btn-3d w-full p-4 rounded-2xl border-2 border-b-4 text-left font-bold text-sm sm:text-base flex items-center gap-3 transition ${optStyle}`}
                          >
                            <span
                              className={`w-7 h-7 rounded-lg border-2 text-xs font-extrabold flex items-center justify-center shrink-0 tabular-nums ${
                                feedback
                                  ? isCorrectOpt
                                    ? 'border-emerald-600 bg-emerald-600 text-white'
                                    : isSelected
                                      ? 'border-rose-600 bg-rose-600 text-white'
                                      : 'border-slate-200 bg-slate-100 text-slate-400'
                                  : isSelected
                                    ? 'border-[#1899D6] bg-[#1899D6] text-white'
                                    : 'border-slate-200 bg-slate-50 text-slate-500'
                              }`}
                            >
                              {feedback ? (isCorrectOpt ? '✓' : isSelected ? '✕' : idx + 1) : idx + 1}
                            </span>
                            <span className="leading-snug">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {question.type === 'dictation' && (() => {
              const normalBusy = audioState.sourceId === 'dictation-normal';
              const normalLoading = normalBusy && audioState.status === 'loading';
              const normalPlaying = normalBusy && audioState.status === 'playing';
              const slowBusy = audioState.sourceId === 'dictation-slow';
              const slowLoading = slowBusy && audioState.status === 'loading';
              const slowPlaying = slowBusy && audioState.status === 'playing';

              const inputTone = feedback
                ? feedback.isCorrect
                  ? 'border-[#4AA802] bg-emerald-50/70 text-emerald-950'
                  : 'border-rose-500 bg-rose-50/70 text-rose-950'
                : 'border-slate-300 bg-white text-slate-900 focus:border-[#0284C7] focus:ring-4 focus:ring-sky-100';

              return (
                <div className="space-y-5" data-testid="dictation-exercise">
                  {/* Audio-Only Character Avatar + Dual-Button Audio Capsule */}
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div
                      aria-hidden="true"
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-sky-50 to-emerald-50 border-2 border-b-4 border-sky-200 flex items-center justify-center text-4xl sm:text-5xl shrink-0 shadow-xs select-none"
                    >
                      {question.avatar ?? '🧕'}
                    </div>

                    <div className="relative flex-1 rounded-2xl border-2 border-b-4 border-sky-200 bg-sky-50/60 p-3.5 sm:p-4">
                      <div
                        aria-hidden="true"
                        className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 bg-sky-50 border-l-2 border-b-2 border-sky-200 rotate-45"
                      />
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <button
                          type="button"
                          aria-label="സാധാരണ വേഗത്തിൽ കേൾക്കുക"
                          data-testid="dictation-play-normal"
                          data-audio-state={normalBusy ? audioState.status : 'idle'}
                          onClick={() =>
                            speakArabic(question.arabic, soundEnabled, 1.0, 'dictation-normal')
                          }
                          className={`btn-3d h-11 sm:h-12 px-3.5 sm:px-5 rounded-2xl bg-[#0284C7] hover:bg-[#0369A1] border-b-4 border-[#075985] text-white font-extrabold text-sm flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition ${
                            normalBusy ? 'ring-4 ring-sky-300/70' : ''
                          } ${normalPlaying ? 'animate-pulse' : ''}`}
                        >
                          {normalLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                          ) : (
                            <Volume2 className="w-5 h-5" aria-hidden="true" />
                          )}
                          <span>കേൾക്കുക</span>
                        </button>

                        <button
                          type="button"
                          aria-label="പതുക്കെ കേൾക്കുക (0.65x)"
                          title="പതുക്കെ കേൾക്കുക (0.65x)"
                          data-testid="dictation-play-slow"
                          data-audio-state={slowBusy ? audioState.status : 'idle'}
                          onClick={() =>
                            speakArabic(question.arabic, soundEnabled, 0.65, 'dictation-slow')
                          }
                          className={`btn-3d h-11 sm:h-12 px-3 sm:px-4 rounded-2xl border-2 border-b-4 font-extrabold text-sm flex items-center gap-1.5 whitespace-nowrap transition ${
                            slowBusy
                              ? 'bg-sky-100 border-[#0284C7] text-[#0369A1] ring-4 ring-sky-200'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          } ${slowPlaying ? 'animate-pulse' : ''}`}
                        >
                          {slowLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Turtle className="w-5 h-5" aria-hidden="true" />
                          )}
                          <span className="font-latin tabular-nums">0.65x</span>
                        </button>
                      </div>
                      <p className="text-xs font-bold text-slate-600 mt-2">
                        ശ്രദ്ധിച്ച് കേട്ട് അറബിയിൽ ടൈപ്പ് ചെയ്യുക · ഹറകത്ത് നിർബന്ധമില്ല
                      </p>
                    </div>
                  </div>

                  {/* Large RTL Arabic Text Input Box */}
                  <div className="relative">
                    <label htmlFor="dictation-input" className="sr-only">
                      കേട്ട അറബി വാക്ക് ടൈപ്പ് ചെയ്യുക
                    </label>
                    <input
                      ref={dictationInputRef}
                      id="dictation-input"
                      data-testid="dictation-input"
                      type="text"
                      dir="rtl"
                      lang="ar"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      disabled={Boolean(feedback)}
                      value={dictationInput}
                      onChange={(e) => setDictationInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canCheck) {
                          e.preventDefault();
                          handleCheck();
                        }
                      }}
                      placeholder={'കേട്ട അറബി വാക്ക് ഇവിടെ ടൈപ്പ് ചെയ്യുക...\u200E'}
                      className={`w-full rounded-2xl border-2 border-b-4 px-5 py-4 pl-12 font-arabic text-2xl sm:text-3xl font-bold placeholder:font-sans placeholder:text-sm sm:placeholder:text-base placeholder:font-semibold placeholder:text-slate-400 focus:outline-none transition ${inputTone}`}
                    />
                    {dictationInput.length > 0 && !feedback && (
                      <button
                        type="button"
                        aria-label="ടൈപ്പ് ചെയ്തത് മായ്ക്കുക"
                        onClick={() => {
                          playTone('tap', soundEnabled);
                          setDictationInput('');
                          dictationInputRef.current?.focus();
                        }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {/* Post-Check Vocalized Arabic + Malayalam Meaning Reveal */}
                  {feedback && (
                    <div
                      data-testid="dictation-reveal"
                      className={`rounded-2xl border-2 p-4 sm:p-5 animate-pop space-y-2.5 ${
                        feedback.isCorrect
                          ? 'bg-emerald-50/90 border-emerald-300'
                          : 'bg-amber-50/95 border-amber-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/5">
                        <div
                          className={`text-xs font-extrabold ${
                            feedback.isCorrect ? 'text-emerald-800' : 'text-amber-900'
                          }`}
                        >
                          {feedback.isCorrect
                            ? '✓ പൂർണ്ണ ഹറകത്തോടുകൂടിയ അറബി രൂപം'
                            : '✕ ശരിയായ അറബി രൂപവും അർത്ഥവും'}
                        </div>

                        <button
                          type="button"
                          aria-label="ശരിയായ ഉച്ചാരണം വീണ്ടും കേൾക്കുക"
                          onClick={() =>
                            speakArabic(question.arabic, soundEnabled, 1.0, 'dictation-normal')
                          }
                          className="btn-3d w-9 h-9 rounded-xl bg-white border-2 border-b-4 border-slate-200 text-[#0284C7] hover:bg-sky-50 flex items-center justify-center shrink-0"
                        >
                          <Volume2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>

                      <div className="text-center space-y-1 pt-0.5">
                        <div
                          dir="rtl"
                          className="font-arabic text-3xl sm:text-4xl font-bold text-slate-900 leading-relaxed"
                        >
                          {question.arabic}
                        </div>
                        {!hideTranslit && question.translit && (
                          <p className="text-xs sm:text-sm font-bold text-[#0369A1]">
                            {question.translit}
                          </p>
                        )}
                        <p className="text-sm sm:text-base font-extrabold text-slate-800 pt-0.5">
                          {question.meaningMl}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Built-in Mini Arabic Quick-Key Helper */}
                  {!feedback && (
                    <div
                      data-testid="arabic-quick-keys"
                      className="rounded-2xl border-2 border-slate-200 bg-slate-50/90 overflow-hidden"
                    >
                      <button
                        type="button"
                        data-testid="toggle-quick-keys-btn"
                        aria-expanded={quickKeysOpen}
                        onClick={() => {
                          playTone('tap', soundEnabled);
                          setQuickKeysOpen((open) => !open);
                        }}
                        className="w-full px-3.5 sm:px-4 py-2.5 flex items-center justify-between gap-2 text-left text-xs font-extrabold text-slate-700 hover:bg-slate-100/80 transition"
                      >
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <Keyboard className="w-4 h-4 text-[#0284C7] shrink-0" aria-hidden="true" />
                          <span className="truncate">
                            അറബി ക്വിക്ക് കീബോർഡ്{' '}
                            <span className="hidden sm:inline font-semibold text-slate-500">
                              (Arabic Quick Keys)
                            </span>
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-500 shrink-0 whitespace-nowrap">
                          <span>{quickKeysOpen ? 'മറയ്ക്കുക' : 'തുറക്കുക'}</span>
                          {quickKeysOpen ? (
                            <ChevronUp className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="w-4 h-4" aria-hidden="true" />
                          )}
                        </span>
                      </button>

                      {quickKeysOpen && (
                        <div className="px-3 pb-3 pt-1.5 border-t border-slate-200/80 space-y-2">
                          <div
                            dir="rtl"
                            className="flex flex-wrap justify-center gap-1.5"
                          >
                            {ARABIC_QUICK_KEYS.map((ch) => (
                              <button
                                key={ch}
                                type="button"
                                data-ar-key={ch}
                                aria-label={`അറബി അക്ഷരം ${ch}`}
                                onClick={() => insertDictationText(ch)}
                                className="btn-3d min-w-[38px] sm:min-w-[42px] h-10 sm:h-11 px-2 rounded-xl bg-white hover:bg-sky-50 border border-b-[3px] border-slate-300 hover:border-[#0284C7] font-arabic text-xl sm:text-2xl font-bold text-slate-900 flex items-center justify-center transition"
                              >
                                {ch}
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              data-testid="arabic-key-space"
                              aria-label="സ്പേസ് (Space)"
                              onClick={() => insertDictationText(' ')}
                              className="btn-3d flex-1 h-10 rounded-xl bg-white hover:bg-sky-50 border border-b-[3px] border-slate-300 hover:border-[#0284C7] text-xs font-extrabold text-slate-700 flex items-center justify-center gap-1.5 transition"
                            >
                              <span>␣</span>
                              <span>സ്പേസ് (Space)</span>
                            </button>
                            <button
                              type="button"
                              data-testid="arabic-key-backspace"
                              aria-label="മായ്ക്കുക (Backspace)"
                              onClick={handleDictationBackspace}
                              className="btn-3d px-4 h-10 rounded-xl bg-rose-50 hover:bg-rose-100 border border-b-[3px] border-rose-200 text-xs font-extrabold text-rose-700 flex items-center justify-center gap-1.5 transition"
                            >
                              <Delete className="w-4 h-4" aria-hidden="true" />
                              <span>മായ്ക്കുക</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Duolingo Speaking Exercise ("Read Aloud") — Exclusive Units 20-35 */}
            {question.type === 'speak' && (() => {
              const avatarEmoji = question.avatar ?? '🧕';
              const normalBusy = audioState.sourceId === 'speak-normal';
              const normalLoading = normalBusy && audioState.status === 'loading';
              const normalPlaying = normalBusy && audioState.status === 'playing';
              const slowBusy = audioState.sourceId === 'speak-slow';
              const slowLoading = slowBusy && audioState.status === 'loading';
              const slowPlaying = slowBusy && audioState.status === 'playing';
              const targetWords = speechEval?.wordStatuses ??
                question.arabic
                  .trim()
                  .split(/\s+/)
                  .map((w) => ({ word: w, matched: Boolean(feedback?.isCorrect) }));
              const isUnavailable = speechStatus === 'unsupported' || speechStatus === 'denied';

              return (
                <div data-testid="speak-exercise" className="space-y-6">
                  {/* Character Avatar + Speech Bubble with Vocalized Arabic, Translit, Meaning & Speaker */}
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div
                      aria-hidden="true"
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-sky-50 to-emerald-50 border-2 border-b-4 border-sky-200 flex items-center justify-center text-4xl sm:text-5xl shrink-0 shadow-xs select-none"
                    >
                      {avatarEmoji}
                    </div>

                    <div className="relative flex-1 rounded-2xl border-2 border-b-4 border-sky-200 bg-white p-4 sm:p-5 shadow-xs space-y-2.5">
                      <div
                        aria-hidden="true"
                        className="absolute -left-2.5 top-6 w-4 h-4 bg-white border-l-2 border-b-2 border-sky-200 rotate-45"
                      />

                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            data-testid="speak-play-normal"
                            aria-label="അറബി ഉച്ചാരണം കേൾക്കുക"
                            onClick={() => {
                              stopSpeechRecognition();
                              speakArabic(question.arabic, soundEnabled, 1.0, 'speak-normal');
                            }}
                            className={`btn-3d w-11 h-11 rounded-2xl bg-[#1CB0F6] hover:bg-[#1899D6] border-b-4 border-[#1177A8] text-white flex items-center justify-center transition ${
                              normalPlaying ? 'ring-4 ring-sky-200 animate-pulse' : ''
                            }`}
                          >
                            {normalLoading ? (
                              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                            ) : (
                              <Volume2 className="w-5 h-5" aria-hidden="true" />
                            )}
                          </button>

                          <button
                            type="button"
                            data-testid="speak-play-slow"
                            aria-label="പതുക്കെ കേൾക്കുക (0.65x)"
                            title="പതുക്കെ കേൾക്കുക (0.65x)"
                            onClick={() => {
                              stopSpeechRecognition();
                              speakArabic(question.arabic, soundEnabled, 0.65, 'speak-slow');
                            }}
                            className={`btn-3d w-10 h-11 rounded-2xl border-2 border-b-4 flex items-center justify-center transition ${
                              slowBusy
                                ? 'bg-sky-100 border-[#0284C7] text-[#0369A1]'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            } ${slowPlaying ? 'animate-pulse' : ''}`}
                          >
                            {slowLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <Turtle className="w-5 h-5" aria-hidden="true" />
                            )}
                          </button>
                        </div>

                        <div
                          dir="rtl"
                          lang="ar"
                          data-testid="speak-target-arabic"
                          className="flex-1 text-right font-arabic text-2xl sm:text-3xl font-bold leading-relaxed flex flex-wrap justify-start gap-x-2 gap-y-1"
                        >
                          {targetWords.map((item, idx) => (
                            <span
                              key={`${item.word}-${idx}`}
                              className={`transition-colors duration-200 ${
                                item.matched ? 'text-[#357A00]' : 'text-slate-900'
                              }`}
                            >
                              {item.word}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 space-y-0.5 text-left">
                        {!hideTranslit && question.translit && (
                          <p
                            data-translit="true"
                            className="text-xs sm:text-sm font-bold text-[#0369A1]"
                          >
                            {question.translit}
                          </p>
                        )}
                        <p className="text-xs sm:text-sm font-extrabold text-slate-700">
                          {question.meaningMl}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Large Sky-Blue Microphone Button with Pulsing Sound-Wave Animation */}
                  <div className="flex flex-col items-center gap-4 pt-1">
                    <div className="relative w-full sm:max-w-md flex items-center justify-center">
                      {isListening && (
                        <div
                          aria-hidden="true"
                          className="animate-mic-ring pointer-events-none absolute inset-0 rounded-2xl border-4 border-[#1CB0F6]"
                        />
                      )}
                      <button
                        type="button"
                        data-testid="speak-mic-btn"
                        disabled={Boolean(feedback) || isUnavailable}
                        aria-pressed={isListening}
                        onClick={handleToggleSpeakMic}
                        className={`btn-3d relative w-full min-h-[64px] px-6 py-4 rounded-2xl border-b-4 font-extrabold text-base sm:text-lg flex items-center justify-center gap-3 transition ${
                          isUnavailable
                            ? 'bg-slate-200 border-slate-300 text-slate-500 cursor-not-allowed'
                            : isListening
                              ? 'bg-[#0284C7] border-[#0369A1] text-white shadow-lg ring-4 ring-sky-200'
                              : 'bg-[#1CB0F6] hover:bg-[#0EA5E9] border-[#1177A8] text-white shadow-sm'
                        }`}
                      >
                        {isListening ? (
                          <>
                            <span
                              data-testid="speak-sound-wave"
                              className="inline-flex items-center gap-1 h-7"
                              aria-hidden="true"
                            >
                              {[0, 0.14, 0.28, 0.18, 0.08].map((delay, idx) => (
                                <span
                                  key={idx}
                                  style={{ animationDelay: `${delay}s` }}
                                  className="animate-sound-wave w-1.5 h-6 rounded-full bg-white"
                                />
                              ))}
                            </span>
                            <span className="whitespace-nowrap">കേൾക്കുന്നു... സംസാരിക്കൂ</span>
                          </>
                        ) : isUnavailable ? (
                          <>
                            <MicOff className="w-5 h-5 shrink-0" aria-hidden="true" />
                            <span className="whitespace-nowrap">മൈക്രോഫോൺ ലഭ്യമല്ല</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-6 h-6 shrink-0" aria-hidden="true" />
                            <span className="whitespace-nowrap">
                              {speechStatus === 'retry' || speechStatus === 'no-speech'
                                ? '🎤 വീണ്ടും സംസാരിക്കുക'
                                : '🎤 സംസാരിക്കുക'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Live Recognized Arabic Words Display */}
                    {(isListening || spokenTranscript) && (
                      <div
                        data-testid="speak-live-transcript"
                        className={`w-full rounded-2xl border-2 p-4 text-center space-y-1.5 transition ${
                          feedback?.isCorrect
                            ? 'bg-emerald-50 border-emerald-300'
                            : isListening
                              ? 'bg-sky-50/70 border-sky-200'
                              : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
                          <span>നിങ്ങൾ പറഞ്ഞത് (Recognized Arabic)</span>
                          {speechEval && (
                            <span className="font-latin tabular-nums text-[#0369A1]">
                              {speechEval.matchedCount} / {speechEval.totalWords} വാക്കുകൾ (
                              {Math.round(speechEval.ratio * 100)}%)
                            </span>
                          )}
                        </div>
                        <div
                          dir="rtl"
                          lang="ar"
                          className="font-arabic text-2xl sm:text-3xl font-bold text-slate-900 min-h-[2.25rem]"
                        >
                          {spokenTranscript || '...'}
                        </div>
                      </div>
                    )}

                    {/* Retry / No-Speech Inline Nudge */}
                    {!feedback && (speechStatus === 'retry' || speechStatus === 'no-speech') && (
                      <div
                        role="status"
                        data-testid="speak-retry-notice"
                        className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs sm:text-sm font-bold text-amber-900"
                      >
                        {speechStatus === 'no-speech'
                          ? 'ശബ്ദം കേട്ടില്ല — മൈക്ക് അമർത്തി ഒരിക്കൽ കൂടി ഉറക്കെ വായിക്കൂ, അല്ലെങ്കിൽ താഴെ ഒഴിവാക്കാം.'
                          : 'കുറച്ചുകൂടി വ്യക്തമായി വീണ്ടും ശ്രമിക്കാം — അല്ലെങ്കിൽ താഴെ "ഇപ്പോൾ സംസാരിക്കാൻ കഴിയില്ല" അമർത്താം.'}
                      </div>
                    )}

                    {/* Friendly Fallback when SpeechRecognition is Unsupported or Mic Permission Denied */}
                    {!feedback && isUnavailable && (
                      <div
                        role="status"
                        data-testid="speak-fallback-notice"
                        className="w-full rounded-2xl border-2 border-amber-200 bg-amber-50/90 p-4 text-left space-y-1.5"
                      >
                        <div className="text-xs sm:text-sm font-extrabold text-amber-900">
                          {speechStatus === 'denied'
                            ? 'മൈക്രോഫോൺ അനുമതി ലഭിച്ചില്ല'
                            : 'ഈ ബ്രൗസറിൽ സ്പീച്ച് റെക്കഗ്നിഷൻ ലഭ്യമല്ല'}
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-amber-800 leading-relaxed">
                          മുകളിലെ 🔊 ബട്ടൺ അമർത്തി ഉച്ചാരണം കേട്ട് സ്വയം പരിശീലിക്കാം. തുടരാൻ താഴെയുള്ള
                          &ldquo;ഇപ്പോൾ സംസാരിക്കാൻ കഴിയില്ല&rdquo; ബട്ടൺ അമർത്തുക — ഹാർട്ട് നഷ്ടപ്പെടില്ല.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="h-4" />
        </div>
      </div>

      {/* Bottom Check Area or Slide-Up Feedback Drawer */}
      {feedback ? (
        <div
          role="status"
          aria-live="polite"
          className={`border-t-2 animate-pop ${
            feedback.isCorrect
              ? 'bg-[#E9F9D9] border-[#B6E68B] text-[#245700]'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 ${
                  feedback.isCorrect ? 'bg-[#4AA802]' : 'bg-rose-600'
                }`}
              >
                {feedback.isCorrect ? (
                  <Check className="w-6 h-6 stroke-[3]" aria-hidden="true" />
                ) : (
                  <X className="w-6 h-6 stroke-[3]" aria-hidden="true" />
                )}
              </div>
              <div>
                <h3 className="font-extrabold text-lg">
                  {feedback.isCorrect ? 'മികച്ചത്!' : 'ശരിയല്ല'}
                </h3>
                <p className="text-sm font-semibold mt-0.5">{feedback.detail}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleContinue}
              className={`btn-3d w-full sm:w-auto sm:min-w-[160px] py-3.5 px-6 rounded-2xl font-extrabold text-base text-white border-b-4 ${
                feedback.isCorrect
                  ? 'bg-[#4AA802] border-[#388000] hover:bg-[#429602]'
                  : 'bg-rose-600 border-rose-800 hover:bg-rose-700'
              }`}
            >
              തുടരുക
            </button>
          </div>
        </div>
      ) : question.type === 'speak' ? (
        <div className="border-t border-slate-200 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-center">
            <button
              type="button"
              data-testid="speak-skip-btn"
              onClick={handleSkipSpeak}
              className="btn-3d w-full sm:w-auto py-3 px-6 rounded-2xl border-2 border-b-4 border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-extrabold text-xs sm:text-sm whitespace-nowrap transition"
            >
              ഇപ്പോൾ സംസാരിക്കാൻ കഴിയില്ല (CAN&apos;T SPEAK NOW)
            </button>
          </div>
        </div>
      ) : (
        question.type !== 'pairs' && (
          <div className="border-t border-slate-200 bg-white">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex justify-end">
              <button
                type="button"
                disabled={!canCheck}
                onClick={handleCheck}
                className={`btn-3d w-full sm:w-auto sm:min-w-[200px] py-3.5 px-8 rounded-2xl font-extrabold text-base border-b-4 transition ${
                  canCheck
                    ? 'bg-[#4AA802] text-white border-[#388000] hover:bg-[#429602] cursor-pointer'
                    : 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed'
                }`}
              >
                പരിശോധിക്കുക
              </button>
            </div>
          </div>
        )
      )}

      {/* Out of Hearts Modal */}
      {showOutOfHearts && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="out-of-hearts-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-5"
        >
          <div className="bg-white rounded-3xl p-6 text-center max-w-sm w-full shadow-2xl animate-pop">
            <div className="text-5xl mb-3" aria-hidden="true">
              💔
            </div>
            <h3 id="out-of-hearts-title" className="text-xl font-extrabold text-slate-900">
              ഹാർട്ടുകൾ തീർന്നു!
            </h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              തെറ്റായ ഉത്തരങ്ങൾ കാരണം നിങ്ങളുടെ ഹാർട്ടുകൾ തീർന്നിരിക്കുന്നു. ഹാർട്ടുകൾ നിറച്ച് വീണ്ടും തുടരാം.
            </p>
            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  if (isLegendary) {
                    playTone('tap', soundEnabled);
                    setQuestionQueue([...session.questions]);
                    setCurrentIndex(0);
                    setScore(0);
                    setHearts(session.initialHearts);
                    resetQuestionState();
                    setShowOutOfHearts(false);
                  } else {
                    playTone('correct', soundEnabled);
                    setHearts(MAX_HEARTS);
                    onRefillHearts();
                    setShowOutOfHearts(false);
                  }
                }}
                className={`btn-3d w-full py-3.5 rounded-2xl border-b-4 text-white font-extrabold text-sm ${
                  isLegendary
                    ? 'bg-purple-600 border-purple-800'
                    : 'bg-[#4AA802] border-[#388000]'
                }`}
              >
                {isLegendary ? 'വീണ്ടും ശ്രമിക്കുക (3 ❤️)' : 'ഹാർട്ടുകൾ നിറയ്ക്കുക (സൗജന്യം)'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOutOfHearts(false);
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl text-slate-500 font-bold text-sm hover:bg-slate-100"
              >
                പുറത്തുകടക്കുക
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
