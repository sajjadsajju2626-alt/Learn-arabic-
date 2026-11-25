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

export interface AudioPairsQuestion {
  type: 'audio_pairs';
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

export interface RadioPodcastMeta {
  /** Spoken Arabic clip played by the audio engine (vocalized with Harakat) */
  arabic: string;
  /** Malayalam phonetic transliteration (shown only inside Post-Check Transcript Reveal) */
  translit: string;
  /** Vocalized Arabic written transcript (revealed only after Check) */
  transcriptAr: string;
  /** Malayalam translation of the clip (revealed only after Check) */
  transcriptMl: string;
  /** Caller / guest avatar in the studio speech bubble */
  callerAvatar?: '🧕' | '🧔';
  /** Caller / guest Malayalam name */
  callerNameMl?: string;
  /** Arabic show header label */
  episodeTitleAr?: string;
}

export interface RadioTfQuestion extends RadioPodcastMeta {
  type: 'radio_tf';
  prompt: string;
  /** Malayalam statement evaluated as True (✔️ ശരി) or False (✖️ തെറ്റ്) */
  statementMl: string;
  answer: boolean;
  isReview?: boolean;
  isSpacedRepetition?: boolean;
}

export interface RadioSelect3Question extends RadioPodcastMeta {
  type: 'radio_select3';
  prompt: string;
  /** 5 shuffled vocalized Arabic word chips (3 spoken in audio + 2 distractors) */
  words: string[];
  /** Exact 3 vocalized Arabic words spoken in the audio clip */
  answers: string[];
  wordTranslits?: Record<string, string>;
  isReview?: boolean;
  isSpacedRepetition?: boolean;
}

export interface RadioMcqQuestion extends RadioPodcastMeta {
  type: 'radio_mcq';
  prompt: string;
  /** 3 vertically stacked Malayalam choice buttons (Fisher-Yates shuffled) */
  options: string[];
  answer: string;
  isReview?: boolean;
  isSpacedRepetition?: boolean;
}

export interface DictationQuestion {
  type: 'dictation';
  prompt: string;
  /** Vocalized Arabic word or short phrase spoken by the audio engine (hidden until Check) */
  arabic: string;
  /** Malayalam phonetic transliteration (revealed only after Check, hidden in Legendary) */
  translit?: string;
  /** Malayalam meaning revealed below the vocalized Arabic after Check */
  meaningMl: string;
  /** Friendly Arabic character avatar alongside the audio capsule */
  avatar?: '🧕' | '👳‍♂️';
  isReview?: boolean;
  isSpacedRepetition?: boolean;
}

export interface SpeakQuestion {
  type: 'speak';
  prompt: string;
  /** Vocalized Arabic phrase or sentence to read aloud */
  arabic: string;
  /** Malayalam phonetic transliteration (hidden in Legendary zero-hint mode) */
  translit?: string;
  /** Malayalam meaning displayed inside the speech bubble */
  meaningMl: string;
  /** Friendly Arabic character avatar beside the speech bubble */
  avatar?: '🧕' | '👳‍♂️';
  isReview?: boolean;
  isSpacedRepetition?: boolean;
}

export type LessonQuestion =
  | McqQuestion
  | ListenQuestion
  | WordBankQuestion
  | PairsQuestion
  | AudioPairsQuestion
  | FillBlankQuestion
  | RadioTfQuestion
  | RadioSelect3Question
  | RadioMcqQuestion
  | DictationQuestion
  | SpeakQuestion;

export type NodeKind =
  | 'lesson'
  | 'practice'
  | 'wordbank'
  | 'chest'
  | 'story'
  | 'dialogue'
  | 'listening'
  | 'video_call'
  | 'hard'
  | 'trophy';

export interface VideoCallReplySuggestion {
  ar: string;
  tr: string;
  ml: string;
}

export interface VideoCallTurn {
  /** Contextual vocalized Arabic prompt spoken by Tariq or Layla */
  characterAr: string;
  /** Malayalam transliteration shown when subtitles are toggled on */
  characterTr: string;
  /** Malayalam meaning shown when subtitles are toggled on */
  characterMl: string;
  /** Warm vocalized Arabic reaction after the user responds */
  reactionAr: string;
  /** Suggested Arabic replies (from short to full sentence) for optional guidance / WebView fallback */
  suggestedReplies: VideoCallReplySuggestion[];
}

export interface VideoCallScenario {
  id: string;
  unitNumber: number;
  characterKey: 'tariq' | 'layla';
  characterNameEn: string;
  characterNameMl: string;
  characterNameAr: string;
  characterAvatar: '👳‍♂️' | '🧕';
  sceneTitleMl: string;
  sceneSettingMl: string;
  backdropImage: string;
  turns: VideoCallTurn[];
}

export interface StoryCharacter {
  nameAr: string;
  nameMl: string;
  avatar: string;
}

export interface StoryDialogueLine {
  kind: 'line';
  speaker: 0 | 1;
  ar: string;
  tr: string;
  ml: string;
}

export interface StoryCheckStep {
  kind: 'check';
  checkType: 'mcq' | 'fill_blank';
  prompt: string;
  sentence?: string;
  hintMl?: string;
  options: string[];
  isArabicOption?: boolean;
  optionTranslits?: Record<string, string>;
  answer: string;
}

export type StoryStep = StoryDialogueLine | StoryCheckStep;

export interface UnitStory {
  id: string;
  titleMl: string;
  titleAr: string;
  titleTr: string;
  emoji: string;
  settingMl: string;
  characters: [StoryCharacter, StoryCharacter];
  steps: StoryStep[];
}

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
  story?: UnitStory;
  videoCall?: VideoCallScenario;
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

export type AppTab = 'path' | 'alphabet' | 'grammar' | 'leaderboard' | 'profile';

export interface UserState {
  id: string;
  name: string;
  avatar: string;
  xp: number;
  streak: number;
  hearts: number;
  completedLessons: string[];
  legendaryLessons?: string[];
  lastActiveDate: string;
  soundEnabled: boolean;
  onboarded: boolean;
  activeTab?: AppTab;
  currentUnitId?: string;
}

export type SessionMode = 'lesson' | 'placement' | 'jump';
export type SessionVariant = 'standard' | 'review' | 'legendary' | 'story' | 'video_call';

export interface SessionConfig {
  mode: SessionMode;
  variant?: SessionVariant;
  lessonId: string | null;
  lessonTitle?: string;
  targetUnitIndex: number | null;
  bannerText: string | null;
  questions: LessonQuestion[];
  initialHearts: number;
  xpReward?: number;
  hideTranslit?: boolean;
}

export interface SessionResult {
  mode: SessionMode;
  variant?: SessionVariant;
  lessonId: string | null;
  targetUnitIndex: number | null;
  score: number;
  totalQuestions: number;
  earnedXp: number;
  unlockedUpToUnitIndex: number | null;
  markLegendary?: boolean;
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
