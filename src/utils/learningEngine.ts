import { COMMUNITY_LEARNERS, UNITS } from '../data/curriculum';
import type {
  ArabicLetter,
  LeaderboardEntry,
  Lesson,
  LessonQuestion,
  SessionMode,
  SessionResult,
  SessionVariant,
  StoryCheckStep,
  StoryStep,
  Unit,
  UnitStory,
  UserState,
  VowelMode,
} from '../types/learning';

export const MAX_HEARTS = 5;
export const LESSON_XP_REWARD = 15;
export const STORY_XP_REWARD = 15;
export const REVIEW_XP_REWARD = 5;
export const LEGENDARY_XP_REWARD = 40;
export const LEGENDARY_HEARTS = 3;
export const REVIEW_QUESTION_COUNT = 5;
export const LEGENDARY_QUESTION_COUNT = 10;
export const TREASURE_CHEST_XP = 25;
export const TREASURE_CHEST_HEARTS = 1;
export const MISTAKE_REVIEW_BANNER_TEXT =
  "🔄 തെറ്റിയവ ശരിയാക്കാം! (Let's correct the ones you missed)";

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

/**
 * Normalizes Arabic & Malayalam Word Bank text for clean, diacritic-tolerant matching.
 * - Unicode NFC normalization
 * - Removes zero-width marks, Arabic Tatweel (ـ), and combining Harakat/Tashkeel
 *   so subtle Harakat ordering differences (e.g., Shadda+Fatha vs Fatha+Shadda) or
 *   optional Alif diacritics never cause false negatives.
 * - Collapses accidental extra whitespace and trims ends.
 */
