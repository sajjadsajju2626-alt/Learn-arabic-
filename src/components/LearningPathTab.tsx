import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, Check, Lock, Rocket, Star, Volume2, X } from 'lucide-react';
import { UNITS } from '../data/curriculum';
import type { Lesson, Unit } from '../types/learning';
import {
  computeJumpButtonDirection,
  computeVisibleUnitIndex,
  getActiveNodeTargetId,
  isLessonUnlocked,
  isUnitUnlocked,
  type JumpButtonDirection,
} from '../utils/learningEngine';
import { playTone, speakArabic } from '../utils/audio';

interface LearningPathTabProps {
  completedLessons: string[];
  legendaryLessons?: string[];
  soundEnabled: boolean;
  focusTrigger?: number;
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
  focusTrigger = 0,
  onStartLesson,
  onStartReview,
  onStartLegendary,
  onClaimChest,
  onStartUnitJump,
}) => {
  const [guidebookUnit, setGuidebookUnit] = useState<Unit | null>(null);
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);

  const activeNodeId = useMemo(
    () => getActiveNodeTargetId(completedLessons, UNITS),
    [completedLessons]
  );

  const activeUnitIndex = useMemo(() => {
    if (!activeNodeId) return 0;
    const idx = UNITS.findIndex((u) => u.lessons.some((l) => l.id === activeNodeId));
    return idx >= 0 ? idx : 0;
  }, [activeNodeId]);

  const [visibleUnitIndex, setVisibleUnitIndex] = useState<number>(activeUnitIndex);
  const [jumpDirection, setJumpDirection] = useState<JumpButtonDirection>(null);

  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const activeNodeRef = useRef<HTMLDivElement | null>(null);
  const lastScrolledTargetRef = useRef<string | null>(null);

  const scrollToActiveNode = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const target = activeNodeRef.current;
    if (!target) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({
      behavior: prefersReduced ? 'auto' : behavior,
      block: 'center',
      inline: 'nearest',
    });
  }, []);

  const syncScrollIndicators = useCallback(() => {
    if (typeof window === 'undefined') return;
    const isDesktop = window.innerWidth >= 1024;
    const stickyAnchorY = isDesktop ? 136 : 168;

    const rects = sectionRefs.current
      .map((el, idx) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { unitIndex: idx, top: r.top, bottom: r.bottom };
      })
      .filter((r): r is { unitIndex: number; top: number; bottom: number } => r !== null);

    if (rects.length > 0) {
      const nextVisible = computeVisibleUnitIndex(rects, stickyAnchorY);
      setVisibleUnitIndex((prev) => (prev === nextVisible ? prev : nextVisible));
    }

    const activeEl = activeNodeRef.current;
    if (activeEl) {
      const ar = activeEl.getBoundingClientRect();
      const topOffset = isDesktop ? 104 : 132;
      const bottomOffset = isDesktop ? 44 : 96;
      const dir = computeJumpButtonDirection(
        { top: ar.top, bottom: ar.bottom },
        window.innerHeight,
        topOffset,
        bottomOffset
      );
      setJumpDirection((prev) => (prev === dir ? prev : dir));
    } else {
      setJumpDirection(null);
    }
  }, []);

  // Auto-scroll to active node on initial mount, when active node advances, or when Path tab is re-focused
  useEffect(() => {
    const triggerKey = `${activeNodeId ?? ''}:${focusTrigger}`;
    if (lastScrolledTargetRef.current === triggerKey) return;
    lastScrolledTargetRef.current = triggerKey;

    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        scrollToActiveNode('smooth');
        syncScrollIndicators();
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [activeNodeId, focusTrigger, scrollToActiveNode, syncScrollIndicators]);

  // Keep sticky Unit Banner and floating Jump button synchronized on scroll & resize
  useEffect(() => {
    let ticking = false;
    const handleScrollOrResize = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        syncScrollIndicators();
        ticking = false;
      });
    };

    syncScrollIndicators();
    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [syncScrollIndicators]);

  const stickyUnit = UNITS[visibleUnitIndex] ?? UNITS[0];
  const stickyUnitUnlocked = isUnitUnlocked(visibleUnitIndex, completedLessons, UNITS);
  const stickyUnitCompletedCount = stickyUnit.lessons.filter((l) =>
    completedLessons.includes(l.id)
  ).length;

  return (
    <div className="space-y-8 pb-12 relative">
      {/* Synchronized Sticky Unit Banner */}
      <div
        data-testid="sticky-unit-banner"
        data-unit-number={stickyUnit.number}
        className={`sticky top-14 lg:top-4 z-20 rounded-2xl px-4 py-3 sm:px-5 sm:py-4 text-white border-b-4 shadow-md transition-colors duration-200 ${stickyUnit.theme.bg} ${stickyUnit.theme.border}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] sm:text-xs font-bold text-white/90 font-latin tabular-nums">
              യൂണിറ്റ് {stickyUnit.number} · {stickyUnitCompletedCount}/{stickyUnit.lessons.length} പൂർത്തിയായി
            </div>
            <h2 className="font-extrabold text-base sm:text-xl leading-snug mt-0.5 truncate">
              {stickyUnit.title}
            </h2>
            <p className="hidden sm:block text-xs sm:text-sm text-white/90 mt-0.5 truncate">
              {stickyUnit.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!stickyUnitUnlocked && (
              <button
                type="button"
                data-testid="sticky-jump-unit-btn"
                onClick={() => {
                  playTone('tap', soundEnabled);
                  onStartUnitJump(visibleUnitIndex);
                }}
                className="btn-3d inline-flex items-center gap-1.5 bg-white text-slate-900 font-extrabold text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border-b-4 border-slate-200 hover:bg-slate-50 whitespace-nowrap"
              >
                <Rocket className="w-4 h-4 text-[#0284C7]" aria-hidden="true" />
                <span>Jump Here?</span>
              </button>
            )}
            <button
              type="button"
              data-testid="sticky-guidebook-btn"
              aria-label={`യൂണിറ്റ് ${stickyUnit.number} ഗൈഡ്‌ബുക്ക് തുറക്കുക`}
              onClick={() => {
                playTone('tap', soundEnabled);
                setGuidebookUnit(stickyUnit);
              }}
              className="btn-3d inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white font-extrabold text-xs sm:text-sm px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border-2 border-b-4 border-white/30 whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">ഗൈഡ്</span>
            </button>
          </div>
        </div>
      </div>

      {UNITS.map((unit, uIdx) => {
        const unitUnlocked = isUnitUnlocked(uIdx, completedLessons, UNITS);
        const unitCompletedCount = unit.lessons.filter((l) =>
          completedLessons.includes(l.id)
        ).length;

        return (
          <section
            key={unit.id}
            ref={(el) => {
              sectionRefs.current[uIdx] = el;
            }}
            data-unit-index={uIdx}
            aria-labelledby={`unit-heading-${unit.id}`}
            className="space-y-4 scroll-mt-32"
          >
            {/* Clean Unit Chapter Divider for Units 2–35 (Unit 1 leads directly under Sticky Banner) */}
            {uIdx === 0 ? (
              <h2 id={`unit-heading-${unit.id}`} className="sr-only">
                {unit.title}
              </h2>
            ) : (
              <div className="pt-2">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                  <div className="text-center max-w-[78%]">
                    <div className="text-[11px] font-extrabold text-slate-400 font-latin tabular-nums">
                      യൂണിറ്റ് {unit.number} · {unitCompletedCount}/{unit.lessons.length}
                    </div>
                    <h2
                      id={`unit-heading-${unit.id}`}
                      className="text-xs sm:text-sm font-extrabold text-slate-700 leading-snug"
                    >
                      {unit.title}
                    </h2>
                  </div>
                  <div className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                </div>
                {!unitUnlocked && (
                  <div className="mt-2.5 flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        playTone('tap', soundEnabled);
                        onStartUnitJump(uIdx);
                      }}
                      className="btn-3d inline-flex items-center gap-1.5 bg-white text-slate-800 font-extrabold text-xs px-3.5 py-2 rounded-xl border-2 border-b-4 border-slate-200 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Rocket className="w-3.5 h-3.5 text-[#0284C7]" aria-hidden="true" />
                      <span>Jump Here?</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 8-Node Winding S-Curve Path */}
            <div className="relative max-w-[440px] mx-auto flex flex-col items-center space-y-6 py-4">
              {unit.lessons.map((lesson, nIdx) => {
                const isCompleted = completedLessons.includes(lesson.id);
                const isLegendary = legendaryLessons.includes(lesson.id);
                const isUnlocked = isLessonUnlocked(lesson.id, completedLessons, UNITS);
                const isCurrent = isUnlocked && !isCompleted;
                const isScrollTarget = lesson.id === activeNodeId;
                const isChest = lesson.nodeType === 'chest';
                const isTrophy = lesson.nodeType === 'trophy';
                const isStory = lesson.nodeType === 'story';
                const isPopoverOpen = activePopoverId === lesson.id;
                const offsetClass = S_CURVE_OFFSETS[nIdx % S_CURVE_OFFSETS.length];

                return (
                  <div
                    key={lesson.id}
                    ref={isScrollTarget ? activeNodeRef : undefined}
                    data-node-id={lesson.id}
                    data-active-node={isScrollTarget ? 'true' : undefined}
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

      {/* Floating "Jump to Current Lesson" Pill Button */}
      {!guidebookUnit && (
        <div
          className={`fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 lg:left-[calc(50%+144px)] xl:left-[calc(50%-48px)] z-30 transition-[opacity,transform] duration-200 ${
            jumpDirection
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-3 pointer-events-none'
          }`}
          aria-hidden={!jumpDirection}
        >
          <button
            type="button"
            data-testid="jump-to-current-btn"
            data-direction={jumpDirection ?? ''}
            tabIndex={jumpDirection ? 0 : -1}
            aria-label="ഇപ്പോഴത്തെ പാഠത്തിലേക്ക് പോകുക"
            onClick={() => {
              playTone('tap', soundEnabled);
              scrollToActiveNode('smooth');
            }}
            className="btn-3d h-11 px-4 rounded-full bg-slate-900/95 hover:bg-slate-800 text-white border border-slate-700 border-b-4 border-b-slate-950 shadow-xl flex items-center gap-2 font-extrabold text-xs sm:text-sm whitespace-nowrap"
          >
            <span
              className="w-6 h-6 rounded-full bg-[#58CC02] text-white flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              {jumpDirection === 'up' ? (
                <ArrowUp className="w-3.5 h-3.5 stroke-[3]" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 stroke-[3]" />
              )}
            </span>
            <span>🎯 ഇപ്പോഴത്തെ പാഠം</span>
            <span className="text-slate-400" aria-hidden="true">·</span>
            <span className="text-[#86EFAC]">തുടരുക</span>
          </button>
        </div>
      )}

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
