import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Eye, EyeOff, Heart, Turtle, Volume2, X } from 'lucide-react';
import type { SessionResult, StoryCheckStep, UnitStory } from '../types/learning';
import {
  buildFilledSentence,
  collectStoryArabicTexts,
  evaluateSessionOutcome,
  evaluateStoryCheckAnswer,
  prepareStorySteps,
  STORY_XP_REWARD,
} from '../utils/learningEngine';
import {
  playTone,
  preloadArabicAudioBatch,
  speakArabic,
  stopArabicAudio,
} from '../utils/audio';

interface StoryModalProps {
  lessonId: string;
  story: UnitStory;
  soundEnabled: boolean;
  initialHearts: number;
  onComplete: (result: SessionResult) => void;
  onClose: () => void;
}

export const StoryModal: React.FC<StoryModalProps> = ({
  lessonId,
  story,
  soundEnabled,
  initialHearts,
  onComplete,
  onClose,
}) => {
  const steps = useMemo(() => prepareStorySteps(story), [story]);
  const [revealedCount, setRevealedCount] = useState(1);
  const [revealedHints, setRevealedHints] = useState<Record<number, boolean>>({});
  const [checkSelections, setCheckSelections] = useState<Record<number, string>>({});
  const [checkResults, setCheckResults] = useState<
    Record<number, { correct: boolean; expectedDisplay: string }>
  >({});
  const [hearts, setHearts] = useState(initialHearts);
  const [score, setScore] = useState(0);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  const activeIdx = revealedCount - 1;
  const activeStep = steps[activeIdx];
  const progressPct = Math.round((revealedCount / steps.length) * 100);

  useEffect(() => {
    preloadArabicAudioBatch(collectStoryArabicTexts(story));
    return () => stopArabicAudio();
  }, [story]);

  useEffect(() => {
    if (activeStep?.kind === 'line') {
      const timer = window.setTimeout(() => {
        speakArabic(activeStep.ar, soundEnabled, 1.0, `story-line-${activeIdx}`);
      }, 150);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [activeIdx, activeStep, soundEnabled]);

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [revealedCount, checkResults]);

  const isBlockedOnCheck =
    activeStep?.kind === 'check' && !checkResults[activeIdx]?.correct;

  const handleCheckSubmit = (stepIdx: number, step: StoryCheckStep) => {
    const selected = checkSelections[stepIdx] ?? null;
    if (!selected) return;
    const outcome = evaluateStoryCheckAnswer(step, selected);
    if (outcome.correct) {
      playTone('correct', soundEnabled);
      setScore((s) => s + 1);
      setCheckResults((prev) => ({ ...prev, [stepIdx]: outcome }));
      if (step.checkType === 'fill_blank' && step.sentence) {
        const filled = buildFilledSentence(step.sentence, step.answer);
        window.setTimeout(() => speakArabic(filled, soundEnabled, 1.0, `story-check-${stepIdx}`), 150);
      }
    } else {
      playTone('wrong', soundEnabled);
      setHearts((h) => Math.max(1, h - 1));
      setCheckResults((prev) => ({ ...prev, [stepIdx]: outcome }));
    }
  };

  const handleContinue = () => {
    playTone('tap', soundEnabled);
    if (revealedCount < steps.length) {
      setRevealedCount((c) => c + 1);
    } else {
      stopArabicAudio();
      const totalChecks = steps.filter((s) => s.kind === 'check').length;
      const result = evaluateSessionOutcome({
        mode: 'lesson',
        variant: 'story',
        lessonId,
        targetUnitIndex: null,
        score,
        totalQuestions: totalChecks,
        xpReward: STORY_XP_REWARD,
      });
      onComplete(result);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`കഥ: ${story.titleMl}`}
      data-testid="story-modal"
      className="fixed inset-0 z-50 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors"
    >
      {/* Top Story Progress Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              playTone('tap', soundEnabled);
              stopArabicAudio();
              onClose();
            }}
            aria-label="കഥ അടയ്ക്കുക"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>

          <div
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="flex-1 bg-slate-200 dark:bg-slate-800 h-3.5 rounded-full overflow-hidden"
          >
            <div
              className="bg-[#4AA802] h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.max(progressPct, 6)}%` }}
            />
          </div>

          <span
            data-testid="story-progress-count"
            className="text-xs font-extrabold text-slate-600 dark:text-slate-300 font-latin tabular-nums shrink-0"
          >
            {revealedCount} / {steps.length}
          </span>

          <div className="flex items-center gap-1.5 font-extrabold text-rose-600 dark:text-rose-400 text-sm font-latin tabular-nums shrink-0">
            <Heart className="w-5 h-5 fill-rose-500 text-rose-500" aria-hidden="true" />
            <span>{hearts}</span>
          </div>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/50 text-[#2E7D00] dark:text-emerald-300 text-xs font-extrabold text-center py-1.5 border-t border-emerald-100 dark:border-emerald-900/60">
          📖 ഇന്ററാക്ടീവ് അറബി കഥ · ഓരോ സംഭാഷണവും കേട്ട് മനസ്സിലാക്കാം
        </div>
      </header>

      {/* Scrollable Progressive Dialogue Stage */}
      <div data-scroll-container="true" className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          {/* Story Header Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-b-4 border-slate-200 dark:border-slate-800 p-5 text-center space-y-2 shadow-xs">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-50 to-sky-50 dark:from-emerald-950/60 dark:to-sky-950/60 border-2 border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-4xl">
              {story.emoji}
            </div>
            <div className="font-arabic text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50">
              {story.titleAr}
            </div>
            <div className="text-xs font-bold text-[#0369A1] dark:text-sky-400">{story.titleTr}</div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-50">{story.titleMl}</h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">{story.settingMl}</p>
            <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
              {story.characters.map((ch, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold"
                >
                  <span>{ch.avatar}</span>
                  <span>{ch.nameMl}</span>
                  <span className="font-arabic text-sm text-slate-900 dark:text-slate-50">({ch.nameAr})</span>
                </span>
              ))}
            </div>
          </div>

          {/* Progressive Steps */}
          <div className="space-y-4">
            {steps.slice(0, revealedCount).map((step, idx) => {
              if (step.kind === 'line') {
                const char = story.characters[step.speaker];
                const isRight = step.speaker === 1;
                const hintOpen = Boolean(revealedHints[idx]);
                return (
                  <div
                    key={idx}
                    data-testid={`story-line-${idx}`}
                    className={`flex items-start gap-3 animate-pop ${isRight ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      aria-hidden="true"
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-2 border-b-4 flex items-center justify-center text-2xl sm:text-3xl shrink-0 ${
                        isRight
                          ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800'
                      }`}
                    >
                      {char.avatar}
                    </div>

                    <div
                      className={`flex-1 rounded-2xl border-2 border-b-4 p-4 shadow-xs ${
                        isRight
                          ? 'bg-sky-50/70 dark:bg-sky-950/35 border-sky-200 dark:border-sky-800/80'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
                          {char.nameMl} · <span className="font-arabic text-sm text-slate-800 dark:text-slate-100">{char.nameAr}</span>
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            aria-label="സംഭാഷണം കേൾക്കുക"
                            onClick={() => speakArabic(step.ar, soundEnabled, 1.0, `story-line-${idx}`)}
                            className="btn-3d w-9 h-9 rounded-xl bg-[#0284C7] border-b-4 border-[#0369A1] text-white flex items-center justify-center"
                          >
                            <Volume2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label="പതുക്കെ കേൾക്കുക"
                            onClick={() => speakArabic(step.ar, soundEnabled, 0.65, `story-line-slow-${idx}`)}
                            className="btn-3d w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border-2 border-b-4 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center"
                          >
                            <Turtle className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <div dir="rtl" className="font-arabic text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 leading-[1.9] text-right">
                        {step.ar}
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-[#0369A1] dark:text-sky-400 mt-1">
                        {step.tr}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            playTone('tap', soundEnabled);
                            setRevealedHints((prev) => ({ ...prev, [idx]: !prev[idx] }));
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          {hintOpen ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>അർത്ഥം മറയ്ക്കുക</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>💡 മലയാളം അർത്ഥം കാണുക</span>
                            </>
                          )}
                        </button>
                        {hintOpen && (
                          <p className="mt-2 text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2">
                            {step.ml}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              // Inline Comprehension Check (MCQ or Fill-in-the-Blank)
              const selected = checkSelections[idx] ?? null;
              const result = checkResults[idx];
              const isSolved = Boolean(result?.correct);

              return (
                <div
                  key={idx}
                  data-testid={`story-check-${idx}`}
                  className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-b-4 border-amber-300 dark:border-amber-700 p-5 space-y-4 shadow-sm animate-pop"
                >
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-extrabold">
                    ❓ കഥയിൽ നിന്നുള്ള ചോദ്യം
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-50 leading-snug">
                    {step.prompt}
                  </h3>

                  {step.checkType === 'fill_blank' && step.sentence && (
                    <div className="bg-slate-50 dark:bg-slate-800/70 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-2">
                      <div dir="rtl" className="font-arabic text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 leading-[2] text-right">
                        {selected
                          ? buildFilledSentence(step.sentence, selected)
                          : step.sentence}
                      </div>
                      {step.hintMl && (
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">💡 {step.hintMl}</p>
                      )}
                    </div>
                  )}

                  <div className={step.checkType === 'fill_blank' ? 'grid grid-cols-3 gap-2.5' : 'space-y-2.5'}>
                    {step.options.map((opt) => {
                      const isSel = selected === opt;
                      const optTr = step.optionTranslits?.[opt];
                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={isSolved}
                          onClick={() => {
                            playTone('tap', soundEnabled);
                            if (step.checkType === 'fill_blank' || step.isArabicOption) {
                              speakArabic(opt, soundEnabled, 1.0, `story-opt-${idx}`);
                            }
                            setCheckSelections((prev) => ({ ...prev, [idx]: opt }));
                            if (result && !result.correct) {
                              setCheckResults((prev) => {
                                const next = { ...prev };
                                delete next[idx];
                                return next;
                              });
                            }
                          }}
                          className={`btn-3d w-full p-3.5 rounded-2xl border-2 border-b-4 font-bold transition ${
                            step.checkType === 'fill_blank'
                              ? 'flex flex-col items-center justify-center gap-0.5 text-center'
                              : 'text-left text-sm sm:text-base'
                          } ${
                            isSolved && opt === step.answer
                              ? 'border-[#4AA802] bg-emerald-50 dark:bg-emerald-950/60 text-[#245700] dark:text-emerald-200'
                              : isSel
                                ? 'border-[#0284C7] bg-sky-50 dark:bg-sky-950/60 text-[#0369A1] dark:text-sky-200'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span className={step.checkType === 'fill_blank' ? 'font-arabic text-2xl' : undefined}>
                            {opt}
                          </span>
                          {optTr && (
                            <span dir="ltr" className="text-[11px] font-bold text-[#0369A1] dark:text-sky-400">
                              {optTr}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {!isSolved && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={!selected}
                        onClick={() => handleCheckSubmit(idx, step)}
                        className={`btn-3d px-6 py-2.5 rounded-xl font-extrabold text-sm border-b-4 ${
                          selected
                            ? 'bg-[#4AA802] border-[#388000] text-white'
                            : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        പരിശോധിക്കുക
                      </button>
                    </div>
                  )}

                  {result && (
                    <div
                      role="status"
                      className={`rounded-2xl px-4 py-3 text-sm font-extrabold flex items-center gap-2 ${
                        result.correct
                          ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                          : 'bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-700'
                      }`}
                    >
                      {result.correct ? (
                        <>
                          <Check className="w-5 h-5 text-[#4AA802] dark:text-emerald-400 shrink-0" />
                          <span>മികച്ചത്! ശരിയായ ഉത്തരം — കഥ തുടരാം!</span>
                        </>
                      ) : (
                        <span>ശരിയല്ല — മറ്റൊരു ഉത്തരം തിരഞ്ഞെടുത്ത് വീണ്ടും ശ്രമിക്കൂ!</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomAnchorRef} className="h-4" />
          </div>
        </div>
      </div>

      {/* Bottom Sticky Continue Bar */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex justify-end">
          <button
            type="button"
            disabled={isBlockedOnCheck}
            onClick={handleContinue}
            data-testid="story-continue-btn"
            className={`btn-3d w-full sm:w-auto sm:min-w-[220px] py-3.5 px-8 rounded-2xl font-extrabold text-base border-b-4 transition ${
              isBlockedOnCheck
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-300 dark:border-slate-700 cursor-not-allowed'
                : 'bg-[#4AA802] text-white border-[#388000] hover:bg-[#429602] cursor-pointer'
            }`}
          >
            {revealedCount < steps.length
              ? 'തുടരുക (Continue)'
              : 'കഥ പൂർത്തിയാക്കുക (+15 XP)'}
          </button>
        </div>
      </div>
    </div>
  );
};
