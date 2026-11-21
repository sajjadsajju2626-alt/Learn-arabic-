import React, { useState } from 'react';
import { BookOpen, Rocket, Sprout, Volume2 } from 'lucide-react';
import { AVATAR_OPTIONS } from '../data/curriculum';
import { playTone } from '../utils/audio';

interface OnboardingScreenProps {
  soundEnabled: boolean;
  onComplete: (name: string, avatar: string, takePlacement: boolean) => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  soundEnabled,
  onComplete,
}) => {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string>(AVATAR_OPTIONS[0].emoji);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (takePlacement: boolean) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('ദയവായി നിങ്ങളുടെ പേര് നൽകുക!');
      playTone('wrong', soundEnabled);
      return;
    }
    setError(null);
    playTone('tap', soundEnabled);
    onComplete(trimmed, avatar, takePlacement);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Cultural & Curriculum Preview Panel */}
        <div className="lg:col-span-5 bg-[#4AA802] text-white p-7 sm:p-10 flex flex-col justify-between gap-8">
          <div>
            <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-3xl mb-6">
              <span aria-hidden="true">🕌</span>
            </div>
            <p className="text-xs font-semibold text-white/85 tracking-wide">
              മലയാളം · العربية
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold leading-snug mt-2 text-balance">
              മലയാളത്തിലൂടെ അറബി പഠിക്കാം
            </h1>
            <p className="text-sm sm:text-base text-white/90 mt-3 leading-relaxed">
              കളികളിലൂടെയും ക്വിസുകളിലൂടെയും എളുപ്പത്തിൽ അറബി ഭാഷ, അക്ഷരമാല, ഹറകത്തുകൾ, ദൈനംദിന സംഭാഷണങ്ങൾ എന്നിവ സ്വായത്തമാക്കൂ.
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/20">
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 shrink-0 mt-0.5 text-white/90" aria-hidden="true" />
              <div className="text-sm">
                <div className="font-bold">20 യൂണിറ്റുകൾ · 160 ഘട്ടങ്ങൾ</div>
                <div className="text-white/80 text-xs mt-0.5">
                  അലിഫ്-ബാ മുതൽ സമ്പൂർണ്ണ സംഭാഷണങ്ങൾ വരെ ഘട്ടം ഘട്ടമായി
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Volume2 className="w-5 h-5 shrink-0 mt-0.5 text-white/90" aria-hidden="true" />
              <div className="text-sm">
                <div className="font-bold">28 അക്ഷരങ്ങളും 5 ഹറകത്തുകളും</div>
                <div className="text-white/80 text-xs mt-0.5">
                  ശരിയായ അറബി ഉച്ചാരണം കേട്ട് പരിശീലിക്കാം
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/10 rounded-2xl p-4 text-right border border-white/15">
            <div className="font-arabic text-2xl font-bold leading-relaxed">
              أَهْلًا وَسَهْلًا بِكُمْ
            </div>
            <div className="text-xs text-white/85 mt-1 text-left">
              അഹ്‌ലൻ വ സഹ്‌ലൻ ബികും — ഹൃദ്യമായ സ്വാഗതം
            </div>
          </div>
        </div>

        {/* Right Setup Form */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                നിങ്ങളുടെ പഠന പ്രൊഫൈൽ തയ്യാറാക്കാം
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                പഠന പുരോഗതി നിങ്ങളുടെ ഉപകരണത്തിൽ സ്വയമേവ സേവ് ചെയ്യപ്പെടും.
              </p>
            </div>

            {/* Avatar Picker */}
            <div>
              <span className="block text-sm font-bold text-slate-700 mb-2.5">
                അവതാർ തിരഞ്ഞെടുക്കുക
              </span>
              <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="അവതാർ തിരഞ്ഞെടുക്കുക">
                {AVATAR_OPTIONS.map((opt) => {
                  const selected = avatar === opt.emoji;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`അവതാർ ${opt.label}`}
                      onClick={() => {
                        playTone('tap', soundEnabled);
                        setAvatar(opt.emoji);
                      }}
                      className={`btn-3d w-14 h-14 rounded-2xl text-2xl border-2 border-b-4 flex items-center justify-center ${
                        selected
                          ? 'border-[#4AA802] bg-[#F0FBE6] ring-2 ring-[#4AA802]/25'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      {opt.emoji}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name Input */}
            <div>
              <label
                htmlFor="onboarding-name-input"
                className="block text-sm font-bold text-slate-700 mb-1.5"
              >
                നിങ്ങളുടെ പേര് നൽകുക
              </label>
              <input
                id="onboarding-name-input"
                type="text"
                maxLength={25}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit(false);
                }}
                placeholder="ഉദാ: അഹമ്മദ്, ഫാത്തിമ..."
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'onboarding-name-error' : undefined}
                className={`w-full px-4 py-3.5 rounded-2xl border-2 text-base font-semibold bg-slate-50 text-slate-900 placeholder:text-slate-400 transition-colors focus:bg-white ${
                  error
                    ? 'border-rose-500 focus:border-rose-500'
                    : 'border-slate-200 focus:border-[#0284C7]'
                }`}
              />
              {error && (
                <p
                  id="onboarding-name-error"
                  role="alert"
                  className="text-xs text-rose-600 font-bold mt-1.5"
                >
                  {error}
                </p>
              )}
            </div>

            {/* Starting Level Selection */}
            <div className="pt-1 space-y-3">
              <p className="text-sm font-bold text-slate-700">എവിടെ നിന്ന് തുടങ്ങണം?</p>

              <button
                type="button"
                onClick={() => handleSubmit(false)}
                className="btn-3d w-full text-left p-4 rounded-2xl border-2 border-b-4 border-[#388000] bg-[#4AA802] hover:bg-[#429602] text-white flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <Sprout className="w-6 h-6 text-white" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-base">ആദ്യം മുതൽ തുടങ്ങാം</div>
                  <div className="text-xs text-white/90 mt-0.5">
                    അറബി അക്ഷരങ്ങൾ (അലിഫ്, ബാ, താ) മുതൽ പഠിച്ചു തുടങ്ങാം
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(true)}
                className="btn-3d w-full text-left p-4 rounded-2xl border-2 border-b-4 border-sky-300 bg-sky-50 hover:bg-sky-100/80 text-slate-900 flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-[#0284C7] flex items-center justify-center shrink-0">
                  <Rocket className="w-6 h-6 text-white" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-[#0369A1] text-base">
                    എനിക്ക് അറബി കുറച്ചൊക്കെ അറിയാം
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    8 ചോദ്യങ്ങളുള്ള ചെറിയ ടെസ്റ്റ് എഴുതി നേരിട്ട് ഉയർന്ന ലെവലിലേക്ക് കടക്കാം
                  </div>
                </div>
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-6">
            സൗജന്യം · ഓഫ്‌ലൈനിലും പ്രവർത്തിക്കും · പരസ്യങ്ങളില്ല
          </p>
        </div>
      </div>
    </div>
  );
};
