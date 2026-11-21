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
}

export interface PairsQuestion {
  type: 'pairs';
  prompt: string;
  pairs: PairItem[];
}

export type LessonQuestion =
  | McqQuestion
  | ListenQuestion
  | WordBankQuestion
  | PairsQuestion;

export interface Lesson {
  id: string;
  title: string;
  icon: string;
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
