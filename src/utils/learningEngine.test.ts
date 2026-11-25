import test from 'node:test';
import assert from 'node:assert/strict';
import { ARABIC_ALPHABET, PLACEMENT_QUESTIONS, UNITS } from '../data/curriculum';
import { UNIT_STORIES } from '../data/unitStories';
import {
  TARIQ_OPENING_GREETING_AR,
  UNIT_VIDEO_CALLS,
  VIDEO_CALL_NODE_TITLE_ML,
} from '../data/unitVideoCalls';
import {
  buildFutureConjugation,
  buildPassiveConjugation,
  computeVerbUnitMastery,
  filterVerbEntries,
  getImperativeConjugation,
  PRONOUN_ROWS,
  TENSE_FORMULAS,
  VERB_CONJUGATIONS,
} from '../data/verbConjugations';
import {
  canUseServerGeminiEndpoint,
  detectArabicIntent,
  generateSmartArabicReply,
  mergeSpeechTranscripts,
  stripQuotedEcho,
} from './videoCallConversation';
import {
  ALPHABET_MAX_UNIT_NUMBER,
  ALL_QUESTION_TYPES,
  applySessionResult,
  ARABIC_QUICK_KEYS,
  areDictationAnswersEqual,
  areRadioSelect3AnswersEqual,
  areWordBankAnswersEqual,
  buildFilledSentence,
  buildLegendarySessionQuestions,
  buildLessonSessionQuestions,
  buildReviewSessionQuestions,
  buildUnitJumpQuestions,
  calculateVideoCallXp,
  claimTreasureChest,
  collectStoryArabicTexts,
  collectVideoCallArabicTexts,
  computeJumpButtonDirection,
  computeStreakUpdate,
  computeVisibleUnitIndex,
  countSpokenArabicWords,
  enqueueMistakeForReview,
  evaluateQuestionAnswer,
  evaluateSessionOutcome,
  evaluateSpeechMatch,
  evaluateStoryCheckAnswer,
  fisherYatesShuffle,
  getActiveNodeTargetId,
  getAllLessonIds,
  getLetterDisplay,
  getQuestionFingerprint,
  getUnitNumberFromLessonId,
  hydratePersistedUserState,
  isBasicAlphabetOrHarakatQuestion,
  isLessonUnlocked,
  isPairsQuestion,
  isPodcastQuestion,
  isUnitUnlocked,
  JUMP_TEST_HEARTS,
  JUMP_TEST_PASS_SCORE,
  JUMP_TEST_QUESTION_COUNT,
  LEGENDARY_HEARTS,
  LEGENDARY_QUESTION_COUNT,
  LEGENDARY_XP_REWARD,
  mergeAndSortLeaderboard,
  mergeCloudUserState,
  migrateLegacyCompletedIds,
  MISTAKE_REVIEW_BANNER_TEXT,
  normalizeAppTab,
  normalizeArabicDictation,
  normalizeArabicSpeech,
  normalizeWordBankText,
  persistUserStateSync,
  prepareSessionQuestions,
  prepareStorySteps,
  resolveCurrentUnitId,
  resolvePairTapSelection,
  REVIEW_QUESTION_COUNT,
  REVIEW_XP_REWARD,
  shouldShowArabicPromptCard,
  shuffleArray,
  SPEAK_MATCH_THRESHOLD,
  SPEAK_MIN_UNIT_NUMBER,
  STORY_XP_REWARD,
  unlockLessonsUpToUnit,
  VIDEO_CALL_BASE_XP,
  VIDEO_CALL_MAX_BONUS_XP,
  VIDEO_CALL_MIN_UNIT_NUMBER,
  VIDEO_CALL_XP_PER_WORD,
} from './learningEngine';
import {
  audioCache,
  BUFFER_TIMEOUT_MS,
  buildArabicAudioSources,
  buildArabicTtsUrl,
  buildHamedNeuralTtsUrl,
  clearArabicAudioCache,
  collectQuestionArabicTexts,
  formatForArabicTTS,
  getArabicLetterAudioUrl,
  getDuaAudioUrl,
  isHamedNeuralVoice,
  isPremiumNeuralArabicVoice,
  normalizeDuaLookupKey,
  preloadArabicAudio,
  PRIMARY_ARABIC_VOICE_ID,
  PRIMARY_ARABIC_VOICE_LABEL,
  resolveArabicPlaybackRate,
  selectBestArabicVoice,
} from './audio';
import type { LessonQuestion, UserState } from '../types/learning';

const baseUser: UserState = {
  id: 'user_local',
  name: 'അഹമ്മദ്',
  avatar: '👳‍♂️',
  xp: 0,
  streak: 1,
  hearts: 5,
  completedLessons: [],
  lastActiveDate: 'Fri Nov 20 2026',
  soundEnabled: true,
  onboarded: true,
};

test('curriculum contains 35 units and 301 winding nodes (8 per unit in Units 1-14, 9 with Video Call in Units 15-35) with 28 Arabic letters', () => {
  assert.equal(UNITS.length, 35);
  assert.equal(getAllLessonIds().length, 301);
  assert.equal(ARABIC_ALPHABET.length, 28);

  const expectedIcons8 = ['⭐', '📖', '🧩', '🎁', '📖', '🎧', '⚡', '🏆'];
  const expectedTypes8 = ['lesson', 'practice', 'wordbank', 'chest', 'story', 'listening', 'hard', 'trophy'];
  const expectedIcons9 = ['⭐', '📖', '🧩', '🎁', '📖', '🎧', '📹', '⚡', '🏆'];
  const expectedTypes9 = ['lesson', 'practice', 'wordbank', 'chest', 'story', 'listening', 'video_call', 'hard', 'trophy'];

  for (const unit of UNITS) {
    const hasVideoCall = unit.number >= VIDEO_CALL_MIN_UNIT_NUMBER;
    const expectedIcons = hasVideoCall ? expectedIcons9 : expectedIcons8;
    const expectedTypes = hasVideoCall ? expectedTypes9 : expectedTypes8;

    assert.equal(
      unit.lessons.length,
      hasVideoCall ? 9 : 8,
      `${unit.id} must have ${hasVideoCall ? 9 : 8} nodes`
    );
    assert.ok(unit.guidebook && unit.guidebook.length >= 8, `${unit.id} must have >= 8 guidebook entries`);
    assert.ok(unit.guidebookTip && unit.guidebookTip.length > 0, `${unit.id} must have a guidebook tip`);
    unit.lessons.forEach((node, idx) => {
      assert.equal(node.icon, expectedIcons[idx], `${node.id} icon mismatch`);
      assert.equal(node.nodeType, expectedTypes[idx], `${node.id} nodeType mismatch`);
      if (node.nodeType === 'chest') {
        assert.equal(node.xpReward, 25);
        assert.equal(node.heartReward, 1);
        assert.equal(node.questions.length, 0);
      } else if (node.nodeType === 'video_call') {
        assert.equal(node.id, `${unit.id}_vc`);
        assert.equal(node.questions.length, 0);
        assert.ok(node.videoCall, `${node.id} must attach a VideoCallScenario`);
      } else {
        assert.ok(node.questions.length >= 3, `${node.id} must have interactive questions`);
      }
    });
  }
});

test('Units 5 to 35 quiz nodes have Harakat, Malayalam transliteration, and mixed question types', () => {
  const advanced = UNITS.slice(4);
  assert.equal(advanced.length, 31);
  for (const unit of advanced) {
    assert.equal(unit.lessons.length, unit.number >= VIDEO_CALL_MIN_UNIT_NUMBER ? 9 : 8);
    for (const lesson of unit.lessons) {
      if (lesson.nodeType === 'chest' || lesson.nodeType === 'video_call') continue;
      assert.ok(lesson.questions.length >= 4, `${lesson.id} should have at least 4 questions`);
      for (const q of lesson.questions) {
        if ('arabic' in q && q.arabic) {
          assert.ok(q.translit && q.translit.length > 0, `${lesson.id} arabic prompt needs translit`);
        }
        if (q.type === 'pairs') {
          for (const pair of q.pairs) {
            assert.ok(pair.tr && pair.tr.length > 0, `${lesson.id} pair item needs Malayalam translit`);
          }
        }
        if ((q.type === 'mcq' || q.type === 'listen') && q.isArabicOption) {
          assert.ok(q.optionTranslits, `${lesson.id} Arabic MCQ needs optionTranslits`);
          for (const opt of q.options) {
            assert.ok(q.optionTranslits[opt], `${lesson.id} missing translit for option ${opt}`);
          }
        }
        if (q.type === 'wordbank' && q.isArabicWords) {
          assert.ok(q.wordTranslits, `${lesson.id} Arabic wordbank needs wordTranslits`);
          for (const w of q.words) {
            assert.ok(q.wordTranslits[w], `${lesson.id} missing translit for word ${w}`);
          }
        }
      }
    }
  }
});

test('lesson, treasure chest, and unit unlocking progresses sequentially across all 8 nodes', () => {
  assert.equal(isLessonUnlocked('u1_n1', []), true);
  assert.equal(isLessonUnlocked('u1_n2', []), false);
  assert.equal(isUnitUnlocked(0, []), true);
  assert.equal(isUnitUnlocked(1, []), false);

  assert.equal(isLessonUnlocked('u1_n2', ['u1_n1']), true);
  const allUnit1 = UNITS[0].lessons.map((l) => l.id);
  assert.equal(isUnitUnlocked(1, allUnit1.slice(0, 7)), false);
  assert.equal(isUnitUnlocked(1, allUnit1), true);

  // Claiming Node 4 Treasure Chest awards +25 XP and +1 Heart, unlocks Node 5, and is idempotent
  const afterChest = claimTreasureChest(
    { ...baseUser, xp: 45, hearts: 4, completedLessons: ['u1_n1', 'u1_n2', 'u1_n3'] },
    'u1_n4'
  );
  assert.equal(afterChest.alreadyClaimed, false);
  assert.equal(afterChest.earnedXp, 25);
  assert.equal(afterChest.earnedHearts, 1);
  assert.equal(afterChest.user.xp, 70);
  assert.equal(afterChest.user.hearts, 5);
  assert.equal(isLessonUnlocked('u1_n5', afterChest.user.completedLessons), true);

  const repeatChest = claimTreasureChest(afterChest.user, 'u1_n4');
  assert.equal(repeatChest.alreadyClaimed, true);
  assert.equal(repeatChest.user.xp, 70);
  assert.equal(repeatChest.user.hearts, 5);

  // Legacy lesson ID migration
  assert.deepEqual(migrateLegacyCompletedIds(['u1_l1', 'u1_l2', 'u2_n1']), ['u1_n1', 'u1_n2', 'u2_n1']);
});

test('unlockLessonsUpToUnit marks all 8 nodes of every preceding unit complete', () => {
  const unlocked = unlockLessonsUpToUnit([], 4);
  assert.equal(unlocked.length, 32);
  assert.equal(isUnitUnlocked(4, unlocked), true);
  assert.equal(isUnitUnlocked(5, unlocked), false);
});

test('getLetterDisplay returns accurate Arabic glyph and Malayalam transliteration for all vowel modes', () => {
  const ba = ARABIC_ALPHABET[1];
  assert.deepEqual(getLetterDisplay(ba, 'base'), { arabic: 'ب', translit: 'ബാ' });
  assert.deepEqual(getLetterDisplay(ba, 'fatha'), { arabic: 'بَ', translit: 'ബ' });
  assert.deepEqual(getLetterDisplay(ba, 'kasra'), { arabic: 'بِ', translit: 'ബി' });
  assert.deepEqual(getLetterDisplay(ba, 'damma'), { arabic: 'بُ', translit: 'ബു' });
  assert.deepEqual(getLetterDisplay(ba, 'tanween'), { arabic: 'بًا', translit: 'ബൻ' });
});

test('evaluateQuestionAnswer checks MCQ and order-sensitive wordbank accurately', () => {
  const mcq = UNITS[0].lessons[0].questions[0];
  assert.equal(evaluateQuestionAnswer(mcq, 'ബാ (Ba)', []).correct, true);
  assert.equal(evaluateQuestionAnswer(mcq, 'താ (Ta)', []).correct, false);

  const wb = UNITS[0].lessons[1].questions[4];
  assert.equal(evaluateQuestionAnswer(wb, null, ['ക', 'ത', 'ബ']).correct, true);
  assert.equal(evaluateQuestionAnswer(wb, null, ['ത', 'ക', 'ബ']).correct, false);
});

test('placement test outcome unlocks up to Unit 5 for 7-8/8 and Unit 3 for 4-6/8', () => {
  const high = evaluateSessionOutcome({
    mode: 'placement',
    lessonId: null,
    targetUnitIndex: null,
    score: 7,
    totalQuestions: 8,
  });
  assert.equal(high.earnedXp, 120);
  assert.equal(high.unlockedUpToUnitIndex, 4);

  const mid = evaluateSessionOutcome({
    mode: 'placement',
    lessonId: null,
    targetUnitIndex: null,
    score: 5,
    totalQuestions: 8,
  });
  assert.equal(mid.earnedXp, 50);
  assert.equal(mid.unlockedUpToUnitIndex, 2);

  const low = evaluateSessionOutcome({
    mode: 'placement',
    lessonId: null,
    targetUnitIndex: null,
    score: 2,
    totalQuestions: 8,
  });
  assert.equal(low.earnedXp, 10);
  assert.equal(low.unlockedUpToUnitIndex, null);

  const updated = applySessionResult(baseUser, high);
  assert.equal(updated.xp, 120);
  assert.equal(updated.completedLessons.length, 32);
  assert.equal(isUnitUnlocked(4, updated.completedLessons), true);
  assert.equal(isUnitUnlocked(5, updated.completedLessons), false);
});

test('unit jump test requires 12/15 (80%) to unlock target unit with 3 hearts', () => {
  assert.equal(JUMP_TEST_QUESTION_COUNT, 15);
  assert.equal(JUMP_TEST_PASS_SCORE, 12);
  assert.equal(JUMP_TEST_HEARTS, 3);

  const pass = evaluateSessionOutcome({
    mode: 'jump',
    lessonId: null,
    targetUnitIndex: 2,
    score: 12,
    totalQuestions: 15,
  });
  assert.equal(pass.earnedXp, 40);
  assert.equal(pass.unlockedUpToUnitIndex, 2);
  assert.ok(pass.subtitle.includes('15-ൽ 12 ശരി'));

  const perfect = evaluateSessionOutcome({
    mode: 'jump',
    lessonId: null,
    targetUnitIndex: 14,
    score: 15,
    totalQuestions: 15,
  });
  assert.equal(perfect.earnedXp, 40);
  assert.equal(perfect.unlockedUpToUnitIndex, 14);

  const fail = evaluateSessionOutcome({
    mode: 'jump',
    lessonId: null,
    targetUnitIndex: 2,
    score: 11,
    totalQuestions: 15,
  });
  assert.equal(fail.earnedXp, 5);
  assert.equal(fail.unlockedUpToUnitIndex, null);
  assert.ok(fail.subtitle.includes('15-ൽ 12 ശരിയുത്തരം ആവശ്യമാണ്'));
});

test('buildUnitJumpQuestions selects 15 unique varied questions mixing multiple choice, translation tiles, audio listening, and matching pairs from preceding units', () => {
  for (const targetUnitIndex of [1, 2, 4, 14, 19, 34]) {
    const qs = buildUnitJumpQuestions(targetUnitIndex);
    assert.equal(qs.length, 15, `Jump test for unit ${targetUnitIndex + 1} must contain 15 questions`);

    // All 15 questions must be unique
    const fps = new Set(qs.map((q) => getQuestionFingerprint(q)));
    assert.equal(fps.size, 15, `Jump test for unit ${targetUnitIndex + 1} must not repeat questions`);

    // Must not include speak questions (microphone shouldn't block entry tests)
    assert.equal(qs.some((q) => q.type === 'speak'), false);

    // Must mix all 4 requested formats: multiple choice, translation tiles, audio listening, and matching pairs
    const hasMc = qs.some((q) => q.type === 'mcq' || q.type === 'fill_blank');
    const hasTiles = qs.some((q) => q.type === 'wordbank');
    const hasAudio = qs.some(
      (q) =>
        q.type === 'listen' ||
        q.type === 'radio_tf' ||
        q.type === 'radio_mcq' ||
        q.type === 'radio_select3'
    );
    const hasPairs = qs.some((q) => isPairsQuestion(q));

    assert.equal(hasMc, true, `Jump test for unit ${targetUnitIndex + 1} must include multiple choice / fill-blank`);
    assert.equal(hasTiles, true, `Jump test for unit ${targetUnitIndex + 1} must include translation tiles (wordbank)`);
    assert.equal(hasAudio, true, `Jump test for unit ${targetUnitIndex + 1} must include audio listening`);
    assert.equal(hasPairs, true, `Jump test for unit ${targetUnitIndex + 1} must include matching pairs`);
  }
});

