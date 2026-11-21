import { COMMUNITY_LEARNERS, UNITS } from '../data/curriculum';
import type {
  ArabicLetter,
  LeaderboardEntry,
  Lesson,
  LessonQuestion,
  SessionResult,
  Unit,
  UserState,
  VowelMode,
} from '../types/learning';

export const MAX_HEARTS = 5;
export const LESSON_XP_REWARD = 15;
export const TREASURE_CHEST_XP = 25;
export const TREASURE_CHEST_HEARTS = 1;

export function getAllLessonIds(units: Unit[] = UNITS): string[] {
  return units.flatMap((u) => u.lessons.map((l) => l.id));
}

export function migrateLegacyCompletedIds(
  completedIds: string[],
  units: Unit[] = UNITS
): string[] {
  const validIds = new Set(getAllLessonIds(units));
  const out = new Set<string>();
  for (const id of completedIds) {
    if (validIds.has(id)) {
      out.add(id);
      continue;
    }
    const legacyMatch = /^u(\d+)_l(\d+)$/.exec(id);
    if (legacyMatch) {
      const mapped = `u${legacyMatch[1]}_n${legacyMatch[2]}`;
      if (validIds.has(mapped)) out.add(mapped);
    }
  }
  return Array.from(out);
}

export function claimTreasureChest(
  user: UserState,
  chestNodeId: string,
  xpReward: number = TREASURE_CHEST_XP,
  heartReward: number = TREASURE_CHEST_HEARTS
): { user: UserState; alreadyClaimed: boolean; earnedXp: number; earnedHearts: number } {
  if (user.completedLessons.includes(chestNodeId)) {
    return {
      user,
      alreadyClaimed: true,
      earnedXp: 0,
      earnedHearts: 0,
    };
  }
  return {
    user: {
      ...user,
      xp: user.xp + xpReward,
      hearts: user.hearts + heartReward,
      completedLessons: [...user.completedLessons, chestNodeId],
    },
    alreadyClaimed: false,
    earnedXp: xpReward,
    earnedHearts: heartReward,
  };
}

export function isLessonUnlocked(
  lessonId: string,
  completedLessons: string[],
  units: Unit[] = UNITS
): boolean {
  const allIds = getAllLessonIds(units);
  const idx = allIds.indexOf(lessonId);
  if (idx === -1) return false;
  if (idx === 0) return true;
  if (completedLessons.includes(lessonId)) return true;
  return completedLessons.includes(allIds[idx - 1]);
}

export function isUnitUnlocked(
  unitIndex: number,
  completedLessons: string[],
  units: Unit[] = UNITS
): boolean {
  const unit = units[unitIndex];
  if (!unit || unit.lessons.length === 0) return false;
  return isLessonUnlocked(unit.lessons[0].id, completedLessons, units);
}

export function getNextActiveLesson(
  completedLessons: string[],
  units: Unit[] = UNITS
): { unit: Unit; lesson: Lesson } | null {
  for (const unit of units) {
    for (const lesson of unit.lessons) {
      if (!completedLessons.includes(lesson.id)) {
        return { unit, lesson };
      }
    }
  }
  return null;
}

export function getLessonIdsUpToUnit(
  targetUnitIndex: number,
  units: Unit[] = UNITS
): string[] {
  const ids: string[] = [];
  for (let i = 0; i < Math.min(targetUnitIndex, units.length); i++) {
    for (const lesson of units[i].lessons) {
      ids.push(lesson.id);
    }
  }
  return ids;
}

export function unlockLessonsUpToUnit(
  completedLessons: string[],
  targetUnitIndex: number,
  units: Unit[] = UNITS
): string[] {
  const next = new Set(completedLessons);
  for (const id of getLessonIdsUpToUnit(targetUnitIndex, units)) {
    next.add(id);
  }
  return Array.from(next);
}

export function getLetterDisplay(
  letter: ArabicLetter,
  vowel: VowelMode
): { arabic: string; translit: string } {
  switch (vowel) {
    case 'fatha':
      return { arabic: letter.fatha, translit: letter.fathaTr };
    case 'kasra':
      return { arabic: letter.kasra, translit: letter.kasraTr };
    case 'damma':
      return { arabic: letter.damma, translit: letter.dammaTr };
    case 'tanween':
      return { arabic: letter.tanween, translit: letter.tanweenTr };
    default:
      return { arabic: letter.base, translit: letter.name };
  }
}

