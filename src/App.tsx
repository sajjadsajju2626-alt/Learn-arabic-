import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PLACEMENT_QUESTIONS, UNITS } from './data/curriculum';
import type { AppTab, Lesson, SessionConfig, SessionResult, UserState } from './types/learning';
import {
  applySessionResult,
  buildLegendarySessionQuestions,
  buildLessonSessionQuestions,
  buildReviewSessionQuestions,
  buildUnitJumpQuestions,
  claimTreasureChest,
  hydratePersistedUserState,
  JUMP_TEST_HEARTS,
  JUMP_TEST_PASS_SCORE,
  JUMP_TEST_QUESTION_COUNT,
  LEGENDARY_HEARTS,
  LEGENDARY_XP_REWARD,
  MAX_HEARTS,
  mergeAndSortLeaderboard,
  normalizeAppTab,
  persistUserStateSync,
  prepareSessionQuestions,
  resolveCurrentUnitId,
  REVIEW_XP_REWARD,
} from './utils/learningEngine';
import { OnboardingScreen } from './components/OnboardingScreen';
import { AppShell } from './components/AppShell';
import { LearningPathTab } from './components/LearningPathTab';
import { AlphabetTab } from './components/AlphabetTab';
import { GrammarCheatSheetTab } from './components/GrammarCheatSheetTab';
import { LeaderboardTab } from './components/LeaderboardTab';
import { ProfileTab } from './components/ProfileTab';
import { LessonModal } from './components/LessonModal';
import { StoryModal } from './components/StoryModal';
import { VideoCallModal } from './components/VideoCallModal';
import { CompleteModal } from './components/CompleteModal';
import {
  applyThemeToDocument,
  persistTheme,
  readPersistedTheme,
  toggleThemeMode,
  type ThemeMode,
} from './utils/theme';

const STORAGE_KEY = 'arabic_ml_app_state_v2';

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  try {
    window.history.scrollRestoration = 'manual';
  } catch {
    // Ignore restricted history APIs
  }
}

function getSafeLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createInitialUserState(): UserState {
  const autostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const fallback: UserState = {
    id: 'local_learner',
    name: autostart ? 'അഹമ്മദ്' : '',
    avatar: '🧕',
    xp: 0,
    streak: 1,
    hearts: MAX_HEARTS,
    completedLessons: [],
    legendaryLessons: [],
    lastActiveDate: new Date().toDateString(),
    soundEnabled: true,
    onboarded: autostart,
    activeTab: 'path',
    currentUnitId: UNITS[0]?.id ?? 'u1',
  };

  return hydratePersistedUserState(getSafeLocalStorage(), STORAGE_KEY, fallback, {
    autostart,
    units: UNITS,
  });
}