test('computeStreakUpdate increments consecutive day, refills hearts, and resets on gap', () => {
  const today = new Date('2026-11-21T10:00:00Z');
  const yesterdayStr = new Date(today.getTime() - 86_400_000).toDateString();
  const olderStr = new Date(today.getTime() - 3 * 86_400_000).toDateString();

  const sameDay = computeStreakUpdate(
    { streak: 4, hearts: 2, lastActiveDate: today.toDateString() },
    today
  );
  assert.equal(sameDay.changed, false);
  assert.equal(sameDay.streak, 4);
  assert.equal(sameDay.hearts, 2);

  const consecutive = computeStreakUpdate(
    { streak: 4, hearts: 1, lastActiveDate: yesterdayStr },
    today
  );
  assert.equal(consecutive.changed, true);
  assert.equal(consecutive.streak, 5);
  assert.equal(consecutive.hearts, 5);

  const broken = computeStreakUpdate(
    { streak: 7, hearts: 3, lastActiveDate: olderStr },
    today
  );
  assert.equal(broken.changed, true);
  assert.equal(broken.streak, 1);
  assert.equal(broken.hearts, 5);
});

test('mergeAndSortLeaderboard ranks user dynamically by XP', () => {
  const rankedLow = mergeAndSortLeaderboard({ ...baseUser, xp: 15 });
  assert.equal(rankedLow[rankedLow.length - 1].isCurrentUser, true);

  const rankedTop = mergeAndSortLeaderboard({ ...baseUser, xp: 600 });
  assert.equal(rankedTop[0].isCurrentUser, true);
  assert.equal(rankedTop[0].name, 'അഹമ്മദ്');
});

test('fisherYatesShuffle preserves elements, does not mutate input, and distributes positions randomly', () => {
  const original = ['A', 'B', 'C', 'D'];
  const firstPosCounts = new Set<number>();
  for (let i = 0; i < 60; i++) {
    const shuffled = fisherYatesShuffle(original);
    assert.deepEqual([...shuffled].sort(), [...original].sort());
    assert.deepEqual(original, ['A', 'B', 'C', 'D']);
    firstPosCounts.add(shuffled.indexOf('A'));
  }
  assert.ok(
    firstPosCounts.size >= 3,
    `Expected answer to appear in at least 3 distinct positions across 60 trials, saw ${firstPosCounts.size}`
  );
});

test('no Malayalam-to-Arabic question across all 280 nodes or Placement Test leaks the Arabic answer in the prompt card', () => {
  const allQuestions: { label: string; q: LessonQuestion }[] = [
    ...UNITS.flatMap((u) =>
      u.lessons.flatMap((l) => l.questions.map((q, idx) => ({ label: `${l.id}#${idx + 1}`, q })))
    ),
    ...PLACEMENT_QUESTIONS.map((q, idx) => ({ label: `placement#${idx + 1}`, q })),
  ];

  for (const { label, q } of allQuestions) {
    if (q.type === 'mcq' && q.isArabicOption) {
      if (q.arabic) {
        assert.notEqual(
          q.arabic.trim(),
          q.answer.trim(),
          `${label} leaks target Arabic answer in prompt card`
        );
      }
    }
    if (q.type === 'wordbank' && q.isArabicWords) {
      assert.equal(
        shouldShowArabicPromptCard(q),
        false,
        `${label} Malayalam-to-Arabic wordbank must not show Arabic prompt card`
      );
    }
    if (q.type === 'listen') {
      assert.equal(
        shouldShowArabicPromptCard(q),
        true,
        `${label} listen question must show audio prompt card`
      );
    }
  }

  // Verify the defensive guard blocks a synthetic Malayalam-to-Arabic leaking MCQ
  const syntheticLeak: LessonQuestion = {
    type: 'mcq',
    prompt: "'ഞാൻ വായിക്കുന്നു' എന്നതിന്റെ അറബി വാക്ക്?",
    arabic: 'أَقْرَأُ',
    translit: 'അഖ്റഉ',
    options: ['أَقْرَأُ', 'أَكْتُبُ', 'أَذْهَبُ', 'أَشْرَبُ'],
    isArabicOption: true,
    answer: 'أَقْرَأُ',
  };
  assert.equal(shouldShowArabicPromptCard(syntheticLeak), false);

  // Verify Unit 9 Lesson 2 Q1 has Arabic options and no leaking Arabic prompt card
  const u9l2q1 = UNITS[8].lessons[1].questions[0];
  assert.equal(u9l2q1.type, 'mcq');
  if (u9l2q1.type === 'mcq') {
    assert.equal(u9l2q1.isArabicOption, true);
    assert.equal(u9l2q1.answer, 'أَقْرَأُ');
    assert.equal(shouldShowArabicPromptCard(u9l2q1), false);
  }
});

test('exclusive ar-SA-HamedNeural audio pipeline routes 28 base letters to studio MP3s and words/sentences to Hamed Neural TTS', () => {
  assert.equal(PRIMARY_ARABIC_VOICE_ID, 'ar-SA-HamedNeural');
  assert.ok(PRIMARY_ARABIC_VOICE_LABEL.includes('Hamed'));

  // 1. All 28 base Arabic letters map cleanly to 01.mp3 .. 28.mp3
  ARABIC_ALPHABET.forEach((letter, idx) => {
    const expectedIndex = String(idx + 1).padStart(2, '0');
    const expectedUrl = `https://raw.githubusercontent.com/mustafa0x/arabic-alphabet-audio/master/mp3/${expectedIndex}.mp3`;
    assert.equal(getArabicLetterAudioUrl(letter.base), expectedUrl);
    assert.equal(buildArabicTtsUrl(letter.base), expectedUrl);

    const sources = buildArabicAudioSources(letter.base);
    assert.equal(sources.length, 1);
    assert.equal(sources[0].provider, 'letter-mp3');
    assert.equal(sources[0].url, expectedUrl);
    assert.equal(sources[0].crossOrigin, true);
  });

  // 2. Harakat syllables, single words, and multi-word sentences route directly to ar-SA-HamedNeural
  //    (zero broken external StreamElements/Youdao calls) using formatForArabicTTS
  for (const sample of ['بَ', 'الْمَسْجِدُ', 'السَّلَامُ عَلَيْكُمْ']) {
    assert.equal(getArabicLetterAudioUrl(sample), null);
    const ttsFormatted = formatForArabicTTS(sample);
    const sources = buildArabicAudioSources(sample);
    assert.equal(sources.length, 0);
    assert.equal(
      buildHamedNeuralTtsUrl(sample),
      `speech://ar-SA-HamedNeural?text=${encodeURIComponent(ttsFormatted)}`
    );
    assert.equal(buildArabicTtsUrl(sample), buildHamedNeuralTtsUrl(sample));
  }

  // 3. Normal (1.0) and slow turtle (0.65) playback rates & 800ms buffer timeout
  assert.equal(resolveArabicPlaybackRate(1.0), 1.0);
  assert.equal(resolveArabicPlaybackRate(0.9), 1.0);
  assert.equal(resolveArabicPlaybackRate(0.65), 0.65);
  assert.equal(resolveArabicPlaybackRate(0.5), 0.65);
  assert.equal(BUFFER_TIMEOUT_MS, 800);
});

test('collectQuestionArabicTexts extracts all Arabic prompt, option, wordbank, and matching pair strings', () => {
  // Arabic MCQ options
  const u1l1q2 = UNITS[0].lessons[0].questions[1];
  assert.deepEqual(collectQuestionArabicTexts(u1l1q2), ['ا', 'ب', 'ت', 'ث']);

  // Matching pairs
  const u1l1q3 = UNITS[0].lessons[0].questions[2];
  assert.deepEqual(collectQuestionArabicTexts(u1l1q3), ['ا', 'ب', 'ت', 'ث']);

  // Listen question
  const u1l1q4 = UNITS[0].lessons[0].questions[3];
  assert.deepEqual(collectQuestionArabicTexts(u1l1q4), ['تَ']);

  // Arabic wordbank question (Unit 4 Lesson 1 Q3 or synthetic)
  const wbArabic: LessonQuestion = {
    type: 'wordbank',
    prompt: 'അറബിയിൽ വാക്യം നിർമ്മിക്കുക',
    words: ['أَنَا', 'طَالِبٌ', 'جَدِيدٌ'],
    isArabicWords: true,
    answer: ['أَنَا', 'طَالِبٌ'],
  };
  assert.deepEqual(collectQuestionArabicTexts(wbArabic), ['أَنَا', 'طَالِبٌ', 'جَدِيدٌ']);
});

test('preloadArabicAudio caches HTMLAudioElement instances in audioCache Map and deduplicates loads', () => {
  const OriginalAudio = (globalThis as unknown as { Audio?: unknown }).Audio;
  const created: { src: string; preload: string; crossOrigin: string | null; loadCalls: number }[] = [];

  class MockAudio {
    src = '';
    preload = '';
    crossOrigin: string | null = null;
    readyState = 0;
    loadCalls = 0;
    onerror: (() => void) | null = null;
    private listeners = new Map<string, (() => void)[]>();
    constructor() {
      created.push(this);
    }
    addEventListener(evt: string, fn: () => void) {
      const list = this.listeners.get(evt) ?? [];
      list.push(fn);
      this.listeners.set(evt, list);
    }
    load() {
      this.loadCalls += 1;
    }
    pause() {}
  }

  clearArabicAudioCache();
  (globalThis as unknown as { Audio: unknown }).Audio = MockAudio;
  try {
    const first = preloadArabicAudio('ب');
    const second = preloadArabicAudio(' ب ');
    assert.ok(first);
    assert.equal(first, second, 'Repeated preload must return the exact cached HTMLAudioElement');
    assert.equal(audioCache.size, 1);
    assert.equal(audioCache.get('ب'), first);
    assert.equal(created.length, 1);
    assert.equal(created[0].preload, 'auto');
    assert.equal(created[0].crossOrigin, 'anonymous');
    assert.equal(created[0].loadCalls, 1);
    assert.equal(
      created[0].src,
      'https://raw.githubusercontent.com/mustafa0x/arabic-alphabet-audio/master/mp3/02.mp3'
    );
  } finally {
    clearArabicAudioCache();
    if (OriginalAudio === undefined) {
      delete (globalThis as unknown as { Audio?: unknown }).Audio;
    } else {
      (globalThis as unknown as { Audio: unknown }).Audio = OriginalAudio;
    }
  }
});

test('prepareSessionQuestions shuffles mcq and listen options via shuffleArray while preserving exact q.answer match', () => {
  const allSets: LessonQuestion[][] = [
    ...UNITS.flatMap((u) => u.lessons.map((l) => l.questions)),
    PLACEMENT_QUESTIONS,
  ];

  // Verify exact answer integrity across every mcq & listen question after shuffling
  for (const questions of allSets) {
    const prepared = prepareSessionQuestions(questions);
    assert.equal(prepared.length, questions.length);
    for (let i = 0; i < prepared.length; i++) {
      const q = prepared[i];
      const orig = questions[i];
      if ((q.type === 'mcq' || q.type === 'listen') && (orig.type === 'mcq' || orig.type === 'listen')) {
        assert.equal(q.options.length, orig.options.length);
        assert.deepEqual([...q.options].sort(), [...orig.options].sort());
        assert.equal(q.answer, orig.answer);
        assert.ok(
          q.options.includes(q.answer),
          `Expected shuffled options to contain exact answer "${q.answer}"`
        );
      }
    }
  }

  // Verify the specific listen question ("ശബ്ദം കേട്ട് ശരിയായ നേരം തിരഞ്ഞെടുക്കുക") places its answer in varied indices
  const u5l2 = UNITS[4].lessons[1].questions;
  const listenQ = u5l2.find((q) => q.type === 'listen');
  assert.ok(listenQ && listenQ.type === 'listen');
  const seenIndices = new Set<number>();
  for (let t = 0; t < 40; t++) {
    const shuffled = shuffleArray(listenQ.options);
    seenIndices.add(shuffled.indexOf(listenQ.answer));
  }
  assert.ok(
    seenIndices.size >= 3,
    `Expected listen question correct answer across >= 3 positions, saw ${seenIndices.size}`
  );
});

test('enqueueMistakeForReview appends isReview copy only in lesson mode and preserves answer integrity', () => {
  const sampleMcq: LessonQuestion = {
    type: 'mcq',
    prompt: 'ഈ അക്ഷരത്തിന്റെ പേര് എന്ത്?',
    arabic: 'ب',
    options: ['അലിഫ്', 'ബാ', 'താ', 'ഥാ'],
    answer: 'ബാ',
  };
  const sampleWb: LessonQuestion = {
    type: 'wordbank',
    prompt: "'പള്ളി വീടിന് മുന്നിലാണ്' എന്ന് അറബിയിൽ ക്രമീകരിക്കുക",
    words: ['اَلْمَسْجِدُ', 'أَمَامَ', 'الْبَيْتِ', 'خَلْفَ'],
    isArabicWords: true,
    answer: ['اَلْمَسْجِدُ', 'أَمَامَ', 'الْبَيْتِ'],
  };

  // In lesson mode, missed MCQ is cloned with isReview: true at the end of the queue
  const initialQueue: LessonQuestion[] = [sampleMcq, sampleWb];
  const afterMiss1 = enqueueMistakeForReview(initialQueue, sampleMcq, 'lesson');
  assert.equal(afterMiss1.length, 3);
  assert.equal(sampleMcq.isReview, undefined, 'original question must not be mutated');
  assert.equal(afterMiss1[2].isReview, true);
  assert.equal(afterMiss1[2].type, 'mcq');
  if (afterMiss1[2].type === 'mcq') {
    assert.equal(afterMiss1[2].answer, 'ബാ');
    assert.ok(afterMiss1[2].options.includes('ബാ'));
  }

  // If missed again during review, it re-queues again so lesson cannot finish until corrected
  const afterMiss2 = enqueueMistakeForReview(afterMiss1, afterMiss1[2], 'lesson');
  assert.equal(afterMiss2.length, 4);
  assert.equal(afterMiss2[3].isReview, true);

  // In placement and jump modes, missed questions are NOT re-queued
  assert.equal(enqueueMistakeForReview(initialQueue, sampleMcq, 'placement').length, 2);
  assert.equal(enqueueMistakeForReview(initialQueue, sampleMcq, 'jump').length, 2);

  // Verify required Duolingo banner text
  assert.equal(
    MISTAKE_REVIEW_BANNER_TEXT,
    "🔄 തെറ്റിയവ ശരിയാക്കാം! (Let's correct the ones you missed)"
  );
});

test('diacritic-tolerant Word Bank matching validates RTL Arabic cleanly and rejects wrong order', () => {
  // Exact RTL Arabic phrase from Unit 7
  const expected = ['اَلْمَسْجِدُ', 'أَمَامَ', 'الْبَيْتِ'];

  // Exact match
  assert.equal(areWordBankAnswersEqual(['اَلْمَسْجِدُ', 'أَمَامَ', 'الْبَيْتِ'], expected), true);

  // Tolerates optional Alif Fatha (الْمَسْجِدُ vs اَلْمَسْجِدُ) and accidental spaces
  assert.equal(areWordBankAnswersEqual([' الْـمَسْجِدُ ', 'أَمَامَ', ' الْبَيْتِ'], expected), true);

  // Tolerates subtle Unicode Harakat ordering differences (Shadda+Fatha vs Fatha+Shadda)
  const shaddaThenFatha = 'اَلْمَسْجِدُ';
  const fathaThenShadda = 'مُحَم\u064E\u0651دٌ';
  const normalShadda = 'مُحَم\u0651\u064Eدٌ';
  assert.equal(normalizeWordBankText(fathaThenShadda), normalizeWordBankText(normalShadda));
  assert.equal(areWordBankAnswersEqual([shaddaThenFatha, 'أَمَامَ', 'الْبَيْتِ'], expected), true);

  // Strictly rejects reversed / wrong RTL word order or wrong words
  assert.equal(areWordBankAnswersEqual(['الْبَيْتِ', 'أَمَامَ', 'اَلْمَسْجِدُ'], expected), false);
  assert.equal(areWordBankAnswersEqual(['اَلْمَسْجِدُ', 'خَلْفَ', 'الْبَيْتِ'], expected), false);
  assert.equal(areWordBankAnswersEqual([], expected), false);

  // Works through evaluateQuestionAnswer as well
  const wbQ: LessonQuestion = {
    type: 'wordbank',
    prompt: "'പള്ളി വീടിന് മുന്നിലാണ്' എന്ന് അറബിയിൽ ക്രമീകരിക്കുക",
    words: ['اَلْمَسْجِدُ', 'أَمَامَ', 'الْبَيْتِ', 'خَلْفَ'],
    isArabicWords: true,
    answer: expected,
  };
  assert.equal(evaluateQuestionAnswer(wbQ, null, ['الْمَسْجِدُ', 'أَمَامَ', 'الْبَيْتِ']).correct, true);
  assert.equal(evaluateQuestionAnswer(wbQ, null, ['الْبَيْتِ', 'أَمَامَ', 'الْمَسْجِدُ']).correct, false);
});

