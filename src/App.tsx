import React, { useEffect, useMemo, useState } from 'react';
import { PLACEMENT_QUESTIONS, UNITS } from './data/curriculum';
import type { AppTab, Lesson, SessionConfig, SessionResult, UserState } from './types/learning';
import {
  applySessionResult,
  buildUnitJumpQuestions,
  computeStreakUpdate,
  MAX_HEARTS,
  mergeAndSortLeaderboard,
  prepareSessionQuestions,
} from './utils/learningEngine';
import { OnboardingScreen } from './components/OnboardingScreen';
import { AppShell } from './components/AppShell';
import { LearningPathTab } from './components/LearningPathTab';
import { AlphabetTab } from './components/AlphabetTab';
import { LeaderboardTab } from './components/LeaderboardTab';
import { ProfileTab } from './components/ProfileTab';
import { LessonModal } from './components/LessonModal';
import { CompleteModal } from './components/CompleteModal';

const STORAGE_KEY = 'arabic_ml_app_state_v2';

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
    lastActiveDate: new Date().toDateString(),
    soundEnabled: true,
    onboarded: autostart,
  };

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<UserState>;
    const merged: UserState = {
      ...fallback,
      ...parsed,
      onboarded: Boolean(parsed.onboarded && parsed.name) || autostart,
      name: parsed.name || (autostart ? 'അഹമ്മദ്' : ''),
    };
    const streakCheck = computeStreakUpdate(merged);
    if (streakCheck.changed) {
      return {
        ...merged,
        streak: streakCheck.streak,
        hearts: streakCheck.hearts,
        lastActiveDate: streakCheck.lastActiveDate,
      };
    }
    return merged;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [user, setUser] = useState<UserState>(createInitialUserState);
  const [activeTab, setActiveTab] = useState<AppTab>('path');
  const [activeSession, setActiveSession] = useState<SessionConfig | null>(null);
  const [completeResult, setCompleteResult] = useState<SessionResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Ignore storage quota errors
    }
  }, [user]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(id);
  }, [toast]);

  const leaderboard = useMemo(() => mergeAndSortLeaderboard(user), [user]);

  const showToast = (msg: string) => setToast(msg);

  const handleOnboardingComplete = (name: string, avatar: string, takePlacement: boolean) => {
    setUser((prev) => ({
      ...prev,
      name,
      avatar,
      onboarded: true,
      lastActiveDate: new Date().toDateString(),
    }));
    if (takePlacement) {
      startPlacementTest();
    }
  };

  const startLesson = (lesson: Lesson) => {
    if (user.hearts <= 0) {
      setUser((prev) => ({ ...prev, hearts: MAX_HEARTS }));
      showToast('ഹാർട്ടുകൾ സ്വയമേവ നിറച്ചിരിക്കുന്നു! പാഠം തുടങ്ങാം.');
    }
    setActiveSession({
      mode: 'lesson',
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      targetUnitIndex: null,
      bannerText: null,
      questions: prepareSessionQuestions(lesson.questions),
      initialHearts: Math.max(user.hearts, 1),
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
    const questions = buildUnitJumpQuestions(unitIndex, UNITS, 5);
    setActiveSession({
      mode: 'jump',
      lessonId: null,
      lessonTitle: `യൂണിറ്റ് ${unitIndex + 1} പ്രവേശന ടെസ്റ്റ്`,
      targetUnitIndex: unitIndex,
      bannerText: `യൂണിറ്റ് ${unitIndex + 1}-ലേക്കുള്ള പ്രവേശന ടെസ്റ്റ്`,
      questions,
      initialHearts: 3,
    });
  };

  const handleSessionComplete = (result: SessionResult) => {
    setUser((prev) => applySessionResult(prev, result, UNITS));
    setActiveSession(null);
    setCompleteResult(result);
  };

  const handleRefillHearts = () => {
    setUser((prev) => ({ ...prev, hearts: MAX_HEARTS }));
    showToast('5 ഹാർട്ടുകൾ നിറച്ചിരിക്കുന്നു!');
  };

  const handleResetProgress = () => {
    setUser((prev) => ({
      ...prev,
      xp: 0,
      completedLessons: [],
      hearts: MAX_HEARTS,
    }));
    setActiveTab('path');
    showToast('പഠന പുരോഗതി റീസെറ്റ് ചെയ്തിരിക്കുന്നു.');
  };

  if (!user.onboarded) {
    return (
      <OnboardingScreen
        soundEnabled={user.soundEnabled}
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
        onSelectTab={setActiveTab}
        onStartLesson={startLesson}
        onStartPlacement={startPlacementTest}
        onRefillHearts={handleRefillHearts}
      >
        {activeTab === 'path' && (
          <LearningPathTab
            completedLessons={user.completedLessons}
            soundEnabled={user.soundEnabled}
            onStartLesson={startLesson}
            onStartUnitJump={startUnitJumpTest}
          />
        )}

        {activeTab === 'alphabet' && (
          <AlphabetTab soundEnabled={user.soundEnabled} />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardTab entries={leaderboard} />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            user={user}
            onUpdateName={(newName) => {
              setUser((prev) => ({ ...prev, name: newName }));
              showToast('പേര് അപ്‌ഡേറ്റ് ചെയ്തിരിക്കുന്നു.');
            }}
            onUpdateAvatar={(newAvatar) => {
              setUser((prev) => ({ ...prev, avatar: newAvatar }));
            }}
            onToggleSound={(enabled) => {
              setUser((prev) => ({ ...prev, soundEnabled: enabled }));
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
          onHeartsChange={(hearts) => setUser((prev) => ({ ...prev, hearts }))}
          onRefillHearts={() => setUser((prev) => ({ ...prev, hearts: MAX_HEARTS }))}
          onComplete={handleSessionComplete}
          onClose={() => setActiveSession(null)}
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
          className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 bg-slate-900 text-white text-sm font-bold px-4 py-3 rounded-xl shadow-lg animate-pop"
        >
          {toast}
        </div>
      )}
    </>
  );
}
