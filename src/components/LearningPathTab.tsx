import React from 'react';
import { BookOpen, Check, Lock, Rocket, Star } from 'lucide-react';
import { UNITS } from '../data/curriculum';
import type { Lesson } from '../types/learning';
import { getAllLessonIds, isLessonUnlocked, isUnitUnlocked } from '../utils/learningEngine';
import { playTone } from '../utils/audio';

interface LearningPathTabProps {
  completedLessons: string[];
  soundEnabled: boolean;
  onStartLesson: (lesson: Lesson) => void;
  onStartUnitJump: (unitIndex: number) => void;
}

const NODE_OFFSETS = [
  'translate-x-0',
  '-translate-x-10 sm:-translate-x-14',
  'translate-x-0',
  'translate-x-10 sm:translate-x-14',
];

export const LearningPathTab: React.FC<LearningPathTabProps> = ({
  completedLessons,
  soundEnabled,
  onStartLesson,
  onStartUnitJump,
}) => {
  const allIds = getAllLessonIds(UNITS);

  return (
    <div className="space-y-10 pb-8">
      {UNITS.map((unit, uIdx) => {
        const unitUnlocked = isUnitUnlocked(uIdx, completedLessons, UNITS);
        const unitCompletedCount = unit.lessons.filter((l) =>
          completedLessons.includes(l.id)
        ).length;

        return (
          <section key={unit.id} aria-labelledby={`unit-heading-${unit.id}`} className="space-y-6">
            {/* Unit Banner */}
            <div
              className={`rounded-2xl p-5 text-white border-b-4 transition-colors ${unit.theme.bg} ${unit.theme.border}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white/85">
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

                {!unitUnlocked ? (
                  <button
                    type="button"
                    onClick={() => {
                      playTone('tap', soundEnabled);
                      onStartUnitJump(uIdx);
                    }}
                    className="btn-3d self-start sm:self-center shrink-0 inline-flex items-center gap-2 bg-white text-slate-900 font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-xl border-b-4 border-slate-200 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <Rocket className="w-4 h-4 text-[#0284C7]" aria-hidden="true" />
                    <span>Jump Here?</span>
                  </button>
                ) : (
                  <div className="hidden sm:flex w-11 h-11 rounded-xl bg-white/15 items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-white" aria-hidden="true" />
                  </div>
                )}
              </div>
            </div>

            {/* Winding Lesson Path */}
            <div className="flex flex-col items-center space-y-7 py-2">
              {unit.lessons.map((lesson) => {
                const globalIdx = allIds.indexOf(lesson.id);
                const isCompleted = completedLessons.includes(lesson.id);
                const isUnlocked = isLessonUnlocked(lesson.id, completedLessons, UNITS);
                const isCurrent = isUnlocked && !isCompleted;
                const offsetClass = NODE_OFFSETS[globalIdx % NODE_OFFSETS.length];

                return (
                  <div
                    key={lesson.id}
                    className={`relative flex flex-col items-center ${offsetClass}`}
                  >
                    {isCurrent && (
                      <div
                        aria-hidden="true"
                        className="animate-bounce-slow mb-2.5 bg-white text-[#357A00] font-extrabold text-xs px-3.5 py-1.5 rounded-xl border-2 border-slate-200 shadow-sm tracking-wide"
                      >
                        തുടങ്ങുക
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={!isUnlocked}
                      aria-label={`${lesson.title} — ${
                        isCompleted
                          ? 'പൂർത്തിയായി, വീണ്ടും പരിശീലിക്കാം'
                          : isCurrent
                            ? 'ഇപ്പോൾ തുടങ്ങുക'
                            : 'ലോക്ക് ചെയ്തിരിക്കുന്നു'
                      }`}
                      onClick={() => {
                        if (!isUnlocked) return;
                        playTone('tap', soundEnabled);
                        onStartLesson(lesson);
                      }}
                      className={`btn-3d w-20 h-20 sm:w-22 sm:h-22 rounded-full flex items-center justify-center text-3xl font-bold border-b-[7px] relative transition ${
                        isCompleted
                          ? 'bg-amber-400 border-amber-600 text-white hover:bg-amber-400/95'
                          : isCurrent
                            ? `${unit.theme.bg} ${unit.theme.border} text-white ring-8 ${unit.theme.ring}`
                            : 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {isCompleted ? (
                        <Star className="w-9 h-9 fill-white text-white" aria-hidden="true" />
                      ) : isUnlocked ? (
                        <span className="font-arabic leading-none inline-flex items-center justify-center pt-1.5">
                          {lesson.icon}
                        </span>
                      ) : (
                        <Lock className="w-7 h-7 text-slate-400" aria-hidden="true" />
                      )}

                      {isCompleted && (
                        <span
                          aria-hidden="true"
                          className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#4AA802] border-2 border-white flex items-center justify-center text-white"
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                        </span>
                      )}
                    </button>

                    <span
                      className={`mt-2.5 text-xs sm:text-sm font-bold text-center max-w-[180px] leading-snug ${
                        isUnlocked ? 'text-slate-800' : 'text-slate-400'
                      }`}
                    >
                      {lesson.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};