test('all 35 units include fill_blank questions in Lessons 2, 4, 5, and 7 (nodes n2, n5, n6, n7) with 3 vocalized options and Malayalam hints', () => {
  const targetNodeSuffixes = ['_n2', '_n5', '_n6', '_n7'];
  let totalFillBlank = 0;

  for (const unit of UNITS) {
    for (const suffix of targetNodeSuffixes) {
      const node = unit.lessons.find((l) => l.id === `${unit.id}${suffix}`);
      assert.ok(node, `${unit.id}${suffix} must exist`);
      const fbQuestions = node.questions.filter((q) => q.type === 'fill_blank');
      assert.ok(
        fbQuestions.length >= 1,
        `${node.id} must include at least one fill_blank question`
      );
      for (const q of fbQuestions) {
        if (q.type !== 'fill_blank') continue;
        totalFillBlank += 1;
        assert.ok(q.sentence.includes('______'), `${node.id} fill_blank sentence must contain ______`);
        assert.ok(q.hintMl.trim().length > 0, `${node.id} fill_blank must have Malayalam hintMl`);
        assert.equal(q.options.length, 3, `${node.id} fill_blank must have 3 options`);
        assert.ok(q.options.includes(q.answer), `${node.id} fill_blank answer must be in options`);
        assert.ok(q.optionTranslits, `${node.id} fill_blank must include optionTranslits`);
        for (const opt of q.options) {
          assert.ok(
            q.optionTranslits?.[opt],
            `${node.id} fill_blank missing Malayalam transliteration for ${opt}`
          );
        }
        assert.equal(
          shouldShowArabicPromptCard(q),
          false,
          `${node.id} fill_blank uses its own speech bubble UI instead of generic Arabic prompt card`
        );
      }
    }
  }

  assert.equal(totalFillBlank, 140, 'Expected 140 fill_blank questions (4 per unit across 35 units)');

  // Verify Unit 7 includes the canonical masjid preposition sentence
  const u7n5 = UNITS[6].lessons.find((l) => l.id === 'u7_n5');
  assert.ok(u7n5);
  const masjidQ = u7n5.questions.find(
    (q) => q.type === 'fill_blank' && q.sentence === 'أَنَا أَذْهَبُ ______ الْمَسْجِدِ'
  );
  assert.ok(masjidQ && masjidQ.type === 'fill_blank');
  assert.equal(masjidQ.answer, 'إِلَى');
  assert.equal(masjidQ.hintMl, 'ഞാൻ പള്ളിയിലേക്ക് പോകുന്നു');
});

test('Units 11 to 15 have exact theme colors, key vocabulary, 8-node progression, and Unit 15 Jump Here / unlock math', () => {
  const masteryUnits = UNITS.slice(10, 15);
  assert.equal(masteryUnits.length, 5);

  const expectedMeta = [
    { id: 'u11', color: 'bg-[#0D9488]', border: 'border-[#0F766E]' },
    { id: 'u12', color: 'bg-[#0284C7]', border: 'border-[#0369A1]' },
    { id: 'u13', color: 'bg-[#E11D48]', border: 'border-[#BE123C]' },
    { id: 'u14', color: 'bg-[#4F46E5]', border: 'border-[#4338CA]' },
    { id: 'u15', color: 'bg-[#D97706]', border: 'border-[#B45309]' },
  ];

  masteryUnits.forEach((unit, idx) => {
    assert.equal(unit.id, expectedMeta[idx].id);
    assert.equal(unit.theme.bg, expectedMeta[idx].color);
    assert.equal(unit.theme.border, expectedMeta[idx].border);
    assert.equal(unit.lessons.length, unit.number >= VIDEO_CALL_MIN_UNIT_NUMBER ? 9 : 8);
    assert.equal(unit.lessons[3].nodeType, 'chest');
    assert.equal(unit.lessons[unit.lessons.length - 1].nodeType, 'trophy');
    assert.ok(unit.guidebook && unit.guidebook.length === 8, `${unit.id} must have 8 guidebook entries`);
  });

  // Verify key vocabulary coverage across Units 11-15
  const serialized = JSON.stringify(masteryUnits);
  const requiredArabicTerms = [
    'مُعَلِّمٌ',
    'طَبِيبٌ',
    'مُهَنْدِسٌ',
    'مَكْتَبٌ',
    'كَيْفَ الْجَوُّ الْيَوْمَ؟',
    'قَمِيصٌ',
    'ثَوْبٌ',
    'حِذَاءٌ',
    'هَلْ يُوجَدُ لَوْنٌ آخَرُ؟',
    'هَاتِفٌ',
    'أَلُو، مَنْ مَعِي؟',
    'سَأَتَّصِلُ بِكَ لَاحِقًا',
    'جَوَازُ السَّفَرِ',
    'تَأْشِيرَةٌ',
    'أَيْنَ مَكْتَبُ الْجَوَازَاتِ؟',
    'سَفَرًا سَعِيدًا',
  ];
  for (const term of requiredArabicTerms) {
    assert.ok(serialized.includes(term), `Missing required Units 11–15 term: ${term}`);
  }

  // Unit 15 (index 14) unlock & jump test verification
  const unlockedUpTo15 = unlockLessonsUpToUnit([], 14);
  assert.equal(unlockedUpTo15.length, 112);
  assert.equal(isUnitUnlocked(14, unlockedUpTo15), true);
  assert.equal(isLessonUnlocked('u15_n1', unlockedUpTo15), true);
  assert.equal(isLessonUnlocked('u15_n2', unlockedUpTo15), false);

  const jumpQs = buildUnitJumpQuestions(14);
  assert.equal(jumpQs.length, 15);
  assert.equal(jumpQs.some((q) => isPairsQuestion(q)), true);
});

test('Units 16 to 20 cover Grammar & Long-Sentence Mastery with exact colors, Malayalam grammar guidebooks, signature sentences, and Unit 20 Jump Here math', () => {
  const grammarUnits = UNITS.slice(15, 20);
  assert.equal(grammarUnits.length, 5);

  const expectedMeta = [
    { id: 'u16', color: 'bg-[#7C3AED]', border: 'border-[#6D28D9]' },
    { id: 'u17', color: 'bg-[#0891B2]', border: 'border-[#0E7490]' },
    { id: 'u18', color: 'bg-[#059669]', border: 'border-[#047857]' },
    { id: 'u19', color: 'bg-[#EA580C]', border: 'border-[#C2410C]' },
    { id: 'u20', color: 'bg-[#1D4ED8]', border: 'border-[#1E40AF]' },
  ];

  grammarUnits.forEach((unit, idx) => {
    assert.equal(unit.id, expectedMeta[idx].id);
    assert.equal(unit.theme.bg, expectedMeta[idx].color);
    assert.equal(unit.theme.border, expectedMeta[idx].border);
    assert.equal(unit.lessons.length, 9);
    assert.equal(unit.lessons[3].nodeType, 'chest');
    assert.equal(unit.lessons[6].nodeType, 'video_call');
    assert.equal(unit.lessons[8].nodeType, 'trophy');
    assert.ok(unit.guidebook && unit.guidebook.length === 8, `${unit.id} must have 8 guidebook entries`);
    assert.ok(
      unit.guidebookTip && unit.guidebookTip.includes('വ്യാകരണ നിയമം'),
      `${unit.id} guidebookTip must clearly explain the grammar rule in Malayalam`
    );
  });

  // Verify signature sentences & grammar forms across Units 16-20
  const serialized = JSON.stringify(grammarUnits);
  const requiredGrammarSentences = [
    'هٰذِهِ طَالِبَةٌ مُجْتَهِدَةٌ',
    'عِنْدِي كِتَابَانِ جَدِيدَانِ',
    'أَمْسِ ذَهَبْتُ إِلَى السُّوقِ وَالْيَوْمَ أَذْهَبُ إِلَى الْمَكْتَبِ',
    'الْقَلَمُ الْأَزْرَقُ عَلَى الطَّاوِلَةِ بِجَانِبِ حَقِيبَتِكَ',
    'أَسْتَيْقِظُ مُبَكِّرًا كُلَّ يَوْمٍ لِأَنَّ عَمَلِي يَبْدَأُ فِي السَّاعَةِ الثَّامِنَةِ صَبَاحًا',
    'مُعَلِّمُونَ',
    'طَالِبَاتٌ',
    'كِتَابِي',
    'كِتَابُكَ',
    'كِتَابُهُ',
    'لِأَنَّ',
    'لٰكِنَّ',
    'عِنْدَمَا',
    'أُرِيدُ أَنْ',
  ];
  for (const term of requiredGrammarSentences) {
    assert.ok(serialized.includes(term), `Missing required Units 16–20 grammar term/sentence: ${term}`);
  }

  // Unit 20 (index 19) unlock & jump test verification (14*8 + 5*9 = 157 nodes)
  const unlockedUpTo20 = unlockLessonsUpToUnit([], 19);
  assert.equal(unlockedUpTo20.length, 157);
  assert.equal(isUnitUnlocked(19, unlockedUpTo20), true);
  assert.equal(isLessonUnlocked('u20_n1', unlockedUpTo20), true);
  assert.equal(isLessonUnlocked('u20_n2', unlockedUpTo20), false);

  const jumpQs = buildUnitJumpQuestions(19);
  assert.equal(jumpQs.length, 15);
  assert.equal(jumpQs.some((q) => isPairsQuestion(q)), true);
});

test('Units 21 to 25 cover Advanced Fluency, Gulf Expressions & Proverbs with exact colors, Malayalam guidebooks, required phrases, and Unit 25 Jump Here math', () => {
  const fluencyUnits = UNITS.slice(20, 25);
  assert.equal(fluencyUnits.length, 5);

  const expectedMeta = [
    { id: 'u21', color: 'bg-[#0F766E]', border: 'border-[#115E59]' },
    { id: 'u22', color: 'bg-[#BE123C]', border: 'border-[#9F1239]' },
    { id: 'u23', color: 'bg-[#6D28D9]', border: 'border-[#5B21B6]' },
    { id: 'u24', color: 'bg-[#047857]', border: 'border-[#065F46]' },
    { id: 'u25', color: 'bg-[#B45309]', border: 'border-[#92400E]' },
  ];

  fluencyUnits.forEach((unit, idx) => {
    assert.equal(unit.id, expectedMeta[idx].id);
    assert.equal(unit.theme.bg, expectedMeta[idx].color);
    assert.equal(unit.theme.border, expectedMeta[idx].border);
    assert.equal(unit.lessons.length, 9);
    assert.equal(unit.lessons[3].nodeType, 'chest');
    assert.equal(unit.lessons[6].nodeType, 'video_call');
    assert.equal(unit.lessons[8].nodeType, 'trophy');
    assert.ok(unit.guidebook && unit.guidebook.length === 8, `${unit.id} must have 8 guidebook entries`);
    assert.ok(
      unit.guidebookTip && unit.guidebookTip.length > 40,
      `${unit.id} guidebookTip must clearly explain the rule or cultural expressions in Malayalam`
    );
  });

  const serialized = JSON.stringify(fluencyUnits);
  const requiredFluencyTerms = [
    'سَأُسَافِرُ غَدًا',
    'سَوْفَ نَلْتَقِي فِي الْمَسَاءِ',
    'الْأُسْبُوعَ الْقَادِمَ',
    'اِجْلِسْ',
    'اِفْتَحِ الْبَابَ',
    'اِكْتُبْ رِسَالَةً',
    'لَا تَقْلَقْ',
    'لَا تَتَأَخَّرْ',
    'أَكْبَرُ مِنْ',
    'أَجْمَلُ',
    'أَسْرَعُ',
    'هٰذَا الْهَاتِفُ أَرْخَصُ مِنْ ذٰلِكَ',
    'إِنْ شَاءَ اللّٰهُ',
    'مَا شَاءَ اللّٰهُ',
    'يَعْطِيكَ الْعَافِيَةَ',
    'مَا فِي مُشْكِلَة',
    'تَحْتَ أَمْرِكَ',
    'الْوَقْتُ كَالسَّيْفِ',
    'مَنْ جَدَّ وَجَدَ',
    'اَلصَّبْرُ مِفْتَاحُ الْفَرَجِ',
  ];
  for (const term of requiredFluencyTerms) {
    assert.ok(serialized.includes(term), `Missing required Units 21–25 fluency/proverb term: ${term}`);
  }

  // Unit 25 (index 24) unlock & jump test verification (14*8 + 10*9 = 202 nodes)
  const unlockedUpTo25 = unlockLessonsUpToUnit([], 24);
  assert.equal(unlockedUpTo25.length, 202);
  assert.equal(isUnitUnlocked(24, unlockedUpTo25), true);
  assert.equal(isLessonUnlocked('u25_n1', unlockedUpTo25), true);
  assert.equal(isLessonUnlocked('u25_n2', unlockedUpTo25), false);

  const jumpQs = buildUnitJumpQuestions(24);
  assert.equal(jumpQs.length, 15);
  assert.equal(jumpQs.some((q) => isPairsQuestion(q)), true);
});

test('Units 26 to 30 cover Core Arabic Grammar Mastery (Kaana, Inna, Passive, Participles, Conditionals) with exact colors, I-rab guidebooks, and Unit 30 Jump Here math', () => {
  const coreGrammarUnits = UNITS.slice(25, 30);
  assert.equal(coreGrammarUnits.length, 5);

  const expectedMeta = [
    { id: 'u26', color: 'bg-[#059669]', border: 'border-[#047857]' },
    { id: 'u27', color: 'bg-[#2563EB]', border: 'border-[#1D4ED8]' },
    { id: 'u28', color: 'bg-[#7C3AED]', border: 'border-[#6D28D9]' },
    { id: 'u29', color: 'bg-[#0D9488]', border: 'border-[#0F766E]' },
    { id: 'u30', color: 'bg-[#B45309]', border: 'border-[#92400E]' },
  ];

  coreGrammarUnits.forEach((unit, idx) => {
    assert.equal(unit.id, expectedMeta[idx].id);
    assert.equal(unit.theme.bg, expectedMeta[idx].color);
    assert.equal(unit.theme.border, expectedMeta[idx].border);
    assert.equal(unit.lessons.length, 9);
    assert.equal(unit.lessons[3].nodeType, 'chest');
    assert.equal(unit.lessons[6].nodeType, 'video_call');
    assert.equal(unit.lessons[8].nodeType, 'trophy');
    assert.ok(unit.guidebook && unit.guidebook.length === 8, `${unit.id} must have 8 guidebook entries`);
    assert.ok(
      unit.guidebookTip && unit.guidebookTip.includes('വ്യാകരണ നിയമം'),
      `${unit.id} guidebookTip must clearly explain the grammar & I'rab rule in Malayalam`
    );
  });

  const serialized = JSON.stringify(coreGrammarUnits);
  const requiredCoreGrammarTerms = [
    'كَانَ الْبَيْتُ كَبِيرًا',
    'لَيْسَ الِامْتِحَانُ صَعْبًا',
    'أَصْبَحَ',
    'مَا زَالَ',
    'إِنَّ الصَّبْرَ جَمِيلٌ',
    'لَعَلَّ الْفَرَجَ قَرِيبٌ',
    'لٰكِنَّ',
    'لَيْتَ',
    'كَأَنَّ',
    'فُتِحَ الْبَابُ',
    'يُكْتَبُ الدَّرْسُ',
    'خُلِقَ الْإِنْسَانُ',
    'كَاتِبٌ',
    'مَكْتُوبٌ',
    'عَالِمٌ',
    'مَعْلُومٌ',
    'فَاتِحٌ',
    'مَفْتُوحٌ',
    'مَنْ يَجْتَهِدْ يَنْجَحْ',
    'إِذَا جَاءَ نَصْرُ اللّٰهِ',
  ];
  for (const term of requiredCoreGrammarTerms) {
    assert.ok(serialized.includes(term), `Missing required Units 26–30 grammar term: ${term}`);
  }

  // Unit 30 (index 29) unlock & jump test verification (14*8 + 15*9 = 247 nodes)
  const unlockedUpTo30 = unlockLessonsUpToUnit([], 29);
  assert.equal(unlockedUpTo30.length, 247);
  assert.equal(isUnitUnlocked(29, unlockedUpTo30), true);
  assert.equal(isLessonUnlocked('u30_n1', unlockedUpTo30), true);
  assert.equal(isLessonUnlocked('u30_n2', unlockedUpTo30), false);

  const jumpQs = buildUnitJumpQuestions(29);
  assert.equal(jumpQs.length, 15);
  assert.equal(jumpQs.some((q) => isPairsQuestion(q)), true);
});

