import test from 'node:test';
import assert from 'node:assert/strict';
import { ARABIC_ALPHABET, PLACEMENT_QUESTIONS, UNITS } from '../data/curriculum';
import {
  applySessionResult,
  buildUnitJumpQuestions,
  computeStreakUpdate,
  evaluateQuestionAnswer,
  evaluateSessionOutcome,
  fisherYatesShuffle,
  getAllLessonIds,
  getLetterDisplay,
  isLessonUnlocked,
  isUnitUnlocked,
  mergeAndSortLeaderboard,
  shouldShowArabicPromptCard,
  unlockLessonsUpToUnit,
} from './learningEngine';
import {
  buildArabicAudioSources,
  buildArabicTtsUrl,
  buildStreamElementsTtsUrl,
  buildYoudaoTtsUrl,
  getArabicLetterAudioUrl,
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

test('curriculum contains 10 units and 30 lessons with 28 Arabic letters', () => {
  assert.equal(UNITS.length, 10);
  assert.equal(getAllLessonIds().length, 30);
  assert.equal(ARABIC_ALPHABET.length, 28);
});

test('Units 5 to 10 each have 3 lessons with Harakat, Malayalam transliteration, and mixed question types', () => {
  const advanced = UNITS.slice(4);
  assert.equal(advanced.length, 6);
  for (const unit of advanced) {
    assert.equal(unit.lessons.length, 3);
    for (const lesson of unit.lessons) {
      assert.ok(lesson.questions.length >= 4, `${lesson.id} should have at least 4 questions`);
      const types = new Set(lesson.questions.map((q) => q.type));
      assert.ok(types.size >= 3, `${lesson.id} should mix at least 3 question types`);
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

test('lesson and unit unlocking progresses sequentially', () => {
  assert.equal(isLessonUnlocked('u1_l1', []), true);
  assert.equal(isLessonUnlocked('u1_l2', []), false);
  assert.equal(isUnitUnlocked(0, []), true);
  assert.equal(isUnitUnlocked(1, []), false);

  assert.equal(isLessonUnlocked('u1_l2', ['u1_l1']), true);
  assert.equal(isUnitUnlocked(1, ['u1_l1', 'u1_l2', 'u1_l3']), true);
});

test('unlockLessonsUpToUnit marks all preceding units complete', () => {
  const unlocked = unlockLessonsUpToUnit([], 4);
  assert.equal(unlocked.length, 12);
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
  assert.equal(updated.completedLessons.length, 12);
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

test('no Malayalam-to-Arabic question across all 30 lessons or Placement Test leaks the Arabic answer in the prompt card', () => {
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

  // 3. Normal (1.0) and slow turtle (0.65) playback rates
  assert.equal(resolveArabicPlaybackRate(1.0), 1.0);
  assert.equal(resolveArabicPlaybackRate(0.9), 1.0);
  assert.equal(resolveArabicPlaybackRate(0.65), 0.65);
  assert.equal(resolveArabicPlaybackRate(0.5), 0.65);
});

