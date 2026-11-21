import React, { useEffect, useMemo, useState } from 'react';
import { Check, Heart, Turtle, Volume2, X } from 'lucide-react';
import type { SessionConfig, SessionResult } from '../types/learning';
import {
  deterministicShuffle,
  evaluateQuestionAnswer,
  evaluateSessionOutcome,
  MAX_HEARTS,
} from '../utils/learningEngine';
import { playTone, speakArabic } from '../utils/audio';

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

export const LessonModal: React.FC<LessonModalProps> = ({
  session,
  soundEnabled,
  onHeartsChange,
  onRefillHearts,
  onComplete,
  onClose,
}) => {
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

  const question = session.questions[currentIndex];
  const progressPct = Math.round((currentIndex / session.questions.length) * 100);
  const shouldGateTranslit =
    'arabic' in question &&
    Boolean(question.arabic) &&
    Boolean(question.translit) &&
    question.arabic!.replace(/[\u064B-\u065F\u0670]/g, '').trim().length <= 2;

  // Deterministic per-question shuffling so order doesn't jump during re-renders
  const shuffledWordBank = useMemo(() => {
    if (question.type !== 'wordbank') return [];
    return deterministicShuffle(
      question.words.map((text, idx) => ({ idx, text })),
      (currentIndex + 1) * 37 + question.words.length * 13
    );
  }, [question, currentIndex]);

  const shuffledPairs = useMemo(() => {
    if (question.type !== 'pairs') return { left: [], right: [] };
    const left = deterministicShuffle(
      question.pairs.map((p, idx) => ({ idx, text: p.ar, tr: p.tr })),
      (currentIndex + 1) * 53
    );
    const right = deterministicShuffle(
      question.pairs.map((p, idx) => ({ idx, text: p.ml })),
      (currentIndex + 1) * 97
    );
    return { left, right };
  }, [question, currentIndex]);

  // Auto-pronounce Arabic prompt when question changes
  useEffect(() => {
    if ('arabic' in question && question.arabic) {
      const timer = window.setTimeout(() => {
        speakArabic(question.arabic!, soundEnabled, 0.9);
      }, 120);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [question, soundEnabled]);

  const deductHeart = () => {
    const next = Math.max(0, hearts - 1);
    setHearts(next);
    if (session.mode === 'lesson') {
      onHeartsChange(next);
    }
    if (next === 0) {
      window.setTimeout(() => setShowOutOfHearts(true), 320);
    }
  };

  const resetQuestionState = () => {
    setSelectedOption(null);
    setWordBankSelected([]);
    setMatchedPairIndices([]);
    setSelectedLeft(null);
    setSelectedRight(null);
    setWrongPairFlash(null);
    setFeedback(null);
    setHintRevealed(false);
  };

  const handlePairSelection = (side: 'left' | 'right', pairIdx: number) => {
    if (question.type !== 'pairs' || feedback || matchedPairIndices.includes(pairIdx)) return;

    const nextLeft = side === 'left' ? pairIdx : selectedLeft;
    const nextRight = side === 'right' ? pairIdx : selectedRight;

    if (side === 'left') {
      setSelectedLeft(pairIdx);
      const pairObj = question.pairs[pairIdx];
      if (pairObj) speakArabic(pairObj.ar, soundEnabled, 0.85);
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
    (question.type === 'mcq' || question.type === 'listen'
      ? selectedOption !== null
      : question.type === 'wordbank'
        ? wordBankSelected.length > 0
        : false);

  const handleCheck = () => {
    if (!canCheck) return;
    const evaluation = evaluateQuestionAnswer(
      question,
      selectedOption,
      wordBankSelected.map((w) => w.text)
    );
    if (evaluation.correct) {
      setScore((s) => s + 1);
      playTone('correct', soundEnabled);
      setFeedback({
        isCorrect: true,
        detail: 'ശരിയായ ഉത്തരം!',
      });
    } else {
      playTone('wrong', soundEnabled);
      deductHeart();
      setFeedback({
        isCorrect: false,
        detail: `ശരിയായ ഉത്തരം: ${evaluation.expectedDisplay}`,
      });
    }
  };

  const handleContinue = () => {
    playTone('tap', soundEnabled);
    if (hearts === 0) {
      setShowOutOfHearts(true);
      return;
    }

    if (currentIndex + 1 < session.questions.length) {
      setCurrentIndex((i) => i + 1);
      resetQuestionState();
    } else {
      const result = evaluateSessionOutcome({
        mode: session.mode,
        lessonId: session.lessonId,
        targetUnitIndex: session.targetUnitIndex,
        score,
        totalQuestions: session.questions.length,
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

          <div
            className="flex items-center gap-1.5 font-extrabold text-rose-600 text-sm font-latin tabular-nums shrink-0"
            aria-label={`ശേഷിക്കുന്ന ഹാർട്ടുകൾ: ${hearts}`}
          >
            <Heart className="w-5 h-5 fill-rose-500 text-rose-500" aria-hidden="true" />
            <span>{hearts}</span>
          </div>
        </div>

        {session.bannerText && (
          <div className="bg-sky-50 text-[#0369A1] text-xs font-extrabold text-center py-1.5 border-t border-sky-100">
            {session.bannerText}
          </div>
        )}
      </header>

      {/* Main Question Stage */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 min-h-full flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="text-xs font-bold text-slate-500 font-latin tabular-nums">
              ചോദ്യം {currentIndex + 1} / {session.questions.length}
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">
              {question.prompt}
            </h2>

            {'arabic' in question && question.arabic && (
              <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    aria-label="ഉച്ചാരണം കേൾക്കുക"
                    onClick={() => speakArabic(question.arabic!, soundEnabled, 0.9)}
                    className="btn-3d w-12 h-12 rounded-2xl bg-[#0284C7] border-b-4 border-[#0369A1] text-white flex items-center justify-center"
                  >
                    <Volume2 className="w-5 h-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="പതുക്കെ കേൾക്കുക"
                    title="പതുക്കെ കേൾക്കുക"
                    onClick={() => speakArabic(question.arabic!, soundEnabled, 0.55)}
                    className="btn-3d w-11 h-11 rounded-xl bg-white border-2 border-b-4 border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-50"
                  >
                    <Turtle className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>

                <div className="text-right flex-1 min-w-0">
                  <div className="font-arabic text-3xl sm:text-4xl font-bold text-slate-900">
                    {question.arabic}
                  </div>
                  {question.translit &&
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
                className={
                  question.isArabicOption ? 'grid grid-cols-2 gap-3.5' : 'space-y-3'
                }
              >
                {question.options.map((opt) => {
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
                          speakArabic(opt, soundEnabled, 0.85);
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
                      {optTr && (
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
                          onClick={() => {
                            playTone('tap', soundEnabled);
                            setWordBankSelected((prev) => prev.filter((_, idx) => idx !== i));
                          }}
                          className="btn-3d px-4 py-2 rounded-xl bg-white border-2 border-b-4 border-[#0284C7] text-slate-900 font-bold flex flex-col items-center"
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
                          {chipTr && (
                            <span dir="ltr" className="text-[11px] font-bold text-[#0369A1]">
                              {chipTr}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

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
                            speakArabic(chip.text, soundEnabled, 0.9);
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
                        {chipTr && (
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
                        {item.tr && (
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
                  playTone('correct', soundEnabled);
                  setHearts(MAX_HEARTS);
                  onRefillHearts();
                  setShowOutOfHearts(false);
                }}
                className="btn-3d w-full py-3.5 rounded-2xl bg-[#4AA802] border-b-4 border-[#388000] text-white font-extrabold text-sm"
              >
                ഹാർട്ടുകൾ നിറയ്ക്കുക (സൗജന്യം)
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