test('Units 31 to 35 cover Classical & Modern Arabic Syntax (Relative Pronouns, Nasb, Jazm, Idafa/Naat, Numbers 11-100) with exact colors, I-rab guidebooks, and Unit 35 Jump Here math', () => {
  const syntaxUnits = UNITS.slice(30, 35);
  assert.equal(syntaxUnits.length, 5);

  const expectedMeta = [
    { id: 'u31', color: 'bg-[#4338CA]', border: 'border-[#3730A3]' },
    { id: 'u32', color: 'bg-[#BE123C]', border: 'border-[#9F1239]' },
    { id: 'u33', color: 'bg-[#0F766E]', border: 'border-[#115E59]' },
    { id: 'u34', color: 'bg-[#6D28D9]', border: 'border-[#5B21B6]' },
    { id: 'u35', color: 'bg-[#B45309]', border: 'border-[#92400E]' },
  ];

  syntaxUnits.forEach((unit, idx) => {
    assert.equal(unit.id, expectedMeta[idx].id);
    assert.equal(unit.theme.bg, expectedMeta[idx].color);
    assert.equal(unit.theme.border, expectedMeta[idx].border);
    assert.equal(unit.lessons.length, 9);
    assert.equal(unit.lessons[3].nodeType, 'chest');
    assert.equal(unit.lessons[6].nodeType, 'video_call');
    assert.equal(unit.lessons[8].nodeType, 'trophy');
    assert.ok(unit.guidebook && unit.guidebook.length === 8, `${unit.id} must have 8 guidebook entries`);
    assert.ok(
      unit.guidebookTip && unit.guidebookTip.includes('വ്യാകരണ നിയമം'),
      `${unit.id} guidebookTip must clearly explain the syntax & I'rab rule in Malayalam`
    );
  });

  const serialized = JSON.stringify(syntaxUnits);
  const requiredSyntaxTerms = [
    'اَلطَّالِبُ الَّذِي يَجْتَهِدُ يَنْجَحُ',
    'اَلْمَدْرَسَةُ الَّتِي أَدْرُسُ فِيهَا كَبِيرَةٌ',
    'الَّذِينَ',
    'اللَّاتِي',
    'أُرِيدُ أَنْ أَتَعَلَّمَ اللُّغَةَ الْعَرَبِيَّةَ',
    'لَنْ أَنْسَى هٰذَا الْيَوْمَ',
    'كَيْ',
    'لِكَيْ',
    'لَمْ يَحْضُرِ الطَّالِبُ أَمْسِ',
    'لَا تَكْذِبْ أَبَدًا',
    'لَمَّا',
    'بَابُ الْمَسْجِدِ مَفْتُوحٌ',
    'اَلْبَابُ الْكَبِيرُ مَفْتُوحٌ',
    'أَحَدَ عَشَرَ كَوْكَبًا',
    'عِشْرُونَ طَالِبًا',
    'مِائَةُ كِتَابٍ',
  ];
  for (const term of requiredSyntaxTerms) {
    assert.ok(serialized.includes(term), `Missing required Units 31–35 syntax term: ${term}`);
  }

  // Unit 35 (index 34) unlock & jump test verification (14*8 + 20*9 = 292 nodes)
  const unlockedUpTo35 = unlockLessonsUpToUnit([], 34);
  assert.equal(unlockedUpTo35.length, 292);
  assert.equal(isUnitUnlocked(34, unlockedUpTo35), true);
  assert.equal(isLessonUnlocked('u35_n1', unlockedUpTo35), true);
  assert.equal(isLessonUnlocked('u35_n2', unlockedUpTo35), false);

  const jumpQs = buildUnitJumpQuestions(34);
  assert.equal(jumpQs.length, 15);
  assert.equal(jumpQs.some((q) => isPairsQuestion(q)), true);
});

test('fill_blank supports buildFilledSentence, Fisher-Yates shuffling, audio preloading, and Mistake Review re-queue', () => {
  const sampleFb: LessonQuestion = {
    type: 'fill_blank',
    prompt: 'വിട്ടുപോയ ഭാഗം പൂരിപ്പിക്കുക',
    sentence: 'أَنَا أَذْهَبُ ______ الْمَسْجِدِ',
    hintMl: 'ഞാൻ പള്ളിയിലേക്ക് പോകുന്നു',
    avatar: '🦉',
    options: ['إِلَى', 'مِنْ', 'فِي'],
    optionTranslits: { 'إِلَى': 'ഇല', 'مِنْ': 'മിൻ', 'فِي': 'ഫീ' },
    answer: 'إِلَى',
  };

  // 1. Complete filled sentence construction & answer evaluation
  assert.equal(
    buildFilledSentence(sampleFb.sentence, sampleFb.answer),
    'أَنَا أَذْهَبُ إِلَى الْمَسْجِدِ'
  );
  const goodEval = evaluateQuestionAnswer(sampleFb, 'إِلَى', []);
  assert.equal(goodEval.correct, true);
  assert.equal(goodEval.expectedDisplay, 'أَنَا أَذْهَبُ إِلَى الْمَسْجِدِ');
  const badEval = evaluateQuestionAnswer(sampleFb, 'مِنْ', []);
  assert.equal(badEval.correct, false);
  assert.equal(badEval.expectedDisplay, 'أَنَا أَذْهَبُ إِلَى الْمَسْجِدِ');

  // 2. Audio preloader collects all 3 choices + the complete filled Arabic sentence
  const audioTexts = collectQuestionArabicTexts(sampleFb);
  assert.deepEqual(audioTexts, ['إِلَى', 'مِنْ', 'فِي', 'أَنَا أَذْهَبُ إِلَى الْمَسْجِدِ']);

  // 3. prepareSessionQuestions shuffles all 3 options across all positions while keeping answer intact
  const seenPositions = new Set<number>();
  for (let i = 0; i < 40; i++) {
    const [prepared] = prepareSessionQuestions([sampleFb]);
    assert.equal(prepared.type, 'fill_blank');
    if (prepared.type === 'fill_blank') {
      assert.equal(prepared.options.length, 3);
      assert.ok(prepared.options.includes('إِلَى'));
      seenPositions.add(prepared.options.indexOf('إِلَى'));
    }
  }
  assert.equal(seenPositions.size, 3, 'Expected fill_blank answer to shuffle across all 3 positions');

  // 4. Mistake Review Queue re-queues missed fill_blank with isReview: true only in lesson mode
  const requeued = enqueueMistakeForReview([sampleFb], sampleFb, 'lesson');
  assert.equal(requeued.length, 2);
  assert.equal(requeued[1].isReview, true);
  assert.equal(requeued[1].type, 'fill_blank');
  if (requeued[1].type === 'fill_blank') {
    assert.equal(requeued[1].answer, 'إِلَى');
    assert.ok(requeued[1].options.includes('إِلَى'));
  }
  assert.equal(enqueueMistakeForReview([sampleFb], sampleFb, 'placement').length, 1);
  assert.equal(enqueueMistakeForReview([sampleFb], sampleFb, 'jump').length, 1);
});

test('buildLessonSessionQuestions delivers 10-12 unique balanced 5-type questions across all 245 non-chest nodes in all 35 units', () => {
  let deterministicSeed = 42;
  const seededRng = () => {
    deterministicSeed = (deterministicSeed * 1664525 + 1013904223) % 4294967296;
    return deterministicSeed / 4294967296;
  };

  let checkedNodes = 0;
  for (let uIdx = 0; uIdx < UNITS.length; uIdx++) {
    const unit = UNITS[uIdx];
    const priorCompleted = unlockLessonsUpToUnit([], uIdx);
    for (const lesson of unit.lessons) {
      if (lesson.nodeType === 'chest' || lesson.nodeType === 'video_call') continue;
      checkedNodes += 1;

      const session = buildLessonSessionQuestions(lesson, priorCompleted, UNITS, seededRng);
      assert.ok(
        session.length >= 10 && session.length <= 12,
        `${lesson.id} expected 10-12 questions, got ${session.length}`
      );
      if (lesson.nodeType === 'trophy') {
        assert.equal(session.length, 12, `${lesson.id} trophy node must deliver exactly 12 questions`);
      }

      // Zero duplicate questions inside the same session
      const fingerprints = new Set(session.map((q) => getQuestionFingerprint(q)));
      assert.equal(
        fingerprints.size,
        session.length,
        `${lesson.id} session contains duplicate questions`
      );

      // All 5 question types must be present
      const presentTypes = new Set(session.map((q) => q.type));
      for (const t of ALL_QUESTION_TYPES) {
        assert.ok(
          presentTypes.has(t),
          `${lesson.id} session is missing question type "${t}" (has: ${[...presentTypes].join(', ')})`
        );
      }

      // Spaced Repetition: 2 earlier-unit review questions whenever prior units are completed
      const srQuestions = session.filter((q) => q.isSpacedRepetition === true);
      if (uIdx > 0) {
        assert.equal(
          srQuestions.length,
          2,
          `${lesson.id} should include 2 Spaced-Repetition review questions from earlier completed units`
        );
        for (const sr of srQuestions) {
          assert.equal(sr.isReview, undefined, `${lesson.id} SR question must not be marked as isReview`);
        }
      } else {
        assert.equal(srQuestions.length, 0, `${lesson.id} in Unit 1 has no earlier units for SR`);
      }

      // Zero prompt/option mismatch or answer-spoiling prompt cards (handcrafted + dynamic)
      for (const q of session) {
        if (q.type === 'mcq' || q.type === 'listen' || q.type === 'fill_blank') {
          assert.ok(
            q.options.includes(q.answer),
            `${lesson.id} shuffled options must include exact answer "${q.answer}"`
          );
        }
        if (q.type === 'mcq') {
          if (q.isArabicOption && q.arabic) {
            assert.notEqual(
              q.arabic.trim(),
              q.answer.trim(),
              `${lesson.id} spoils Arabic answer in prompt card`
            );
          }
          // Verify no question asks for Arabic phrase while offering the exact prompt quote as option
          const quotedMatch = q.prompt.match(/'([^']+)'/);
          if (quotedMatch && q.prompt.includes('എങ്ങനെ') && !q.isArabicOption) {
            assert.equal(
              q.options.some((o) => o.trim() === quotedMatch[1].trim()),
              false,
              `${lesson.id} duplicates quoted prompt "${quotedMatch[1]}" as Malayalam option`
            );
          }
        }
      }
    }
  }
  assert.equal(checkedNodes, 245, 'Expected 245 non-chest lesson nodes across 35 units');

  // Verify the exact Unit 8 price question and Unit 6 green tree question have Arabic options and no spoiling prompt card
  const u8n2 = UNITS[7].lessons[1];
  const priceQ = u8n2.questions.find((q) => q.prompt.includes('ഇതിന് എത്ര വിലയാണ്'));
  assert.ok(priceQ && priceQ.type === 'mcq');
  assert.equal(priceQ.isArabicOption, true);
  assert.equal(priceQ.answer, 'بِكَمْ هٰذَا؟');
  assert.equal(shouldShowArabicPromptCard(priceQ), false);

  const u6n5 = UNITS[5].lessons[4];
  const greenTreeQ = u6n5.questions.find((q) => q.prompt.includes('പച്ച മരം'));
  assert.ok(greenTreeQ && greenTreeQ.type === 'mcq');
  assert.equal(greenTreeQ.isArabicOption, true);
  assert.equal(greenTreeQ.answer, 'شَجَرَةٌ خَضْرَاءُ');
  assert.equal(shouldShowArabicPromptCard(greenTreeQ), false);
});

test('all 35 units have Interactive Arabic Story on Node 5 with 5-6 vocalized lines, 2 checks, audio extraction, and Unit 15 Missing Passport story', () => {
  assert.equal(Object.keys(UNIT_STORIES).length, 35);

  for (const unit of UNITS) {
    const node5 = unit.lessons[4];
    assert.equal(node5.id, `${unit.id}_n5`);
    assert.equal(node5.nodeType, 'story');
    assert.equal(node5.icon, '📖');
    assert.ok(node5.story, `${node5.id} must attach a UnitStory`);

    const story = node5.story;
    assert.equal(story.characters.length, 2, `${unit.id} story must have 2 named characters`);
    assert.ok(story.titleAr.trim().length > 0 && /[\u0600-\u06FF]/.test(story.titleAr));
    assert.ok(story.titleMl.trim().length > 0);
    assert.ok(story.titleTr.trim().length > 0);

    const lines = story.steps.filter((s) => s.kind === 'line');
    const checks = story.steps.filter((s) => s.kind === 'check');
    assert.ok(
      lines.length >= 5 && lines.length <= 6,
      `${unit.id} story must have 5-6 dialogue lines, got ${lines.length}`
    );
    assert.equal(checks.length, 2, `${unit.id} story must have 2 mid-story comprehension checks`);

    for (const line of lines) {
      if (line.kind !== 'line') continue;
      assert.ok(line.speaker === 0 || line.speaker === 1);
      assert.ok(/[\u0600-\u06FF]/.test(line.ar), `${unit.id} story line must contain Arabic script`);
      assert.ok(line.tr.trim().length > 0, `${unit.id} story line must include Malayalam transliteration`);
      assert.ok(line.ml.trim().length > 0, `${unit.id} story line must include Malayalam meaning`);
    }

    for (const check of checks) {
      if (check.kind !== 'check') continue;
      assert.ok(check.options.length >= 3, `${unit.id} story check needs >= 3 options`);
      assert.ok(check.options.includes(check.answer), `${unit.id} story check answer must be in options`);
      assert.equal(evaluateStoryCheckAnswer(check, check.answer).correct, true);
      const wrongOpt = check.options.find((o) => o !== check.answer) ?? '__wrong__';
      assert.equal(evaluateStoryCheckAnswer(check, wrongOpt).correct, false);
    }

    // Audio preloader collects story title and dialogue lines
    const texts = collectStoryArabicTexts(story);
    assert.ok(texts.includes(story.titleAr));
    assert.ok(texts.length >= 6);
  }

  // Unit 15 signature Missing Passport story
  const u15Story = UNIT_STORIES.u15;
  assert.equal(u15Story.titleAr, 'جَوَازُ السَّفَرِ الْمَفْقُودُ');
  assert.equal(u15Story.titleMl, 'കാണാതായ പാസ്പോർട്ട്');

  // prepareStorySteps shuffles check options without mutating original story
  const origCheck = u15Story.steps.find((s) => s.kind === 'check');
  assert.ok(origCheck && origCheck.kind === 'check');
  const seenPos = new Set<number>();
  for (let i = 0; i < 40; i++) {
    const prepared = prepareStorySteps(u15Story);
    const prepCheck = prepared.find((s) => s.kind === 'check');
    assert.ok(prepCheck && prepCheck.kind === 'check');
    assert.ok(prepCheck.options.includes(prepCheck.answer));
    seenPos.add(prepCheck.options.indexOf(prepCheck.answer));
  }
  assert.ok(seenPos.size >= 2, 'Story check options should shuffle across positions');
});

test('Review (+5 XP, 5 questions) and Legendary (+40 XP, 10 zero-hint questions, 3 hearts, crown persistence) work cleanly', () => {
  assert.equal(REVIEW_XP_REWARD, 5);
  assert.equal(REVIEW_QUESTION_COUNT, 5);
  assert.equal(LEGENDARY_XP_REWARD, 40);
  assert.equal(LEGENDARY_QUESTION_COUNT, 10);
  assert.equal(LEGENDARY_HEARTS, 3);
  assert.equal(STORY_XP_REWARD, 15);

  const sampleNode = UNITS[14].lessons[1]; // u15_n2
  const reviewQs = buildReviewSessionQuestions(sampleNode, UNITS);
  assert.equal(reviewQs.length, 5);
  assert.equal(new Set(reviewQs.map((q) => getQuestionFingerprint(q))).size, 5);

  const legendaryQs = buildLegendarySessionQuestions(sampleNode, UNITS);
  assert.equal(legendaryQs.length, 10);
  assert.equal(new Set(legendaryQs.map((q) => getQuestionFingerprint(q))).size, 10);

  // Story outcome awards +15 XP and marks node complete
  const storyOutcome = evaluateSessionOutcome({
    mode: 'lesson',
    variant: 'story',
    lessonId: 'u15_n5',
    targetUnitIndex: null,
    score: 2,
    totalQuestions: 2,
    xpReward: STORY_XP_REWARD,
  });
  assert.equal(storyOutcome.earnedXp, 15);
  const afterStory = applySessionResult(baseUser, storyOutcome);
  assert.equal(afterStory.xp, 15);
  assert.ok(afterStory.completedLessons.includes('u15_n5'));

  // Review outcome awards +5 XP and does not mark legendary
  const reviewOutcome = evaluateSessionOutcome({
    mode: 'lesson',
    variant: 'review',
    lessonId: 'u15_n2',
    targetUnitIndex: null,
    score: 5,
    totalQuestions: 5,
    xpReward: REVIEW_XP_REWARD,
  });
  assert.equal(reviewOutcome.earnedXp, 5);
  assert.equal(Boolean(reviewOutcome.markLegendary), false);
  const afterReview = applySessionResult(afterStory, reviewOutcome);
  assert.equal(afterReview.xp, 20);
  assert.deepEqual(afterReview.legendaryLessons ?? [], []);

  // Legendary outcome awards +40 XP and persists legendaryLessons crown idempotently
  const legendaryOutcome = evaluateSessionOutcome({
    mode: 'lesson',
    variant: 'legendary',
    lessonId: 'u15_n2',
    targetUnitIndex: null,
    score: 10,
    totalQuestions: 10,
    xpReward: LEGENDARY_XP_REWARD,
  });
  assert.equal(legendaryOutcome.earnedXp, 40);
  assert.equal(legendaryOutcome.markLegendary, true);
  assert.equal(legendaryOutcome.emoji, '👑');
  const afterLegendary = applySessionResult(afterReview, legendaryOutcome);
  assert.equal(afterLegendary.xp, 60);
  assert.deepEqual(afterLegendary.legendaryLessons, ['u15_n2']);

  // Repeating Legendary doesn't duplicate the lessonId in legendaryLessons
  const afterLegendaryAgain = applySessionResult(afterLegendary, legendaryOutcome);
  assert.equal(afterLegendaryAgain.xp, 100);
  assert.deepEqual(afterLegendaryAgain.legendaryLessons, ['u15_n2']);
});

