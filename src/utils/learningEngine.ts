import { COMMUNITY_LEARNERS, UNITS } from '../data/curriculum';
import type {
  AppTab,
  ArabicLetter,
  AudioPairsQuestion,
  LeaderboardEntry,
  Lesson,
  LessonQuestion,
  PairsQuestion,
  SessionMode,
  SessionResult,
  SessionVariant,
  StoryCheckStep,
  StoryStep,
  Unit,
  UnitStory,
  UserState,
  VideoCallScenario,
  VowelMode,
} from '../types/learning';

export const MAX_HEARTS = 5;
export const LESSON_XP_REWARD = 15;
export const STORY_XP_REWARD = 15;
export const VIDEO_CALL_MIN_UNIT_NUMBER = 15;
export const VIDEO_CALL_BASE_XP = 15;
export const VIDEO_CALL_XP_PER_WORD = 2;
export const VIDEO_CALL_MAX_BONUS_XP = 35;
export const REVIEW_XP_REWARD = 5;
export const LEGENDARY_XP_REWARD = 40;
export const LEGENDARY_HEARTS = 3;
export const REVIEW_QUESTION_COUNT = 5;
export const LEGENDARY_QUESTION_COUNT = 10;
export const JUMP_TEST_QUESTION_COUNT = 15;
export const JUMP_TEST_PASS_SCORE = 12;
export const JUMP_TEST_HEARTS = 3;
export const TREASURE_CHEST_XP = 25;
export const TREASURE_CHEST_HEARTS = 1;
export const ALPHABET_MAX_UNIT_NUMBER = 4;
export const MISTAKE_REVIEW_BANNER_TEXT =
  "🔄 തെറ്റിയവ ശരിയാക്കാം! (Let's correct the ones you missed)";

