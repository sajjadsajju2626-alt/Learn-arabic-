import React from 'react';
import { Flame, Trophy } from 'lucide-react';
import type { LeaderboardEntry } from '../types/learning';

interface LeaderboardTabProps {
  entries: LeaderboardEntry[];
}

export const LeaderboardTab: React.FC<LeaderboardTabProps> = ({ entries }) => {
  const userRank = entries.findIndex((e) => e.isCurrentUser) + 1;

  return (
    <div className="space-y-6 pb-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-5 sm:p-6 text-white border-b-4 border-orange-700 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-amber-50">
            ആഴ്ചതോറുമുള്ള പഠന ലീഗ് · {entries.length} പഠിതാക്കൾ
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold mt-1 flex items-center gap-2">
            <Trophy className="w-6 h-6 shrink-0" aria-hidden="true" />
            <span>ലീഡർബോർഡ്</span>
          </h1>
          <p className="text-sm text-amber-50 mt-1">
            പാഠങ്ങൾ പൂർത്തിയാക്കി കൂടുതൽ XP നേടി ഒന്നാം സ്ഥാനത്തേക്ക് എത്തൂ
          </p>
        </div>

        {userRank > 0 && (
          <div className="bg-white/15 border border-white/25 rounded-2xl px-4 py-2.5 text-center min-w-[96px]">
            <div className="text-xs font-semibold text-amber-50">നിങ്ങളുടെ റാങ്ക്</div>
            <div className="text-2xl font-extrabold font-latin tabular-nums mt-0.5">
              #{userRank}
            </div>
          </div>
        )}
      </div>

      {/* Standings List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden transition-colors">
        {entries.map((entry, idx) => {
          const rank = idx + 1;
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

          return (
            <div
              key={entry.id}
              data-testid={entry.isCurrentUser ? 'leaderboard-current-user' : undefined}
              className={`flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 transition-colors ${
                entry.isCurrentUser
                  ? 'bg-[#F0FBE6] dark:bg-emerald-950/45'
                  : 'bg-white dark:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-8 flex items-center justify-center shrink-0">
                  {medal ? (
                    <span className="text-2xl" aria-label={`റാങ്ക് ${rank}`}>
                      {medal}
                    </span>
                  ) : (
                    <span className="font-extrabold text-sm text-slate-500 dark:text-slate-400 font-latin tabular-nums">
                      {rank}
                    </span>
                  )}
                </div>

                <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xl shrink-0">
                  <span aria-hidden="true">{entry.avatar}</span>
                </div>

                <div className="min-w-0">
                  <div className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                    {entry.name}
                    {entry.isCurrentUser && (
                      <span className="text-xs font-bold text-[#357A00] dark:text-emerald-400 ml-2">
                        · നിങ്ങൾ
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5 font-latin tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-orange-500" aria-hidden="true" />
                      {entry.streak} ദിവസം
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{entry.lessonsCount} പാഠങ്ങൾ</span>
                  </div>
                </div>
              </div>

              <div className="font-extrabold text-amber-600 dark:text-amber-400 text-sm sm:text-base font-latin tabular-nums shrink-0">
                {entry.xp} XP
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