test('formatForArabicTTS preserves single-word final Harakat and applies Sun-letter assimilation, Hamzat al-Wasl elision, and multi-word pausal Sukoon', () => {
  // 1. Single-word taps preserve exact final Harakat ("Al-masjidu") while applying Sun-letter assimilation
  assert.equal(formatForArabicTTS('الْمَسْجِدُ'), 'الْمَسْجِدُ');
  assert.equal(formatForArabicTTS('كَالْمَاءِ'), 'كَالْمَاءِ');
  assert.equal(formatForArabicTTS('كَالْبَيْتِ'), 'كَالْبَيْتِ');
  assert.equal(formatForArabicTTS('كَالسَّيْفِ'), 'كَسَّيْفِ');
  assert.equal(formatForArabicTTS('بِالسَّيَّارَةِ'), 'بِسَّيَّارَةِ');
  assert.equal(formatForArabicTTS('وَالشَّمْسُ'), 'وَشَّمْسُ');
  assert.equal(formatForArabicTTS('فَالسَّفَرُ'), 'فَسَّفَرُ');
  assert.equal(formatForArabicTTS('لِلسَّفَرِ'), 'لِسَّفَرِ');

  // 2. Full multi-word sentences apply Sun-letter assimilation, Hamzat al-Wasl elision, and end-of-sentence pausal Sukoon
  assert.equal(formatForArabicTTS('السَّلَامُ عَلَيْكُمْ'), 'اسَّلَامُ عَلَيْكُمْ');
  assert.equal(formatForArabicTTS('أَيْنَ الْمَسْجِدُ؟'), 'أَيْنَ الْمَسْجِدْ؟');
  assert.equal(formatForArabicTTS('الْوَقْتُ كَالسَّيْفِ'), 'الْوَقْتُ كَسَّيْفْ');
  assert.equal(
    formatForArabicTTS('الْوَقْتُ كَالسَّيْفِ إِنْ لَمْ تَقْطَعْهُ قَطَعَكَ'),
    'الْوَقْتُ كَسَّيْفِ إِنْ لَمْ تَقْطَعْهُ قَطَعَكْ'
  );

  // 3. Tanween Fath (-an) stays intact
  assert.equal(formatForArabicTTS('شُكْرًا'), 'شُكْرًا');
  assert.equal(formatForArabicTTS('مَرْحَبًا'), 'مَرْحَبًا');
  assert.equal(formatForArabicTTS('سَفَرًا سَعِيدًا'), 'سَفَرًا سَعِيدًا');

  // 4. Single-letter Harakat syllables stay intact for Alphabet & Unit 1
  assert.equal(formatForArabicTTS('ب'), 'ب');
  assert.equal(formatForArabicTTS('بَ'), 'بَ');
  assert.equal(formatForArabicTTS('جِ'), 'جِ');
  assert.equal(formatForArabicTTS('تُ'), 'تُ');

  // 5. Divine Name Allah is never stripped of its Lam
  assert.equal(formatForArabicTTS('إِنْ شَاءَ اللّٰهُ'), 'إِنْ شَاءَ اللّٰهْ');
  assert.equal(formatForArabicTTS('الْحَمْدُ لِلّٰهِ'), 'الْحَمْدُ لِلّٰهْ');

  // 6. Hamed Neural URL encodes the formatted pronunciation while UI keeps original Arabic
  assert.equal(
    buildHamedNeuralTtsUrl('الْوَقْتُ كَالسَّيْفِ'),
    `speech://ar-SA-HamedNeural?text=${encodeURIComponent('الْوَقْتُ كَسَّيْفْ')}`
  );
  assert.equal(
    buildHamedNeuralTtsUrl('الْمَسْجِدُ'),
    `speech://ar-SA-HamedNeural?text=${encodeURIComponent('الْمَسْجِدُ')}`
  );

  // 7. Verify Malayalam transliterations for كَالسَّيْفِ / كَالْمَاءِ / كَالْبَيْتِ match natural spoken Arabic
  const u25n2 = UNITS[24].lessons[1];
  const swordFb = u25n2.questions.find(
    (q) => q.type === 'fill_blank' && q.options.includes('كَالسَّيْفِ')
  );
  assert.ok(swordFb && swordFb.type === 'fill_blank');
  assert.equal(swordFb.optionTranslits?.['كَالسَّيْفِ'], 'കസ്സയ്ഫ്');
  assert.equal(swordFb.optionTranslits?.['كَالْمَاءِ'], 'കൽമാഅ്');
  assert.equal(swordFb.optionTranslits?.['كَالْبَيْتِ'], 'കൽബയ്ത്');

  // 8. Connected Hamzatul Wasl prepositions before ال
  assert.equal(formatForArabicTTS('فِي الْمَسْجِدِ'), 'فِلْمَسْجِدْ');
  assert.equal(formatForArabicTTS('فِي السُّوقِ'), 'فِسُّوقْ');
  assert.equal(formatForArabicTTS('أَنَا أَذْهَبُ إِلَى الْمَسْجِدِ'), 'أَنَا أَذْهَبُ إِلَلْمَسْجِدْ');
  assert.equal(formatForArabicTTS('الْكِتَابُ عَلَى الطَّاوِلَةِ'), 'الْكِتَابُ عَلَطَّاوِلَةْ');
  assert.equal(formatForArabicTTS('أَنَا مِنَ الْهِنْدِ'), 'أَنَا مِنَلْهِنْدْ');
  assert.equal(formatForArabicTTS('فِي اللّٰهِ'), 'فِي اللّٰهْ');
});

test('hisnmuslim.com Du-a MP3 routing and exclusive ar-SA-HamedNeural prioritization with ar-SA offline fallback work accurately', () => {
  // 1. Direct MP3 endpoints from hisnmuslim.com for Du'as & Dhikr
  const duaExpectations: Array<[string, string]> = [
    ['بِسْمِ اللّٰهِ تَوَكَّلْتُ عَلَى اللّٰهِ', 'https://www.hisnmuslim.com/audio/ar/16.mp3'],
    ['جَزَاكَ اللّٰهُ خَيْرًا', 'https://www.hisnmuslim.com/audio/ar/198.mp3'],
    ['غُفْرَانَكَ', 'https://www.hisnmuslim.com/audio/ar/11.mp3'],
    ['اَلْحَمْدُ لِلّٰهِ الَّذِي أَحْيَانَا', 'https://www.hisnmuslim.com/audio/ar/1.mp3'],
    ['سُبْحَانَ اللّٰهِ وَبِحَمْدِهِ', 'https://www.hisnmuslim.com/audio/ar/91.mp3'],
    ['اللّٰهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْخُبْثِ وَالْخَبَائِثِ', 'https://www.hisnmuslim.com/audio/ar/10.mp3'],
  ];

  for (const [duaText, expectedUrl] of duaExpectations) {
    assert.ok(normalizeDuaLookupKey(duaText).length > 0);
    assert.equal(getDuaAudioUrl(duaText), expectedUrl);
    assert.equal(buildArabicTtsUrl(duaText), expectedUrl);

    const sources = buildArabicAudioSources(duaText);
    assert.equal(sources.length, 1);
    assert.equal(sources[0].provider, 'hisnmuslim');
    assert.equal(sources[0].url, expectedUrl);
    assert.equal(sources[0].crossOrigin, true);
  }

  // Non-Du'a lesson sentence must NOT accidentally match HisnMuslim MP3
  assert.equal(getDuaAudioUrl('كَالسَّيْفِ'), null);
  assert.equal(getDuaAudioUrl('أَيْنَ الْمَسْجِدُ؟'), null);

  // 2. Exclusive Hamed Neural primary voice + ar-SA offline fallback
  const espeakVoice = { name: 'Arabic eSpeak', lang: 'ar' };
  const googleVoice = { name: 'Google العربية', lang: 'ar-SA' };
  const magedVoice = { name: 'Maged', lang: 'ar-SA' };
  const hamedVoice = { name: 'Microsoft Hamed Online (Natural) - Arabic (Saudi Arabia)', lang: 'ar-SA' };
  const englishVoice = { name: 'Microsoft Aria Online (Natural) - English', lang: 'en-US' };

  assert.equal(selectBestArabicVoice([englishVoice]), null);
  assert.equal(selectBestArabicVoice([englishVoice, espeakVoice]), espeakVoice);
  assert.equal(isHamedNeuralVoice(espeakVoice), false);
  assert.equal(isHamedNeuralVoice(googleVoice), false);
  assert.equal(isHamedNeuralVoice(magedVoice), false);
  assert.equal(isHamedNeuralVoice(hamedVoice), true);
  assert.equal(isPremiumNeuralArabicVoice(hamedVoice), true);
  assert.equal(isPremiumNeuralArabicVoice(magedVoice), false);

  // When offline / Hamed unavailable, gracefully falls back to ar-SA voices
  assert.equal(selectBestArabicVoice([espeakVoice, googleVoice]), googleVoice);
  assert.equal(selectBestArabicVoice([espeakVoice, magedVoice]), magedVoice);

  // Whenever Hamed Neural is available, Hamed wins exclusively over all other voices
  assert.equal(selectBestArabicVoice([espeakVoice, googleVoice, magedVoice, hamedVoice]), hamedVoice);
});

test('all 35 units include all 3 Arabic Radio / Podcast formats (radio_tf, radio_select3, radio_mcq) on Node 6 with valid clips, distractors, and Audio-Only First gating', () => {
  let trueCount = 0;
  let falseCount = 0;

  for (const unit of UNITS) {
    const node6 = unit.lessons[5];
    assert.equal(node6.id, `${unit.id}_n6`);
    assert.equal(node6.nodeType, 'listening');

    const tfQ = node6.questions.find((q) => q.type === 'radio_tf');
    const select3Q = node6.questions.find((q) => q.type === 'radio_select3');
    const mcqQ = node6.questions.find((q) => q.type === 'radio_mcq');

    assert.ok(tfQ && tfQ.type === 'radio_tf', `${node6.id} must include radio_tf`);
    assert.ok(select3Q && select3Q.type === 'radio_select3', `${node6.id} must include radio_select3`);
    assert.ok(mcqQ && mcqQ.type === 'radio_mcq', `${node6.id} must include radio_mcq`);

    if (tfQ.answer) trueCount += 1;
    else falseCount += 1;

    // Audio-Only First + pure vocalized Arabic + non-empty transcript/translation for all 3 formats
    for (const pq of [tfQ, select3Q, mcqQ]) {
      assert.equal(isPodcastQuestion(pq), true);
      assert.equal(
        shouldShowArabicPromptCard(pq),
        false,
        `${node6.id} ${pq.type} must be Audio-Only First (no standard Arabic prompt card)`
      );
      assert.ok(/[\u0621-\u064A]/.test(pq.arabic), `${node6.id} ${pq.type} needs Arabic audio text`);
      assert.equal(
        /[\u0D00-\u0D7F]/.test(pq.arabic),
        false,
        `${node6.id} ${pq.type} spoken Arabic clip must not contain Malayalam characters`
      );
      assert.ok(pq.translit.trim().length > 0, `${node6.id} ${pq.type} needs Malayalam translit`);
      assert.ok(pq.transcriptAr.trim().length > 0, `${node6.id} ${pq.type} needs transcriptAr`);
      assert.ok(pq.transcriptMl.trim().length > 0, `${node6.id} ${pq.type} needs transcriptMl`);
      assert.ok(
        pq.callerAvatar === '🧕' || pq.callerAvatar === '🧔',
        `${node6.id} ${pq.type} callerAvatar must be 🧕 or 🧔`
      );
      const audioClips = collectQuestionArabicTexts(pq);
      assert.ok(audioClips.includes(pq.arabic.trim()), `${node6.id} ${pq.type} must preload spoken audio`);
    }

    // radio_tf checks
    assert.ok(tfQ.statementMl.trim().length > 0);
    assert.equal(typeof tfQ.answer, 'boolean');

    // radio_select3 checks: 5 unique chips (3 spoken in audio + 2 non-overlapping distractors)
    assert.equal(select3Q.words.length, 5, `${node6.id} radio_select3 must have 5 word chips`);
    assert.equal(select3Q.answers.length, 3, `${node6.id} radio_select3 must have 3 spoken answers`);
    const normalizedWords = select3Q.words.map((w) => normalizeWordBankText(w));
    assert.equal(new Set(normalizedWords).size, 5, `${node6.id} radio_select3 word chips must be unique`);
    const clipNorm = normalizeWordBankText(select3Q.arabic);
    for (const ans of select3Q.answers) {
      assert.ok(select3Q.words.includes(ans), `${node6.id} radio_select3 answer "${ans}" must be in words`);
      assert.ok(
        clipNorm.includes(normalizeWordBankText(ans)),
        `${node6.id} radio_select3 answer "${ans}" must appear in spoken clip "${select3Q.arabic}"`
      );
    }
    const answerSet = new Set(select3Q.answers.map((a) => normalizeWordBankText(a)));
    const distractors = select3Q.words.filter((w) => !answerSet.has(normalizeWordBankText(w)));
    assert.equal(distractors.length, 2, `${node6.id} radio_select3 must have exactly 2 distractors`);

    // radio_mcq checks: 3 unique Malayalam choices containing exact answer
    assert.equal(mcqQ.options.length, 3, `${node6.id} radio_mcq must have 3 vertically stacked options`);
    assert.equal(new Set(mcqQ.options).size, 3, `${node6.id} radio_mcq options must be unique`);
    assert.ok(mcqQ.options.includes(mcqQ.answer), `${node6.id} radio_mcq options must include exact answer`);
  }

  assert.ok(trueCount >= 15 && falseCount >= 15, `Expected balanced True/False mix across 35 units, got ${trueCount}T/${falseCount}F`);
});

test('Podcast evaluation, Fisher-Yates shuffling, Mistake Review Queue, and 10-12 session weaving work accurately', () => {
  const u2n6 = UNITS[1].lessons[5];
  const tfQ = u2n6.questions.find((q) => q.type === 'radio_tf')!;
  const select3Q = u2n6.questions.find((q) => q.type === 'radio_select3')!;
  const mcqQ = u2n6.questions.find((q) => q.type === 'radio_mcq')!;
  assert.equal(tfQ.type, 'radio_tf');
  assert.equal(select3Q.type, 'radio_select3');
  assert.equal(mcqQ.type, 'radio_mcq');

  // 1. Evaluation: radio_tf
  assert.equal(evaluateQuestionAnswer(tfQ, String(tfQ.answer), []).correct, true);
  assert.equal(evaluateQuestionAnswer(tfQ, String(!tfQ.answer), []).correct, false);

  // 2. Evaluation: radio_select3 (order-independent, diacritic-tolerant, requires exactly 3)
  assert.equal(areRadioSelect3AnswersEqual([...select3Q.answers].reverse(), select3Q.answers), true);
  assert.equal(evaluateQuestionAnswer(select3Q, null, [...select3Q.answers].reverse()).correct, true);
  assert.equal(evaluateQuestionAnswer(select3Q, null, select3Q.answers.slice(0, 2)).correct, false);
  const wrongChip = select3Q.words.find((w) => !select3Q.answers.includes(w))!;
  assert.equal(
    evaluateQuestionAnswer(select3Q, null, [select3Q.answers[0], select3Q.answers[1], wrongChip]).correct,
    false
  );

  // 3. Evaluation: radio_mcq
  assert.equal(evaluateQuestionAnswer(mcqQ, mcqQ.answer, []).correct, true);
  const wrongMcqOpt = mcqQ.options.find((o) => o !== mcqQ.answer)!;
  assert.equal(evaluateQuestionAnswer(mcqQ, wrongMcqOpt, []).correct, false);

  // 4. Shuffling via prepareSessionQuestions preserves all chips/options and exact answers
  const [prepTf, prepS3, prepMcq] = prepareSessionQuestions([tfQ, select3Q, mcqQ]);
  assert.equal(prepTf.type, 'radio_tf');
  assert.equal(prepS3.type, 'radio_select3');
  assert.equal(prepMcq.type, 'radio_mcq');
  if (prepS3.type === 'radio_select3') {
    assert.equal(prepS3.words.length, 5);
    assert.deepEqual([...prepS3.words].sort(), [...select3Q.words].sort());
  }
  if (prepMcq.type === 'radio_mcq') {
    assert.equal(prepMcq.options.length, 3);
    assert.ok(prepMcq.options.includes(prepMcq.answer));
  }

  // 5. Mistake Review Queue re-queues missed podcast questions in lesson mode only
  const queued = enqueueMistakeForReview([select3Q, mcqQ], select3Q, 'lesson');
  assert.equal(queued.length, 3);
  assert.equal(queued[2].isReview, true);
  assert.equal(queued[2].type, 'radio_select3');
  assert.equal(enqueueMistakeForReview([select3Q], select3Q, 'placement').length, 1);

  // 6. Node 6 session includes all 3 podcast formats AND regular lessons weave in podcast questions
  const node6Session = buildLessonSessionQuestions(u2n6, unlockLessonsUpToUnit([], 1), UNITS);
  assert.equal(node6Session.length, 12);
  assert.ok(node6Session.some((q) => q.type === 'radio_tf'));
  assert.ok(node6Session.some((q) => q.type === 'radio_select3'));
  assert.ok(node6Session.some((q) => q.type === 'radio_mcq'));

  const regularLesson = UNITS[1].lessons[1]; // u2_n2
  const regularSession = buildLessonSessionQuestions(regularLesson, unlockLessonsUpToUnit([], 1), UNITS);
  assert.ok(regularSession.length >= 10 && regularSession.length <= 12);
  assert.ok(regularSession.some(isPodcastQuestion), 'Regular 10-12 question lessons should weave in at least 1 Podcast question');
});