export function getUnitNumberFromLessonId(lessonId?: string | null): number | null {
  if (!lessonId) return null;
  const match = /^u(\d+)_/i.exec(lessonId.trim());
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const BASIC_ALPHABET_PROMPT_PATTERN =
  /(അക്ഷരം\s*(ഏതാണ്|തിരഞ്ഞെടുക്കുക)|അക്ഷരത്തിന്റെ\s*ഉച്ചാരണം|അക്ഷരങ്ങളും|പുള്ളികളുള്ള\s*അക്ഷരം|ഹറകത്തുള്ള\s*അക്ഷര|ശരിയായ\s*ഹറകത്ത്\s*തിരഞ്ഞെടുക്കുക|ചെറിയ\s*വര\s*\(|ശബ്ദം\s*നൽകുന്ന\s*അക്ഷരം|ശബ്ദമുള്ള\s*അക്ഷരം)/;

function countBareArabicLetters(text?: string | null): number {
  if (!text) return 0;
  const matches = text.normalize('NFC').match(/[\u0621-\u064A]/g);
  return matches ? matches.length : 0;
}

function isSingleArabicLetterOption(option: string): boolean {
  if (countBareArabicLetters(option) !== 1) return false;
  // Exclude long Malayalam grammar explanations that merely mention a Harakat/Tanween example like '(ـًا)'
  const nonArabicRemainder = option
    .normalize('NFC')
    .replace(/[\u0600-\u06FF\s()[\]'".,!?:/\-–—·]+/g, '');
  return nonArabicRemainder.length <= 14;
}

/**
 * Identifies basic Arabic Alphabet and single-letter Harakat recognition questions
 * that must remain strictly restricted to Units 1-4.
 */
export function isBasicAlphabetOrHarakatQuestion(question: LessonQuestion): boolean {
  if (!question) return false;
  if (BASIC_ALPHABET_PROMPT_PATTERN.test(question.prompt || '')) {
    return true;
  }

  if (
    question.type === 'mcq' ||
    question.type === 'listen' ||
    question.type === 'dictation' ||
    question.type === 'speak'
  ) {
    if (question.arabic && countBareArabicLetters(question.arabic) === 1) {
      return true;
    }
  }

  if (question.type === 'mcq' || question.type === 'listen') {
    if (
      Array.isArray(question.options) &&
      question.options.length > 0 &&
      question.options.every((opt) => isSingleArabicLetterOption(opt))
    ) {
      return true;
    }
  }

  if (isPairsQuestion(question)) {
    if (
      question.pairs.length > 0 &&
      question.pairs.every((pair) => countBareArabicLetters(pair.ar) === 1)
    ) {
      return true;
    }
  }

  return false;
}

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

export const ARABIC_QUICK_KEYS: readonly string[] = [
  'ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش',
  'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه',
  'و', 'ي', 'ة', 'ى', 'أ', 'إ', 'آ', 'ئ', 'ؤ',
] as const;

/**
 * Smart Harakat-insensitive Arabic normalization for Dictation ("Type What You Hear"):
 * - Unicode NFC normalization
 * - Strips all Arabic Harakat/Tashkeel ([\u064B-\u065F\u0670\u06D6-\u06ED]) and zero-width marks
 * - Strips Tatweel (ـ) and punctuation
 * - Normalizes Alef variants (أ إ آ ٱ -> ا) and Alef Maqsura (ى -> ي)
 * - Collapses extra whitespace and trims ends
 */
export function normalizeArabicDictation(text: string): string {
  return String(text ?? '')
    .normalize('NFC')
    .replace(/[\u200B-\u200F\uFEFF\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[.,!؟?،؛:"'()\[\]«»\-–—…\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function areDictationAnswersEqual(
  userInput: string,
  expectedArabic: string
): boolean {
  const normUser = normalizeArabicDictation(userInput);
  const normExpected = normalizeArabicDictation(expectedArabic);
  return Boolean(normExpected) && normUser === normExpected;
}

export const SPEAK_MIN_UNIT_NUMBER = 20;
export const SPEAK_MATCH_THRESHOLD = 0.7;

export interface SpeechWordStatus {
  word: string;
  matched: boolean;
}

export interface SpeechEvaluationResult {
  matched: boolean;
  ratio: number;
  matchedCount: number;
  totalWords: number;
  wordStatuses: SpeechWordStatus[];
}

/**
 * Strips Arabic Harakat/Tashkeel, Tatweel, and punctuation and normalizes Alef/Yaa/Taa Marbuta
 * for fair Web Speech API (`ar-SA`) spoken-word comparison.
 */
export function normalizeArabicSpeech(text: string): string {
  return normalizeArabicDictation(text).replace(/ة/g, 'ه');
}

export function evaluateSpeechMatch(
  spokenTranscript: string,
  expectedArabic: string,
  threshold: number = SPEAK_MATCH_THRESHOLD
): SpeechEvaluationResult {
  const displayWords = String(expectedArabic ?? '')
    .trim()
    .split(/\s+/)
    .filter((w) => normalizeArabicSpeech(w).length > 0);

  const expectedTokens = displayWords.map((w) => normalizeArabicSpeech(w));
  const totalWords = expectedTokens.length;

  if (totalWords === 0) {
    return { matched: false, ratio: 0, matchedCount: 0, totalWords: 0, wordStatuses: [] };
  }

  const spokenTokens = normalizeArabicSpeech(spokenTranscript)
    .split(/\s+/)
    .filter(Boolean);

  // Bag-of-words frequency map so repeating one word cannot game the 70% threshold
  const spokenCounts = new Map<string, number>();
  for (const tok of spokenTokens) {
    spokenCounts.set(tok, (spokenCounts.get(tok) ?? 0) + 1);
  }

  let matchedCount = 0;
  const wordStatuses: SpeechWordStatus[] = displayWords.map((word, idx) => {
    const normExpected = expectedTokens[idx];
    const available = spokenCounts.get(normExpected) ?? 0;
    if (available > 0) {
      spokenCounts.set(normExpected, available - 1);
      matchedCount += 1;
      return { word, matched: true };
    }
    return { word, matched: false };
  });

  const ratio = matchedCount / totalWords;
  return {
    matched: ratio >= threshold - 1e-9,
    ratio,
    matchedCount,
    totalWords,
    wordStatuses,
  };
}

export function isPodcastQuestion(question: LessonQuestion): boolean {
  return (
    question.type === 'radio_tf' ||
    question.type === 'radio_select3' ||
    question.type === 'radio_mcq'
  );
}

export function isPairsQuestion(
  question: LessonQuestion
): question is PairsQuestion | AudioPairsQuestion {
  return question.type === 'pairs' || question.type === 'audio_pairs';
}

export interface PairSelectionState {
  selectedLeft: number | null;
  selectedRight: number | null;
  matchedPairIndices: readonly number[];
  wrongPairFlash: { left: number; right: number } | null;
}

export type PairTapAction = 'noop' | 'select' | 'switch' | 'deselect' | 'match' | 'mismatch';

export interface PairSelectionTransition {
  action: PairTapAction;
  selectedLeft: number | null;
  selectedRight: number | null;
  matchedPairIndices: number[];
  wrongPairFlash: { left: number; right: number } | null;
  shouldSpeakArabic: boolean;
  allMatched: boolean;
}

/**
 * Pure state transition for Matching Pairs (`pairs` and `audio_pairs`):
 * - Ignores taps on already-matched cards.
 * - Cancels an active mismatch flash immediately so a fresh tap starts cleanly.
 * - Tapping an already-selected card in the same column deselects it.
 * - Tapping another card in the same column switches selection cleanly.
 * - Tapping a card in the opposite column evaluates match vs. mismatch.
 */
export function resolvePairTapSelection(
  state: PairSelectionState,
  side: 'left' | 'right',
  pairIdx: number,
  totalPairs: number
): PairSelectionTransition {
  const matched = [...state.matchedPairIndices];
  if (matched.includes(pairIdx)) {
    return {
      action: 'noop',
      selectedLeft: state.selectedLeft,
      selectedRight: state.selectedRight,
      matchedPairIndices: matched,
      wrongPairFlash: state.wrongPairFlash,
      shouldSpeakArabic: false,
      allMatched: matched.length >= totalPairs,
    };
  }

  // If a mismatch flash was in progress, clear it and begin a fresh selection on the tapped card
  if (state.wrongPairFlash !== null) {
    return {
      action: 'select',
      selectedLeft: side === 'left' ? pairIdx : null,
      selectedRight: side === 'right' ? pairIdx : null,
      matchedPairIndices: matched,
      wrongPairFlash: null,
      shouldSpeakArabic: side === 'left',
      allMatched: false,
    };
  }

  // Tapping the currently selected card in the same column deselects it
  if (side === 'left' && state.selectedLeft === pairIdx) {
    return {
      action: 'deselect',
      selectedLeft: null,
      selectedRight: state.selectedRight,
      matchedPairIndices: matched,
      wrongPairFlash: null,
      shouldSpeakArabic: false,
      allMatched: false,
    };
  }
  if (side === 'right' && state.selectedRight === pairIdx) {
    return {
      action: 'deselect',
      selectedLeft: state.selectedLeft,
      selectedRight: null,
      matchedPairIndices: matched,
      wrongPairFlash: null,
      shouldSpeakArabic: false,
      allMatched: false,
    };
  }

  const nextLeft = side === 'left' ? pairIdx : state.selectedLeft;
  const nextRight = side === 'right' ? pairIdx : state.selectedRight;

  // Switching selection within the same column when the opposite column is unselected
  if (side === 'left' && state.selectedLeft !== null && state.selectedRight === null) {
    return {
      action: 'switch',
      selectedLeft: pairIdx,
      selectedRight: null,
      matchedPairIndices: matched,
      wrongPairFlash: null,
      shouldSpeakArabic: true,
      allMatched: false,
    };
  }
  if (side === 'right' && state.selectedRight !== null && state.selectedLeft === null) {
    return {
      action: 'switch',
      selectedLeft: null,
      selectedRight: pairIdx,
      matchedPairIndices: matched,
      wrongPairFlash: null,
      shouldSpeakArabic: false,
      allMatched: false,
    };
  }

  // Single-side selection (waiting for the opposite column)
  if (nextLeft === null || nextRight === null) {
    return {
      action: 'select',
      selectedLeft: nextLeft,
      selectedRight: nextRight,
      matchedPairIndices: matched,
      wrongPairFlash: null,
      shouldSpeakArabic: side === 'left',
      allMatched: false,
    };
  }

  // Both sides selected: check match vs. mismatch
  if (nextLeft === nextRight) {
    const updatedMatched = [...matched, nextLeft];
    return {
      action: 'match',
      selectedLeft: null,
      selectedRight: null,
      matchedPairIndices: updatedMatched,
      wrongPairFlash: null,
      shouldSpeakArabic: side === 'left',
      allMatched: updatedMatched.length === totalPairs,
    };
  }

  return {
    action: 'mismatch',
    selectedLeft: nextLeft,
    selectedRight: nextRight,
    matchedPairIndices: matched,
    wrongPairFlash: { left: nextLeft, right: nextRight },
    shouldSpeakArabic: side === 'left',
    allMatched: false,
  };
}

export function areRadioSelect3AnswersEqual(
  selectedWords: readonly string[],
  expectedWords: readonly string[]
): boolean {
  if (selectedWords.length !== 3 || expectedWords.length !== 3) return false;
  const expectedSet = new Set(expectedWords.map((w) => normalizeWordBankText(w)));
  if (expectedSet.size !== 3) return false;
  const pickedSet = new Set(selectedWords.map((w) => normalizeWordBankText(w)));
  if (pickedSet.size !== 3) return false;
  for (const w of pickedSet) {
    if (!expectedSet.has(w)) return false;
  }
  return true;
}

export function enqueueMistakeForReview(
  questions: readonly LessonQuestion[],
  missedQuestion: LessonQuestion,
  mode: SessionMode,
  rng: () => number = Math.random,
  unitNumber?: number
): LessonQuestion[] {
  if (mode !== 'lesson') {
    return [...questions];
  }
  if (
    typeof unitNumber === 'number' &&
    unitNumber > ALPHABET_MAX_UNIT_NUMBER &&
    isBasicAlphabetOrHarakatQuestion(missedQuestion)
  ) {
    return [...questions];
  }
  const cloned = JSON.parse(JSON.stringify(missedQuestion)) as LessonQuestion;
  cloned.isReview = true;
  if (
    (cloned.type === 'mcq' ||
      cloned.type === 'listen' ||
      cloned.type === 'fill_blank' ||
      cloned.type === 'radio_mcq') &&
    Array.isArray(cloned.options)
  ) {
    cloned.options = shuffleArray(cloned.options, rng);
  }
  if (cloned.type === 'radio_select3' && Array.isArray(cloned.words)) {
    cloned.words = shuffleArray(cloned.words, rng);
  }
  return [...questions, cloned];
}

export function evaluateQuestionAnswer(
  question: LessonQuestion,
  selectedOption: string | null,
  wordBankWords: string[]
): { correct: boolean; expectedDisplay: string } {
  if (question.type === 'mcq' || question.type === 'listen' || question.type === 'radio_mcq') {
    return {
      correct: selectedOption === question.answer,
      expectedDisplay: question.answer,
    };
  }

  if (question.type === 'radio_tf') {
    const pickedBool =
      selectedOption === 'true' ? true : selectedOption === 'false' ? false : null;
    return {
      correct: pickedBool === question.answer,
      expectedDisplay: question.answer ? '✔️ ശരി (True)' : '✖️ തെറ്റ് (False)',
    };
  }

  if (question.type === 'radio_select3') {
    return {
      correct: areRadioSelect3AnswersEqual(wordBankWords, question.answers),
      expectedDisplay: question.answers.join(' · '),
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
  if (question.type === 'dictation') {
    return {
      correct: areDictationAnswersEqual(selectedOption ?? '', question.arabic),
      expectedDisplay: question.arabic,
    };
  }
  if (question.type === 'speak') {
    const result = evaluateSpeechMatch(selectedOption ?? '', question.arabic);
    return {
      correct: result.matched,
      expectedDisplay: question.arabic,
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
    const requiredScore =
      totalQuestions === JUMP_TEST_QUESTION_COUNT
        ? JUMP_TEST_PASS_SCORE
        : Math.ceil(totalQuestions * 0.8);
    if (score >= requiredScore) {
      return {
        mode,
        lessonId: null,
        targetUnitIndex,
        score,
        totalQuestions,
        earnedXp: 40,
        unlockedUpToUnitIndex: targetUnitIndex,
        title: `യൂണിറ്റ് ${targetUnitIndex + 1} അൺലോക്ക് ആയി!`,
        subtitle: `പ്രവേശന പരീക്ഷ നിങ്ങൾ വിജയിച്ചിരിക്കുന്നു! (${totalQuestions}-ൽ ${score} ശരി)`,
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
      subtitle: `ഈ യൂണിറ്റിലേക്ക് കടക്കാൻ ${totalQuestions}-ൽ ${requiredScore} ശരിയുത്തരം ആവശ്യമാണ്.`,
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

  if (variant === 'video_call') {
    return {
      mode: 'lesson',
      variant: 'video_call',
      lessonId,
      targetUnitIndex: null,
      score,
      totalQuestions,
      earnedXp: xpReward ?? VIDEO_CALL_BASE_XP,
      unlockedUpToUnitIndex: null,
      title: 'വീഡിയോ കോൾ പൂർത്തിയായി! 📹',
      subtitle: 'അറബി സംഭാഷണം വിജയകരമായി പൂർത്തിയാക്കി ബോണസ് XP നേടി!',
      emoji: '📹',
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
  if (question.type === 'dictation' || question.type === 'speak' || isPodcastQuestion(question)) {
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
      (q.type === 'mcq' ||
        q.type === 'listen' ||
        q.type === 'fill_blank' ||
        q.type === 'radio_mcq') &&
      Array.isArray(q.options)
    ) {
      return {
        ...q,
        options: shuffleArray(q.options, rng),
      };
    }
    if (q.type === 'radio_select3' && Array.isArray(q.words)) {
      return {
        ...q,
        words: shuffleArray(q.words, rng),
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
  if (lesson.nodeType === 'trophy' || lesson.nodeType === 'listening' || lesson.nodeType === 'hard') {
    return 12;
  }
  if (
    lesson.nodeType === 'dialogue' ||
    lesson.nodeType === 'story' ||
    lesson.nodeType === 'practice' ||
    lesson.nodeType === 'wordbank'
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
  if (q.type === 'dictation') {
    return `dictation|${normalizeArabicDictation(q.arabic)}`;
  }
  if (q.type === 'speak') {
    return `speak|${normalizeArabicSpeech(q.arabic)}`;
  }
  if (q.type === 'radio_tf') {
    return `radio_tf|${norm(q.arabic)}|${norm(q.statementMl)}|${String(q.answer)}`;
  }
  if (q.type === 'radio_select3') {
    const ansSig = [...q.answers].map((a) => norm(a)).sort().join(',');
    return `radio_select3|${norm(q.arabic)}|${ansSig}`;
  }
  if (q.type === 'radio_mcq') {
    return `radio_mcq|${norm(q.arabic)}|${norm(q.answer)}`;
  }
  const pairSig = q.pairs
    .map((p) => norm(p.ar))
    .sort()
    .join(',');
  return `${q.type}|${pairSig}`;
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

  const disallowSingleLetter = unit.number > ALPHABET_MAX_UNIT_NUMBER;
  const pushEntry = (ar: string, tr: string, ml: string) => {
    const cleanAr = ar.trim();
    const cleanMl = ml.trim();
    if (!cleanAr || !cleanMl) return;
    // Skip compound comparison rows (with arrows or slashes) for cleaner single-answer MCQs
    if (/[→\/]/.test(cleanAr)) return;
    if (disallowSingleLetter && countBareArabicLetters(cleanAr) < 2) return;
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
      if (isPairsQuestion(q)) {
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

  // 3. Dynamic Audio-Only Dictation ("Type What You Hear") questions
  const dictationCandidates = collectUnitDictationPool(unit);
  const shuffledDictation = shuffleArray(dictationCandidates, rng);
  shuffledDictation.forEach((entry, idx) => {
    generated.push({
      type: 'dictation',
      prompt: 'ശബ്ദം കേട്ട് അറബിയിൽ ടൈപ്പ് ചെയ്യുക',
      arabic: entry.ar,
      translit: entry.tr || undefined,
      meaningMl: entry.ml,
      avatar: idx % 2 === 0 ? '🧕' : '👳‍♂️',
    });
  });

  // 4. Dynamic Speaking ("Read Aloud") questions — EXCLUSIVELY Units 20 to 35
  if (unit.number >= SPEAK_MIN_UNIT_NUMBER) {
    const speakCandidates = shuffleArray(collectUnitSpeakPool(unit), rng);
    speakCandidates.forEach((entry, idx) => {
      generated.push({
        type: 'speak',
        prompt: 'കേട്ട ശേഷം ഉറക്കെ വായിക്കുക',
        arabic: entry.ar,
        translit: entry.tr || undefined,
        meaningMl: entry.ml,
        avatar: idx % 2 === 0 ? '🧕' : '👳‍♂️',
      });
    });
  }

  return generated;
}

function collectUnitSpeakPool(unit: Unit): VocabEntry[] {
  const seen = new Set<string>();
  const sentences: VocabEntry[] = [];
  const singleWords: VocabEntry[] = [];

  const pushCandidate = (ar: string, tr: string, ml: string) => {
    const cleanAr = String(ar ?? '').trim();
    const cleanMl = String(ml ?? '').trim();
    if (!cleanAr || !cleanMl) return;
    if (/[_→\/]/.test(cleanAr)) return;
    if (/[\u0D00-\u0D7F]/.test(cleanAr)) return;
    if (!/[\u0621-\u064A]/.test(cleanAr)) return;

    const normKey = normalizeArabicSpeech(cleanAr);
    if (!normKey || seen.has(normKey)) return;
    const wordCount = normKey.split(/\s+/).filter(Boolean).length;
    if (wordCount < 1 || wordCount > 7) return;
    seen.add(normKey);

    const entry: VocabEntry = { ar: cleanAr, tr: String(tr ?? '').trim(), ml: cleanMl };
    if (wordCount >= 2) {
      sentences.push(entry);
    } else {
      singleWords.push(entry);
    }
  };

  for (const g of unit.guidebook ?? []) {
    pushCandidate(g.ar, g.tr, g.ml);
  }
  for (const l of unit.lessons) {
    if (l.nodeType === 'chest' || l.nodeType === 'video_call') continue;
    if (l.story) {
      for (const step of l.story.steps) {
        if (step.kind === 'line') {
          pushCandidate(step.ar, step.tr, step.ml);
        }
      }
    }
    for (const q of l.questions) {
      if (isPairsQuestion(q)) {
        for (const p of q.pairs) {
          pushCandidate(p.ar, p.tr ?? '', p.ml);
        }
      } else if ((q.type === 'mcq' || q.type === 'listen') && q.arabic && !q.isArabicOption) {
        pushCandidate(q.arabic, q.translit ?? '', q.answer);
      } else if (q.type === 'fill_blank' && q.sentence && q.answer && q.hintMl) {
        pushCandidate(buildFilledSentence(q.sentence, q.answer), '', q.hintMl);
      }
    }
  }

  return sentences.length >= 4 ? sentences : [...sentences, ...singleWords];
}

function collectUnitDictationPool(unit: Unit): VocabEntry[] {
  const seen = new Set<string>();
  const multiLetter: VocabEntry[] = [];
  const singleLetter: VocabEntry[] = [];

  const pushCandidate = (ar: string, tr: string, ml: string) => {
    const cleanAr = String(ar ?? '').trim();
    const cleanMl = String(ml ?? '').trim();
    if (!cleanAr || !cleanMl) return;
    if (/[_→\/]/.test(cleanAr)) return;
    if (/[\u0D00-\u0D7F]/.test(cleanAr)) return;
    if (!/[\u0621-\u064A]/.test(cleanAr)) return;

    const normKey = normalizeArabicDictation(cleanAr);
    if (!normKey || seen.has(normKey)) return;
    const wordCount = normKey.split(/\s+/).filter(Boolean).length;
    if (wordCount < 1 || wordCount > 4) return;
    seen.add(normKey);

    const entry: VocabEntry = { ar: cleanAr, tr: String(tr ?? '').trim(), ml: cleanMl };
    const bareLetters = normKey.replace(/\s+/g, '');
    if (bareLetters.length >= 2) {
      multiLetter.push(entry);
    } else {
      singleLetter.push(entry);
    }
  };

  for (const g of unit.guidebook ?? []) {
    pushCandidate(g.ar, g.tr, g.ml);
  }
  for (const l of unit.lessons) {
    if (l.nodeType === 'chest' || l.nodeType === 'video_call') continue;
    for (const q of l.questions) {
      if (isPairsQuestion(q)) {
        for (const p of q.pairs) {
          pushCandidate(p.ar, p.tr ?? '', p.ml);
        }
      } else if ((q.type === 'mcq' || q.type === 'listen') && q.arabic && !q.isArabicOption) {
        pushCandidate(q.arabic, q.translit ?? '', q.answer);
      } else if (q.type === 'fill_blank' && q.sentence && q.answer && q.hintMl) {
        pushCandidate(buildFilledSentence(q.sentence, q.answer), '', q.hintMl);
      }
    }
  }

  if (unit.number > ALPHABET_MAX_UNIT_NUMBER) {
    return multiLetter;
  }
  return multiLetter.length >= 3 ? multiLetter : [...multiLetter, ...singleLetter];
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

  const disallowBasicAlphabet = Boolean(unit && unit.number > ALPHABET_MAX_UNIT_NUMBER);

  const tryAccept = (
    list: LessonQuestion[],
    q: LessonQuestion,
    markSpacedRepetition = false
  ): boolean => {
    if (disallowBasicAlphabet && isBasicAlphabetOrHarakatQuestion(q)) return false;
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
  //    Starting from Unit 6 onward, sample strictly from Units 5..N-1; in Unit 5, review Units 2-4 (skipping Unit 1).
  //    Never allow basic Alphabet/Harakat questions from Unit 5 onward.
  const spacedRepetition: LessonQuestion[] = [];
  const minSrUnitIndex =
    unit && unit.number >= ALPHABET_MAX_UNIT_NUMBER + 2
      ? ALPHABET_MAX_UNIT_NUMBER
      : disallowBasicAlphabet
        ? 1
        : 0;
  if (unitIndex > minSrUnitIndex && completedLessons.length > 0) {
    const completedSet = new Set(completedLessons);
    const earlierPool: LessonQuestion[] = [];
    for (let i = minSrUnitIndex; i < unitIndex; i++) {
      const earlierUnit = units[i];
      const hasCompletedInUnit = earlierUnit.lessons.some((l) => completedSet.has(l.id));
      if (!hasCompletedInUnit) continue;
      for (const l of earlierUnit.lessons) {
        if (l.nodeType === 'chest' || l.nodeType === 'video_call' || l.questions.length === 0) continue;
        for (const q of l.questions) {
          if (disallowBasicAlphabet && isBasicAlphabetOrHarakatQuestion(q)) continue;
          earlierPool.push(q);
        }
      }
    }
    const shuffledEarlier = shuffleArray(earlierPool, rng);
    const srTarget = Math.min(2, Math.max(0, targetCount - handcrafted.length));
    // Prefer non-pairs first for crisp recall, fall back to any earlier question
    const preferredEarlier = [
      ...shuffledEarlier.filter((q) => !isPairsQuestion(q)),
      ...shuffledEarlier.filter((q) => isPairsQuestion(q)),
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
      if (sibling.id === lesson.id || sibling.nodeType === 'chest' || sibling.nodeType === 'video_call') continue;
      for (const q of sibling.questions) {
        if (disallowBasicAlphabet && isBasicAlphabetOrHarakatQuestion(q)) continue;
        siblingHandcrafted.push(q);
      }
    }
  }
  const dynamicUnitQs = unit
    ? generateDynamicUnitQuestions(unit, rng).filter(
        (q) => !(disallowBasicAlphabet && isBasicAlphabetOrHarakatQuestion(q))
      )
    : [];
  const unitPool: LessonQuestion[] = [
    ...shuffleArray(siblingHandcrafted, rng),
    ...shuffleArray(dynamicUnitQs, rng),
  ];

  // Fallback cross-unit pool (only if a unit somehow ever lacked enough unique candidates)
  const fallbackPool: LessonQuestion[] = [];
  if (unitPool.length < 15) {
    for (const u of units) {
      if (unit && u.id === unit.id) continue;
      if (disallowBasicAlphabet && u.number <= ALPHABET_MAX_UNIT_NUMBER) continue;
      for (const l of u.lessons) {
        if (l.nodeType === 'chest' || l.nodeType === 'video_call') continue;
        for (const q of l.questions) {
          if (disallowBasicAlphabet && isBasicAlphabetOrHarakatQuestion(q)) continue;
          fallbackPool.push(q);
        }
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

  const baseTargetCount = targetCount;
  const maxSessionCount = lesson.nodeType === 'trophy' ? 12 : 12;
  let effectiveTargetCount = baseTargetCount;

  for (const requiredType of ALL_QUESTION_TYPES) {
    if (currentTotal() >= maxSessionCount) break;
    if (hasType(requiredType)) continue;
    for (const cand of allCandidates) {
      if (cand.type !== requiredType) continue;
      if (tryAccept(reinforcements, cand, false)) break;
    }
  }

  // 4b. Mix at least 1 Arabic Radio / Podcast exercise into regular 10-12 question lessons
  const hasPodcast = () =>
    handcrafted.some(isPodcastQuestion) ||
    spacedRepetition.some(isPodcastQuestion) ||
    reinforcements.some(isPodcastQuestion);
  if (currentTotal() < maxSessionCount && !hasPodcast()) {
    for (const cand of allCandidates) {
      if (!isPodcastQuestion(cand)) continue;
      if (tryAccept(reinforcements, cand, false)) break;
    }
  }

  // 4c. Mix 1-2 Dictation ("Type What You Hear") exercises into regular lessons and 2 into Hard Practice nodes
  const countDictation = () =>
    [...handcrafted, ...spacedRepetition, ...reinforcements].filter((q) => q.type === 'dictation')
      .length;
  const desiredDictationCount = lesson.nodeType === 'hard' ? 2 : 1;
  while (countDictation() < desiredDictationCount && currentTotal() < maxSessionCount) {
    let addedDictation = false;
    for (const cand of allCandidates) {
      if (cand.type !== 'dictation') continue;
      if (tryAccept(reinforcements, cand, false)) {
        addedDictation = true;
        break;
      }
    }
    if (!addedDictation) break;
  }

  // 4d. Mix 1-2 Speaking ("Read Aloud") exercises EXCLUSIVELY in Units 20 to 35
  const allowSpeak = Boolean(unit && unit.number >= SPEAK_MIN_UNIT_NUMBER);
  if (allowSpeak) {
    const countSpeak = () =>
      [...handcrafted, ...spacedRepetition, ...reinforcements].filter((q) => q.type === 'speak')
        .length;
    const desiredSpeakCount =
      lesson.nodeType === 'hard' || lesson.nodeType === 'trophy' ? 2 : 1;

    while (countSpeak() < desiredSpeakCount) {
      if (currentTotal() >= maxSessionCount) {
        // Free a redundant non-protected reinforcement slot if session hit 12 before adding speak
        const allSoFar = [...handcrafted, ...spacedRepetition, ...reinforcements];
        const countsByType: Record<string, number> = {};
        for (const item of allSoFar) {
          countsByType[item.type] = (countsByType[item.type] ?? 0) + 1;
        }
        const removableIdx = reinforcements.findIndex((r) => {
          if (r.type === 'speak') return false;
          if (r.type === 'dictation') {
            return countsByType.dictation > desiredDictationCount;
          }
          if (isPodcastQuestion(r)) {
            return allSoFar.filter(isPodcastQuestion).length > 1;
          }
          return (countsByType[r.type] ?? 0) > 1;
        });
        if (removableIdx >= 0) {
          reinforcements.splice(removableIdx, 1);
        } else {
          let swappedHandcrafted = false;
          for (let i = handcrafted.length - 1; i >= 1; i--) {
            const item = handcrafted[i];
            if (item.type === 'speak' || isPodcastQuestion(item)) continue;
            if ((countsByType[item.type] ?? 0) > 1) {
              handcrafted.splice(i, 1);
              swappedHandcrafted = true;
              break;
            }
          }
          if (!swappedHandcrafted) break;
        }
      }

      let addedSpeak = false;
      for (const cand of allCandidates) {
        if (cand.type !== 'speak') continue;
        if (tryAccept(reinforcements, cand, false)) {
          addedSpeak = true;
          break;
        }
      }
      if (!addedSpeak) break;
    }
  }

  if (currentTotal() > effectiveTargetCount) {
    effectiveTargetCount = Math.min(maxSessionCount, currentTotal());
  }

  // 5. Fill remaining slots up to effectiveTargetCount (10-12) balancing across question types
  const typeCounts: Record<LessonQuestion['type'], number> = {
    mcq: 0,
    listen: 0,
    pairs: 0,
    audio_pairs: 0,
    wordbank: 0,
    fill_blank: 0,
    radio_tf: 0,
    radio_select3: 0,
    radio_mcq: 0,
    dictation: 0,
    speak: 0,
  };
  for (const q of [...handcrafted, ...spacedRepetition, ...reinforcements]) {
    typeCounts[q.type] += 1;
  }

  const fillTypes: readonly LessonQuestion['type'][] = allowSpeak
    ? [...ALL_QUESTION_TYPES, 'dictation', 'speak']
    : [...ALL_QUESTION_TYPES, 'dictation'];
  while (currentTotal() < effectiveTargetCount) {
    // Pick the least-represented question type (capping pairs, dictation & speak at 2 so sessions stay snappy)
    const prioritizedTypes = [...fillTypes].sort((a, b) => {
      const penA =
        (a === 'pairs' && typeCounts.pairs >= 2) ||
        (a === 'dictation' && typeCounts.dictation >= 2) ||
        (a === 'speak' && typeCounts.speak >= 2)
          ? 10
          : 0;
      const penB =
        (b === 'pairs' && typeCounts.pairs >= 2) ||
        (b === 'dictation' && typeCounts.dictation >= 2) ||
        (b === 'speak' && typeCounts.speak >= 2)
          ? 10
          : 0;
      return typeCounts[a] + penA - (typeCounts[b] + penB);
    });

    let added = false;
    for (const t of prioritizedTypes) {
      if (t === 'speak' && typeCounts.speak >= 2) continue;
      if (t === 'dictation' && typeCounts.dictation >= 2) continue;
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

  return prepareSessionQuestions(ordered.slice(0, effectiveTargetCount), rng);
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
  const disallowBasicAlphabet = Boolean(unit && unit.number > ALPHABET_MAX_UNIT_NUMBER);
  const extraDynamic = unit
    ? generateDynamicUnitQuestions(unit, rng).filter(
        (q) => !(disallowBasicAlphabet && isBasicAlphabetOrHarakatQuestion(q))
      )
    : [];
  const combined = [...basePool, ...shuffleArray(extraDynamic, rng)];

  const difficultyRank = (q: LessonQuestion): number => {
    if (q.type === 'dictation') return 0;
    if (q.type === 'speak') return 1;
    if (q.type === 'wordbank' && q.isArabicWords) return 2;
    if (q.type === 'fill_blank') return 3;
    if (q.type === 'listen') return 4;
    if (q.type === 'mcq' && q.isArabicOption) return 5;
    if (q.type === 'wordbank') return 6;
    if (q.type === 'mcq') return 7;
    return 8;
  };

  const ranked = [...combined].sort((a, b) => difficultyRank(a) - difficultyRank(b));
  const seen = new Set<string>();
  const picked: LessonQuestion[] = [];
  const counts: Record<string, number> = {};
  const maxForType = (t: LessonQuestion['type']): number => {
    if (t === 'dictation' || t === 'speak') return 2;
    return 3;
  };
  for (const q of ranked) {
    if (picked.length >= LEGENDARY_QUESTION_COUNT) break;
    if ((counts[q.type] ?? 0) >= maxForType(q.type)) continue;
    const fp = getQuestionFingerprint(q);
    if (seen.has(fp)) continue;
    seen.add(fp);
    counts[q.type] = (counts[q.type] ?? 0) + 1;
    const clone = JSON.parse(JSON.stringify(q)) as LessonQuestion;
    delete clone.isReview;
    delete clone.isSpacedRepetition;
    picked.push(clone);
  }
  if (picked.length < LEGENDARY_QUESTION_COUNT) {
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

type JumpBucket = 'multiple_choice' | 'translation_tiles' | 'audio_listening' | 'matching_pairs';

function classifyJumpQuestionBucket(q: LessonQuestion): JumpBucket | null {
  if (q.type === 'mcq' || q.type === 'fill_blank') return 'multiple_choice';
  if (q.type === 'wordbank') return 'translation_tiles';
  if (
    q.type === 'listen' ||
    q.type === 'radio_tf' ||
    q.type === 'radio_mcq' ||
    q.type === 'radio_select3'
  ) {
    return 'audio_listening';
  }
  if (q.type === 'pairs' || q.type === 'audio_pairs') return 'matching_pairs';
  return null;
}

export function buildUnitJumpQuestions(
  targetUnitIndex: number,
  units: Unit[] = UNITS,
  count = JUMP_TEST_QUESTION_COUNT
): LessonQuestion[] {
  const maxUnits = Math.min(targetUnitIndex, units.length);
  if (maxUnits <= 0 || count <= 0) return [];

  interface TaggedCandidate {
    unitIndex: number;
    bucket: JumpBucket;
    fp: string;
    question: LessonQuestion;
  }

  const seenGlobal = new Set<string>();
  const buckets: Record<JumpBucket, TaggedCandidate[]> = {
    multiple_choice: [],
    translation_tiles: [],
    audio_listening: [],
    matching_pairs: [],
  };

  const targetUnitNumber = targetUnitIndex + 1;
  const disallowBasicAlphabet = targetUnitNumber > ALPHABET_MAX_UNIT_NUMBER;
  // For Jump-Ahead Entry Tests at Unit N (N >= 6), sample exclusively from Units 5 through N-1.
  // For Unit 5 itself (targetUnitIndex === 4), sample from Units 2-4 (vocabulary/phrases, zero Unit 1 alphabet).
  const startUnitIndex =
    targetUnitNumber >= ALPHABET_MAX_UNIT_NUMBER + 2
      ? ALPHABET_MAX_UNIT_NUMBER
      : targetUnitNumber === ALPHABET_MAX_UNIT_NUMBER + 1
        ? 1
        : 0;

  for (let i = startUnitIndex; i < maxUnits; i++) {
    for (const lesson of units[i].lessons) {
      if (
        lesson.nodeType === 'chest' ||
        lesson.nodeType === 'video_call' ||
        lesson.questions.length === 0
      ) {
        continue;
      }
      for (const q of lesson.questions) {
        if (q.type === 'speak') continue;
        if (disallowBasicAlphabet && isBasicAlphabetOrHarakatQuestion(q)) continue;
        const bucket = classifyJumpQuestionBucket(q);
        if (!bucket) continue;
        const fp = getQuestionFingerprint(q);
        if (seenGlobal.has(fp)) continue;
        seenGlobal.add(fp);
        buckets[bucket].push({ unitIndex: i, bucket, fp, question: q });
      }
    }
  }

  // Spread selections evenly across preceding units (prioritizing distinct units first)
  const pickAcrossUnits = (
    candidates: TaggedCandidate[],
    quota: number,
    usedFps: Set<string>,
    preferPredicate?: (q: LessonQuestion) => boolean
  ): LessonQuestion[] => {
    if (quota <= 0 || candidates.length === 0) return [];
    const byUnit = new Map<number, TaggedCandidate[]>();
    for (const c of shuffleArray(candidates)) {
      if (usedFps.has(c.fp)) continue;
      const list = byUnit.get(c.unitIndex) ?? [];
      list.push(c);
      byUnit.set(c.unitIndex, list);
    }

    const picked: LessonQuestion[] = [];
    const unitOrder = shuffleArray(Array.from(byUnit.keys()));

    // Optional first pass to ensure grammar/particle fill_blank or primary listening items are represented
    if (preferPredicate) {
      const preferLimit = Math.min(2, Math.max(1, Math.floor(quota / 2)));
      for (const uIdx of unitOrder) {
        if (picked.length >= preferLimit) break;
        const list = byUnit.get(uIdx);
        if (!list) continue;
        const matchIdx = list.findIndex((c) => !usedFps.has(c.fp) && preferPredicate(c.question));
        if (matchIdx !== -1) {
          const [chosen] = list.splice(matchIdx, 1);
          usedFps.add(chosen.fp);
          picked.push(chosen.question);
        }
      }
    }

    // Round-robin across distinct preceding units so vocabulary, verbs, particles & sentences span prior units
    let progress = true;
    while (picked.length < quota && progress) {
      progress = false;
      for (const uIdx of unitOrder) {
        if (picked.length >= quota) break;
        const list = byUnit.get(uIdx);
        if (!list || list.length === 0) continue;
        const next = list.shift();
        if (next && !usedFps.has(next.fp)) {
          usedFps.add(next.fp);
          picked.push(next.question);
          progress = true;
        }
      }
    }

    return picked;
  };

  // Balanced 15-question mix: 5 multiple choice (vocab/verbs/particles), 4 translation tiles (wordbank),
  // 4 audio listening, 2 matching pairs (scales cleanly for custom counts)
  const mcQuota = count === 15 ? 5 : Math.max(1, Math.round(count * 0.34));
  const wbQuota = count === 15 ? 4 : Math.max(1, Math.round(count * 0.27));
  const audioQuota = count === 15 ? 4 : Math.max(1, Math.round(count * 0.26));
  const pairsQuota = Math.max(1, count - mcQuota - wbQuota - audioQuota);

  const usedFps = new Set<string>();
  const selected: LessonQuestion[] = [
    ...pickAcrossUnits(buckets.multiple_choice, mcQuota, usedFps, (q) => q.type === 'fill_blank'),
    ...pickAcrossUnits(buckets.translation_tiles, wbQuota, usedFps),
    ...pickAcrossUnits(buckets.audio_listening, audioQuota, usedFps, (q) => q.type === 'listen'),
    ...pickAcrossUnits(buckets.matching_pairs, pairsQuota, usedFps),
  ];

  // Top up from any remaining unused candidates across all buckets if a single bucket had fewer unique items (e.g., Unit 2)
  if (selected.length < count) {
    const remaining = [
      ...buckets.multiple_choice,
      ...buckets.audio_listening,
      ...buckets.translation_tiles,
      ...buckets.matching_pairs,
    ].filter((c) => !usedFps.has(c.fp));
    selected.push(...pickAcrossUnits(remaining, count - selected.length, usedFps));
  }

  // Shuffle final order and avoid placing two matching pairs back-to-back
  const ordered = shuffleArray(selected.slice(0, count));
  for (let i = 1; i < ordered.length; i++) {
    if (isPairsQuestion(ordered[i]) && isPairsQuestion(ordered[i - 1])) {
      const swapIdx = ordered.findIndex(
        (q, idx) =>
          !isPairsQuestion(q) &&
          (idx === 0 || !isPairsQuestion(ordered[idx - 1])) &&
          (idx === ordered.length - 1 || !isPairsQuestion(ordered[idx + 1]))
      );
      if (swapIdx !== -1) {
        [ordered[i], ordered[swapIdx]] = [ordered[swapIdx], ordered[i]];
      }
    }
  }

  return prepareSessionQuestions(ordered);
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

/**
 * Returns the lesson ID that auto-scroll and the floating "Jump to Current Lesson"
 * button should target: the first incomplete lesson node, or the final capstone node
 * once all 280 nodes have been completed.
 */
export function getActiveNodeTargetId(
  completedLessons: string[],
  units: Unit[] = UNITS
): string | null {
  const next = getNextActiveLesson(completedLessons, units);
  if (next) return next.lesson.id;
  const lastUnit = units[units.length - 1];
  const lastLesson = lastUnit?.lessons[lastUnit.lessons.length - 1];
  return lastLesson ? lastLesson.id : null;
}

export interface UnitScrollRect {
  unitIndex: number;
  top: number;
  bottom: number;
}

/**
 * Determines which unit index should be displayed in the sticky Unit Banner
 * given each unit section's viewport-relative vertical bounds and a sticky anchor line.
 */
export function computeVisibleUnitIndex(
  unitRects: UnitScrollRect[],
  anchorY = 140
): number {
  if (!unitRects || unitRects.length === 0) return 0;

  let activeIdx = unitRects[0].unitIndex;
  for (const rect of unitRects) {
    if (rect.top <= anchorY) {
      activeIdx = rect.unitIndex;
    } else {
      break;
    }
  }
  return activeIdx;
}

export type JumpButtonDirection = 'up' | 'down' | null;

/**
 * Computes whether the floating "Jump to Current Lesson" button should be shown
 * and which direction ('up' or 'down') the active node lies relative to the viewport.
 */
export function computeJumpButtonDirection(
  activeRect: { top: number; bottom: number } | null,
  viewportHeight: number,
  topOffset = 120,
  bottomOffset = 92
): JumpButtonDirection {
  if (!activeRect || viewportHeight <= 0) return null;
  if (activeRect.bottom < topOffset) return 'up';
  if (activeRect.top > viewportHeight - bottomOffset) return 'down';
  return null;
}

export const VALID_APP_TABS: readonly AppTab[] = ['path', 'alphabet', 'grammar', 'leaderboard', 'profile'];

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Resolves the active unit ID (e.g. 'u1'..'u35') from completedLessons,
 * falling back to 'u1' or the last unit when all nodes are finished.
 */
export function resolveCurrentUnitId(
  completedLessons: string[],
  units: Unit[] = UNITS
): string {
  const activeNodeId = getActiveNodeTargetId(completedLessons, units);
  if (activeNodeId) {
    const unit = units.find((u) => u.lessons.some((l) => l.id === activeNodeId));
    if (unit) return unit.id;
  }
  return units[0]?.id ?? 'u1';
}

export function normalizeAppTab(tab: unknown): AppTab {
  return VALID_APP_TABS.includes(tab as AppTab) ? (tab as AppTab) : 'path';
}

/**
 * Synchronously persists user progress, XP, streak, hearts, activeTab, and currentUnitId
 * to localStorage the exact instant a state change happens.
 */
export function persistUserStateSync(
  storage: StorageLike | null | undefined,
  storageKey: string,
  state: UserState,
  units: Unit[] = UNITS
): UserState {
  const normalized: UserState = {
    ...state,
    activeTab: normalizeAppTab(state.activeTab),
    currentUnitId: state.currentUnitId || resolveCurrentUnitId(state.completedLessons, units),
  };
  if (storage) {
    try {
      storage.setItem(storageKey, JSON.stringify(normalized));
    } catch {
      // Ignore storage quota / private mode errors
    }
  }
  return normalized;
}

/**
 * Synchronously hydrates persisted user state before UI render, migrating legacy IDs,
 * preserving activeTab & currentUnitId, and updating daily streak safely.
 */
export function hydratePersistedUserState(
  storage: StorageLike | null | undefined,
  storageKey: string,
  fallback: UserState,
  options: { autostart?: boolean; now?: Date; units?: Unit[] } = {}
): UserState {
  const units = options.units ?? UNITS;
  const autostart = Boolean(options.autostart);
  const now = options.now ?? new Date();

  const defaultState: UserState = {
    ...fallback,
    activeTab: normalizeAppTab(fallback.activeTab),
    currentUnitId: fallback.currentUnitId || resolveCurrentUnitId(fallback.completedLessons, units),
  };

  if (!storage) return defaultState;

  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<UserState>;
    const completedLessons = migrateLegacyCompletedIds(parsed.completedLessons ?? [], units);
    const legendaryLessons = Array.isArray(parsed.legendaryLessons)
      ? Array.from(new Set(parsed.legendaryLessons))
      : [];
    const validUnitIds = new Set(units.map((u) => u.id));
    const resolvedUnitId =
      typeof parsed.currentUnitId === 'string' && validUnitIds.has(parsed.currentUnitId)
        ? parsed.currentUnitId
        : resolveCurrentUnitId(completedLessons, units);

    let merged: UserState = {
      ...defaultState,
      ...parsed,
      completedLessons,
      legendaryLessons,
      activeTab: normalizeAppTab(parsed.activeTab),
      currentUnitId: resolvedUnitId,
      onboarded: Boolean(parsed.onboarded && parsed.name) || autostart,
      name: parsed.name || (autostart ? 'അഹമ്മദ്' : ''),
    };

    const streakCheck = computeStreakUpdate(merged, now);
    if (streakCheck.changed) {
      merged = {
        ...merged,
        streak: streakCheck.streak,
        hearts: streakCheck.hearts,
        lastActiveDate: streakCheck.lastActiveDate,
      };
      persistUserStateSync(storage, storageKey, merged, units);
    }
    return merged;
  } catch {
    return defaultState;
  }
}

/**
 * Monotonically merges Firestore cloud progress into local state so a slower cloud
 * snapshot can never reset or regress locally completed lessons, XP, streak, or activeTab.
 */
export function mergeCloudUserState(
  local: UserState,
  cloud: Partial<UserState>,
  units: Unit[] = UNITS
): { state: UserState; changed: boolean } {
  const cloudCompleted = migrateLegacyCompletedIds(cloud.completedLessons ?? [], units);
  const mergedCompleted = Array.from(new Set([...local.completedLessons, ...cloudCompleted]));
  const cloudLegendary = Array.isArray(cloud.legendaryLessons) ? cloud.legendaryLessons : [];
  const mergedLegendary = Array.from(
    new Set([...(local.legendaryLessons ?? []), ...cloudLegendary])
  );
  const nextXp = Math.max(Number(local.xp) || 0, Number(cloud.xp) || 0);
  const nextStreak = Math.max(Number(local.streak) || 1, Number(cloud.streak) || 1);
  const nextCurrentUnitId = resolveCurrentUnitId(mergedCompleted, units);

  const changed =
    mergedCompleted.length > local.completedLessons.length ||
    mergedLegendary.length > (local.legendaryLessons ?? []).length ||
    nextXp !== local.xp ||
    nextStreak !== local.streak;

  if (!changed) {
    return { state: local, changed: false };
  }

  return {
    changed: true,
    state: {
      ...local,
      completedLessons: mergedCompleted,
      legendaryLessons: mergedLegendary,
      xp: nextXp,
      streak: nextStreak,
      name: local.name || cloud.name || '',
      avatar: local.avatar || cloud.avatar || '🧕',
      currentUnitId: nextCurrentUnitId,
    },
  };
}

/**
 * Counts meaningful spoken Arabic words in a Video Call turn transcript.
 */
export function countSpokenArabicWords(text: string): number {
  const normalized = normalizeArabicSpeech(text);
  if (!normalized) return 0;
  return normalized
    .split(/\s+/)
    .filter((token) => /[\u0621-\u064A]/.test(token))
    .length;
}

/**
 * Computes proportional Video Call XP: "Use more words, get more XP!"
 * Base 15 XP + 2 XP per spoken Arabic word (capped at +35 bonus XP -> 50 XP max).
 */
export function calculateVideoCallXp(totalSpokenWords: number): {
  baseXp: number;
  bonusXp: number;
  totalXp: number;
  spokenWords: number;
} {
  const safeWords = Math.max(0, Math.floor(Number(totalSpokenWords) || 0));
  const bonusXp = Math.min(VIDEO_CALL_MAX_BONUS_XP, safeWords * VIDEO_CALL_XP_PER_WORD);
  return {
    baseXp: VIDEO_CALL_BASE_XP,
    bonusXp,
    totalXp: VIDEO_CALL_BASE_XP + bonusXp,
    spokenWords: safeWords,
  };
}

/**
 * Collects unique Arabic lines from a Video Call scenario for audio preloading.
 */
export function collectVideoCallArabicTexts(scenario: VideoCallScenario): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (text?: string) => {
    const t = String(text ?? '').trim();
    if (!t || !/[\u0600-\u06FF]/.test(t) || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const turn of scenario.turns) {
    add(turn.characterAr);
    add(turn.reactionAr);
  }
  return out;
}



