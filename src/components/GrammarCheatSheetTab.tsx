import React, { useMemo, useState } from 'react';
import { Search, Volume2, X } from 'lucide-react';
import { UNITS } from '../data/curriculum';
import {
  buildFutureConjugation,
  computeVerbUnitMastery,
  filterVerbEntries,
  PRONOUN_ROWS,
  TENSE_FORMULAS,
  VERB_CONJUGATIONS,
  type ConjugationForm,
  type FutureMarker,
  type PronounRowKey,
  type TenseFilterMode,
  type VerbTenseKey,
  type VerbUnitGroup,
} from '../data/verbConjugations';
import { playTone, speakArabic } from '../utils/audio';

interface GrammarCheatSheetTabProps {
  completedLessons: string[];
  soundEnabled: boolean;
}

const TENSE_FILTERS: { id: TenseFilterMode; labelMl: string }[] = [
  { id: 'all', labelMl: 'എല്ലാ കാലങ്ങളും' },
  { id: 'past', labelMl: 'ഭൂതകാലം' },
  { id: 'present', labelMl: 'വർത്തമാനകാലം' },
  { id: 'future', labelMl: 'ഭാവികാലം' },
];

const UNIT_GROUPS: { id: VerbUnitGroup; labelMl: string }[] = [
  { id: 'all', labelMl: 'എല്ലാം (10)' },
  { id: 'core', labelMl: 'യൂണിറ്റ് 9 & 18' },
  { id: 'advanced', labelMl: 'യൂണിറ്റ് 21–33' },
];