test('Dictation ("Type What You Hear") Harakat-insensitive normalization, quick-key set, Audio-Only gating, Mistake Review Queue, and 35-unit weaving work accurately', () => {
  // 1. Mini Arabic Quick-Key Helper contains all 35 required Arabic letters
  const expectedKeys = 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي ة ى أ إ آ ئ ؤ'.split(' ');
  assert.deepEqual([...ARABIC_QUICK_KEYS], expectedKeys);
  assert.equal(ARABIC_QUICK_KEYS.length, 35);

  // 2. Smart Harakat-insensitive normalization & Alef/Yaa/Tatweel/Punctuation handling
  assert.equal(normalizeArabicDictation('السَّلَامُ عَلَيْكُمْ'), 'السلام عليكم');
  assert.equal(normalizeArabicDictation('أَيْنَ الْمَسْجِدُ؟'), 'اين المسجد');
  assert.equal(normalizeArabicDictation('إِلَى الْمَسْجِدِ'), 'الي المسجد');
  assert.equal(normalizeArabicDictation('اللّٰهُ أَكْبَرُ!'), 'الله اكبر');
  assert.equal(normalizeArabicDictation('مَرْحَـبًا!'), 'مرحبا');
  assert.equal(normalizeArabicDictation('هٰذَا كِتَابٌ.'), 'هذا كتاب');

  assert.equal(areDictationAnswersEqual('السلام عليكم', 'السَّلَامُ عَلَيْكُمْ'), true);
  assert.equal(areDictationAnswersEqual('اين المسجد', 'أَيْنَ الْمَسْجِدُ؟'), true);
  assert.equal(areDictationAnswersEqual('الى المسجد', 'إِلَى الْمَسْجِدِ'), true);
  assert.equal(areDictationAnswersEqual('الي المسجد', 'إِلَى الْمَسْجِدِ'), true);
  assert.equal(areDictationAnswersEqual('شكرا', 'شُكْرًا'), true);
  assert.equal(areDictationAnswersEqual('آمين', 'أَمِين'), true);
  assert.equal(areDictationAnswersEqual('مرحبـا', 'مَرْحَبًا!'), true);
  assert.equal(areDictationAnswersEqual('هذا كتاب', 'هٰذَا كِتَابٌ.'), true);

  // Rejects empty or wrong answers
  assert.equal(areDictationAnswersEqual('', 'السَّلَامُ عَلَيْكُمْ'), false);
  assert.equal(areDictationAnswersEqual('   ', 'السَّلَامُ عَلَيْكُمْ'), false);
  assert.equal(areDictationAnswersEqual('مكتب', 'كِتَابٌ'), false);
  assert.equal(areDictationAnswersEqual('مساء الخير', 'صَبَاحُ الْخَيْرِ'), false);

  // 3. Evaluation, Audio-Only First gating, audio preloading, and Mistake Review Queue
  const sampleDict: LessonQuestion = {
    type: 'dictation',
    prompt: 'ശബ്ദം കേട്ട് അറബിയിൽ ടൈപ്പ് ചെയ്യുക',
    arabic: 'السَّلَامُ عَلَيْكُمْ',
    translit: 'അസ്സലാമു അലൈക്കും',
    meaningMl: 'നിങ്ങൾക്ക് സമാധാനം ഉണ്ടാകട്ടെ',
    avatar: '🧕',
  };
  assert.equal(shouldShowArabicPromptCard(sampleDict), false);
  assert.ok(collectQuestionArabicTexts(sampleDict).includes('السَّلَامُ عَلَيْكُمْ'));
  assert.equal(evaluateQuestionAnswer(sampleDict, 'السلام عليكم', []).correct, true);
  assert.equal(evaluateQuestionAnswer(sampleDict, 'السَّلَامُ عَلَيْكُمْ', []).correct, true);
  assert.equal(evaluateQuestionAnswer(sampleDict, 'مرحبا', []).correct, false);
  assert.equal(evaluateQuestionAnswer(sampleDict, 'مرحبا', []).expectedDisplay, 'السَّلَامُ عَلَيْكُمْ');

  const queued = enqueueMistakeForReview([sampleDict], sampleDict, 'lesson');
  assert.equal(queued.length, 2);
  assert.equal(queued[1].type, 'dictation');
  assert.equal(queued[1].isReview, true);
  assert.equal(enqueueMistakeForReview([sampleDict], sampleDict, 'placement').length, 1);

  // 4. All 35 units weave 1-2 dictation questions into regular lessons and 2 into Hard Practice nodes
  let seed = 101;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let uIdx = 0; uIdx < UNITS.length; uIdx++) {
    const unit = UNITS[uIdx];
    const priorCompleted = unlockLessonsUpToUnit([], uIdx);
    for (const lesson of unit.lessons) {
      if (lesson.nodeType === 'chest' || lesson.nodeType === 'video_call') continue;
      const session = buildLessonSessionQuestions(lesson, priorCompleted, UNITS, rng);
      const dictations = session.filter((q) => q.type === 'dictation');
      assert.ok(
        dictations.length >= 1 && dictations.length <= 2,
        `${lesson.id} (${lesson.nodeType}) should include 1-2 dictation questions, got ${dictations.length}`
      );
      if (lesson.nodeType === 'hard') {
        assert.equal(
          dictations.length,
          2,
          `${lesson.id} Hard Practice node must include 2 dictation questions, got ${dictations.length}`
        );
      }
      for (const dq of dictations) {
        if (dq.type !== 'dictation') continue;
        assert.equal(shouldShowArabicPromptCard(dq), false);
        assert.ok(/[\u0621-\u064A]/.test(dq.arabic), `${lesson.id} dictation needs Arabic text`);
        assert.equal(/[\u0D00-\u0D7F]/.test(dq.arabic), false, `${lesson.id} dictation arabic must not contain Malayalam`);
        assert.ok(dq.meaningMl.trim().length > 0, `${lesson.id} dictation needs Malayalam meaning`);
        assert.ok(dq.avatar === '🧕' || dq.avatar === '👳‍♂️');
      }
    }
  }

  // 5. Legendary mode includes dictation challenges
  const u2n2 = UNITS[1].lessons[1];
  const legQs = buildLegendarySessionQuestions(u2n2, UNITS, rng);
  assert.equal(legQs.length, LEGENDARY_QUESTION_COUNT);
  assert.ok(legQs.some((q) => q.type === 'dictation'), 'Legendary mode should include dictation questions');
});

test('Auto-scroll progress helpers accurately resolve active lesson node, sticky unit banner index, and floating jump direction', () => {
  const allIds = getAllLessonIds();
  assert.equal(allIds.length, 301);

  // 1. Fresh learner starts on u1_n1
  assert.equal(getActiveNodeTargetId([], UNITS), 'u1_n1');

  // 2. Completing Units 1-11 lands directly on Unit 12 Node 1 (u12_n1)
  const completed11Units = unlockLessonsUpToUnit([], 11);
  assert.equal(completed11Units.length, 88);
  assert.equal(getActiveNodeTargetId(completed11Units, UNITS), 'u12_n1');

  // 3. Completing partial nodes in Unit 12 advances to the exact next incomplete node
  assert.equal(
    getActiveNodeTargetId([...completed11Units, 'u12_n1', 'u12_n2'], UNITS),
    'u12_n3'
  );

  // 4. Completing all 280 nodes falls back safely to the final capstone trophy node u35_n8
  assert.equal(getActiveNodeTargetId(allIds, UNITS), 'u35_n8');

  // 5. Sticky Unit Banner index tracks whichever unit intersects the top anchor line (anchorY = 140)
  const sampleRects = [
    { unitIndex: 0, top: -900, bottom: -120 },
    { unitIndex: 1, top: -100, bottom: 720 },
    { unitIndex: 2, top: 760, bottom: 1580 },
  ];
  assert.equal(computeVisibleUnitIndex(sampleRects, 140), 1);
  // Scrolled near top -> Unit 0
  assert.equal(
    computeVisibleUnitIndex(
      [
        { unitIndex: 0, top: 180, bottom: 980 },
        { unitIndex: 1, top: 1020, bottom: 1820 },
      ],
      140
    ),
    0
  );
  // Scrolled deep down into Unit 24 -> Unit 24
  assert.equal(
    computeVisibleUnitIndex(
      [
        { unitIndex: 23, top: -820, bottom: 40 },
        { unitIndex: 24, top: 80, bottom: 920 },
        { unitIndex: 25, top: 960, bottom: 1800 },
      ],
      140
    ),
    24
  );

  // 6. Floating "Jump to Current Lesson" button direction ('up' | 'down' | null)
  // Active node centered in viewport (900px tall) -> hidden (null)
  assert.equal(computeJumpButtonDirection({ top: 380, bottom: 520 }, 900, 120, 92), null);
  // User scrolled far down (active node is above top offset) -> 'up'
  assert.equal(computeJumpButtonDirection({ top: -400, bottom: -260 }, 900, 120, 92), 'up');
  // User scrolled far up (active node is below bottom offset) -> 'down'
  assert.equal(computeJumpButtonDirection({ top: 1200, bottom: 1340 }, 900, 120, 92), 'down');
  // Partially intersecting safe zone remains hidden so it never flickers while centered
  assert.equal(computeJumpButtonDirection({ top: 100, bottom: 240 }, 900, 120, 92), null);
  assert.equal(computeJumpButtonDirection({ top: 740, bottom: 860 }, 900, 120, 92), null);
});

test('Speaking Exercise (speak) strips Harakat/punctuation with 70% word-match threshold and appears EXCLUSIVELY in Units 20 to 35', () => {
  assert.equal(SPEAK_MIN_UNIT_NUMBER, 20);
  assert.equal(SPEAK_MATCH_THRESHOLD, 0.7);

  // 1. Harakat/Tashkeel, punctuation, Alef/Yaa/Taa-Marbuta normalization
  assert.equal(normalizeArabicSpeech('الْمَدْرَسَةُ الْكَبِيرَةُ!'), 'المدرسه الكبيره');
  assert.equal(normalizeArabicSpeech('إِلَى الْمَسْجِدِ؟'), 'الي المسجد');

  // 2. 70% word-match acceptance & rejection
  // 4-word sentence: 3/4 = 75% >= 70% -> PASS; 2/4 = 50% < 70% -> FAIL
  const target4 = 'أُرِيدُ أَنْ أَتَعَلَّمَ الْعَرَبِيَّةَ';
  const pass75 = evaluateSpeechMatch('اريد ان اتعلم', target4);
  assert.equal(pass75.matched, true);
  assert.equal(pass75.matchedCount, 3);
  assert.equal(pass75.totalWords, 4);
  assert.equal(pass75.wordStatuses[3].matched, false);

  const fail50 = evaluateSpeechMatch('اريد ان', target4);
  assert.equal(fail50.matched, false);
  assert.equal(fail50.matchedCount, 2);

  // Repeating one word 4 times must NOT pass the 70% threshold
  const repeatCheat = evaluateSpeechMatch('اريد اريد اريد اريد', target4);
  assert.equal(repeatCheat.matched, false);
  assert.equal(repeatCheat.matchedCount, 1);

  // Exact full vocalized vs unvocalized match with Taa Marbuta -> Haa
  const taaMatch = evaluateSpeechMatch('المدرسه الكبيره جميله', 'الْمَدْرَسَةُ الْكَبِيرَةُ جَمِيلَةٌ.');
  assert.equal(taaMatch.matched, true);
  assert.equal(taaMatch.ratio, 1);

  // Empty transcript -> rejected
  assert.equal(evaluateSpeechMatch('', target4).matched, false);

  // 3. Question evaluation & audio preloading
  const sampleSpeak: LessonQuestion = {
    type: 'speak',
    prompt: 'കേട്ട ശേഷം ഉറക്കെ വായിക്കുക',
    arabic: 'بَابُ الْمَسْجِدِ مَفْتُوحٌ',
    translit: 'ബാബുൽ മസ്ജിദി മഫ്തൂഹുൻ',
    meaningMl: 'പള്ളിയുടെ വാതിൽ തുറന്നിരിക്കുന്നു',
    avatar: '🧕',
  };
  assert.equal(shouldShowArabicPromptCard(sampleSpeak), false);
  assert.ok(collectQuestionArabicTexts(sampleSpeak).includes('بَابُ الْمَسْجِدِ مَفْتُوحٌ'));
  assert.equal(evaluateQuestionAnswer(sampleSpeak, 'باب المسجد مفتوح', []).correct, true);
  assert.equal(evaluateQuestionAnswer(sampleSpeak, 'باب المسجد', []).correct, false); // 2/3 = 66.7% < 70%

  // 4. Exclusive Unit 20–35 gating across ALL 35 units (245 non-chest nodes)
  let seed = 2026;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let uIdx = 0; uIdx < UNITS.length; uIdx++) {
    const unit = UNITS[uIdx];
    const priorCompleted = unlockLessonsUpToUnit([], uIdx);
    for (const lesson of unit.lessons) {
      if (lesson.nodeType === 'chest' || lesson.nodeType === 'video_call') continue;
      const session = buildLessonSessionQuestions(lesson, priorCompleted, UNITS, rng);
      const speakQs = session.filter((q) => q.type === 'speak');

      if (unit.number < 20) {
        assert.equal(
          speakQs.length,
          0,
          `Unit ${unit.number} (${lesson.id}) must have 0 speaking exercises, got ${speakQs.length}`
        );
      } else {
        assert.ok(
          speakQs.length >= 1 && speakQs.length <= 2,
          `Unit ${unit.number} (${lesson.id}) must include 1-2 speaking exercises, got ${speakQs.length}`
        );
        for (const sq of speakQs) {
          if (sq.type !== 'speak') continue;
          assert.ok(/[\u0621-\u064A]/.test(sq.arabic), `${lesson.id} speak needs Arabic sentence`);
          assert.equal(/[\u0D00-\u0D7F]/.test(sq.arabic), false, `${lesson.id} speak arabic must not contain Malayalam`);
          assert.ok(sq.meaningMl.trim().length > 0, `${lesson.id} speak needs Malayalam meaning`);
          assert.ok(sq.avatar === '🧕' || sq.avatar === '👳‍♂️');
        }
      }
    }
  }

  // 5. Legendary & Review sessions in Units 1-19 stay free of speaking prompts
  const u19Leg = buildLegendarySessionQuestions(UNITS[18].lessons[1], UNITS, rng);
  assert.equal(u19Leg.filter((q) => q.type === 'speak').length, 0);
  const u20Leg = buildLegendarySessionQuestions(UNITS[19].lessons[1], UNITS, rng);
  assert.ok(u20Leg.some((q) => q.type === 'speak'), 'Unit 20 Legendary should include speaking challenges');
});

test('Instant synchronous localStorage persistence, pre-render hydration, and monotonic cloud merge prevent refresh progress resets', () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };
  const key = 'arabic_ml_app_state_v3';

  // 1. Synchronous persistence writes completedLessons, xp, streak, hearts, activeTab, and currentUnitId immediately
  const completed14 = unlockLessonsUpToUnit([], 14);
  const saved = persistUserStateSync(mockStorage, key, {
    ...baseUser,
    xp: 640,
    streak: 9,
    hearts: 4,
    completedLessons: [...completed14, 'u15_n1', 'u15_n2'],
    activeTab: 'alphabet',
    currentUnitId: 'u15',
  });
  assert.equal(saved.activeTab, 'alphabet');
  assert.equal(saved.currentUnitId, 'u15');
  assert.ok(store.has(key));

  // 2. Pre-render hydration restores exact progress, tab, and active unit without jumping back to Unit 1
  const hydrated = hydratePersistedUserState(mockStorage, key, baseUser, {
    now: new Date('2026-11-20T12:00:00Z'),
  });
  assert.equal(hydrated.xp, 640);
  assert.equal(hydrated.streak, 9);
  assert.equal(hydrated.hearts, 4);
  assert.equal(hydrated.activeTab, 'alphabet');
  assert.equal(hydrated.currentUnitId, 'u15');
  assert.equal(getActiveNodeTargetId(hydrated.completedLessons, UNITS), 'u15_n3');
  assert.equal(resolveCurrentUnitId(hydrated.completedLessons, UNITS), 'u15');
  assert.equal(normalizeAppTab('invalid_tab'), 'path');

  // 3. Monotonic cloud merge never regresses local progress when cloud snapshot is stale
  const staleCloud = {
    xp: 200,
    streak: 3,
    completedLessons: ['u1_n1', 'u1_n2'],
  };
  const staleMerge = mergeCloudUserState(hydrated, staleCloud);
  assert.equal(staleMerge.changed, false);
  assert.equal(staleMerge.state.xp, 640);
  assert.equal(staleMerge.state.completedLessons.length, hydrated.completedLessons.length);

  // 4. Newer cloud progress merges cleanly without losing local completions or activeTab
  const newerCloud = {
    xp: 720,
    streak: 11,
    completedLessons: [...hydrated.completedLessons, 'u15_n3'],
    legendaryLessons: ['u15_n1'],
  };
  const newerMerge = mergeCloudUserState(hydrated, newerCloud);
  assert.equal(newerMerge.changed, true);
  assert.equal(newerMerge.state.xp, 720);
  assert.equal(newerMerge.state.streak, 11);
  assert.equal(newerMerge.state.activeTab, 'alphabet');
  assert.equal(newerMerge.state.currentUnitId, 'u15');
  assert.ok(newerMerge.state.completedLessons.includes('u15_n3'));
  assert.deepEqual(newerMerge.state.legendaryLessons, ['u15_n1']);
});

