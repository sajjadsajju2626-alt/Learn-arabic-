import React, { useState } from 'react';
import { BookOpen, Check, Lock, Rocket, Star, Volume2, X } from 'lucide-react';
import { UNITS } from '../data/curriculum';
import type { Lesson, Unit } from '../types/learning';
import { isLessonUnlocked, isUnitUnlocked } from '../utils/learningEngine';
import { playTone, speakArabic } from '../utils/audio';

interface LearningPathTabProps {
  completedLessons: string[];
  legendaryLessons?: string[];
  soundEnabled: boolean;
  onStartLesson: (lesson: Lesson) => void;
  onStartReview?: (lesson: Lesson) => void;
  onStartLegendary?: (lesson: Lesson) => void;
  onClaimChest?: (lesson: Lesson) => void;
  onStartUnitJump: (unitIndex: number) => void;
}

// Smooth 8-node S-curve offsets matching Duolingo's winding path
const S_CURVE_OFFSETS = [
  'translate-x-0',
  '-translate-x-8 sm:-translate-x-12',
  '-translate-x-12 sm:-translate-x-18',
  '-translate-x-6 sm:-translate-x-9',
  'translate-x-5 sm:translate-x-7',
  'translate-x-12 sm:translate-x-18',
  'translate-x-7 sm:translate-x-11',
  'translate-x-0',
];