export const GrammarCheatSheetTab: React.FC<GrammarCheatSheetTabProps> = ({
  completedLessons,
  soundEnabled,
}) => {
  const [unitGroup, setUnitGroup] = useState<VerbUnitGroup>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVerbId, setSelectedVerbId] = useState<string>(VERB_CONJUGATIONS[0].id);
  const [tenseFilter, setTenseFilter] = useState<TenseFilterMode>('all');
  const [futureMarker, setFutureMarker] = useState<FutureMarker>('sa');
  const [highlightAffixes, setHighlightAffixes] = useState<boolean>(true);
  const [activeAudioKey, setActiveAudioKey] = useState<string | null>(null);
  const [activePronoun, setActivePronoun] = useState<PronounRowKey | null>(null);

  const filteredVerbs = useMemo(
    () => filterVerbEntries(VERB_CONJUGATIONS, { unitGroup, query: searchQuery }),
    [unitGroup, searchQuery]
  );

  const activeVerb = useMemo(() => {
    const exact = filteredVerbs.find((v) => v.id === selectedVerbId);
    if (exact) return exact;
    return filteredVerbs[0] ?? VERB_CONJUGATIONS[0];
  }, [filteredVerbs, selectedVerbId]);

  const verbMasteryRows = useMemo(
    () => computeVerbUnitMastery(completedLessons, UNITS),
    [completedLessons]
  );

  const visibleTenses: VerbTenseKey[] =
    tenseFilter === 'all' ? ['past', 'present', 'future'] : [tenseFilter];

  const handleSpeak = (text: string, audioKey: string, rate = 0.95) => {
    playTone('tap', soundEnabled);
    setActiveAudioKey(audioKey);
    speakArabic(text, soundEnabled, rate, `grammar-${audioKey}`);
  };

  const renderArabicWithAffixes = (form: ConjugationForm, tense: VerbTenseKey) => {
    if (!highlightAffixes) {
      return <span>{form.ar}</span>;
    }

    const prefixTone =
      tense === 'future'
        ? 'text-[#0284C7]'
        : tense === 'present'
          ? 'text-[#059669]'
          : 'text-[#B45309]';
    const suffixTone =
      tense === 'past'
        ? 'text-[#B45309]'
        : tense === 'present'
          ? 'text-[#059669]'
          : 'text-[#0284C7]';

    return (
      <>
        {form.prefix && <span className={prefixTone}>{form.prefix}</span>}
        <span className="text-slate-900">{form.stem}</span>
        {form.suffix && <span className={suffixTone}>{form.suffix}</span>}
      </>
    );
  };

  const activeFutureExample =
    futureMarker === 'sawfa'
      ? activeVerb.examples.futureSawfa
      : activeVerb.examples.futureSa;

  return (
    <section
      aria-label="വ്യാകരണ സഹായി — ക്രിയാരൂപ പട്ടിക"
      data-testid="grammar-cheat-sheet"
      className="space-y-6"
    >
      {/* Clean Editorial Header */}
      <div className="space-y-1.5">
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight text-balance">
          വ്യാകരണ സഹായി — ക്രിയാരൂപങ്ങൾ
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>ഭൂതകാലം (الْمَاضِي)</span>
          <span aria-hidden="true">·</span>
          <span>വർത്തമാനകാലം (الْمُضَارِع)</span>
          <span aria-hidden="true">·</span>
          <span>ഭാവികാലം (الْمُسْتَقْبَل)</span>
          <span aria-hidden="true">·</span>
          <span className="text-slate-500">യൂണിറ്റ് 9, 18, 21–33</span>
        </p>
      </div>

      {/* Filter & Verb Selector Deck */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          {/* Unit Group Segmented Filter */}
          <div
            role="group"
            aria-label="യൂണിറ്റ് ഫിൽട്ടർ"
            className="grid grid-cols-3 w-full sm:w-auto sm:inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl"
          >
            {UNIT_GROUPS.map((group) => {
              const active = unitGroup === group.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    playTone('tap', soundEnabled);
                    setUnitGroup(group.id);
                  }}
                  className={`px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-extrabold rounded-lg transition-colors whitespace-nowrap text-center ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {group.labelMl}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ക്രിയ തിരയുക (ഉദാ: പോകുക, ذهب)"
              aria-label="ക്രിയ തിരയുക"
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0284C7] focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="തിരയൽ മായ്ക്കുക"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Verb Selector Grid */}
        {filteredVerbs.length === 0 ? (
          <div className="py-8 text-center space-y-2 border-t border-slate-100">
            <p className="text-sm font-bold text-slate-700">
              തിരയലിന് യോജിച്ച ക്രിയ കണ്ടെത്താനായില്ല.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setUnitGroup('all');
              }}
              className="text-xs font-extrabold text-[#0284C7] hover:underline"
            >
              എല്ലാ ക്രിയകളും കാണിക്കുക
            </button>
          </div>
        ) : (
          <div
            role="listbox"
            aria-label="ക്രിയ തിരഞ്ഞെടുക്കുക"
            className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1"
          >
            {filteredVerbs.map((verb) => {
              const selected = verb.id === activeVerb.id;
              return (
                <button
                  key={verb.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    playTone('tap', soundEnabled);
                    setSelectedVerbId(verb.id);
                    setActiveAudioKey(null);
                  }}
                  className={`min-h-[60px] px-3 py-2.5 rounded-xl border text-left transition-colors flex flex-col justify-between ${
                    selected
                      ? 'bg-[#F0FBE6] border-[#4AA802] text-slate-900'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      dir="rtl"
                      lang="ar"
                      className="font-arabic text-xl font-bold leading-snug text-slate-900"
                    >
                      {verb.baseAr}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 font-latin tabular-nums shrink-0">
                      U{verb.unitNumbers[0]}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-700 truncate mt-0.5">
                    {verb.meaningMl}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Verb Spotlight & Interactive Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-500">
                <span>മൂലാക്ഷരങ്ങൾ (Root):</span>
                <span dir="rtl" lang="ar" className="font-arabic text-sm font-bold text-slate-800">
                  {activeVerb.rootAr}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-latin tabular-nums">
                  യൂണിറ്റ് {activeVerb.unitNumbers.join(', ')}
                </span>
              </div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <h2
                  dir="rtl"
                  lang="ar"
                  className="font-arabic text-3xl font-bold text-slate-900 leading-tight"
                >
                  {activeVerb.baseAr}
                </h2>
                <span className="text-lg font-extrabold text-slate-900">
                  {activeVerb.meaningMl}
                </span>
                <span className="text-xs font-semibold text-slate-500 font-latin">
                  {activeVerb.baseTr} / {activeVerb.meaningEn}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                {activeVerb.patternNoteMl}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleSpeak(activeVerb.baseAr, `base-${activeVerb.id}`, 0.9)}
              aria-label={`${activeVerb.baseAr} ഉച്ചാരണം കേൾക്കുക`}
              className="btn-3d inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0284C7] border-b-4 border-[#0369A1] hover:bg-[#0369A1] text-white font-extrabold text-xs sm:text-sm whitespace-nowrap shrink-0"
            >
              <Volume2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>ഉച്ചാരണം കേൾക്കുക</span>
            </button>
          </div>

          {/* Interactive Controls Row: Tense Focus + Future Marker + Affix Highlight */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Tense Filter */}
            <div
              role="group"
              aria-label="കാലം തിരഞ്ഞെടുക്കുക"
              className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto max-w-full"
            >
              {TENSE_FILTERS.map((tf) => {
                const active = tenseFilter === tf.id;
                return (
                  <button
                    key={tf.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      playTone('tap', soundEnabled);
                      setTenseFilter(tf.id);
                    }}
                    className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tf.labelMl}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Future Prefix Toggle (سَـ vs سَوْفَ) */}
              <div
                role="group"
                aria-label="ഭാവികാല സൂചകം"
                className="inline-flex items-center gap-1 p-1 bg-sky-50 border border-sky-200 rounded-xl"
              >
                <button
                  type="button"
                  aria-pressed={futureMarker === 'sa'}
                  onClick={() => {
                    playTone('tap', soundEnabled);
                    setFutureMarker('sa');
                  }}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-colors whitespace-nowrap ${
                    futureMarker === 'sa'
                      ? 'bg-[#0284C7] text-white'
                      : 'text-[#0369A1] hover:bg-sky-100'
                  }`}
                >
                  <span className="font-arabic text-sm">سَـ</span> സമീപം
                </button>
                <button
                  type="button"
                  aria-pressed={futureMarker === 'sawfa'}
                  onClick={() => {
                    playTone('tap', soundEnabled);
                    setFutureMarker('sawfa');
                  }}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-colors whitespace-nowrap ${
                    futureMarker === 'sawfa'
                      ? 'bg-[#0284C7] text-white'
                      : 'text-[#0369A1] hover:bg-sky-100'
                  }`}
                >
                  <span className="font-arabic text-sm">سَوْفَ</span> ദീർഘം
                </button>
              </div>

              {/* Affix Color-Coding Toggle */}
              <button
                type="button"
                aria-pressed={highlightAffixes}
                onClick={() => {
                  playTone('tap', soundEnabled);
                  setHighlightAffixes((v) => !v);
                }}
                className={`px-3 py-2 text-xs font-extrabold rounded-xl border transition-colors whitespace-nowrap ${
                  highlightAffixes
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                പ്രത്യയ അടയാളം: {highlightAffixes ? 'ഓൺ' : 'ഓഫ്'}
              </button>
            </div>
          </div>
        </div>

        {/* CSS GRID CONJUGATION MATRIX (Focal Anchor) */}
        <div className="overflow-x-auto">
          <div
            data-testid="conjugation-grid"
            className="min-w-[600px] divide-y divide-slate-200"
          >
            {/* Matrix Header Row */}
            <div
              className={`grid bg-slate-50 text-xs font-extrabold text-slate-700 ${
                visibleTenses.length === 3
                  ? 'grid-cols-[152px_repeat(3,minmax(0,1fr))]'
                  : 'grid-cols-[170px_minmax(0,1fr)]'
              }`}
            >
              <div className="px-4 py-3 border-r border-slate-200">
                <div>സർവ്വനാമം</div>
                <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                  Pronoun
                </div>
              </div>

              {visibleTenses.includes('past') && (
                <div className="px-4 py-3 border-r border-slate-200 last:border-r-0 bg-amber-50/50">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[#92400E] whitespace-nowrap">ഭൂതകാലം</span>
                    <span dir="rtl" lang="ar" className="font-arabic text-sm font-bold text-[#B45309] shrink-0">
                      الْمَاضِي
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                    Past · അവസാന പ്രത്യയം
                  </div>
                </div>
              )}

              {visibleTenses.includes('present') && (
                <div className="px-4 py-3 border-r border-slate-200 last:border-r-0 bg-emerald-50/50">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[#065F46] whitespace-nowrap">വർത്തമാനകാലം</span>
                    <span dir="rtl" lang="ar" className="font-arabic text-sm font-bold text-[#059669] shrink-0">
                      الْمُضَارِع
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                    Present · ആദ്യ അക്ഷരം أ ن ي ت
                  </div>
                </div>
              )}

              {visibleTenses.includes('future') && (
                <div className="px-4 py-3 bg-sky-50/50">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[#075985] whitespace-nowrap">ഭാവികാലം</span>
                    <span dir="rtl" lang="ar" className="font-arabic text-sm font-bold text-[#0284C7] shrink-0">
                      الْمُسْتَقْبَل
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                    {futureMarker === 'sawfa'
                      ? 'Future · سَوْفَ + വർത്തമാനകാലം'
                      : 'Future · سَـ + വർത്തമാനകാലം'}
                  </div>
                </div>
              )}
            </div>

            {/* 7 Pronoun Rows */}
            {PRONOUN_ROWS.map((pronoun) => {
              const row = activeVerb.rows[pronoun.key];
              const futureForm = buildFutureConjugation(row, futureMarker);
              const isRowFocused = activePronoun === pronoun.key;

              const allCells: { tense: VerbTenseKey; form: ConjugationForm; affixHint: string }[] = [
                { tense: 'past', form: row.past, affixHint: pronoun.pastAffix },
                { tense: 'present', form: row.present, affixHint: pronoun.presentAffix },
                {
                  tense: 'future',
                  form: futureForm,
                  affixHint: futureMarker === 'sawfa' ? 'سَوْفَ + ' + pronoun.presentAffix : 'سَـ + ' + pronoun.presentAffix,
                },
              ];
              const cells = allCells.filter((c) => visibleTenses.includes(c.tense));

              return (
                <div
                  key={pronoun.key}
                  className={`grid transition-colors ${
                    isRowFocused ? 'bg-slate-50/90' : 'bg-white'
                  } ${
                    visibleTenses.length === 3
                      ? 'grid-cols-[152px_repeat(3,minmax(0,1fr))]'
                      : 'grid-cols-[170px_minmax(0,1fr)]'
                  }`}
                >
                  {/* Pronoun Label Cell */}
                  <button
                    type="button"
                    onClick={() => {
                      setActivePronoun((prev) => (prev === pronoun.key ? null : pronoun.key));
                      handleSpeak(pronoun.ar, `pronoun-${pronoun.key}`, 0.9);
                    }}
                    aria-label={`${pronoun.ar} (${pronoun.ml}) കേൾക്കുക`}
                    className="px-4 py-3.5 border-r border-slate-200 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#0284C7] transition-colors flex flex-col justify-center"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        dir="rtl"
                        lang="ar"
                        className="font-arabic text-xl font-bold text-slate-900 leading-snug"
                      >
                        {pronoun.ar}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 font-latin">
                        {pronoun.en}
                      </span>
                    </div>
                    <div className="text-xs font-extrabold text-slate-700 mt-0.5">
                      {pronoun.ml}
                    </div>
                    <div className="text-[11px] text-slate-500">{pronoun.tr}</div>
                  </button>

                  {/* Conjugation Cells */}
                  {cells.map(({ tense, form, affixHint }) => {
                    const cellAudioKey = `${activeVerb.id}-${pronoun.key}-${tense}-${futureMarker}`;
                    const isActiveAudio = activeAudioKey === cellAudioKey;
                    const activeBorderBg =
                      tense === 'past'
                        ? 'bg-amber-50/90 ring-1 ring-inset ring-amber-300'
                        : tense === 'present'
                          ? 'bg-emerald-50/90 ring-1 ring-inset ring-emerald-300'
                          : 'bg-sky-50/90 ring-1 ring-inset ring-sky-300';

                    return (
                      <button
                        key={tense}
                        type="button"
                        onClick={() => {
                          setActivePronoun(pronoun.key);
                          handleSpeak(form.ar, cellAudioKey, 0.92);
                        }}
                        aria-label={`${pronoun.ml} ${tense}: ${form.ar} (${form.ml}) കേൾക്കുക`}
                        className={`px-4 py-3.5 border-r border-slate-200 last:border-r-0 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#0284C7] flex flex-col justify-between gap-1 ${
                          isActiveAudio ? activeBorderBg : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            dir="rtl"
                            lang="ar"
                            className="font-arabic text-2xl font-bold leading-snug"
                          >
                            {renderArabicWithAffixes(form, tense)}
                          </span>
                          <Volume2
                            className={`w-3.5 h-3.5 mt-1 shrink-0 ${
                              isActiveAudio ? 'text-[#0284C7]' : 'text-slate-300'
                            }`}
                            aria-hidden="true"
                          />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-slate-800">{form.ml}</div>
                          <div className="text-[11px] text-slate-500 flex items-center justify-between gap-1 mt-0.5">
                            <span className="truncate">{form.tr}</span>
                            {highlightAffixes &&
                              (/[\u0600-\u06FF]/.test(affixHint) ? (
                                <span
                                  dir="rtl"
                                  lang="ar"
                                  className="font-arabic text-xs font-bold text-slate-500 shrink-0"
                                >
                                  {affixHint}
                                </span>
                              ) : (
                                <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                                  {affixHint}
                                </span>
                              ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Live 3-Tense Example Sentence Strip */}
        <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-extrabold text-slate-700">
              ഉദാഹരണ വാക്യങ്ങൾ — {activeVerb.meaningMl} ({activeVerb.baseAr})
            </h3>
            <span className="text-[11px] font-semibold text-slate-500">
              കേൾക്കാൻ വാക്യത്തിൽ തൊടുക
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                key: 'past' as VerbTenseKey,
                label: 'ഭൂതകാലം · Past',
                tone: 'text-[#92400E]',
                ex: activeVerb.examples.past,
              },
              {
                key: 'present' as VerbTenseKey,
                label: 'വർത്തമാനകാലം · Present',
                tone: 'text-[#065F46]',
                ex: activeVerb.examples.present,
              },
              {
                key: 'future' as VerbTenseKey,
                label: futureMarker === 'sawfa' ? 'ഭാവികാലം · سَوْفَ' : 'ഭാവികാലം · سَـ',
                tone: 'text-[#075985]',
                ex: activeFutureExample,
              },
            ].map((item) => {
              const exKey = `ex-${activeVerb.id}-${item.key}-${futureMarker}`;
              const playing = activeAudioKey === exKey;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSpeak(item.ex.ar, exKey, 0.92)}
                  className={`p-3.5 rounded-xl border text-left transition-colors flex flex-col justify-between gap-2 ${
                    playing
                      ? 'bg-sky-50 border-[#0284C7]'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-extrabold ${item.tone}`}>
                      {item.label}
                    </span>
                    <Volume2 className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                  </div>
                  <div
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-lg font-bold text-slate-900 leading-relaxed"
                  >
                    {item.ex.ar}
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-800">{item.ex.ml}</div>
                    <div className="text-[11px] text-slate-500">{item.ex.tr}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tense Formula & Negation Reference Grid */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-extrabold text-slate-900">
            കാല നിയമങ്ങളും നിഷേധരൂപങ്ങളും
          </h2>
          <span className="text-xs text-slate-500">Tense Patterns &amp; Negation</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TENSE_FORMULAS.map((rule) => {
            const headerTone =
              rule.key === 'past'
                ? 'text-[#92400E]'
                : rule.key === 'present'
                  ? 'text-[#065F46]'
                  : 'text-[#075985]';
            return (
              <div
                key={rule.key}
                className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className={`text-sm font-extrabold ${headerTone}`}>
                      {rule.titleMl} · {rule.titleEn}
                    </div>
                    <span dir="rtl" lang="ar" className="font-arabic text-base font-bold text-slate-800">
                      {rule.titleAr}
                    </span>
                  </div>
                  <div
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-base font-bold text-slate-900 py-1.5 border-y border-slate-100"
                  >
                    {rule.markerSummaryAr}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{rule.formulaMl}</p>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <div
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-base font-bold text-slate-900"
                  >
                    {rule.negationAr}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600">
                    {rule.negationMl}
                  </div>
                  <div className="text-[11px] text-slate-400 font-latin">{rule.unitsLabel}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Verb Curriculum Mastery Bars (CSS Grid Visualization) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
              ക്രിയ-വ്യാകരണ യൂണിറ്റ് പുരോഗതി
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ഭൂത, വർത്തമാന, ഭാവി, കർമ്മണി, നസ്ബ്, ജസ്മ് യൂണിറ്റുകളിലെ നിങ്ങളുടെ പുരോഗതി
            </p>
          </div>
          <span className="text-xs font-extrabold text-slate-600 font-latin tabular-nums">
            {verbMasteryRows.reduce((sum, r) => sum + r.completedCount, 0)} /{' '}
            {verbMasteryRows.reduce((sum, r) => sum + r.totalCount, 0)} ഘട്ടങ്ങൾ
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {verbMasteryRows.map((row) => (
            <div key={row.unitId} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <div className="min-w-0 truncate">
                  <span className="font-extrabold text-slate-900 font-latin tabular-nums">
                    യൂണിറ്റ് {row.unitNumber}
                  </span>
                  <span className="text-slate-400 mx-1.5" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-semibold text-slate-700">{row.shortTitleMl}</span>
                </div>
                <span className="font-extrabold text-slate-700 font-latin tabular-nums shrink-0">
                  {row.completedCount}/{row.totalCount} ({row.percent}%)
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#4AA802] rounded-full transition-all duration-300"
                  style={{ width: `${row.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
