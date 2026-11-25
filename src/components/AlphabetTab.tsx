import React, { useEffect, useState } from 'react';
import { Loader2, Turtle, Volume2 } from 'lucide-react';
import { ARABIC_ALPHABET } from '../data/curriculum';
import type { ArabicLetter, VowelMode } from '../types/learning';
import { getLetterDisplay } from '../utils/learningEngine';
import {
  getArabicAudioState,
  playTone,
  preloadArabicAudioBatch,
  speakArabic,
  stopArabicAudio,
  subscribeArabicAudioState,
  type ArabicAudioState,
} from '../utils/audio';

interface AlphabetTabProps {
  soundEnabled: boolean;
}

const VOWEL_TABS: { id: VowelMode; label: string; sample: string; note: string }[] = [
  { id: 'base', label: 'അടിസ്ഥാനം', sample: 'ا ب ت', note: '28 അറബി അടിസ്ഥാന അക്ഷരങ്ങൾ' },
  { id: 'fatha', label: 'ഫത്ഹ് ( َ )', sample: 'بَ تَ', note: "മുകളിൽ വര — 'അ' ശബ്ദം" },
  { id: 'kasra', label: 'കസ്റ് ( ِ )', sample: 'بِ تِ', note: "താഴെ വര — 'ഇ' ശബ്ദം" },
  { id: 'damma', label: 'ളമ്മ് ( ُ )', sample: 'بُ تُ', note: "മുകളിൽ വാവ് രൂപം — 'ഉ' ശബ്ദം" },
  { id: 'tanween', label: 'തൻവീൻ ( ً )', sample: 'بًا تًا', note: "ഇരട്ട ഫത്ഹ് — 'അൻ' ശബ്ദം" },
];

export const AlphabetTab: React.FC<AlphabetTabProps> = ({ soundEnabled }) => {
  const [vowel, setVowel] = useState<VowelMode>('base');
  const [activeLetter, setActiveLetter] = useState<ArabicLetter>(ARABIC_ALPHABET[0]);
  const [audioState, setAudioState] = useState<ArabicAudioState>(() => getArabicAudioState());

  useEffect(() => {
    const unsub = subscribeArabicAudioState(setAudioState);
    return () => {
      unsub();
      stopArabicAudio();
    };
  }, []);

  useEffect(() => {
    preloadArabicAudioBatch(
      ARABIC_ALPHABET.map((letter) => getLetterDisplay(letter, vowel).arabic)
    );
  }, [vowel]);

  const activeVowelInfo = VOWEL_TABS.find((t) => t.id === vowel) ?? VOWEL_TABS[0];
  const activeDisplay = getLetterDisplay(activeLetter, vowel);
  const normalBusy = audioState.sourceId === 'alpha-normal';
  const slowBusy = audioState.sourceId === 'alpha-slow';

  const handleSelectLetter = (letter: ArabicLetter) => {
    setActiveLetter(letter);
    const { arabic } = getLetterDisplay(letter, vowel);
    playTone('tap', soundEnabled);
    speakArabic(arabic, soundEnabled, 1.0, 'alpha-normal');
  };

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-50">
          അറബി അക്ഷരമാലയും ഹറകത്തുകളും
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          ഉച്ചാരണം കേൾക്കാൻ ഓരോ അക്ഷരത്തിലും തൊടുക · വലത്തുനിന്ന് ഇടത്തോട്ട് (RTL) വായിക്കാം
        </p>
      </div>

      {/* Selected Letter Spotlight Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center shrink-0">
            <span className="font-arabic text-4xl font-bold text-slate-900 dark:text-slate-50 leading-normal pt-1">
              {activeDisplay.arabic}
            </span>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              തിരഞ്ഞെടുത്ത അക്ഷരം · {activeVowelInfo.label}
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-slate-50 mt-0.5" dir="ltr">
              {activeDisplay.translit}{' '}
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                ({activeLetter.name})
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{activeVowelInfo.note}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-audio-state={normalBusy ? audioState.status : 'idle'}
            onClick={() => speakArabic(activeDisplay.arabic, soundEnabled, 1.0, 'alpha-normal')}
            className={`btn-3d inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0284C7] border-b-4 border-[#0369A1] text-white font-bold text-sm whitespace-nowrap transition ${
              normalBusy ? 'ring-4 ring-sky-300/70' : ''
            } ${normalBusy && audioState.status === 'playing' ? 'animate-pulse' : ''}`}
          >
            {normalBusy && audioState.status === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Volume2 className="w-4 h-4" aria-hidden="true" />
            )}
            <span>കേൾക്കുക</span>
          </button>
          <button
            type="button"
            data-audio-state={slowBusy ? audioState.status : 'idle'}
            onClick={() => speakArabic(activeDisplay.arabic, soundEnabled, 0.65, 'alpha-slow')}
            aria-label="പതുക്കെ കേൾക്കുക"
            title="പതുക്കെ കേൾക്കുക"
            className={`btn-3d inline-flex items-center justify-center w-11 h-11 rounded-xl border-2 border-b-4 transition ${
              slowBusy
                ? 'bg-sky-50 dark:bg-sky-950/60 border-[#0284C7] text-[#0369A1] dark:text-sky-300 ring-4 ring-sky-200 dark:ring-sky-900'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
            } ${slowBusy && audioState.status === 'playing' ? 'animate-pulse' : ''}`}
          >
            {slowBusy && audioState.status === 'loading' ? (
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            ) : (
              <Turtle className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Harakat Vowel Switcher */}
      <div
        role="tablist"
        aria-label="ഹറകത്ത് തിരഞ്ഞെടുക്കുക"
        className="grid grid-cols-2 sm:grid-cols-5 gap-2"
      >
        {VOWEL_TABS.map((tab) => {
          const isSelected = vowel === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => {
                playTone('tap', soundEnabled);
                setVowel(tab.id);
              }}
              className={`btn-3d py-2.5 px-3 rounded-xl text-xs font-extrabold border-2 border-b-4 flex flex-col items-center justify-center gap-0.5 whitespace-nowrap ${
                isSelected
                  ? 'border-[#388000] bg-[#4AA802] text-white'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span className="font-arabic text-base leading-normal">{tab.sample}</span>
            </button>
          );
        })}
      </div>

      {/* 28 Arabic Letters Grid (RTL) */}
      <div
        dir="rtl"
        data-testid="alphabet-grid"
        className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-2.5 sm:gap-3"
      >
        {ARABIC_ALPHABET.map((letter) => {
          const { arabic, translit } = getLetterDisplay(letter, vowel);
          const isSelected = activeLetter.base === letter.base;
          return (
            <button
              key={letter.base}
              type="button"
              aria-label={`${letter.name} — ${translit}`}
              aria-pressed={isSelected}
              onClick={() => handleSelectLetter(letter)}
              className={`btn-3d rounded-2xl border-2 border-b-4 p-3 min-h-[88px] flex flex-col items-center justify-center ${
                isSelected
                  ? 'bg-sky-50 dark:bg-sky-950/60 border-[#0284C7] dark:border-sky-500 ring-2 ring-sky-200 dark:ring-sky-900'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-600 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className="font-arabic text-3xl font-bold text-slate-900 dark:text-slate-50 leading-normal">
                {arabic}
              </span>
              <span dir="ltr" className="text-xs font-extrabold text-[#0369A1] dark:text-sky-400 mt-0.5">
                {translit}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