export const LearningPathTab: React.FC<LearningPathTabProps> = ({
  completedLessons,
  legendaryLessons = [],
  soundEnabled,
  onStartLesson,
  onStartReview,
  onStartLegendary,
  onClaimChest,
  onStartUnitJump,
}) => {
  const [guidebookUnit, setGuidebookUnit] = useState<Unit | null>(null);
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);

  return (
    <div className="space-y-12 pb-8">
      {UNITS.map((unit, uIdx) => {
        const unitUnlocked = isUnitUnlocked(uIdx, completedLessons, UNITS);
        const unitCompletedCount = unit.lessons.filter((l) =>
          completedLessons.includes(l.id)
        ).length;

        return (
          <section key={unit.id} aria-labelledby={`unit-heading-${unit.id}`} className="space-y-6">
            {/* Unit Banner with Guidebook Button */}
            <div
              className={`rounded-2xl p-4 sm:p-5 text-white border-b-4 transition-colors ${unit.theme.bg} ${unit.theme.border}`}
            >
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white/90 font-latin tabular-nums">
                    യൂണിറ്റ് {unit.number} · {unitCompletedCount}/{unit.lessons.length} പൂർത്തിയായി
                  </div>
                  <h2
                    id={`unit-heading-${unit.id}`}
                    className="font-extrabold text-lg sm:text-xl leading-snug mt-1"
                  >
                    {unit.title}
                  </h2>
                  <p className="text-sm text-white/90 mt-1">{unit.subtitle}</p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {!unitUnlocked && (
                    <button
                      type="button"
                      onClick={() => {
                        playTone('tap', soundEnabled);
                        onStartUnitJump(uIdx);
                      }}
                      className="btn-3d hidden sm:inline-flex items-center gap-2 bg-white text-slate-900 font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-xl border-b-4 border-slate-200 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Rocket className="w-4 h-4 text-[#0284C7]" aria-hidden="true" />
                      <span>Jump Here?</span>
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`യൂണിറ്റ് ${unit.number} ഗൈഡ്‌ബുക്ക് തുറക്കുക`}
                    onClick={() => {
                      playTone('tap', soundEnabled);
                      setGuidebookUnit(unit);
                    }}
                    className="btn-3d inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white font-extrabold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border-2 border-b-4 border-white/30 whitespace-nowrap"
                  >
                    <BookOpen className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">ഗൈഡ്</span>
                  </button>
                </div>
              </div>
              {!unitUnlocked && (
                <div className="mt-3 sm:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      playTone('tap', soundEnabled);
                      onStartUnitJump(uIdx);
                    }}
                    className="btn-3d inline-flex items-center gap-2 bg-white text-slate-900 font-extrabold text-xs px-3.5 py-2 rounded-xl border-b-4 border-slate-200 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <Rocket className="w-4 h-4 text-[#0284C7]" aria-hidden="true" />
                    <span>Jump Here?</span>
                  </button>
                </div>
              )}
            </div>

            {/* 8-Node Winding S-Curve Path */}
            <div className="relative max-w-[440px] mx-auto flex flex-col items-center space-y-6 py-4">
              {unit.lessons.map((lesson, nIdx) => {
                const isCompleted = completedLessons.includes(lesson.id);
                const isLegendary = legendaryLessons.includes(lesson.id);
                const isUnlocked = isLessonUnlocked(lesson.id, completedLessons, UNITS);
                const isCurrent = isUnlocked && !isCompleted;
                const isChest = lesson.nodeType === 'chest';
                const isTrophy = lesson.nodeType === 'trophy';
                const isStory = lesson.nodeType === 'story';
                const isPopoverOpen = activePopoverId === lesson.id;
                const offsetClass = S_CURVE_OFFSETS[nIdx % S_CURVE_OFFSETS.length];

                return (
                  <div
                    key={lesson.id}
                    className={`relative flex flex-col items-center ${offsetClass} ${isPopoverOpen ? 'z-30' : 'z-10'}`}
                  >
                    {isCurrent && (
                      <div
                        aria-hidden="true"
                        className={`animate-bounce-slow mb-2 bg-white font-extrabold text-xs px-3.5 py-1 rounded-xl border-2 border-slate-200 shadow-sm tracking-wide ${
                          isChest ? 'text-amber-600' : isStory ? 'text-violet-700' : 'text-[#357A00]'
                        }`}
                      >
                        {isChest ? 'തുറക്കുക!' : isStory ? '📖 കഥ വായിക്കാം' : 'തുടങ്ങുക'}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={!isUnlocked}
                      aria-label={`${lesson.title} — ${
                        isLegendary
                          ? 'ലെജൻഡറി പൂർത്തിയായി'
                          : isCompleted
                            ? 'പൂർത്തിയായി'
                            : isCurrent
                              ? isChest
                                ? 'നിധിപ്പെട്ടി തുറക്കുക'
                                : 'ഇപ്പോൾ തുടങ്ങുക'
                              : 'ലോക്ക് ചെയ്തിരിക്കുന്നു'
                      }`}
                      onClick={() => {
                        if (!isUnlocked) return;
                        playTone('tap', soundEnabled);
                        if (isChest && onClaimChest) {
                          setActivePopoverId(null);
                          onClaimChest(lesson);
                        } else if (isCompleted) {
                          setActivePopoverId((prev) => (prev === lesson.id ? null : lesson.id));
                        } else {
                          setActivePopoverId(null);
                          onStartLesson(lesson);
                        }
                      }}
                      className={`btn-3d ${
                        isChest ? 'w-20 h-[76px] rounded-2xl' : 'w-20 h-20 rounded-full'
                      } flex items-center justify-center text-3xl font-bold border-b-[7px] relative transition ${
                        isChest
                          ? isCompleted
                            ? 'bg-amber-100 border-amber-400 text-amber-700'
                            : isUnlocked
                              ? 'bg-amber-400 border-amber-600 text-white ring-8 ring-amber-200/80'
                              : 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed'
                          : isLegendary
                            ? 'bg-gradient-to-b from-purple-500 via-violet-600 to-indigo-700 border-purple-900 text-amber-300 ring-4 ring-amber-300/85 shadow-lg shadow-purple-400/50'
                            : isCompleted
                              ? 'bg-amber-400 border-amber-600 text-white hover:bg-amber-400/95'
                              : isCurrent
                                ? `${unit.theme.bg} ${unit.theme.border} text-white ring-8 ${unit.theme.ring}`
                                : 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {isChest ? (
                        <span aria-hidden="true">{isCompleted ? '✨' : '🎁'}</span>
                      ) : isLegendary ? (
                        <span aria-hidden="true">👑</span>
                      ) : isCompleted ? (
                        isTrophy ? (
                          <span aria-hidden="true">🏆</span>
                        ) : isStory ? (
                          <span aria-hidden="true">📖</span>
                        ) : (
                          <Star className="w-9 h-9 fill-white text-white" aria-hidden="true" />
                        )
                      ) : isUnlocked ? (
                        <span aria-hidden="true">{lesson.icon}</span>
                      ) : (
                        <Lock className="w-7 h-7 text-slate-400" aria-hidden="true" />
                      )}

                      {isCompleted && (
                        <span
                          aria-hidden="true"
                          className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white ${
                            isLegendary ? 'bg-amber-400 text-purple-900 text-xs font-extrabold' : 'bg-[#4AA802]'
                          }`}
                        >
                          {isLegendary ? '★' : <Check className="w-4 h-4 stroke-[3]" />}
                        </span>
                      )}
                    </button>

                    <span
                      className={`mt-2 text-xs sm:text-sm font-bold text-center max-w-[175px] leading-snug ${
                        isLegendary
                          ? 'text-purple-800'
                          : isUnlocked
                            ? 'text-slate-800'
                            : 'text-slate-400'
                      }`}
                    >
                      {lesson.title}
                    </span>

                    {/* Completed Node Popover: REVIEW (+5 XP) & LEGENDARY (+40 XP) */}
                    {isPopoverOpen && isCompleted && !isChest && (
                      <div
                        role="dialog"
                        aria-label={`${lesson.title} ഓപ്ഷനുകൾ`}
                        className="mt-3 w-72 bg-white rounded-2xl border-2 border-b-4 border-slate-200 shadow-xl p-4 space-y-2.5 animate-pop relative"
                      >
                        <div
                          aria-hidden="true"
                          className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-l-2 border-t-2 border-slate-200 rotate-45"
                        />
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                              {isLegendary ? '👑 ലെജൻഡറി മാസ്റ്ററി' : '✓ പൂർത്തിയായ ഘട്ടം'}
                            </div>
                            <h4 className="text-sm font-extrabold text-slate-900 leading-snug mt-0.5">
                              {lesson.title}
                            </h4>
                          </div>
                          <button
                            type="button"
                            aria-label="പോപ്പ്ഓവർ അടയ്ക്കുക"
                            onClick={() => setActivePopoverId(null)}
                            className="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            playTone('tap', soundEnabled);
                            setActivePopoverId(null);
                            if (onStartReview) onStartReview(lesson);
                            else onStartLesson(lesson);
                          }}
                          className="btn-3d w-full py-2.5 px-4 rounded-xl bg-[#0284C7] border-b-4 border-[#0369A1] text-white font-extrabold text-xs sm:text-sm flex items-center justify-between gap-2"
                        >
                          <span className="whitespace-nowrap">REVIEW +5 XP</span>
                          <span className="text-[11px] font-bold opacity-90 whitespace-nowrap shrink-0">5 ചോദ്യങ്ങൾ</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            playTone('tap', soundEnabled);
                            setActivePopoverId(null);
                            if (onStartLegendary) onStartLegendary(lesson);
                            else onStartLesson(lesson);
                          }}
                          className="btn-3d w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-amber-500 border-b-4 border-purple-900 text-white font-extrabold text-xs sm:text-sm flex items-center justify-between gap-2"
                        >
                          <span className="whitespace-nowrap">👑 LEGENDARY +40 XP</span>
                          <span className="text-[11px] font-bold opacity-95 whitespace-nowrap shrink-0">3 ❤️ · സൂചനകളില്ല</span>
                        </button>

                        {isStory && lesson.story && (
                          <button
                            type="button"
                            onClick={() => {
                              playTone('tap', soundEnabled);
                              setActivePopoverId(null);
                              onStartLesson(lesson);
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs"
                          >
                            📖 കഥ വീണ്ടും വായിക്കാം
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Unit Guidebook Modal */}
      {guidebookUnit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guidebook-title"
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-pop">
            <div className={`${guidebookUnit.theme.bg} text-white p-5 flex items-start justify-between gap-3`}>
              <div>
                <div className="text-xs font-bold text-white/90">
                  യൂണിറ്റ് {guidebookUnit.number} ഗൈഡ്‌ബുക്ക്
                </div>
                <h3 id="guidebook-title" className="text-lg font-extrabold mt-0.5">
                  {guidebookUnit.title}
                </h3>
              </div>
              <button
                type="button"
                aria-label="ഗൈഡ്‌ബുക്ക് അടയ്ക്കുക"
                onClick={() => setGuidebookUnit(null)}
                className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {guidebookUnit.guidebookTip && (
                <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                  {guidebookUnit.guidebookTip}
                </div>
              )}

              <div className="space-y-2.5">
                {(guidebookUnit.guidebook ?? []).map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 bg-white"
                  >
                    <button
                      type="button"
                      aria-label={`${entry.tr} കേൾക്കുക`}
                      onClick={() => speakArabic(entry.ar.split(' / ')[0], soundEnabled, 1.0)}
                      className="btn-3d w-10 h-10 rounded-xl bg-[#1CB0F6] border-b-4 border-[#1899D6] text-white flex items-center justify-center shrink-0"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <div className="flex-1 min-w-0 text-right">
                      <div className="font-arabic text-2xl font-bold text-slate-900">{entry.ar}</div>
                      <div dir="ltr" className="text-xs font-bold text-[#0369A1]">
                        {entry.tr}
                      </div>
                      <div dir="ltr" className="text-xs font-bold text-slate-700 mt-0.5">
                        {entry.ml}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