test('Video Call Roleplay (video_call) appears EXCLUSIVELY in Units 15 to 35 as open-topic Tariq calls with unified title, open greeting, and word-count bonus XP', () => {
  assert.equal(VIDEO_CALL_MIN_UNIT_NUMBER, 15);
  assert.equal(VIDEO_CALL_BASE_XP, 15);
  assert.equal(VIDEO_CALL_XP_PER_WORD, 2);
  assert.equal(VIDEO_CALL_MAX_BONUS_XP, 35);
  assert.equal(Object.keys(UNIT_VIDEO_CALLS).length, 21);

  // 1. Units 1-14 must have ZERO video_call nodes; Units 15-35 must each have 1 open-topic Tariq video_call node
  for (const unit of UNITS) {
    const vcNodes = unit.lessons.filter((l) => l.nodeType === 'video_call');
    if (unit.number < 15) {
      assert.equal(vcNodes.length, 0, `${unit.id} must NOT have a video_call node`);
    } else {
      assert.equal(vcNodes.length, 1, `${unit.id} must have exactly 1 video_call node`);
      const vcNode = vcNodes[0];
      assert.equal(vcNode.id, `${unit.id}_vc`);
      assert.equal(vcNode.icon, '📹');
      assert.equal(vcNode.title, VIDEO_CALL_NODE_TITLE_ML);
      assert.equal(vcNode.title, 'വീഡിയോ കോൾ: താരിഖുമായി സംസാരിക്കാം');
      assert.ok(vcNode.videoCall, `${vcNode.id} must attach VideoCallScenario`);

      const scenario = vcNode.videoCall;
      assert.equal(scenario.characterKey, 'tariq', `${vcNode.id} must feature Tariq`);
      assert.equal(scenario.characterAvatar, '👳‍♂️');
      assert.equal(scenario.sceneTitleMl, 'വീഡിയോ കോൾ: താരിഖുമായി സംസാരിക്കാം');
      assert.equal(scenario.turns.length, 5, `${vcNode.id} must have 5 conversational turns`);
      assert.equal(
        scenario.turns[0].characterAr,
        TARIQ_OPENING_GREETING_AR,
        `${vcNode.id} must open with Tariq open-topic greeting`
      );
      assert.equal(
        scenario.turns[0].characterAr,
        'أَهْلًا وَسَهْلًا يَا صَدِيقِي! كَيْفَ حَالُكَ الْيَوْمَ؟ وَمَاذَا تُحِبُّ أَنْ نَتَحَدَّثَ عَنْهُ؟'
      );

      for (const turn of scenario.turns) {
        assert.ok(/[\u0621-\u064A]/.test(turn.characterAr), `${vcNode.id} turn needs Arabic question`);
        assert.ok(/[\u064B-\u0652]/.test(turn.characterAr), `${vcNode.id} turn must include Harakat`);
        assert.ok(turn.characterTr.trim().length > 0);
        assert.ok(turn.characterMl.trim().length > 0);
        assert.ok(/[\u0621-\u064A]/.test(turn.reactionAr), `${vcNode.id} turn needs Arabic reaction`);
        assert.ok(turn.suggestedReplies.length >= 2, `${vcNode.id} turn needs quick-reply suggestions`);
      }

      const audioLines = collectVideoCallArabicTexts(scenario);
      assert.ok(audioLines.length >= 5, `${vcNode.id} must collect Arabic lines for preloading`);
    }
  }

  // 2. Spoken Arabic word counting ignores English/Malayalam/punctuation and strips Harakat
  assert.equal(countSpokenArabicWords('أَنَا مُسَافِرٌ إِلَى دُبَي الْيَوْمَ!'), 5);
  assert.equal(countSpokenArabicWords('مَرْحَبًا يَا طَارِقُ'), 3);
  assert.equal(countSpokenArabicWords('hello 123'), 0);
  assert.equal(countSpokenArabicWords(''), 0);

  // 3. Proportional XP: Base 15 + 2 XP/word, capped at +35 bonus (50 XP max)
  assert.deepEqual(calculateVideoCallXp(0), { baseXp: 15, bonusXp: 0, totalXp: 15, spokenWords: 0 });
  assert.deepEqual(calculateVideoCallXp(10), { baseXp: 15, bonusXp: 20, totalXp: 35, spokenWords: 10 });
  assert.deepEqual(calculateVideoCallXp(25), { baseXp: 15, bonusXp: 35, totalXp: 50, spokenWords: 25 });

  // 4. Session outcome & persistence for completing u15_vc
  const xpCalc = calculateVideoCallXp(12); // 15 + 24 = 39 XP
  const outcome = evaluateSessionOutcome({
    mode: 'lesson',
    variant: 'video_call',
    lessonId: 'u15_vc',
    targetUnitIndex: null,
    score: 5,
    totalQuestions: 5,
    xpReward: xpCalc.totalXp,
  });
  assert.equal(outcome.earnedXp, 39);
  assert.equal(outcome.emoji, '📹');
  assert.equal(outcome.lessonId, 'u15_vc');

  const updated = applySessionResult(baseUser, outcome);
  assert.equal(updated.xp, 39);
  assert.ok(updated.completedLessons.includes('u15_vc'));
});

test('Open-topic Video Call Smart Arabic Responder understands meaning without parroting («...»), generates vocalized follow-ups, avoids repetition, and merges continuous speech across pauses', () => {
  const tariqScenario = UNIT_VIDEO_CALLS.u15;
  assert.ok(tariqScenario);

  // 1. Intent detection across rich open-topic Arabic inputs
  assert.equal(detectArabicIntent('السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللّٰهِ').intent, 'greeting');
  assert.equal(detectArabicIntent('كَيْفَ حَالُكَ أَنْتَ يَا طَارِقُ؟').intent, 'question_to_tariq');
  assert.equal(detectArabicIntent('أُرِيدُ قَهْوَةً عَرَبِيَّةً مَعَ التَّمْرِ').intent, 'food_drink');
  assert.equal(detectArabicIntent('سَأُسَافِرُ إِلَى دُبَي غَدًا').intent, 'travel');
  assert.equal(detectArabicIntent('أُمِّي وَأَبِي بِخَيْرٍ وَالْحَمْدُ لِلّٰهِ').intent, 'family');
  assert.equal(detectArabicIntent('أَنَا سَعِيدٌ جِدًّا الْيَوْمَ').intent, 'feelings_positive');
  assert.equal(detectArabicIntent('أَنَا تَعْبَانٌ قَلِيلًا').intent, 'feelings_tired');
  assert.equal(detectArabicIntent('الْجَوُّ حَارٌّ جِدًّا').intent, 'weather');
  assert.equal(detectArabicIntent('أَدْرُسُ اللُّغَةَ الْعَرَبِيَّةَ فِي الْجَامِعَةِ').intent, 'work_study');
  assert.equal(detectArabicIntent('أُحِبُّ لَعِبَ كُرَةِ الْقَدَمِ').intent, 'hobbies_sports');
  assert.equal(detectArabicIntent('ذَهَبْتُ إِلَى السُّوقِ لِشِرَاءِ مَلَابِسَ').intent, 'shopping');
  assert.equal(detectArabicIntent('سَأَلْتَقِي بِكَ غَدًا فِي السَّاعَةِ الْخَامِسَةِ').intent, 'time_routine');
  assert.equal(detectArabicIntent('نَعَمْ أَكِيدٌ').intent, 'affirmative');
  assert.equal(detectArabicIntent('لَا شُكْرًا').intent, 'gratitude_farewell');
  assert.equal(detectArabicIntent('لَا أَعْرِفُ').intent, 'negative');

  // 2. Coffee input gets a natural vocalized reply with Harakat, ZERO «...» parroting, and a related follow-up
  const foodReply = generateSmartArabicReply({
    userSpokenText: 'أريد قهوة عربية مع التمر',
    scenario: tariqScenario,
    turnIndex: 0,
    history: [{ speaker: 'character', text: tariqScenario.turns[0].characterAr }],
  });
  assert.equal(foodReply.source, 'smart_local');
  assert.equal(foodReply.intent, 'food_drink');
  assert.equal(foodReply.isFinalTurn, false);
  assert.equal(foodReply.replyArabic.includes('«'), false, 'Tariq must NEVER parrot/quote user words with «...»');
  assert.equal(foodReply.replyArabic.includes('»'), false, 'Tariq must NEVER parrot/quote user words with «...»');
  assert.ok(/[\u064B-\u0652]/.test(foodReply.replyArabic), 'Tariq reply must contain Harakat diacritics');
  assert.ok(foodReply.replyArabic.includes('؟'), 'Non-final reply must include a directly related follow-up question');
  assert.ok(foodReply.replyTransliteration.trim().length > 0);
  assert.ok(foodReply.replyMalayalam.trim().length > 0);
  assert.equal(foodReply.nextHints.length, 3, 'Must refresh 3 tailored Arabic follow-up hints');
  assert.equal(foodReply.xpEarned, 10);

  // 3. Second food turn uses a non-repeating follow-up variant instead of repeating turn 0's question
  const foodReply2 = generateSmartArabicReply({
    userSpokenText: 'أحب الشاي بالنعناع',
    scenario: tariqScenario,
    turnIndex: 1,
    history: [
      { speaker: 'character', text: tariqScenario.turns[0].characterAr },
      { speaker: 'user', text: 'أريد قهوة عربية مع التمر' },
      { speaker: 'character', text: foodReply.replyArabic },
    ],
  });
  assert.notEqual(foodReply2.replyArabic, foodReply.replyArabic);
  assert.equal(foodReply2.replyArabic.includes('«'), false);

  // 4. Arbitrary open-topic Arabic sentence gets a natural non-echoing reply (never quotes raw input)
  const openReply = generateSmartArabicReply({
    userSpokenText: 'اشتريت قطة صغيرة أمس',
    scenario: tariqScenario,
    turnIndex: 1,
    history: [],
  });
  assert.equal(openReply.replyArabic.includes('«'), false);
  assert.equal(openReply.replyArabic.includes('قطة'), false, 'Must not parrot raw unvocalized user words');
  assert.ok(/[\u064B-\u0652]/.test(openReply.replyArabic));
  assert.ok(openReply.nextHints.length >= 2);
  assert.equal(openReply.isFinalTurn, false);

  // 5. Final turn returns natural vocalized closing farewell with isFinalTurn: true and empty nextHints
  const finalReply = generateSmartArabicReply({
    userSpokenText: 'شُكْرًا جَزِيلًا يَا طَارِقُ',
    scenario: tariqScenario,
    turnIndex: tariqScenario.turns.length - 1,
    history: [],
  });
  assert.equal(finalReply.isFinalTurn, true);
  assert.deepEqual(finalReply.nextHints, []);
  assert.equal(finalReply.replyArabic.includes('«'), false);
  assert.ok(finalReply.replyArabic.includes('إِلَى اللِّقَاءِ'));

  // 6. Continuous recording transcript merging across pauses + echo sanitizer
  assert.equal(
    mergeSpeechTranscripts('أَنَا بِخَيْرٍ', 'وَالْحَمْدُ لِلّٰهِ', 'أُحِبُّ السَّفَرَ'),
    'أَنَا بِخَيْرٍ وَالْحَمْدُ لِلّٰهِ أُحِبُّ السَّفَرَ'
  );
  assert.equal(mergeSpeechTranscripts('  أَهْلًا  ', '', '  يَا طَارِقُ '), 'أَهْلًا يَا طَارِقُ');
  assert.equal(stripQuotedEcho('جَمِيلٌ «قَهْوَة» جِدًّا'), 'جَمِيلٌ قَهْوَة جِدًّا');

  // 7. Automatic environment routing: GitHub Pages & Android APK skip server endpoint; AI Studio / localhost use it
  assert.equal(canUseServerGeminiEndpoint({ protocol: 'https:', hostname: 'user.github.io' }), false);
  assert.equal(canUseServerGeminiEndpoint({ protocol: 'file:', hostname: '' }), false);
  assert.equal(canUseServerGeminiEndpoint({ protocol: 'capacitor:', hostname: 'localhost' }), false);
  assert.equal(canUseServerGeminiEndpoint({ protocol: 'http:', hostname: 'localhost' }), true);
  assert.equal(canUseServerGeminiEndpoint({ protocol: 'https:', hostname: 'myapp.run.app' }), true);
});

test('Matching Pairs (pairs & audio_pairs) selection switches cleanly within a column, deselects on re-tap, matches pairs, and recovers from mismatch flash', () => {
  const baseState = {
    selectedLeft: null,
    selectedRight: null,
    matchedPairIndices: [] as number[],
    wrongPairFlash: null,
  };

  // 1. Selecting a left card highlights it and speaks Arabic
  const t1 = resolvePairTapSelection(baseState, 'left', 0, 4);
  assert.equal(t1.action, 'select');
  assert.equal(t1.selectedLeft, 0);
  assert.equal(t1.selectedRight, null);
  assert.equal(t1.shouldSpeakArabic, true);

  // 2. Tapping another card in the SAME column switches cleanly
  const t2 = resolvePairTapSelection(t1, 'left', 2, 4);
  assert.equal(t2.action, 'switch');
  assert.equal(t2.selectedLeft, 2);
  assert.equal(t2.selectedRight, null);
  assert.equal(t2.shouldSpeakArabic, true);

  // 3. Tapping the already-selected left card again deselects it without re-speaking
  const t3 = resolvePairTapSelection(t2, 'left', 2, 4);
  assert.equal(t3.action, 'deselect');
  assert.equal(t3.selectedLeft, null);
  assert.equal(t3.selectedRight, null);
  assert.equal(t3.shouldSpeakArabic, false);

  // 4. Right column: select -> switch -> deselect
  const r1 = resolvePairTapSelection(t3, 'right', 1, 4);
  assert.equal(r1.action, 'select');
  assert.equal(r1.selectedRight, 1);
  assert.equal(r1.shouldSpeakArabic, false);

  const r2 = resolvePairTapSelection(r1, 'right', 3, 4);
  assert.equal(r2.action, 'switch');
  assert.equal(r2.selectedRight, 3);
  assert.equal(r2.selectedLeft, null);

  const r3 = resolvePairTapSelection(r2, 'right', 3, 4);
  assert.equal(r3.action, 'deselect');
  assert.equal(r3.selectedRight, null);

  // 5. Matching pair marks index as matched and clears both selections
  const mStart = resolvePairTapSelection(r3, 'left', 1, 4);
  const mDone = resolvePairTapSelection(mStart, 'right', 1, 4);
  assert.equal(mDone.action, 'match');
  assert.deepEqual(mDone.matchedPairIndices, [1]);
  assert.equal(mDone.selectedLeft, null);
  assert.equal(mDone.selectedRight, null);
  assert.equal(mDone.allMatched, false);

  // 6. Tapping an already-matched card is a no-op
  const noopTap = resolvePairTapSelection(mDone, 'left', 1, 4);
  assert.equal(noopTap.action, 'noop');
  assert.deepEqual(noopTap.matchedPairIndices, [1]);

  // 7. Mismatch flashes wrongPairFlash; tapping a new card mid-flash clears flash and selects cleanly
  const wStart = resolvePairTapSelection(mDone, 'left', 0, 4);
  const wFlash = resolvePairTapSelection(wStart, 'right', 2, 4);
  assert.equal(wFlash.action, 'mismatch');
  assert.deepEqual(wFlash.wrongPairFlash, { left: 0, right: 2 });

  const recover = resolvePairTapSelection(wFlash, 'left', 3, 4);
  assert.equal(recover.action, 'select');
  assert.equal(recover.wrongPairFlash, null);
  assert.equal(recover.selectedLeft, 3);
  assert.equal(recover.selectedRight, null);

  // 8. Final pair completes the question
  const almostDone = {
    selectedLeft: 3,
    selectedRight: null,
    matchedPairIndices: [0, 1, 2],
    wrongPairFlash: null,
  };
  const finalMatch = resolvePairTapSelection(almostDone, 'right', 3, 4);
  assert.equal(finalMatch.action, 'match');
  assert.equal(finalMatch.allMatched, true);
  assert.deepEqual(finalMatch.matchedPairIndices, [0, 1, 2, 3]);

  // 9. Both `pairs` and `audio_pairs` are recognized and preload Arabic audio cleanly
  const pairsQ = {
    type: 'pairs' as const,
    prompt: 'ജോഡികൾ യോജിപ്പിക്കുക',
    pairs: [
      { ar: 'بَابٌ', tr: 'ബാബുൻ', ml: 'വാതിൽ' },
      { ar: 'كِتَابٌ', tr: 'കിതാബുൻ', ml: 'പുസ്തകം' },
    ],
  };
  const audioPairsQ = {
    type: 'audio_pairs' as const,
    prompt: 'ശബ്ദവും അർത്ഥവും യോജിപ്പിക്കുക',
    pairs: [
      { ar: 'بَابٌ', tr: 'ബാബുൻ', ml: 'വാതിൽ' },
      { ar: 'كِتَابٌ', tr: 'കിതാബുൻ', ml: 'പുസ്തകം' },
    ],
  };
  assert.equal(isPairsQuestion(pairsQ), true);
  assert.equal(isPairsQuestion(audioPairsQ), true);
  assert.notEqual(getQuestionFingerprint(pairsQ), getQuestionFingerprint(audioPairsQ));
  assert.deepEqual(collectQuestionArabicTexts(audioPairsQ), ['بَابٌ', 'كِتَابٌ']);
});

