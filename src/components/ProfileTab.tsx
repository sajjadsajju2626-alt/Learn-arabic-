import React, { useState } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  Flame,
  Heart,
  KeyRound,
  Loader2,
  Pencil,
  Rocket,
  RotateCcw,
  Star,
  Target,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AVATAR_OPTIONS, UNITS } from '../data/curriculum';
import type { UserState } from '../types/learning';
import { getAllLessonIds, MAX_HEARTS } from '../utils/learningEngine';
import { playTone } from '../utils/audio';
import { getSavedGeminiApiKey, testAndSaveGeminiApiKey } from '../utils/videoCallConversation';

interface ProfileTabProps {
  user: UserState;
  onUpdateName: (newName: string) => void;
  onUpdateAvatar: (newAvatar: string) => void;
  onToggleSound: (enabled: boolean) => void;
  onRetakePlacement: () => void;
  onRefillHearts: () => void;
  onResetProgress: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  user,
  onUpdateName,
  onUpdateAvatar,
  onToggleSound,
  onRetakePlacement,
  onRefillHearts,
  onResetProgress,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(user.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [apiKeyInput, setApiKeyInput] = useState(() => getSavedGeminiApiKey());
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingApiKey, setTestingApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(() =>
    getSavedGeminiApiKey()
      ? { type: 'success', message: '✅ കണക്ഷൻ വിജയിച്ചു! (Connected)' }
      : null
  );

  const totalLessons = getAllLessonIds(UNITS).length;

  const handleTestAndSaveApiKey = async () => {
    if (testingApiKey) return;
    playTone('tap', user.soundEnabled);
    setTestingApiKey(true);
    setApiKeyStatus(null);
    const trimmed = apiKeyInput.trim();
    setApiKeyInput(trimmed);
    const result = await testAndSaveGeminiApiKey(trimmed);
    setTestingApiKey(false);
    if (result.ok) {
      playTone('correct', user.soundEnabled);
      setApiKeyStatus({
        type: 'success',
        message: '✅ കണക്ഷൻ വിജയിച്ചു! (Connected)',
      });
    } else {
      playTone('wrong', user.soundEnabled);
      setApiKeyStatus({
        type: 'error',
        message: result.error,
      });
    }
  };

  const handleSaveName = () => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setNameError('പേര് ഒഴിഞ്ഞുകിടക്കാൻ പാടില്ല');
      return;
    }
    setNameError(null);
    onUpdateName(trimmed);
    setEditingName(false);
    playTone('correct', user.soundEnabled);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Profile Identity Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-sky-50 dark:bg-sky-950/60 border-4 border-[#0284C7] flex items-center justify-center text-4xl shrink-0">
            <span aria-hidden="true">{user.avatar}</span>
          </div>

          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="space-y-2">
                <label htmlFor="profile-edit-name" className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                  പുതിയ പേര് നൽകുക
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="profile-edit-name"
                    type="text"
                    maxLength={25}
                    value={draftName}
                    onChange={(e) => {
                      setDraftName(e.target.value);
                      if (nameError) setNameError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') setEditingName(false);
                    }}
                    className="flex-1 min-w-0 px-3.5 py-2 rounded-xl border-2 border-[#0284C7] text-sm font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
                  />
                  <button
                    type="button"
                    onClick={handleSaveName}
                    aria-label="പേര് സേവ് ചെയ്യുക"
                    className="btn-3d px-3.5 py-2 rounded-xl bg-[#4AA802] border-b-4 border-[#388000] text-white font-bold text-sm inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <Check className="w-4 h-4" aria-hidden="true" />
                    <span>സേവ്</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftName(user.name);
                      setNameError(null);
                      setEditingName(false);
                    }}
                    aria-label="റദ്ദാക്കുക"
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
                {nameError && (
                  <p role="alert" className="text-xs font-bold text-rose-600 dark:text-rose-400">
                    {nameError}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-50">
                    {user.name}
                  </h1>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftName(user.name);
                      setEditingName(true);
                      playTone('tap', user.soundEnabled);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>പേര് മാറ്റുക</span>
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  മലയാളം → അറബി പഠിതാവ് · {user.completedLessons.length}/{totalLessons} പാഠങ്ങൾ പൂർത്തിയായി
                </p>
              </div>
            )}

            {/* Quick Avatar Switcher */}
            <div className="flex items-center gap-2 mt-4" role="radiogroup" aria-label="അവതാർ മാറ്റുക">
              {AVATAR_OPTIONS.map((opt) => {
                const selected = user.avatar === opt.emoji;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`അവതാർ ${opt.label}`}
                    onClick={() => {
                      playTone('tap', user.soundEnabled);
                      onUpdateAvatar(opt.emoji);
                    }}
                    className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center border-2 transition ${
                      selected
                        ? 'border-[#4AA802] bg-[#F0FBE6] dark:bg-emerald-950/60'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.emoji}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-center transition-colors">
          <Flame className="w-6 h-6 text-orange-500 mx-auto" aria-hidden="true" />
          <div className="font-extrabold text-2xl text-slate-900 dark:text-slate-50 font-latin tabular-nums mt-1.5">
            {user.streak}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">ദിവസം (Streak)</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-center transition-colors">
          <Star className="w-6 h-6 text-amber-500 mx-auto" aria-hidden="true" />
          <div className="font-extrabold text-2xl text-slate-900 dark:text-slate-50 font-latin tabular-nums mt-1.5">
            {user.xp}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">ആകെ XP</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-center transition-colors">
          <Target className="w-6 h-6 text-[#4AA802] dark:text-emerald-400 mx-auto" aria-hidden="true" />
          <div className="font-extrabold text-2xl text-slate-900 dark:text-slate-50 font-latin tabular-nums mt-1.5">
            {user.completedLessons.length} / {totalLessons}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">പാഠങ്ങൾ</div>
        </div>
      </div>

      {/* Direct Gemini 2.5 Flash API Key Card for Video Call Roleplay */}
      <div
        data-testid="profile-gemini-key-card"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3.5 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/70 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <label
              htmlFor="profile-gemini-api-key"
              className="text-sm font-extrabold text-slate-900 dark:text-slate-100 block"
            >
              🔑 AI സംഭാഷണ കീ (Gemini API Key)
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              താരിഖുമായി തത്സമയ അറബി വീഡിയോ കോൾ (gemini-2.5-flash) നടത്താൻ നിങ്ങളുടെ Gemini API Key ഇവിടെ നൽകി പരിശോധിക്കാം. GitHub Pages, Android APK എന്നിവയിലും നേരിട്ട് പ്രവർത്തിക്കും.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1 min-w-0">
            <input
              id="profile-gemini-api-key"
              data-testid="profile-gemini-key-input"
              type={showApiKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={(e) => {
                setApiKeyInput(e.target.value);
                if (apiKeyStatus) setApiKeyStatus(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleTestAndSaveApiKey();
                }
              }}
              placeholder="AIzaSy..."
              autoComplete="off"
              spellCheck={false}
              className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 focus:border-[#0284C7] dark:focus:border-sky-400 outline-none text-sm font-mono text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/80 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              aria-label={showApiKey ? 'കീ മറയ്ക്കുക' : 'കീ കാണിക്കുക'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              {showApiKey ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>

          <button
            type="button"
            data-testid="profile-gemini-key-test-btn"
            disabled={testingApiKey}
            onClick={() => void handleTestAndSaveApiKey()}
            className="btn-3d px-4 py-2.5 rounded-xl bg-[#4AA802] hover:bg-[#419600] border-b-4 border-[#388000] text-white font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-60 shrink-0"
          >
            {testingApiKey ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>പരിശോധിക്കുന്നു...</span>
              </>
            ) : (
              <span>പരിശോധിച്ച് സേവ് ചെയ്യുക (Test &amp; Save)</span>
            )}
          </button>
        </div>

        {apiKeyStatus && (
          <div
            role={apiKeyStatus.type === 'error' ? 'alert' : 'status'}
            data-testid="profile-gemini-key-status"
            className={`rounded-xl px-3.5 py-2.5 text-xs font-extrabold break-words ${
              apiKeyStatus.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {apiKeyStatus.message}
          </div>
        )}
      </div>

      {/* Unit Mastery Breakdown */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 transition-colors">
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">യൂണിറ്റ് പുരോഗതി</h2>
        <div className="space-y-3.5">
          {UNITS.map((unit) => {
            const done = unit.lessons.filter((l) => user.completedLessons.includes(l.id)).length;
            const pct = Math.round((done / unit.lessons.length) * 100);
            return (
              <div key={unit.id}>
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className="text-slate-700 dark:text-slate-300 truncate pr-2">{unit.title}</span>
                  <span className="text-slate-500 dark:text-slate-400 font-latin tabular-nums shrink-0">
                    {done}/{unit.lessons.length}
                  </span>
                </div>
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${unit.theme.bg}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Settings & Actions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden transition-colors">
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {user.soundEnabled ? (
              <Volume2 className="w-5 h-5 text-[#4AA802] dark:text-emerald-400 shrink-0" aria-hidden="true" />
            ) : (
              <VolumeX className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
            )}
            <div>
              <label htmlFor="sound-effects-toggle" className="font-bold text-sm text-slate-800 dark:text-slate-200 block">
                ശബ്ദ ഇഫക്റ്റുകൾ (Sound Effects)
              </label>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                ഉത്തരങ്ങളുടെയും അറബി ഉച്ചാരണത്തിന്റെയും ശബ്ദം
              </div>
            </div>
          </div>
          <input
            id="sound-effects-toggle"
            type="checkbox"
            checked={user.soundEnabled}
            onChange={(e) => onToggleSound(e.target.checked)}
            className="w-5 h-5 accent-[#4AA802] rounded cursor-pointer"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            playTone('tap', user.soundEnabled);
            onRetakePlacement();
          }}
          className="w-full p-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Rocket className="w-5 h-5 text-[#0284C7] dark:text-sky-400 shrink-0" aria-hidden="true" />
            <div>
              <div className="font-bold text-sm text-[#0369A1] dark:text-sky-300">
                നിലവാര നിർണ്ണയ പരീക്ഷ (Placement Test)
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                ടെസ്റ്റ് എഴുതി ഉയർന്ന യൂണിറ്റുകളിലേക്ക് നേരിട്ട് കടക്കുക
              </div>
            </div>
          </div>
          <span className="text-xs font-bold text-[#0284C7] dark:text-sky-400 whitespace-nowrap">തുടങ്ങുക</span>
        </button>

        <button
          type="button"
          onClick={() => {
            playTone('correct', user.soundEnabled);
            onRefillHearts();
          }}
          className="w-full p-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Heart className="w-5 h-5 text-rose-500 shrink-0" aria-hidden="true" />
            <div>
              <div className="font-bold text-sm text-rose-600 dark:text-rose-400">
                ഹാർട്ടുകൾ നിറയ്ക്കുക (Refill Hearts)
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {MAX_HEARTS} ഹാർട്ടുകൾ സൗജന്യമായി തിരികെ നേടുക (ഇപ്പോൾ: {user.hearts})
              </div>
            </div>
          </div>
          <span className="text-xs font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">നിറയ്ക്കുക</span>
        </button>

        <button
          type="button"
          onClick={() => {
            playTone('tap', user.soundEnabled);
            setShowResetConfirm(true);
          }}
          className="w-full p-4 text-left flex items-center justify-between gap-4 hover:bg-rose-50/60 dark:hover:bg-rose-950/35 transition-colors"
        >
          <div className="flex items-center gap-3">
            <RotateCcw className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" aria-hidden="true" />
            <div>
              <div className="font-bold text-sm text-rose-700 dark:text-rose-400">
                പ്രോഗ്രസ് റീസെറ്റ് ചെയ്യുക (Reset)
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                എല്ലാ പാഠങ്ങളും XP-യും ആദ്യം മുതൽ തുടങ്ങുക
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Accessible In-App Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-dialog-title"
          className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-xl border border-slate-200 dark:border-slate-700 animate-pop space-y-4">
            <h3 id="reset-dialog-title" className="text-lg font-extrabold text-slate-900 dark:text-slate-50">
              പ്രോഗ്രസ് റീസെറ്റ് ചെയ്യണോ?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              നിങ്ങളുടെ എല്ലാ XP-യും പൂർത്തിയാക്കിയ പാഠങ്ങളും മായ്ച്ച് യൂണിറ്റ് 1 മുതൽ വീണ്ടും തുടങ്ങും.
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                റദ്ദാക്കുക
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  onResetProgress();
                }}
                className="btn-3d flex-1 py-3 rounded-xl bg-rose-600 border-b-4 border-rose-800 font-bold text-sm text-white hover:bg-rose-700"
              >
                റീസെറ്റ് ചെയ്യുക
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
