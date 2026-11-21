export type VowelMode = 'base' | 'fatha' | 'kasra' | 'damma' | 'tanween';

export interface ArabicLetter {
  base: string;
  name: string;
  fatha: string;
  fathaTr: string;
  kasra: string;
  kasraTr: string;
  damma: string;
  dammaTr: string;
  tanween: string;
  tanweenTr: string;
}

export interface PairItem {
  ar: string;
  ml: string;
  tr?: string;
}

export interface McqQuestion {
  type: 'mcq';
  prompt: string;
  arabic?: string;
  translit?: string;
  options: string[];
  isArabicOption?: boolean;
  optionTranslits?: Record<string, string>;
  answer: string;
  isReview?: boolean;
  isSpacedRepetition?: boolean;
}

export interface ListenQuestion {
  type: 'listen';
  prompt: string;
  arabic: string;
  translit?: string;
  options: string[];
  isArabicOption?: boolean;
  optionTranslits?: Record<string, string>;
  answer: string;
  isReview?: boolean;
  isSpacedRepetition?: boolean;
}

export interface WordBankQuestion {
  type: 'wordbank';
  prompt: string;
  arabic?: string;
  translit?: string;
  words: string[];
  isArabicWords?: boolean;
  wordTranslits?: Record<string, string>;
  answer: string[];
  isReview?: boolean;
  isSpacedRepetition?: boolean;
}

export interface PairsQuestion {
  type: 'pairs';
  prompt: string;
  pairs: PairItem[];
  isReview?: boolean;
  isSpacedRepetition?: boolean;
}

export interface FillBlankQuestion {
  type: 'fill_blank';
  prompt: string;
  sentence: string;
  hintMl: string;
  avatar?: '🦉' | '👳‍♂️';
  options: string[];
  optionTranslits?: Record<string, string>;
  answer: string;
  isReview?: boolean;
  isSpacedRepetition?: boolean;
}

export type LessonQuestion =
  | McqQuestion
  | ListenQuestion
  | WordBankQuestion
  | PairsQuestion
  | FillBlankQuestion;

export type NodeKind =
  | 'lesson'
  | 'practice'
  | 'wordbank'
  | 'chest'
  | 'dialogue'
  | 'listening'
  | 'hard'
  | 'trophy';

export interface GuidebookEntry {
  ar: string;
  tr: string;
  ml: string;
}

export interface UnitMascot {
  kind: 'owl' | 'lantern' | 'crescent' | 'book' | 'compass' | 'tea';
  greetingAr: string;
  greetingTr: string;
  greetingMl: string;
}

export interface Lesson {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  nodeType?: NodeKind;
  xpReward?: number;
  heartReward?: number;
  questions: LessonQuestion[];
}

export interface UnitTheme {
  bg: string;
  border: string;
  ring: string;
  text: string;
  softBg: string;
  softBorder: string;
}

export interface Unit {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  theme: UnitTheme;
  guidebookTip?: string;
  guidebook?: GuidebookEntry[];
  mascot?: UnitMascot;
  lessons: Lesson[];
}

export type AppTab = 'path' | 'alphabet' | 'leaderboard' | 'profile';

export interface UserState {
  id: string;
  name: string;
  avatar: string;
  xp: number;
  streak: number;
  hearts: number;
  completedLessons: string[];
  lastActiveDate: string;
  soundEnabled: boolean;
  onboarded: boolean;
}

export type SessionMode = 'lesson' | 'placement' | 'jump';

export interface SessionConfig {
  mode: SessionMode;
  lessonId: string | null;
  lessonTitle?: string;
  targetUnitIndex: number | null;
  bannerText: string | null;
  questions: LessonQuestion[];
  initialHearts: number;
}

export interface SessionResult {
  mode: SessionMode;
  lessonId: string | null;
  targetUnitIndex: number | null;
  score: number;
  totalQuestions: number;
  earnedXp: number;
  unlockedUpToUnitIndex: number | null;
  title: string;
  subtitle: string;
  emoji: string;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar: string;
  xp: number;
  streak: number;
  lessonsCount: number;
  isCurrentUser?: boolean;
}