export function normalizeWordBankText(text: string): string {
  return String(text ?? '')
    .normalize('NFC')
    .replace(/[\u200B-\u200F\uFEFF\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function areWordBankAnswersEqual(
  pickedWords: readonly string[],
  expectedWords: readonly string[]
): boolean {
  const pickedNormalized = normalizeWordBankText(pickedWords.join(' '));
  const expectedNormalized = normalizeWordBankText(expectedWords.join(' '));
  return Boolean(expectedNormalized) && pickedNormalized === expectedNormalized;
}

export function buildFilledSentence(sentence: string, word: string): string {
  const cleanedWord = word.trim();
  if (!cleanedWord) return sentence.trim();
  return sentence.replace(/_+/, cleanedWord).replace(/\s+/g, ' ').trim();
}

export function enqueueMistakeForReview(
  questions: readonly LessonQuestion[],
  missedQuestion: LessonQuestion,
  mode: SessionMode,
  rng: () => number = Math.random
): LessonQuestion[] {
  if (mode !== 'lesson') {
    return [...questions];
  }
  const cloned = JSON.parse(JSON.stringify(missedQuestion)) as LessonQuestion;
  cloned.isReview = true;
  if (
    (cloned.type === 'mcq' || cloned.type === 'listen' || cloned.type === 'fill_blank') &&
    Array.isArray(cloned.options)
  ) {
    cloned.options = shuffleArray(cloned.options, rng);
  }
  return [...questions, cloned];
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

  if (question.type === 'fill_blank') {
    return {
      correct: selectedOption === question.answer,
      expectedDisplay: buildFilledSentence(question.sentence, question.answer),
    };
  }
  if (question.type === 'wordbank') {
    return {
      correct: areWordBankAnswersEqual(wordBankWords, question.answer),
      expectedDisplay: question.answer.join(' '),
    };
  }
  return { correct: true, expectedDisplay: '' };
}

export function evaluateSessionOutcome(params: {
  mode: 'lesson' | 'placement' | 'jump';
  variant?: SessionVariant;
  lessonId: string | null;
  targetUnitIndex: number | null;
  score: number;
  totalQuestions: number;
  xpReward?: number;
}): SessionResult {
  const { mode, variant = 'standard', lessonId, targetUnitIndex, score, totalQuestions, xpReward } = params;

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

  if (variant === 'review') {
    return {
      mode: 'lesson',
      variant: 'review',
      lessonId,
      targetUnitIndex: null,
      score,
      totalQuestions,
      earnedXp: xpReward ?? REVIEW_XP_REWARD,
      unlockedUpToUnitIndex: null,
      title: 'പുനരവലോകനം പൂർത്തിയായി!',
      subtitle: 'വേഗത്തിലുള്ള 5 ചോദ്യ പരിശീലനം വിജയകരമായി പൂർത്തിയാക്കി.',
      emoji: '🔄',
    };
  }

  if (variant === 'legendary') {
    return {
      mode: 'lesson',
      variant: 'legendary',
      lessonId,
      targetUnitIndex: null,
      score,
      totalQuestions,
      earnedXp: xpReward ?? LEGENDARY_XP_REWARD,
      unlockedUpToUnitIndex: null,
      markLegendary: true,
      title: 'ലെജൻഡറി വിജയം! 👑',
      subtitle: 'ഉച്ചാരണ സൂചനകളില്ലാതെ 10 കഠിന ചോദ്യങ്ങൾ ജയിച്ച് ലെജൻഡറി കിരീടം നേടി!',
      emoji: '👑',
    };
  }

  if (variant === 'story') {
    return {
      mode: 'lesson',
      variant: 'story',
      lessonId,
      targetUnitIndex: null,
      score,
      totalQuestions,
      earnedXp: xpReward ?? STORY_XP_REWARD,
      unlockedUpToUnitIndex: null,
      title: 'കഥ പൂർത്തിയായി! 📖',
      subtitle: 'അറബി സംഭാഷണം കേട്ട് മനസ്സിലാക്കി അടുത്ത ഘട്ടം അൺലോക്ക് ചെയ്തു.',
      emoji: '📖',
    };
  }

  return {
    mode: 'lesson',
    variant: 'standard',
    lessonId,
    targetUnitIndex: null,
    score,
    totalQuestions,
    earnedXp: xpReward ?? LESSON_XP_REWARD,
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
  const legendaryLessons = [...(user.legendaryLessons ?? [])];

  if (result.mode === 'lesson' && result.lessonId) {
    if (!completedLessons.includes(result.lessonId)) {
      completedLessons.push(result.lessonId);
    }
    if (result.markLegendary && !legendaryLessons.includes(result.lessonId)) {
      legendaryLessons.push(result.lessonId);
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
    legendaryLessons,
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
    if (
      (q.type === 'mcq' || q.type === 'listen' || q.type === 'fill_blank') &&
      Array.isArray(q.options)
    ) {
      return {
        ...q,
        options: shuffleArray(q.options, rng),
      };
    }
    return { ...q };
  });
}

export const ALL_QUESTION_TYPES: readonly LessonQuestion['type'][] = [
  'mcq',
  'listen',
  'pairs',
  'wordbank',
  'fill_blank',
] as const;

export function resolveLessonTargetCount(lesson: Pick<Lesson, 'nodeType'>): number {
  if (lesson.nodeType === 'trophy') return 12;
  if (
    lesson.nodeType === 'hard' ||
    lesson.nodeType === 'listening' ||
    lesson.nodeType === 'dialogue' ||
    lesson.nodeType === 'story'
  ) {
    return 11;
  }
  return 10;
}

export function getQuestionFingerprint(q: LessonQuestion): string {
  const norm = (s?: string) => normalizeWordBankText(s ?? '').toLowerCase();
  if (q.type === 'mcq') {
    return `mcq|${norm(q.prompt)}|${norm(q.arabic)}|${norm(q.answer)}`;
  }
  if (q.type === 'listen') {
    return `listen|${norm(q.arabic)}|${norm(q.answer)}`;
  }
  if (q.type === 'wordbank') {
    return `wordbank|${norm(q.arabic || q.prompt)}|${norm(q.answer.join(' '))}`;
  }
  if (q.type === 'fill_blank') {
    return `fill_blank|${norm(q.sentence)}|${norm(q.answer)}`;
  }
  const pairSig = q.pairs
    .map((p) => norm(p.ar))
    .sort()
    .join(',');
  return `pairs|${pairSig}`;
}

interface VocabEntry {
  ar: string;
  tr: string;
  ml: string;
}

function collectUnitVocabPool(unit: Unit): VocabEntry[] {
  const seenAr = new Set<string>();
  const seenMl = new Set<string>();
  const clean: VocabEntry[] = [];

  const pushEntry = (ar: string, tr: string, ml: string) => {
    const cleanAr = ar.trim();
    const cleanMl = ml.trim();
    if (!cleanAr || !cleanMl) return;
    // Skip compound comparison rows (with arrows or slashes) for cleaner single-answer MCQs
    if (/[→\/]/.test(cleanAr)) return;
    const arKey = normalizeWordBankText(cleanAr);
    const mlKey = cleanMl.toLowerCase();
    if (!arKey || seenAr.has(arKey) || seenMl.has(mlKey)) return;
    seenAr.add(arKey);
    seenMl.add(mlKey);
    clean.push({ ar: cleanAr, tr: (tr || '').trim(), ml: cleanMl });
  };

  for (const g of unit.guidebook ?? []) {
    pushEntry(g.ar, g.tr, g.ml);
  }
  for (const l of unit.lessons) {
    for (const q of l.questions) {
      if (q.type === 'pairs') {
        for (const p of q.pairs) {
          pushEntry(p.ar, p.tr ?? '', p.ml);
        }
      }
    }
  }
  return clean;
}

function generateDynamicUnitQuestions(
  unit: Unit,
  rng: () => number
): LessonQuestion[] {
  const vocab = shuffleArray(collectUnitVocabPool(unit), rng);
  if (vocab.length < 4) return [];

  const generated: LessonQuestion[] = [];
  const allArabicWords = vocab
    .flatMap((v) => v.ar.split(/\s+/))
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && /[\u0600-\u06FF]/.test(w));

  // 1. Arabic -> Malayalam MCQs & Malayalam -> Arabic MCQs (zero prompt spoilage)
  for (let i = 0; i < vocab.length; i++) {
    const target = vocab[i];
    const distractors = shuffleArray(
      vocab.filter((_, idx) => idx !== i),
      rng
    ).slice(0, 3);
    if (distractors.length < 3) continue;

    // Arabic -> Malayalam MCQ
    generated.push({
      type: 'mcq',
      prompt: 'ഈ അറബി പ്രയോഗത്തിന്റെ ശരിയായ മലയാളം അർത്ഥം ഏതാണ്?',
      arabic: target.ar,
      translit: target.tr || undefined,
      options: [target.ml, ...distractors.map((d) => d.ml)],
      answer: target.ml,
    });

    // Malayalam -> Arabic MCQ (NO arabic/translit field on prompt card!)
    const optTranslits: Record<string, string> = {};
    const arChoices = [target, ...distractors];
    for (const item of arChoices) {
      if (item.tr) optTranslits[item.ar] = item.tr;
    }
    generated.push({
      type: 'mcq',
      prompt: `'${target.ml}' എന്നതിന്റെ ശരിയായ അറബി രൂപം ഏതാണ്?`,
      options: arChoices.map((c) => c.ar),
      isArabicOption: true,
      optionTranslits: Object.keys(optTranslits).length > 0 ? optTranslits : undefined,
      answer: target.ar,
    });

    // Listen & Choose
    generated.push({
      type: 'listen',
      prompt: 'ശബ്ദം കേട്ട് ശരിയായ മലയാളം അർത്ഥം തിരഞ്ഞെടുക്കുക',
      arabic: target.ar,
      translit: target.tr || undefined,
      options: [target.ml, ...distractors.map((d) => d.ml)],
      answer: target.ml,
    });

    // Dynamic Word Bank for 2-5 word Arabic phrases
    const words = target.ar.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 5) {
      const normalizedSet = new Set(words.map((w) => normalizeWordBankText(w)));
      const extraDistractor = shuffleArray(allArabicWords, rng).find(
        (w) => !normalizedSet.has(normalizeWordBankText(w))
      );
      const wbWords = extraDistractor ? [...words, extraDistractor] : [...words];
      generated.push({
        type: 'wordbank',
        prompt: `'${target.ml}' എന്ന് അറബിയിൽ ക്രമീകരിക്കുക`,
        words: wbWords,
        isArabicWords: true,
        answer: words,
      });
    }
  }

  // 2. Dynamic Matching Pairs (sets of 4 distinct unit items)
  if (vocab.length >= 4) {
    generated.push({
      type: 'pairs',
      prompt: 'ഈ യൂണിറ്റിലെ വാക്കുകളും അർത്ഥങ്ങളും യോജിപ്പിക്കുക',
      pairs: vocab.slice(0, 4).map((v) => ({
        ar: v.ar,
        tr: v.tr || undefined,
        ml: v.ml,
      })),
    });
    if (vocab.length >= 8) {
      generated.push({
        type: 'pairs',
        prompt: 'കൂടുതൽ അറബി പ്രയോഗങ്ങൾ അർത്ഥവുമായി യോജിപ്പിക്കുക',
        pairs: vocab.slice(4, 8).map((v) => ({
          ar: v.ar,
          tr: v.tr || undefined,
          ml: v.ml,
        })),
      });
    }
  }

  return generated;
}

/**
 * Builds a full Duolingo-grade 10-12 question lesson session:
 * - Combines all handcrafted questions for the node with same-unit reinforcement
 *   questions (other unit nodes + dynamically generated unit vocab/grammar questions)
 *   and up to 2 Spaced-Repetition review questions from earlier completed units.
 * - Guarantees 10-12 questions (12 for Unit Mastery Trophy nodes).
 * - Guarantees zero duplicate questions within the session.
 * - Guarantees a balanced mix across all 5 question types (mcq, listen, pairs, wordbank, fill_blank).
 * - Applies Fisher-Yates option shuffling while preserving exact answer matching.
 */
export function buildLessonSessionQuestions(
  lesson: Lesson,
  completedLessons: readonly string[] = [],
  units: readonly Unit[] = UNITS,
  rng: () => number = Math.random
): LessonQuestion[] {
  const targetCount = resolveLessonTargetCount(lesson);
  const unitIndex = units.findIndex((u) => u.lessons.some((l) => l.id === lesson.id));
  const unit = unitIndex >= 0 ? units[unitIndex] : null;

  const seen = new Set<string>();
  const cloneQ = (q: LessonQuestion): LessonQuestion =>
    JSON.parse(JSON.stringify(q)) as LessonQuestion;

  const tryAccept = (
    list: LessonQuestion[],
    q: LessonQuestion,
    markSpacedRepetition = false
  ): boolean => {
    const fp = getQuestionFingerprint(q);
    if (seen.has(fp)) return false;
    seen.add(fp);
    const copy = cloneQ(q);
    delete copy.isReview;
    if (markSpacedRepetition) {
      copy.isSpacedRepetition = true;
    } else {
      delete copy.isSpacedRepetition;
    }
    list.push(copy);
    return true;
  };

  // 1. Handcrafted questions for the active node
  const handcrafted: LessonQuestion[] = [];
  for (const q of lesson.questions) {
    if (handcrafted.length >= targetCount) break;
    tryAccept(handcrafted, q, false);
  }

  // 2. Spaced-Repetition pool: up to 2 review questions from earlier completed units
  const spacedRepetition: LessonQuestion[] = [];
  if (unitIndex > 0 && completedLessons.length > 0) {
    const completedSet = new Set(completedLessons);
    const earlierPool: LessonQuestion[] = [];
    for (let i = 0; i < unitIndex; i++) {
      const earlierUnit = units[i];
      const hasCompletedInUnit = earlierUnit.lessons.some((l) => completedSet.has(l.id));
      if (!hasCompletedInUnit) continue;
      for (const l of earlierUnit.lessons) {
        if (l.nodeType === 'chest' || l.questions.length === 0) continue;
        for (const q of l.questions) {
          earlierPool.push(q);
        }
      }
    }
    const shuffledEarlier = shuffleArray(earlierPool, rng);
    const srTarget = Math.min(2, Math.max(0, targetCount - handcrafted.length));
    // Prefer non-pairs first for crisp recall, fall back to any earlier question
    const preferredEarlier = [
      ...shuffledEarlier.filter((q) => q.type !== 'pairs'),
      ...shuffledEarlier.filter((q) => q.type === 'pairs'),
    ];
    for (const q of preferredEarlier) {
      if (spacedRepetition.length >= srTarget) break;
      tryAccept(spacedRepetition, q, true);
    }
  }

  // 3. Same-unit reinforcement pool (unused handcrafted questions from sibling nodes + dynamic generator)
  const siblingHandcrafted: LessonQuestion[] = [];
  if (unit) {
    for (const sibling of unit.lessons) {
      if (sibling.id === lesson.id || sibling.nodeType === 'chest') continue;
      for (const q of sibling.questions) {
        siblingHandcrafted.push(q);
      }
    }
  }
  const dynamicUnitQs = unit ? generateDynamicUnitQuestions(unit, rng) : [];
  const unitPool: LessonQuestion[] = [
    ...shuffleArray(siblingHandcrafted, rng),
    ...shuffleArray(dynamicUnitQs, rng),
  ];

  // Fallback cross-unit pool (only if a unit somehow ever lacked enough unique candidates)
  const fallbackPool: LessonQuestion[] = [];
  if (unitPool.length < 15) {
    for (const u of units) {
      if (unit && u.id === unit.id) continue;
      for (const l of u.lessons) {
        if (l.nodeType === 'chest') continue;
        for (const q of l.questions) fallbackPool.push(q);
      }
    }
  }
  const allCandidates = [...unitPool, ...shuffleArray(fallbackPool, rng)];

  // 4. Guarantee balanced 5-type coverage (mcq, listen, pairs, wordbank, fill_blank)
  const reinforcements: LessonQuestion[] = [];
  const currentTotal = () =>
    handcrafted.length + spacedRepetition.length + reinforcements.length;
  const hasType = (t: LessonQuestion['type']) =>
    handcrafted.some((q) => q.type === t) ||
    spacedRepetition.some((q) => q.type === t) ||
    reinforcements.some((q) => q.type === t);

  for (const requiredType of ALL_QUESTION_TYPES) {
    if (currentTotal() >= targetCount) break;
    if (hasType(requiredType)) continue;
    for (const cand of allCandidates) {
      if (cand.type !== requiredType) continue;
      if (tryAccept(reinforcements, cand, false)) break;
    }
  }

  // 5. Fill remaining slots up to targetCount (10-12) balancing across question types
  const typeCounts: Record<LessonQuestion['type'], number> = {
    mcq: 0,
    listen: 0,
    pairs: 0,
    wordbank: 0,
    fill_blank: 0,
  };
  for (const q of [...handcrafted, ...spacedRepetition, ...reinforcements]) {
    typeCounts[q.type] += 1;
  }

  while (currentTotal() < targetCount) {
    // Pick the least-represented question type (capping pairs at 2 so sessions stay snappy)
    const prioritizedTypes = [...ALL_QUESTION_TYPES].sort((a, b) => {
      const penA = a === 'pairs' && typeCounts.pairs >= 2 ? 10 : 0;
      const penB = b === 'pairs' && typeCounts.pairs >= 2 ? 10 : 0;
      return typeCounts[a] + penA - (typeCounts[b] + penB);
    });

    let added = false;
    for (const t of prioritizedTypes) {
      for (const cand of allCandidates) {
        if (cand.type !== t) continue;
        if (tryAccept(reinforcements, cand, false)) {
          typeCounts[t] += 1;
          added = true;
          break;
        }
      }
      if (added) break;
    }
    if (!added) break;
  }

  // 6. Smart Duolingo sequencing: anchor first handcrafted core question, interleave types, place SR mid/late
  const ordered: LessonQuestion[] = [];
  if (handcrafted.length > 0) {
    ordered.push(handcrafted[0]);
  }
  const restUnit = [...handcrafted.slice(1), ...reinforcements];
  const remaining = [...restUnit];

  while (remaining.length > 0) {
    const prevType = ordered.length > 0 ? ordered[ordered.length - 1].type : null;
    const diffIdx = remaining.findIndex((q) => q.type !== prevType);
    const pickIdx = diffIdx >= 0 ? diffIdx : 0;
    ordered.push(remaining.splice(pickIdx, 1)[0]);
  }

  // Weave Spaced-Repetition review questions cleanly at mid & late positions
  if (spacedRepetition.length >= 1) {
    const midPos = Math.min(4, ordered.length);
    ordered.splice(midPos, 0, spacedRepetition[0]);
  }
  if (spacedRepetition.length >= 2) {
    const latePos = Math.min(8, ordered.length);
    ordered.splice(latePos, 0, spacedRepetition[1]);
  }

  return prepareSessionQuestions(ordered.slice(0, targetCount), rng);
}

/**
 * Builds a quick 5-question refresher session (+5 XP) for already-completed nodes.
 */
export function buildReviewSessionQuestions(
  lesson: Lesson,
  units: readonly Unit[] = UNITS,
  rng: () => number = Math.random
): LessonQuestion[] {
  const fullPool = buildLessonSessionQuestions(lesson, [], units, rng);
  const picked: LessonQuestion[] = [];
  const seen = new Set<string>();

  for (const t of ALL_QUESTION_TYPES) {
    if (picked.length >= REVIEW_QUESTION_COUNT) break;
    const match = fullPool.find((q) => q.type === t && !seen.has(getQuestionFingerprint(q)));
    if (match) {
      seen.add(getQuestionFingerprint(match));
      picked.push(match);
    }
  }
  for (const q of fullPool) {
    if (picked.length >= REVIEW_QUESTION_COUNT) break;
    const fp = getQuestionFingerprint(q);
    if (!seen.has(fp)) {
      seen.add(fp);
      picked.push(q);
    }
  }
  return prepareSessionQuestions(picked.slice(0, REVIEW_QUESTION_COUNT), rng);
}

/**
 * Builds a harder 10-question Zero-Hint Legendary mastery challenge (+40 XP, 3 hearts).
 * Prioritizes active recall formats (wordbank, fill_blank, listen, Arabic-option MCQ).
 */
export function buildLegendarySessionQuestions(
  lesson: Lesson,
  units: readonly Unit[] = UNITS,
  rng: () => number = Math.random
): LessonQuestion[] {
  const basePool = buildLessonSessionQuestions(lesson, [], units, rng);
  const unit = units.find((u) => u.lessons.some((l) => l.id === lesson.id));
  const extraDynamic = unit ? generateDynamicUnitQuestions(unit, rng) : [];
  const combined = [...basePool, ...shuffleArray(extraDynamic, rng)];

  const difficultyRank = (q: LessonQuestion): number => {
    if (q.type === 'wordbank' && q.isArabicWords) return 0;
    if (q.type === 'fill_blank') return 1;
    if (q.type === 'listen') return 2;
    if (q.type === 'mcq' && q.isArabicOption) return 3;
    if (q.type === 'wordbank') return 4;
    if (q.type === 'mcq') return 5;
    return 6;
  };

  const ranked = [...combined].sort((a, b) => difficultyRank(a) - difficultyRank(b));
  const seen = new Set<string>();
  const picked: LessonQuestion[] = [];
  for (const q of ranked) {
    if (picked.length >= LEGENDARY_QUESTION_COUNT) break;
    const fp = getQuestionFingerprint(q);
    if (seen.has(fp)) continue;
    seen.add(fp);
    const clone = JSON.parse(JSON.stringify(q)) as LessonQuestion;
    delete clone.isReview;
    delete clone.isSpacedRepetition;
    picked.push(clone);
  }
  return prepareSessionQuestions(picked.slice(0, LEGENDARY_QUESTION_COUNT), rng);
}

/**
 * Prepares an Interactive Story by cloning steps and Fisher-Yates shuffling every
 * mid-story comprehension check's options while keeping exact answer matching intact.
 */
export function prepareStorySteps(
  story: UnitStory,
  rng: () => number = Math.random
): StoryStep[] {
  return story.steps.map((step) => {
    if (step.kind === 'check') {
      return {
        ...step,
        options: shuffleArray(step.options, rng),
        optionTranslits: step.optionTranslits ? { ...step.optionTranslits } : undefined,
      };
    }
    return { ...step };
  });
}

export function evaluateStoryCheckAnswer(
  step: StoryCheckStep,
  selectedOption: string | null
): { correct: boolean; expectedDisplay: string } {
  const correct = selectedOption === step.answer;
  const expectedDisplay =
    step.checkType === 'fill_blank' && step.sentence
      ? buildFilledSentence(step.sentence, step.answer)
      : step.answer;
  return { correct, expectedDisplay };
}

export function collectStoryArabicTexts(story: UnitStory): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (text?: string) => {
    const t = (text ?? '').trim();
    if (!t || !/[\u0600-\u06FF]/.test(t) || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  add(story.titleAr);
  for (const step of story.steps) {
    if (step.kind === 'line') {
      add(step.ar);
    } else if (step.kind === 'check') {
      for (const opt of step.options) add(opt);
      if (step.checkType === 'fill_blank' && step.sentence) {
        add(buildFilledSentence(step.sentence, step.answer));
      }
    }
  }
  return out;
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