export default function App() {
  const [user, setUser] = useState<UserState>(createInitialUserState);
  const userRef = useRef<UserState>(user);
  userRef.current = user;

  const activeTab: AppTab = normalizeAppTab(user.activeTab);
  const [pathFocusTrigger, setPathFocusTrigger] = useState(0);
  const [activeSession, setActiveSession] = useState<SessionConfig | null>(null);
  const [activeStoryLesson, setActiveStoryLesson] = useState<Lesson | null>(null);
  const [activeVideoCallLesson, setActiveVideoCallLesson] = useState<Lesson | null>(null);
  const [completeResult, setCompleteResult] = useState<SessionResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const initial = readPersistedTheme(getSafeLocalStorage());
    if (typeof document !== 'undefined') {
      applyThemeToDocument(document.documentElement, initial);
    }
    return initial;
  });

  useEffect(() => {
    applyThemeToDocument(document.documentElement, theme);
    persistTheme(getSafeLocalStorage(), theme);
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => toggleThemeMode(prev));
  }, []);

  const updateUserSync = useCallback((updater: (prev: UserState) => UserState) => {
    setUser((prev) => {
      const next = persistUserStateSync(
        getSafeLocalStorage(),
        STORAGE_KEY,
        updater(prev),
        UNITS
      );
      userRef.current = next;
      return next;
    });
  }, []);

  const handleSelectTab = useCallback(
    (tab: AppTab) => {
      const normalized = normalizeAppTab(tab);
      updateUserSync((prev) => ({ ...prev, activeTab: normalized }));
      if (normalized === 'path') {
        setPathFocusTrigger((n) => n + 1);
      }
    },
    [updateUserSync]
  );

  const handleVisibleUnitChange = useCallback(
    (unitId: string) => {
      if (!unitId || userRef.current.currentUnitId === unitId) return;
      updateUserSync((prev) =>
        prev.currentUnitId === unitId ? prev : { ...prev, currentUnitId: unitId }
      );
    },
    [updateUserSync]
  );

  // Flush synchronously on page hide / tab backgrounding so mobile WebView kills never drop progress
  useEffect(() => {
    const flushNow = () => {
      persistUserStateSync(getSafeLocalStorage(), STORAGE_KEY, userRef.current, UNITS);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    window.addEventListener('pagehide', flushNow);
    window.addEventListener('beforeunload', flushNow);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      window.removeEventListener('beforeunload', flushNow);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(id);
  }, [toast]);

  const leaderboard = useMemo(() => mergeAndSortLeaderboard(user), [user]);

  const showToast = (msg: string) => setToast(msg);

  const handleOnboardingComplete = (name: string, avatar: string, takePlacement: boolean) => {
    updateUserSync((prev) => ({
      ...prev,
      name,
      avatar,
      onboarded: true,
      activeTab: 'path',
      currentUnitId: resolveCurrentUnitId(prev.completedLessons, UNITS),
      lastActiveDate: new Date().toDateString(),
    }));
    if (takePlacement) {
      startPlacementTest();
    }
  };

  const handleClaimChest = (lesson: Lesson) => {
    updateUserSync((prev) => {
      const outcome = claimTreasureChest(prev, lesson.id, lesson.xpReward, lesson.heartReward);
      if (outcome.alreadyClaimed) {
        showToast('ഈ നിധിപ്പെട്ടി ഇതിനകം തുറന്നതാണ്!');
      } else {
        showToast(`🎁 നിധിപ്പെട്ടി തുറന്നു! +${outcome.earnedXp} XP & +${outcome.earnedHearts} ❤️`);
      }
      return {
        ...outcome.user,
        currentUnitId: resolveCurrentUnitId(outcome.user.completedLessons, UNITS),
      };
    });
  };

  const startLesson = (lesson: Lesson) => {
    if (lesson.nodeType === 'chest') {
      handleClaimChest(lesson);
      return;
    }
    if (lesson.nodeType === 'story' && lesson.story) {
      setActiveStoryLesson(lesson);
      return;
    }
    if (lesson.nodeType === 'video_call' && lesson.videoCall) {
      setActiveVideoCallLesson(lesson);
      return;
    }
    if (user.hearts <= 0) {
      updateUserSync((prev) => ({ ...prev, hearts: MAX_HEARTS }));
      showToast('ഹാർട്ടുകൾ സ്വയമേവ നിറച്ചിരിക്കുന്നു! പാഠം തുടങ്ങാം.');
    }
    setActiveSession({
      mode: 'lesson',
      variant: 'standard',
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      targetUnitIndex: null,
      bannerText: null,
      questions: buildLessonSessionQuestions(lesson, user.completedLessons, UNITS),
      initialHearts: Math.max(user.hearts, 1),
      xpReward: lesson.xpReward ?? 15,
    });
  };

  const startReview = (lesson: Lesson) => {
    setActiveSession({
      mode: 'lesson',
      variant: 'review',
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      targetUnitIndex: null,
      bannerText: '🔄 ദ്രുത പുനരവലോകനം · 5 ചോദ്യങ്ങൾ (+5 XP)',
      questions: buildReviewSessionQuestions(lesson, UNITS),
      initialHearts: Math.max(user.hearts, 1),
      xpReward: REVIEW_XP_REWARD,
    });
  };

  const startLegendary = (lesson: Lesson) => {
    setActiveSession({
      mode: 'lesson',
      variant: 'legendary',
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      targetUnitIndex: null,
      bannerText: '👑 ലെജൻഡറി വെല്ലുവിളി · 3 ❤️ · ഉച്ചാരണ സൂചനകളില്ല (+40 XP)',
      questions: buildLegendarySessionQuestions(lesson, UNITS),
      initialHearts: LEGENDARY_HEARTS,
      xpReward: LEGENDARY_XP_REWARD,
      hideTranslit: true,
    });
  };

  const startPlacementTest = () => {
    setActiveSession({
      mode: 'placement',
      lessonId: null,
      lessonTitle: 'നിലവാര നിർണ്ണയ പരീക്ഷ',
      targetUnitIndex: null,
      bannerText: 'നിലവാര നിർണ്ണയ പരീക്ഷ (Placement Test)',
      questions: prepareSessionQuestions(PLACEMENT_QUESTIONS),
      initialHearts: MAX_HEARTS,
    });
  };

  const startUnitJumpTest = (unitIndex: number) => {
    const questions = buildUnitJumpQuestions(unitIndex, UNITS, JUMP_TEST_QUESTION_COUNT);
    setActiveSession({
      mode: 'jump',
      lessonId: null,
      lessonTitle: `യൂണിറ്റ് ${unitIndex + 1} പ്രവേശന ടെസ്റ്റ്`,
      targetUnitIndex: unitIndex,
      bannerText: `🚀 യൂണിറ്റ് ${unitIndex + 1}-ലേക്കുള്ള പ്രവേശന ടെസ്റ്റ് (${JUMP_TEST_QUESTION_COUNT}-ൽ ${JUMP_TEST_PASS_SCORE} ശരി ആവശ്യം)`,
      questions,
      initialHearts: JUMP_TEST_HEARTS,
    });
  };

  const handleSessionComplete = (result: SessionResult) => {
    updateUserSync((prev) => {
      const updated = applySessionResult(prev, result, UNITS);
      return {
        ...updated,
        currentUnitId: resolveCurrentUnitId(updated.completedLessons, UNITS),
      };
    });
    setActiveSession(null);
    setActiveStoryLesson(null);
    setActiveVideoCallLesson(null);
    setCompleteResult(result);
    setPathFocusTrigger((n) => n + 1);
  };

  const handleRefillHearts = () => {
    updateUserSync((prev) => ({ ...prev, hearts: MAX_HEARTS }));
    showToast('5 ഹാർട്ടുകൾ നിറച്ചിരിക്കുന്നു!');
  };

  const handleResetProgress = () => {
    updateUserSync((prev) => ({
      ...prev,
      xp: 0,
      completedLessons: [],
      legendaryLessons: [],
      hearts: MAX_HEARTS,
      activeTab: 'path',
      currentUnitId: UNITS[0]?.id ?? 'u1',
    }));
    setPathFocusTrigger((n) => n + 1);
    showToast('പഠന പുരോഗതി റീസെറ്റ് ചെയ്തിരിക്കുന്നു.');
  };

  if (!user.onboarded) {
    return (
      <OnboardingScreen
        soundEnabled={user.soundEnabled}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  return (
    <>
      <AppShell
        activeTab={activeTab}
        user={user}
        leaderboard={leaderboard}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onSelectTab={handleSelectTab}
        onStartLesson={startLesson}
        onStartPlacement={startPlacementTest}
        onRefillHearts={handleRefillHearts}
      >
        {activeTab === 'path' && (
          <LearningPathTab
            completedLessons={user.completedLessons}
            legendaryLessons={user.legendaryLessons ?? []}
            soundEnabled={user.soundEnabled}
            focusTrigger={pathFocusTrigger}
            onVisibleUnitChange={handleVisibleUnitChange}
            onStartLesson={startLesson}
            onStartReview={startReview}
            onStartLegendary={startLegendary}
            onClaimChest={handleClaimChest}
            onStartUnitJump={startUnitJumpTest}
          />
        )}

        {activeTab === 'alphabet' && (
          <AlphabetTab soundEnabled={user.soundEnabled} />
        )}

        {activeTab === 'grammar' && (
          <GrammarCheatSheetTab
            completedLessons={user.completedLessons}
            soundEnabled={user.soundEnabled}
          />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardTab entries={leaderboard} />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            user={user}
            onUpdateName={(newName) => {
              updateUserSync((prev) => ({ ...prev, name: newName }));
              showToast('പേര് അപ്‌ഡേറ്റ് ചെയ്തിരിക്കുന്നു.');
            }}
            onUpdateAvatar={(newAvatar) => {
              updateUserSync((prev) => ({ ...prev, avatar: newAvatar }));
            }}
            onToggleSound={(enabled) => {
              updateUserSync((prev) => ({ ...prev, soundEnabled: enabled }));
            }}
            onRetakePlacement={startPlacementTest}
            onRefillHearts={handleRefillHearts}
            onResetProgress={handleResetProgress}
          />
        )}
      </AppShell>

      {activeSession && (
        <LessonModal
          session={activeSession}
          soundEnabled={user.soundEnabled}
          onHeartsChange={(hearts) => updateUserSync((prev) => ({ ...prev, hearts }))}
          onRefillHearts={() => updateUserSync((prev) => ({ ...prev, hearts: MAX_HEARTS }))}
          onComplete={handleSessionComplete}
          onClose={() => setActiveSession(null)}
        />
      )}

      {activeStoryLesson && activeStoryLesson.story && (
        <StoryModal
          lessonId={activeStoryLesson.id}
          story={activeStoryLesson.story}
          soundEnabled={user.soundEnabled}
          initialHearts={Math.max(user.hearts, 1)}
          onComplete={handleSessionComplete}
          onClose={() => setActiveStoryLesson(null)}
        />
      )}

      {activeVideoCallLesson && activeVideoCallLesson.videoCall && (
        <VideoCallModal
          lessonId={activeVideoCallLesson.id}
          scenario={activeVideoCallLesson.videoCall}
          soundEnabled={user.soundEnabled}
          learnerName={user.name}
          onComplete={handleSessionComplete}
          onClose={() => setActiveVideoCallLesson(null)}
        />
      )}

      {completeResult && (
        <CompleteModal
          result={completeResult}
          streak={user.streak}
          soundEnabled={user.soundEnabled}
          onDone={() => setCompleteResult(null)}
        />
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 bg-slate-900 dark:bg-slate-800 text-white border border-transparent dark:border-slate-700 text-sm font-bold px-4 py-3 rounded-xl shadow-lg animate-pop"
        >
          {toast}
        </div>
      )}
    </>
  );
}