export function evaluateQuestionAnswer(
  question: LessonQuestion,
  selectedOption: string | null,
  wordBankWords: string[]
): { correct: boolean; expectedDisplay: string } {
  if (question.type === 'mcq' || question.type === 'listen') {
    return {
      correct: selectedOption === question.answer,
      expectedDisplay: question.answer,
    };
  }
  if (question.type === 'wordbank') {
    const isExactMatch =
      wordBankWords.length === question.answer.length &&
      wordBankWords.every((w, i) => w === question.answer[i]);
    return {
      correct: isExactMatch,
      expectedDisplay: question.answer.join(' '),
    };
  }
  return { correct: true, expectedDisplay: '' };
}

export function evaluateSessionOutcome(params: {
  mode: 'lesson' | 'placement' | 'jump';
  lessonId: string | null;
  targetUnitIndex: number | null;
  score: number;
  totalQuestions: number;
}): SessionResult {
  const { mode, lessonId, targetUnitIndex, score, totalQuestions } = params;

  if (mode === 'placement') {
    if (score >= 7) {
      return {
        mode,
        lessonId: null,
        targetUnitIndex: null,
        score,
        totalQuestions,
        earnedXp: 120,
        unlockedUpToUnitIndex: 4,
        title: 'ഗംഭീരം! യൂണിറ്റ് 5 അൺലോക്ക് ആയി!',
        subtitle: `8-ൽ ${score} ശരിയുത്തരം! നിങ്ങൾ നേരിട്ട് യൂണിറ്റ് 5-ലേക്ക് കടന്നിരിക്കുന്നു.`,
        emoji: '🏆',
      };
    }
    if (score >= 4) {
      return {
        mode,
        lessonId: null,
        targetUnitIndex: null,
        score,
        totalQuestions,
        earnedXp: 50,
        unlockedUpToUnitIndex: 2,
        title: 'മികച്ചത്! യൂണിറ്റ് 3 അൺലോക്ക് ആയി!',
        subtitle: `8-ൽ ${score} ശരിയുത്തരം! ആദ്യ രണ്ട് യൂണിറ്റുകൾ പൂർത്തിയായതായി രേഖപ്പെടുത്തി.`,
        emoji: '🚀',
      };
    }
    return {
      mode,
      lessonId: null,
      targetUnitIndex: null,
      score,
      totalQuestions,
      earnedXp: 10,
      unlockedUpToUnitIndex: null,
      title: 'നമുക്ക് ആദ്യം മുതൽ തുടങ്ങാം!',
      subtitle: `8-ൽ ${score} ശരിയുത്തരം. യൂണിറ്റ് 1 മുതൽ അടിസ്ഥാന കാര്യങ്ങൾ എളുപ്പത്തിൽ പഠിക്കാം.`,
      emoji: '🌱',
    };
  }

  if (mode === 'jump' && targetUnitIndex !== null) {
    if (score >= 4) {
      return {
        mode,
        lessonId: null,
        targetUnitIndex,
        score,
        totalQuestions,
        earnedXp: 40,
        unlockedUpToUnitIndex: targetUnitIndex,
        title: `യൂണിറ്റ് ${targetUnitIndex + 1} അൺലോക്ക് ആയി!`,
        subtitle: 'പ്രവേശന പരീക്ഷ നിങ്ങൾ വിജയിച്ചിരിക്കുന്നു!',
        emoji: '🚀',
      };
    }
    return {
      mode,
      lessonId: null,
      targetUnitIndex,
      score,
      totalQuestions,
      earnedXp: 5,
      unlockedUpToUnitIndex: null,
      title: 'കുറച്ചുകൂടി പരിശീലിക്കാം!',
      subtitle: 'ഈ യൂണിറ്റിലേക്ക് കടക്കാൻ 5-ൽ 4 ശരിയുത്തരം ആവശ്യമാണ്.',
      emoji: '💪',
    };
  }

  return {
    mode: 'lesson',
    lessonId,
    targetUnitIndex: null,
    score,
    totalQuestions,
    earnedXp: LESSON_XP_REWARD,
    unlockedUpToUnitIndex: null,
    title: 'പാഠം പൂർത്തിയായി!',
    subtitle: 'മികച്ച പ്രകടനം! അടുത്ത പാഠം അൺലോക്ക് ആയിരിക്കുന്നു.',
    emoji: '🎉',
  };
}

