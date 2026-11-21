import test from 'node:test';
import assert from 'node:assert/strict';
import { ARABIC_ALPHABET, PLACEMENT_QUESTIONS, UNITS } from '../data/curriculum';
import {
  applySessionResult,
  areWordBankAnswersEqual,
  buildFilledSentence,
  buildUnitJumpQuestions,
  claimTreasureChest,
  computeStreakUpdate,
  enqueueMistakeForReview,
  evaluateQuestionAnswer,
  evaluateSessionOutcome,
  fisherYatesShuffle,
  getAllLessonIds,
  getLetterDisplay,
  isLessonUnlocked,
  isUnitUnlocked,
  mergeAndSortLeaderboard,
  migrateLegacyCompletedIds,
  MISTAKE_REVIEW_BANNER_TEXT,
  normalizeWordBankText,
  prepareSessionQuestions,
  shouldShowArabicPromptCard,
  shuffleArray,
  unlockLessonsUpToUnit,
} from './learningEngine';
import {
  audioCache,
  BUFFER_TIMEOUT_MS,
  buildArabicAudioSources,
  buildArabicTtsUrl,
  buildStreamElementsTtsUrl,
  buildYoudaoTtsUrl,
  clearArabicAudioCache,
  collectQuestionArabicTexts,
  getArabicLetterAudioUrl,
  preloadArabicAudio,
  resolveArabicPlaybackRate,
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

test('curriculum contains 30 units and 240 winding nodes (8 per unit) with 28 Arabic letters', () => {
  assert.equal(UNITS.length, 30);
  assert.equal(getAllLessonIds().length, 240);
  assert.equal(ARABIC_ALPHABET.length, 28);

  const expectedIcons = ['⭐', '📖', '🧩', '🎁', '💬', '🎧', '⚡', '🏆'];
  const expectedTypes = ['lesson', 'practice', 'wordbank', 'chest', 'dialogue', 'listening', 'hard', 'trophy'];

  for (const unit of UNITS) {
    assert.equal(unit.lessons.length, 8, `${unit.id} must have 8 nodes`);
    assert.ok(unit.guidebook && unit.guidebook.length >= 8, `${unit.id} must have >= 8 guidebook entries`);
    assert.ok(unit.guidebookTip && unit.guidebookTip.length > 0, `${unit.id} must have a guidebook tip`);
    unit.lessons.forEach((node, idx) => {
      assert.equal(node.icon, expectedIcons[idx], `${node.id} icon mismatch`);
      assert.equal(node.nodeType, expectedTypes[idx], `${node.id} nodeType mismatch`);
      if (node.nodeType === 'chest') {
        assert.equal(node.xpReward, 25);
        assert.equal(node.heartReward, 1);
        assert.equal(node.questions.length, 0);
      } else {
        assert.ok(node.questions.length >= 3, `${node.id} must have interactive questions`);
      }
    });
  }
});

test('Units 5 to 30 quiz nodes have Harakat, Malayalam transliteration, and mixed question types', () => {
  const advanced = UNITS.slice(4);
  assert.equal(advanced.length, 26);
  for (const unit of advanced) {
    assert.equal(unit.lessons.length, 8);
    for (const lesson of unit.lessons) {
      if (lesson.nodeType === 'chest') continue;
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

test('unit jump test requires 4/5 to unlock target unit', () => {
  const pass = evaluateSessionOutcome({
    mode: 'jump',
    lessonId: null,
    targetUnitIndex: 2,
    score: 4,
    totalQuestions: 5,
  });
  assert.equal(pass.earnedXp, 40);
  assert.equal(pass.unlockedUpToUnitIndex, 2);

  const fail = evaluateSessionOutcome({
    mode: 'jump',
    lessonId: null,
    targetUnitIndex: 2,
    score: 3,
    totalQuestions: 5,
  });
  assert.equal(fail.earnedXp, 5);
  assert.equal(fail.unlockedUpToUnitIndex, null);
});

test('buildUnitJumpQuestions selects up to 5 non-pair questions from earlier units', () => {
  const qs = buildUnitJumpQuestions(2);
  assert.equal(qs.length, 5);
  assert.equal(qs.every((q) => q.type !== 'pairs'), true);
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

test('no Malayalam-to-Arabic question across all 240 nodes or Placement Test leaks the Arabic answer in the prompt card', () => {
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

test('multi-source Arabic audio pipeline routes 28 base letters to studio MP3s and words/harakat to StreamElements Wavenet-B + Youdao backup', () => {
  // 1. All 28 base Arabic letters map cleanly to 01.mp3 .. 28.mp3
  ARABIC_ALPHABET.forEach((letter, idx) => {
    const expectedIndex = String(idx + 1).padStart(2, '0');
    const expectedUrl = `https://raw.githubusercontent.com/mustafa0x/arabic-alphabet-audio/master/mp3/${expectedIndex}.mp3`;
    assert.equal(getArabicLetterAudioUrl(letter.base), expectedUrl);
    assert.equal(buildArabicTtsUrl(letter.base), expectedUrl);

    const sources = buildArabicAudioSources(letter.base);
    assert.equal(sources.length, 3);
    assert.equal(sources[0].provider, 'letter-mp3');
    assert.equal(sources[0].url, expectedUrl);
    assert.equal(sources[0].crossOrigin, true);
    assert.equal(sources[1].provider, 'streamelements');
    assert.equal(sources[2].provider, 'youdao');
  });

  // 2. Harakat syllables, words, and sentences route to StreamElements ar-XA-Wavenet-B then Youdao backup
  for (const sample of ['بَ', 'أَقْرَأُ', 'السَّلَامُ عَلَيْكُمْ']) {
    assert.equal(getArabicLetterAudioUrl(sample), null);
    const sources = buildArabicAudioSources(sample);
    assert.equal(sources.length, 2);
    assert.equal(sources[0].provider, 'streamelements');
    assert.equal(
      sources[0].url,
      `https://api.streamelements.com/kappa/v2/speech?voice=ar-XA-Wavenet-B&text=${encodeURIComponent(sample)}`
    );
    assert.equal(sources[0].crossOrigin, true);
    assert.equal(sources[1].provider, 'youdao');
    assert.equal(
      sources[1].url,
      `https://dictation.youdao.com/dictvoice?audio=${encodeURIComponent(sample)}&le=ar`
    );
    assert.equal(buildStreamElementsTtsUrl(sample), sources[0].url);
    assert.equal(buildYoudaoTtsUrl(sample), sources[1].url);
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

test('all 30 units include fill_blank questions in Lessons 2, 4, 5, and 7 (nodes n2, n5, n6, n7) with 3 vocalized options and Malayalam hints', () => {
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

  assert.equal(totalFillBlank, 120, 'Expected 120 fill_blank questions (4 per unit across 30 units)');

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
    assert.equal(unit.lessons.length, 8);
    assert.equal(unit.lessons[3].nodeType, 'chest');
    assert.equal(unit.lessons[7].nodeType, 'trophy');
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
  assert.equal(jumpQs.length, 5);
  assert.equal(jumpQs.every((q) => q.type !== 'pairs'), true);
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
    assert.equal(unit.lessons.length, 8);
    assert.equal(unit.lessons[3].nodeType, 'chest');
    assert.equal(unit.lessons[7].nodeType, 'trophy');
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

  // Unit 20 (index 19) unlock & jump test verification
  const unlockedUpTo20 = unlockLessonsUpToUnit([], 19);
  assert.equal(unlockedUpTo20.length, 152);
  assert.equal(isUnitUnlocked(19, unlockedUpTo20), true);
  assert.equal(isLessonUnlocked('u20_n1', unlockedUpTo20), true);
  assert.equal(isLessonUnlocked('u20_n2', unlockedUpTo20), false);

  const jumpQs = buildUnitJumpQuestions(19);
  assert.equal(jumpQs.length, 5);
  assert.equal(jumpQs.every((q) => q.type !== 'pairs'), true);
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
    assert.equal(unit.lessons.length, 8);
    assert.equal(unit.lessons[3].nodeType, 'chest');
    assert.equal(unit.lessons[7].nodeType, 'trophy');
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

  // Unit 25 (index 24) unlock & jump test verification
  const unlockedUpTo25 = unlockLessonsUpToUnit([], 24);
  assert.equal(unlockedUpTo25.length, 192);
  assert.equal(isUnitUnlocked(24, unlockedUpTo25), true);
  assert.equal(isLessonUnlocked('u25_n1', unlockedUpTo25), true);
  assert.equal(isLessonUnlocked('u25_n2', unlockedUpTo25), false);

  const jumpQs = buildUnitJumpQuestions(24);
  assert.equal(jumpQs.length, 5);
  assert.equal(jumpQs.every((q) => q.type !== 'pairs'), true);
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
    assert.equal(unit.lessons.length, 8);
    assert.equal(unit.lessons[3].nodeType, 'chest');
    assert.equal(unit.lessons[7].nodeType, 'trophy');
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

  // Unit 30 (index 29) unlock & jump test verification
  const unlockedUpTo30 = unlockLessonsUpToUnit([], 29);
  assert.equal(unlockedUpTo30.length, 232);
  assert.equal(isUnitUnlocked(29, unlockedUpTo30), true);
  assert.equal(isLessonUnlocked('u30_n1', unlockedUpTo30), true);
  assert.equal(isLessonUnlocked('u30_n2', unlockedUpTo30), false);

  const jumpQs = buildUnitJumpQuestions(29);
  assert.equal(jumpQs.length, 5);
  assert.equal(jumpQs.every((q) => q.type !== 'pairs'), true);
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


