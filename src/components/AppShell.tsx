import React from 'react';
import { BookOpen, Flame, Heart, Home, Rocket, Star, Table2, Trophy, User } from 'lucide-react';
import type { AppTab, LeaderboardEntry, Lesson, UserState } from '../types/learning';
import { UNITS } from '../data/curriculum';
import { getAllLessonIds, getNextActiveLesson, MAX_HEARTS } from '../utils/learningEngine';
import { playTone } from '../utils/audio';

interface AppShellProps {
  activeTab: AppTab;
  user: UserState;
  leaderboard: LeaderboardEntry[];
  onSelectTab: (tab: AppTab) => void;
  onStartLesson: (lesson: Lesson) => void;
  onStartPlacement: () => void;
  onRefillHearts: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: { id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'path', label: 'പഠനം', icon: Home },
  { id: 'alphabet', label: 'അക്ഷരങ്ങൾ', icon: BookOpen },
  { id: 'grammar', label: 'വ്യാകരണം', icon: Table2 },
  { id: 'leaderboard', label: 'റാങ്ക്', icon: Trophy },
  { id: 'profile', label: 'പ്രൊഫൈൽ', icon: User },
];

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  user,
  leaderboard,
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

  const handleNav = (tab: AppTab) => {
    playTone('tap', user.soundEnabled);
    onSelectTab(tab);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 px-5 py-6 z-30">
        <div className="px-2 mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#4AA802] border-b-4 border-[#388000] flex items-center justify-center text-xl shrink-0">
            <span aria-hidden="true">🕌</span>
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-base text-slate-900 leading-tight whitespace-nowrap">
              അറബി പഠിക്കാം
            </div>
            <div className="text-xs font-semibold text-slate-500 font-latin">
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
                    ? 'bg-[#F0FBE6] text-[#2E6B00] border border-[#C5EB9E]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-slate-200 px-2 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center text-xl shrink-0">
            <span aria-hidden="true">{user.avatar}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-extrabold text-slate-900 truncate">{user.name}</div>
            <div className="text-xs text-slate-500 font-latin tabular-nums">
              {user.xp} XP · {user.completedLessons.length}/{totalLessons} പാഠം
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Compact Sticky Top Bar (56px, within 15% mobile sticky cap with 64px bottom bar) */}
      <header className="lg:hidden sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg" aria-hidden="true">
            🕌
          </span>
          <span className="font-extrabold text-sm text-slate-900 truncate">
            അറബി പഠിക്കാം
          </span>
        </div>

        <div className="flex items-center gap-4 font-extrabold text-sm font-latin tabular-nums shrink-0">
          <div className="flex items-center gap-1 text-orange-600" aria-label={`സ്ട്രീക്ക് ${user.streak} ദിവസം`}>
            <Flame className="w-4 h-4 fill-orange-500 text-orange-500" aria-hidden="true" />
            <span>{user.streak}</span>
          </div>
          <div className="flex items-center gap-1 text-amber-600" aria-label={`ആകെ XP ${user.xp}`}>
            <Star className="w-4 h-4 fill-amber-500 text-amber-500" aria-hidden="true" />
            <span>{user.xp}</span>
          </div>
          <div className="flex items-center gap-1 text-rose-600" aria-label={`ഹാർട്ടുകൾ ${user.hearts}`}>
            <Heart className="w-4 h-4 fill-rose-500 text-rose-500" aria-hidden="true" />
            <span>{user.hearts}</span>
          </div>
        </div>
      </header>

      {/* Main Content + Desktop Right Companion Rail */}
      <div className="flex-1 lg:pl-72">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10 grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* Primary Learning Canvas */}
          <main className="xl:col-span-8 min-w-0">{children}</main>

          {/* Desktop Right Companion Rail */}
          <aside className="hidden xl:block xl:col-span-4 space-y-5 sticky top-6">
            {/* Live Stats Strip */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-orange-50/70">
                <Flame className="w-5 h-5 fill-orange-500 text-orange-500 mx-auto" aria-hidden="true" />
                <div className="font-extrabold text-lg text-slate-900 font-latin tabular-nums mt-1">
                  {user.streak}
                </div>
                <div className="text-[11px] font-bold text-slate-500">സ്ട്രീക്ക്</div>
              </div>
              <div className="p-2 rounded-xl bg-amber-50/70">
                <Star className="w-5 h-5 fill-amber-500 text-amber-500 mx-auto" aria-hidden="true" />
                <div className="font-extrabold text-lg text-slate-900 font-latin tabular-nums mt-1">
                  {user.xp}
                </div>
                <div className="text-[11px] font-bold text-slate-500">XP</div>
              </div>
              <div className="p-2 rounded-xl bg-rose-50/70">
                <Heart className="w-5 h-5 fill-rose-500 text-rose-500 mx-auto" aria-hidden="true" />
                <div className="font-extrabold text-lg text-slate-900 font-latin tabular-nums mt-1">
                  {user.hearts}/{MAX_HEARTS}
                </div>
                <div className="text-[11px] font-bold text-slate-500">ഹാർട്ട്</div>
              </div>
            </div>

            {/* Course Progress & Next Lesson Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900">പഠന പുരോഗതി</h2>
                <span className="text-xs font-extrabold text-[#357A00] font-latin tabular-nums">
                  {completionPct}%
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#4AA802] rounded-full transition-all duration-300"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <p className="text-xs text-slate-600">
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
                  className="w-full py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-bold text-xs hover:bg-rose-100 transition-colors"
                >
                  ഹാർട്ടുകൾ നിറയ്ക്കുക (സൗജന്യം)
                </button>
              )}
            </div>

            {/* Placement Test Quick Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <Rocket className="w-5 h-5 text-[#0284C7] shrink-0" aria-hidden="true" />
                <h2 className="text-sm font-extrabold text-slate-900">
                  നിലവാര നിർണ്ണയ പരീക്ഷ
                </h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                അറബി അടിസ്ഥാനം അറിയാമെങ്കിൽ 8 ചോദ്യങ്ങളുള്ള ടെസ്റ്റ് എഴുതി ഉയർന്ന യൂണിറ്റുകൾ അൺലോക്ക് ചെയ്യാം.
              </p>
              <button
                type="button"
                onClick={() => {
                  playTone('tap', user.soundEnabled);
                  onStartPlacement();
                }}
                className="btn-3d w-full py-2.5 px-4 rounded-xl border-2 border-b-4 border-sky-200 bg-sky-50 hover:bg-sky-100 text-[#0369A1] font-extrabold text-xs"
              >
                ടെസ്റ്റ് എഴുതുക
              </button>
            </div>

            {/* Mini Leaderboard Preview */}
            {activeTab !== 'leaderboard' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-slate-900">മുന്നിലുള്ളവർ</h2>
                  <button
                    type="button"
                    onClick={() => handleNav('leaderboard')}
                    className="text-xs font-bold text-[#0284C7] hover:underline"
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
                        <span className="font-bold text-slate-800 truncate">
                          {entry.name}
                        </span>
                      </div>
                      <span className="font-extrabold text-amber-600 font-latin tabular-nums shrink-0">
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
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 items-center px-1.5"
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
                active ? 'text-[#357A00] bg-[#F0FBE6]' : 'text-slate-500 hover:text-slate-800'
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