export function applySessionResult(
  user: UserState,
  result: SessionResult,
  units: Unit[] = UNITS
): UserState {
  let completedLessons = [...user.completedLessons];

  if (result.mode === 'lesson' && result.lessonId) {
    if (!completedLessons.includes(result.lessonId)) {
      completedLessons.push(result.lessonId);
    }
  } else if (result.unlockedUpToUnitIndex !== null) {
    completedLessons = unlockLessonsUpToUnit(
      completedLessons,
      result.unlockedUpToUnitIndex,
      units
    );
  }

  return {
    ...user,
    xp: user.xp + result.earnedXp,
    completedLessons,
  };
}

export function computeStreakUpdate(
  state: Pick<UserState, 'streak' | 'hearts' | 'lastActiveDate'>,
  now: Date = new Date()
): { streak: number; hearts: number; lastActiveDate: string; changed: boolean } {
  const today = now.toDateString();
  if (state.lastActiveDate === today) {
    return {
      streak: state.streak,
      hearts: state.hearts,
      lastActiveDate: state.lastActiveDate,
      changed: false,
    };
  }

  const yesterday = new Date(now.getTime() - 86_400_000).toDateString();
  const nextStreak = state.lastActiveDate === yesterday ? state.streak + 1 : 1;

  return {
    streak: nextStreak,
    hearts: MAX_HEARTS,
    lastActiveDate: today,
    changed: true,
  };
}

export function fisherYatesShuffle<T>(
  items: readonly T[],
  rng: () => number = Math.random
): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Determines whether the Arabic prompt card (word + audio + transliteration)
 * should be displayed above the options.
 *
 * - Always shown for `listen` questions.
 * - For `mcq`, shown ONLY when translating FROM Arabic TO Malayalam (or when
 *   the prompt's Arabic text is not the target answer itself). Never shown when
 *   the question asks the user to pick the matching Arabic word from Malayalam.
 * - For `wordbank`, shown ONLY when translating FROM Arabic TO Malayalam
 *   (`!isArabicWords`), never when building an Arabic sentence from Malayalam.
 */
export function shouldShowArabicPromptCard(question: LessonQuestion): boolean {
  if (!('arabic' in question) || !question.arabic) {
    return false;
  }
  if (question.type === 'listen') {
    return true;
  }
  if (question.type === 'wordbank') {
    return !question.isArabicWords;
  }
  if (question.type === 'mcq') {
    if (question.isArabicOption) {
      // Allow Arabic prompt card only when it is a source word (e.g. opposite color)
      // and NOT the correct answer or one of the Arabic options.
      const normalizedArabic = question.arabic.trim();
      if (
        question.answer.trim() === normalizedArabic ||
        question.options.some((opt) => opt.trim() === normalizedArabic)
      ) {
        return false;
      }
    }
    return true;
  }
  return false;
}

export function shuffleArray<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function prepareSessionQuestions(
  rawQuestions: readonly LessonQuestion[],
  rng: () => number = Math.random
): LessonQuestion[] {
  return rawQuestions.map((q) => {
    if ((q.type === 'mcq' || q.type === 'listen') && Array.isArray(q.options)) {
      return {
        ...q,
        options: shuffleArray(q.options, rng),
      };
    }
    return { ...q };
  });
}

export function buildUnitJumpQuestions(
  targetUnitIndex: number,
  units: Unit[] = UNITS,
  count = 5
): LessonQuestion[] {
  const pool: LessonQuestion[] = [];
  for (let i = 0; i < Math.min(targetUnitIndex, units.length); i++) {
    for (const lesson of units[i].lessons) {
      if (lesson.nodeType === 'chest' || lesson.questions.length === 0) continue;
      for (const q of lesson.questions) {
        if (q.type !== 'pairs') {
          pool.push(q);
        }
      }
    }
  }
  return prepareSessionQuestions(shuffleArray(pool).slice(0, count));
}

export function deterministicShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed || 1;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function mergeAndSortLeaderboard(
  user: UserState,
  community: LeaderboardEntry[] = COMMUNITY_LEARNERS
): LeaderboardEntry[] {
  const currentEntry: LeaderboardEntry = {
    id: user.id,
    name: user.name || 'നിങ്ങൾ',
    avatar: user.avatar,
    xp: user.xp,
    streak: user.streak,
    lessonsCount: user.completedLessons.length,
    isCurrentUser: true,
  };

  const merged = [
    ...community.filter((c) => c.id !== user.id).map((c) => ({ ...c, isCurrentUser: false })),
    currentEntry,
  ];

  merged.sort((a, b) => {
    if (b.xp !== a.xp) return b.xp - a.xp;
    if (b.streak !== a.streak) return b.streak - a.streak;
    return a.isCurrentUser ? -1 : 1;
  });

  return merged;
}
