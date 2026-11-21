import test from 'node:test';
import assert from 'node:assert/strict';
import { ARABIC_ALPHABET, UNITS } from '../data/curriculum';
import {
  applySessionResult,
  buildUnitJumpQuestions,
  computeStreakUpdate,
  evaluateQuestionAnswer,
  evaluateSessionOutcome,
  getAllLessonIds,
  getLetterDisplay,
  isLessonUnlocked,
  isUnitUnlocked,
  mergeAndSortLeaderboard,
  unlockLessonsUpToUnit,
} from './learningEngine';
import type { UserState } from '../types/learning';

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
