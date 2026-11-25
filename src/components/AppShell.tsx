import React from 'react';
import {
  BookOpen,
  Flame,
  Heart,
  Home,
  Moon,
  Rocket,
  Star,
  Sun,
  Table2,
  Trophy,
  User,
} from 'lucide-react';
import type { AppTab, LeaderboardEntry, Lesson, UserState } from '../types/learning';
import { UNITS } from '../data/curriculum';
import { getAllLessonIds, getNextActiveLesson, MAX_HEARTS } from '../utils/learningEngine';
import { playTone } from '../utils/audio';
import type { ThemeMode } from '../utils/theme';

interface AppShellProps {
  activeTab: AppTab;
  user: UserState;
  leaderboard: LeaderboardEntry[];
  theme: ThemeMode;
  onToggleTheme: () => void;
  onSelectTab: (tab: AppTab) => void;
  onStartLesson: (lesson: Lesson) => void;
  onStartPlacement: () => void;
  onRefillHearts: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: { id: AppTab; label: string; headerTitle: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'path', label: 'പഠനം', headerTitle: 'പഠന പാത · 35 യൂണിറ്റുകൾ', icon: Home },
  { id: 'alphabet', label: 'അക്ഷരങ്ങൾ', headerTitle: 'അറബി അക്ഷരമാലയും ഹറകത്തുകളും', icon: BookOpen },
  { id: 'grammar', label: 'വ്യാകരണം', headerTitle: 'വ്യാകരണ സഹായി · ക്രിയാരൂപങ്ങൾ', icon: Table2 },
  { id: 'leaderboard', label: 'റാങ്ക്', headerTitle: 'ആഴ്ചതോറുമുള്ള ലീഡർബോർഡ്', icon: Trophy },
  { id: 'profile', label: 'പ്രൊഫൈൽ', headerTitle: 'നിങ്ങളുടെ പ്രൊഫൈൽ', icon: User },
];

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  user,
  leaderboard,
  theme,
  onToggleTheme,
  onSelectTab,
  onStartLesson,
  onStartPlacement,
  onRefillHearts,
  children,
}) => {
  const totalLessons = getAllLessonIds(UNITS).length;
  const completionPct = Math.round((user.completedLessons.length / totalLessons) * 100);
  const nextActive = getNextActiveLesson(user.completedLessons, UNITS);
  const topThree = leaderboard.slice(0, 3);
  const isDark = theme === 'dark';
  const activeNav = NAV_ITEMS.find((item) => item.id === activeTab) ?? NAV_ITEMS[0];

  const handleNav = (tab: AppTab) => {
    playTone('tap', user.soundEnabled);
    onSelectTab(tab);
  };

  const handleThemeToggle = () => {
    playTone('tap', user.soundEnabled);
    onToggleTheme();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row transition-colors">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:fixed lg:inset-y-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 px-5 py-6 z-30 transition-colors">
        <div className="px-2 mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#4AA802] border-b-4 border-[#388000] flex items-center justify-center text-xl shrink-0">
            <span aria-hidden="true">🕌</span>
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-base text-slate-900 dark:text-slate-50 leading-tight whitespace-nowrap">
              അറബി പഠിക്കാം
            </div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-latin">
              Learn Arabic
            </div>
          </div>
        </div>

        <nav aria-label="പ്രധാന നാവിഗേഷൻ" className="space-y-1.5 flex-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-extrabold text-sm transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#F0FBE6] dark:bg-emerald-950/60 text-[#2E6B00] dark:text-emerald-300 border border-[#C5EB9E] dark:border-emerald-800/80'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-50 border border-transparent'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 px-2 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-xl shrink-0">
            <span aria-hidden="true">{user.avatar}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
              {user.name}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-latin tabular-nums">
              {user.xp} XP · {user.completedLessons.length}/{totalLessons} പാഠം
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Compact Sticky Top Bar (56px, within 15% mobile sticky cap with 64px bottom bar) */}
      <header className="lg:hidden sticky top-0 z-30 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3.5 flex items-center justify-between gap-2 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0" aria-hidden="true">
            🕌
          </span>
          <span className="font-extrabold text-sm text-slate-900 dark:text-slate-50 truncate">
            അറബി പഠിക്കാം
          </span>
        </div>

        <div className="flex items-center gap-3 font-extrabold text-sm font-latin tabular-nums shrink-0">
          <div
            className="flex items-center gap-1 text-orange-600 dark:text-orange-400"
            aria-label={`സ്ട്രീക്ക് ${user.streak} ദിവസം`}
          >
            <Flame className="w-4 h-4 fill-orange-500 text-orange-500" aria-hidden="true" />
            <span>{user.streak}</span>
          </div>
          <div
            className="flex items-center gap-1 text-amber-600 dark:text-amber-400"
            aria-label={`ആകെ XP ${user.xp}`}
          >
            <Star className="w-4 h-4 fill-amber-500 text-amber-500" aria-hidden="true" />
            <span>{user.xp}</span>
          </div>
          <div
            className="flex items-center gap-1 text-rose-600 dark:text-rose-400"
            aria-label={`ഹാർട്ടുകൾ ${user.hearts}`}
          >
            <Heart className="w-4 h-4 fill-rose-500 text-rose-500" aria-hidden="true" />
            <span>{user.hearts}</span>
          </div>
          <button
            type="button"
            data-testid="mobile-theme-toggle-btn"
            aria-pressed={isDark}
            aria-label={isDark ? 'ലൈറ്റ് മോഡിലേക്ക് മാറ്റുക' : 'ഡാർക്ക് മോഡിലേക്ക് മാറ്റുക'}
            title={isDark ? 'ലൈറ്റ് മോഡ്' : 'ഡാർക്ക് മോഡ്'}
            onClick={handleThemeToggle}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-300 flex items-center justify-center transition-colors shrink-0"
          >
            {isDark ? (
              <Sun className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content + Desktop Sticky Header + Desktop Right Companion Rail */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        {/* Desktop AppShell Header with Global Dark Mode Toggle */}
        <header className="hidden lg:flex sticky top-0 z-20 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 lg:px-8 items-center justify-between gap-4 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate">
              {activeNav.headerTitle}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              data-testid="theme-toggle-btn"
              aria-pressed={isDark}
              aria-label={isDark ? 'ലൈറ്റ് മോഡിലേക്ക് മാറ്റുക' : 'ഡാർക്ക് മോഡിലേക്ക് മാറ്റുക'}
              onClick={handleThemeToggle}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-100 font-bold text-xs transition-colors whitespace-nowrap"
            >
              {isDark ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                  <span>ലൈറ്റ് മോഡ്</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-600 shrink-0" aria-hidden="true" />
                  <span>ഡാർക്ക് മോഡ്</span>
                </>
              )}
            </button>
          </div>
        </header>

        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10 grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* Primary Learning Canvas */}
          <main className="xl:col-span-8 min-w-0">{children}</main>

          {/* Desktop Right Companion Rail */}
          <aside className="hidden xl:block xl:col-span-4 space-y-5 sticky top-20">
            {/* Live Stats Strip */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 grid grid-cols-3 gap-2 text-center transition-colors">
              <div className="p-2 rounded-xl bg-orange-50/70 dark:bg-orange-950/35">
                <Flame className="w-5 h-5 fill-orange-500 text-orange-500 mx-auto" aria-hidden="true" />
                <div className="font-extrabold text-lg text-slate-900 dark:text-slate-100 font-latin tabular-nums mt-1">
                  {user.streak}
                </div>
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">സ്ട്രീക്ക്</div>
              </div>
              <div className="p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/35">
                <Star className="w-5 h-5 fill-amber-500 text-amber-500 mx-auto" aria-hidden="true" />
                <div className="font-extrabold text-lg text-slate-900 dark:text-slate-100 font-latin tabular-nums mt-1">
                  {user.xp}
                </div>
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">XP</div>
              </div>
              <div className="p-2 rounded-xl bg-rose-50/70 dark:bg-rose-950/35">
                <Heart className="w-5 h-5 fill-rose-500 text-rose-500 mx-auto" aria-hidden="true" />
                <div className="font-extrabold text-lg text-slate-900 dark:text-slate-100 font-latin tabular-nums mt-1">
                  {user.hearts}/{MAX_HEARTS}
                </div>
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">ഹാർട്ട്</div>
              </div>
            </div>

            {/* Course Progress & Next Lesson Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 transition-colors">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  പഠന പുരോഗതി
                </h2>
                <span className="text-xs font-extrabold text-[#357A00] dark:text-emerald-400 font-latin tabular-nums">
                  {completionPct}%
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#4AA802] rounded-full transition-all duration-300"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {user.completedLessons.length} / {totalLessons} പാഠങ്ങൾ പൂർത്തിയായി
              </p>

              {nextActive && (
                <button
                  type="button"
                  onClick={() => {
                    playTone('tap', user.soundEnabled);
                    onStartLesson(nextActive.lesson);
                  }}
                  className="btn-3d w-full py-3 px-4 rounded-xl bg-[#4AA802] border-b-4 border-[#388000] hover:bg-[#429602] text-white font-extrabold text-sm text-center"
                >
                  അടുത്ത പാഠം തുടങ്ങുക
                </button>
              )}

              {user.hearts < MAX_HEARTS && (
                <button
                  type="button"
                  onClick={() => {
                    playTone('correct', user.soundEnabled);
                    onRefillHearts();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold text-xs hover:bg-rose-100 dark:hover:bg-rose-950/70 transition-colors"
                >
                  ഹാർട്ടുകൾ നിറയ്ക്കുക (സൗജന്യം)
                </button>
              )}
            </div>

            {/* Placement Test Quick Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 transition-colors">
              <div className="flex items-center gap-2.5">
                <Rocket className="w-5 h-5 text-[#0284C7] dark:text-sky-400 shrink-0" aria-hidden="true" />
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  നിലവാര നിർണ്ണയ പരീക്ഷ
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                അറബി അടിസ്ഥാനം അറിയാമെങ്കിൽ 8 ചോദ്യങ്ങളുള്ള ടെസ്റ്റ് എഴുതി ഉയർന്ന യൂണിറ്റുകൾ അൺലോക്ക് ചെയ്യാം.
              </p>
              <button
                type="button"
                onClick={() => {
                  playTone('tap', user.soundEnabled);
                  onStartPlacement();
                }}
                className="btn-3d w-full py-2.5 px-4 rounded-xl border-2 border-b-4 border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-950/80 text-[#0369A1] dark:text-sky-300 font-extrabold text-xs"
              >
                ടെസ്റ്റ് എഴുതുക
              </button>
            </div>

            {/* Mini Leaderboard Preview */}
            {activeTab !== 'leaderboard' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 transition-colors">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    മുന്നിലുള്ളവർ
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleNav('leaderboard')}
                    className="text-xs font-bold text-[#0284C7] dark:text-sky-400 hover:underline"
                  >
                    എല്ലാം കാണുക
                  </button>
                </div>
                <div className="space-y-2.5">
                  {topThree.map((entry, idx) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between text-xs gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base" aria-hidden="true">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {entry.name}
                        </span>
                      </div>
                      <span className="font-extrabold text-amber-600 dark:text-amber-400 font-latin tabular-nums shrink-0">
                        {entry.xp} XP
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Mobile Fixed Bottom Thumb Navigation Bar (64px) */}
      <nav
        aria-label="മൊബൈൽ നാവിഗേഷൻ"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center px-1.5 transition-colors"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => handleNav(item.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                active
                  ? 'text-[#357A00] dark:text-emerald-300 bg-[#F0FBE6] dark:bg-emerald-950/60'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span className="text-[11px] font-extrabold leading-tight whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