test('Grammar Cheat Sheet visualizes Past, Present, Future, Imperative, and Passive Voice verb conjugations across recent units with valid vocalized Arabic, affix splits, toggles, filtering, mastery math, and tab persistence', () => {
  // 1. 'grammar' tab is valid and persists cleanly
  assert.equal(normalizeAppTab('grammar'), 'grammar');
  const mem = new Map<string, string>();
  const storage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
  };
  const persisted = persistUserStateSync(storage, 'grammar_tab_test', { ...baseUser, activeTab: 'grammar' }, UNITS);
  assert.equal(persisted.activeTab, 'grammar');
  const hydrated = hydratePersistedUserState(storage, 'grammar_tab_test', baseUser, { units: UNITS });
  assert.equal(hydrated.activeTab, 'grammar');

  // 2. All 10 curriculum verbs × 7 pronouns have complete vocalized Past, Present, Future, Imperative (2nd person), and Passive (Past & Present) conjugations
  assert.equal(VERB_CONJUGATIONS.length, 10);
  assert.equal(PRONOUN_ROWS.length, 7);
  assert.equal(TENSE_FORMULAS.length, 5);
  assert.deepEqual(
    TENSE_FORMULAS.map((f) => f.key),
    ['past', 'present', 'future', 'imperative', 'passive']
  );

  for (const verb of VERB_CONJUGATIONS) {
    assert.ok(/[\u064B-\u0652]/.test(verb.baseAr), `${verb.id} baseAr needs Harakat`);
    assert.ok(verb.unitNumbers.length >= 2, `${verb.id} must map to curriculum units`);
    assert.ok(
      verb.examples.past.ar &&
        verb.examples.present.ar &&
        verb.examples.futureSa.ar &&
        verb.examples.futureSawfa.ar &&
        verb.examples.imperative.ar &&
        verb.examples.passivePast.ar &&
        verb.examples.passivePresent.ar,
      `${verb.id} must include all 7 example sentences (past, present, futureSa, futureSawfa, imperative, passivePast, passivePresent)`
    );

    for (const pronoun of PRONOUN_ROWS) {
      const row = verb.rows[pronoun.key];
      assert.ok(row, `${verb.id} missing pronoun ${pronoun.key}`);
      assert.equal(
        `${row.past.prefix}${row.past.stem}${row.past.suffix}`,
        row.past.ar,
        `${verb.id}.${pronoun.key}.past affix split must reconstruct exact Arabic form`
      );
      assert.equal(
        `${row.present.prefix}${row.present.stem}${row.present.suffix}`,
        row.present.ar,
        `${verb.id}.${pronoun.key}.present affix split must reconstruct exact Arabic form`
      );
      assert.ok(/[\u064B-\u0652]/.test(row.past.ar), `${verb.id}.${pronoun.key}.past needs Harakat`);
      assert.ok(/[\u064B-\u0652]/.test(row.present.ar), `${verb.id}.${pronoun.key}.present needs Harakat`);

      const futureSa = buildFutureConjugation(row, 'sa');
      const futureSawfa = buildFutureConjugation(row, 'sawfa');
      assert.ok(futureSa.ar.startsWith('سَ'), `${verb.id}.${pronoun.key} near future must start with سَ`);
      assert.equal(`${futureSa.prefix}${futureSa.stem}${futureSa.suffix}`, futureSa.ar);
      assert.ok(futureSawfa.ar.startsWith('سَوْفَ '), `${verb.id}.${pronoun.key} far future must start with سَوْفَ`);
      assert.equal(`${futureSawfa.prefix}${futureSawfa.stem}${futureSawfa.suffix}`, futureSawfa.ar);
      assert.equal(futureSa.ml, row.futureMl);
      assert.equal(futureSawfa.ml, row.futureMl);

      // Imperative (الْأَمْر): direct imperative only on 2nd person (anta, anti)
      const imp = getImperativeConjugation(verb, pronoun.key);
      if (pronoun.key === 'anta' || pronoun.key === 'anti') {
        assert.ok(imp, `${verb.id}.${pronoun.key} must have a direct Imperative form`);
        assert.equal(
          `${imp.prefix}${imp.stem}${imp.suffix}`,
          imp.ar,
          `${verb.id}.${pronoun.key}.imperative affix split must reconstruct exact Arabic form`
        );
        assert.ok(/[\u064B-\u0652]/.test(imp.ar), `${verb.id}.${pronoun.key}.imperative needs Harakat`);
      } else {
        assert.equal(imp, null, `${verb.id}.${pronoun.key} should not have a direct 2nd-person Imperative`);
      }

      // Passive Voice (الْمَجْهُول): Past (فُعِلَ) & Present (يُفْعَلُ) on all 7 pronouns
      const passivePast = buildPassiveConjugation(verb, pronoun.key, 'past');
      const passivePresent = buildPassiveConjugation(verb, pronoun.key, 'present');
      assert.equal(
        `${passivePast.prefix}${passivePast.stem}${passivePast.suffix}`,
        passivePast.ar,
        `${verb.id}.${pronoun.key}.passivePast affix split must reconstruct exact Arabic form`
      );
      assert.equal(
        `${passivePresent.prefix}${passivePresent.stem}${passivePresent.suffix}`,
        passivePresent.ar,
        `${verb.id}.${pronoun.key}.passivePresent affix split must reconstruct exact Arabic form`
      );
      assert.ok(/[\u064B-\u0652]/.test(passivePast.ar), `${verb.id}.${pronoun.key}.passivePast needs Harakat`);
      assert.ok(/[\u064B-\u0652]/.test(passivePresent.ar), `${verb.id}.${pronoun.key}.passivePresent needs Harakat`);
    }
  }

  // Spot-check key irregular & Form III/V Imperative and Passive Arabic orthography
  const byId = new Map(VERB_CONJUGATIONS.map((v) => [v.id, v]));
  assert.equal(getImperativeConjugation(byId.get('kataba')!, 'anta')?.ar, 'اُكْتُبْ');
  assert.equal(getImperativeConjugation(byId.get('akala')!, 'anta')?.ar, 'كُلْ');
  assert.equal(getImperativeConjugation(byId.get('akala')!, 'anti')?.ar, 'كُلِي');
  assert.equal(getImperativeConjugation(byId.get('safara')!, 'anta')?.ar, 'سَافِرْ');
  assert.equal(getImperativeConjugation(byId.get('taallama')!, 'anta')?.ar, 'تَعَلَّمْ');
  assert.equal(getImperativeConjugation(byId.get('darasa')!, 'anta')?.ar, 'اُدْرُسْ');
  assert.equal(buildPassiveConjugation(byId.get('kataba')!, 'huwa', 'past').ar, 'كُتِبَ');
  assert.equal(buildPassiveConjugation(byId.get('kataba')!, 'huwa', 'present').ar, 'يُكْتَبُ');
  assert.equal(buildPassiveConjugation(byId.get('safara')!, 'huwa', 'past').ar, 'سُوفِرَ');
  assert.equal(buildPassiveConjugation(byId.get('taallama')!, 'huwa', 'past').ar, 'تُعُلِّمَ');
  assert.equal(buildPassiveConjugation(byId.get('akala')!, 'ana', 'present').ar, 'أُوكَلُ');
  assert.equal(buildPassiveConjugation(byId.get('qaraa')!, 'hum', 'present').ar, 'يُقْرَؤُونَ');

  // 3. Filtering works by unit group and diacritic-insensitive Arabic / Malayalam / English search
  assert.equal(filterVerbEntries(VERB_CONJUGATIONS, { unitGroup: 'all' }).length, 10);
  assert.equal(filterVerbEntries(VERB_CONJUGATIONS, { unitGroup: 'core' }).length, 6);
  assert.equal(filterVerbEntries(VERB_CONJUGATIONS, { unitGroup: 'advanced' }).length, 4);
  assert.deepEqual(
    filterVerbEntries(VERB_CONJUGATIONS, { query: 'ذهب' }).map((v) => v.id),
    ['dhahaba']
  );
  assert.deepEqual(
    filterVerbEntries(VERB_CONJUGATIONS, { query: 'യാത്ര' }).map((v) => v.id),
    ['safara']
  );
  assert.deepEqual(
    filterVerbEntries(VERB_CONJUGATIONS, { query: 'write' }).map((v) => v.id),
    ['kataba']
  );
  assert.equal(filterVerbEntries(VERB_CONJUGATIONS, { query: 'zzzz_none' }).length, 0);

  // 4. Mastery computation accurately tracks verb curriculum units (Units 9, 18, 21, 22, 28, 32, 33)
  const unit18 = UNITS.find((u) => u.number === 18);
  assert.ok(unit18);
  const halfUnit18Ids = unit18.lessons.slice(0, 4).map((l) => l.id);
  const mastery = computeVerbUnitMastery(halfUnit18Ids, UNITS);
  assert.equal(mastery.length, 7);
  const row18 = mastery.find((m) => m.unitNumber === 18);
  assert.ok(row18);
  assert.equal(row18.completedCount, 4);
  assert.equal(row18.totalCount, unit18.lessons.length);
  assert.equal(row18.percent, Math.round((4 / unit18.lessons.length) * 100));
});

test('basic Alphabet and single-letter Harakat recognition questions are strictly restricted to Units 1-4 across all lessons, Hard Practice, Mistake Review, Placement, and Unit 5-35 Jump-Ahead Entry Tests', () => {
  assert.equal(ALPHABET_MAX_UNIT_NUMBER, 4);
  assert.equal(getUnitNumberFromLessonId('u1_n1'), 1);
  assert.equal(getUnitNumberFromLessonId('u5_n7'), 5);
  assert.equal(getUnitNumberFromLessonId('u21_n8'), 21);
  assert.equal(getUnitNumberFromLessonId(null), null);

  // 1. Classifier catches basic Alphabet & single-letter Harakat questions accurately
  const sampleDuQuestion = {
    type: 'mcq' as const,
    prompt: "'ദു' (Du) എന്ന ശബ്ദം നൽകുന്ന അക്ഷരം ഏതാണ്?",
    options: ['دَ', 'دِ', 'دُ', 'رُ'],
    isArabicOption: true,
    answer: 'دُ',
  };
  const sampleJiQuestion = {
    type: 'mcq' as const,
    prompt: "ചോദ്യം 1/8: 'ജി' (Ji) എന്ന ശബ്ദമുള്ള അക്ഷരം ഏതാണ്?",
    options: ['جَ', 'جِ', 'جُ', 'حِ'],
    isArabicOption: true,
    answer: 'جِ',
  };
  assert.equal(isBasicAlphabetOrHarakatQuestion(sampleDuQuestion), true);
  assert.equal(isBasicAlphabetOrHarakatQuestion(sampleJiQuestion), true);

  // Unit 1 still preserves its Alphabet & Harakat curriculum
  const u1AlphabetCount = UNITS[0].lessons
    .flatMap((l) => l.questions)
    .filter((q) => isBasicAlphabetOrHarakatQuestion(q)).length;
  assert.ok(u1AlphabetCount >= 15, `Unit 1 must retain basic alphabet & Harakat questions (found ${u1AlphabetCount})`);

  // Zero false positives across all handcrafted Units 5-35 questions (including I'rab grammar in Units 27, 32-35)
  for (let uIdx = 4; uIdx < UNITS.length; uIdx++) {
    const unit = UNITS[uIdx];
    for (const lesson of unit.lessons) {
      for (const q of lesson.questions) {
        assert.equal(
          isBasicAlphabetOrHarakatQuestion(q),
          false,
          `Unit ${unit.number} (${lesson.id}) handcrafted question should not be classified as basic alphabet: ${q.prompt}`
        );
      }
    }
  }

  // 2. Placement Test (Unit 5 placement jump) has ZERO basic Alphabet/Harakat questions
  assert.equal(PLACEMENT_QUESTIONS.length, 8);
  for (const q of PLACEMENT_QUESTIONS) {
    assert.equal(
      isBasicAlphabetOrHarakatQuestion(q),
      false,
      `Placement Test (Unit 5 jump) must not contain basic alphabet/Harakat question: ${q.prompt}`
    );
  }

  // Build fingerprint lookup maps per unit range
  const unit1to4Fps = new Set<string>();
  const unit1Fps = new Set<string>();
  for (let i = 0; i < 4; i++) {
    for (const l of UNITS[i].lessons) {
      for (const q of l.questions) {
        const fp = getQuestionFingerprint(q);
        unit1to4Fps.add(fp);
        if (i === 0) unit1Fps.add(fp);
      }
    }
  }

  // 3. Jump-Ahead Entry Tests from Unit 5 through Unit 35:
  //    - Zero basic alphabet/Harakat questions for ALL N = 5..35
  //    - For N = 6..35 (including Unit 21 & Unit 35), every question is sampled strictly from Units 5..N-1
  //    - For N = 5 (targetUnitIndex = 4), every question comes from Units 2..4 (zero Unit 1 alphabet)
  for (let targetUnitIndex = 4; targetUnitIndex < UNITS.length; targetUnitIndex++) {
    const targetUnitNumber = targetUnitIndex + 1;
    const jumpQs = buildUnitJumpQuestions(targetUnitIndex, UNITS, JUMP_TEST_QUESTION_COUNT);
    assert.equal(jumpQs.length, 15, `Unit ${targetUnitNumber} Jump Test must have 15 questions`);

    const allowedRangeFps = new Set<string>();
    const startIdx = targetUnitNumber >= 6 ? 4 : 1;
    for (let i = startIdx; i < targetUnitIndex; i++) {
      for (const l of UNITS[i].lessons) {
        if (l.nodeType === 'chest' || l.nodeType === 'video_call') continue;
        for (const q of l.questions) {
          if (q.type === 'speak') continue;
          allowedRangeFps.add(getQuestionFingerprint(q));
        }
      }
    }

    for (const q of jumpQs) {
      assert.equal(
        isBasicAlphabetOrHarakatQuestion(q),
        false,
        `Unit ${targetUnitNumber} Entry Test leaked alphabet/Harakat question: ${q.prompt}`
      );
      const fp = getQuestionFingerprint(q);
      assert.equal(
        allowedRangeFps.has(fp),
        true,
        `Unit ${targetUnitNumber} Entry Test question must come strictly from Units ${startIdx + 1}-${targetUnitNumber - 1}: ${q.prompt}`
      );
      if (targetUnitNumber >= 6) {
        assert.equal(
          unit1to4Fps.has(fp),
          false,
          `Unit ${targetUnitNumber} Entry Test must NEVER sample from Units 1-4: ${q.prompt}`
        );
      } else {
        assert.equal(
          unit1Fps.has(fp),
          false,
          `Unit 5 Entry Test must NEVER sample from Unit 1: ${q.prompt}`
        );
      }
    }
  }

  // 4. All Lessons, Hard Practice, Trophy, Review, and Legendary sessions in Units 5-35
  //    with all preceding units (including Unit 1) marked completed must have ZERO alphabet/Harakat questions
  let seed = 9137;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let uIdx = 4; uIdx < UNITS.length; uIdx++) {
    const unit = UNITS[uIdx];
    const priorCompleted = unlockLessonsUpToUnit([], uIdx, UNITS);
    for (const lesson of unit.lessons) {
      if (lesson.nodeType === 'chest' || lesson.nodeType === 'video_call') continue;
      const sessionQs = buildLessonSessionQuestions(lesson, priorCompleted, UNITS, rng);
      for (const q of sessionQs) {
        assert.equal(
          isBasicAlphabetOrHarakatQuestion(q),
          false,
          `Unit ${unit.number} (${lesson.id} ${lesson.nodeType}) session leaked alphabet/Harakat question: ${q.prompt}`
        );
        if (q.isSpacedRepetition) {
          if (unit.number >= 6) {
            assert.equal(
              unit1to4Fps.has(getQuestionFingerprint(q)),
              false,
              `Unit ${unit.number} (${lesson.id}) Spaced Repetition must not pull from Units 1-4: ${q.prompt}`
            );
          } else {
            assert.equal(
              unit1Fps.has(getQuestionFingerprint(q)),
              false,
              `Unit 5 (${lesson.id}) Spaced Repetition must not pull from Unit 1: ${q.prompt}`
            );
          }
        }
      }
      if (lesson.nodeType === 'hard' || lesson.nodeType === 'trophy') {
        const revQs = buildReviewSessionQuestions(lesson, UNITS, rng);
        const legQs = buildLegendarySessionQuestions(lesson, UNITS, rng);
        for (const q of [...revQs, ...legQs]) {
          assert.equal(
            isBasicAlphabetOrHarakatQuestion(q),
            false,
            `Unit ${unit.number} (${lesson.id}) review/legendary leaked alphabet/Harakat question: ${q.prompt}`
          );
        }
      }
    }
  }

  // 5. Mistake Review refuses to enqueue basic alphabet/Harakat questions in Units 5-35,
  //    while continuing to re-queue normally in Units 1-4 and for vocabulary/grammar in Units 5-35
  const u5VocabQ = UNITS[4].lessons[0].questions[0];
  assert.equal(
    enqueueMistakeForReview([u5VocabQ], sampleDuQuestion, 'lesson', rng, 5).length,
    1,
    'Unit 5 Mistake Review must reject basic alphabet/Harakat questions'
  );
  assert.equal(
    enqueueMistakeForReview([u5VocabQ], sampleDuQuestion, 'lesson', rng, 21).length,
    1,
    'Unit 21 Mistake Review must reject basic alphabet/Harakat questions'
  );
  assert.equal(
    enqueueMistakeForReview([u5VocabQ], u5VocabQ, 'lesson', rng, 5).length,
    2,
    'Unit 5 Mistake Review must still re-queue normal Unit 5 vocabulary/grammar questions'
  );
  assert.equal(
    enqueueMistakeForReview([sampleDuQuestion], sampleDuQuestion, 'lesson', rng, 1).length,
    2,
    'Unit 1 Mistake Review must still re-queue Unit 1 Harakat questions'
  );
});




