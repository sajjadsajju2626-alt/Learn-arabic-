import type { Unit } from '../types/learning';

export type VerbTenseKey = 'past' | 'present' | 'future';
export type TenseFilterMode = 'all' | VerbTenseKey;
export type FutureMarker = 'sa' | 'sawfa';
export type VerbUnitGroup = 'all' | 'core' | 'advanced';
export type PronounRowKey = 'ana' | 'nahnu' | 'anta' | 'anti' | 'huwa' | 'hiya' | 'hum';

export interface PronounMeta {
  key: PronounRowKey;
  ar: string;
  tr: string;
  ml: string;
  en: string;
  pastAffix: string;
  presentAffix: string;
}

export interface ConjugationForm {
  ar: string;
  tr: string;
  ml: string;
  prefix: string;
  stem: string;
  suffix: string;
}

export interface PronounVerbRow {
  past: ConjugationForm;
  present: ConjugationForm;
  futureMl: string;
}

export interface VerbExampleSentence {
  ar: string;
  tr: string;
  ml: string;
}

export interface VerbConjugationEntry {
  id: string;
  rootAr: string;
  baseAr: string;
  baseTr: string;
  meaningMl: string;
  meaningEn: string;
  unitNumbers: number[];
  unitGroup: 'core' | 'advanced';
  patternNoteMl: string;
  examples: {
    past: VerbExampleSentence;
    present: VerbExampleSentence;
    futureSa: VerbExampleSentence;
    futureSawfa: VerbExampleSentence;
  };
  rows: Record<PronounRowKey, PronounVerbRow>;
}

export interface TenseFormulaCard {
  key: VerbTenseKey;
  titleMl: string;
  titleAr: string;
  titleEn: string;
  markerSummaryAr: string;
  formulaMl: string;
  negationAr: string;
  negationMl: string;
  unitsLabel: string;
}

export interface VerbUnitMasteryRow {
  unitNumber: number;
  unitId: string;
  shortTitleMl: string;
  tenseTagMl: string;
  completedCount: number;
  totalCount: number;
  percent: number;
}

export const PRONOUN_ROWS: readonly PronounMeta[] = [
  {
    key: 'ana',
    ar: 'أَنَا',
    tr: 'അന',
    ml: 'ഞാൻ',
    en: 'I',
    pastAffix: 'ـتُ',
    presentAffix: 'أَـ',
  },
  {
    key: 'nahnu',
    ar: 'نَحْنُ',
    tr: 'നഹ്നു',
    ml: 'നാം',
    en: 'We',
    pastAffix: 'ـنَا',
    presentAffix: 'نَـ',
  },
  {
    key: 'anta',
    ar: 'أَنْتَ',
    tr: 'അൻത',
    ml: 'നീ (പു.)',
    en: 'You (m.)',
    pastAffix: 'ـتَ',
    presentAffix: 'تَـ',
  },
  {
    key: 'anti',
    ar: 'أَنْتِ',
    tr: 'അൻതി',
    ml: 'നീ (സ്ത്രീ.)',
    en: 'You (f.)',
    pastAffix: 'ـتِ',
    presentAffix: 'تَـ ... ـِينَ',
  },
  {
    key: 'huwa',
    ar: 'هُوَ',
    tr: 'ഹുവ',
    ml: 'അവൻ',
    en: 'He',
    pastAffix: 'മൂലരൂപം',
    presentAffix: 'يَـ',
  },
  {
    key: 'hiya',
    ar: 'هِيَ',
    tr: 'ഹിയ',
    ml: 'അവൾ',
    en: 'She',
    pastAffix: 'ـتْ',
    presentAffix: 'تَـ',
  },
  {
    key: 'hum',
    ar: 'هُمْ',
    tr: 'ഹും',
    ml: 'അവർ',
    en: 'They (m.)',
    pastAffix: 'ـُوا',
    presentAffix: 'يَـ ... ـُونَ',
  },
] as const;

export const TENSE_FORMULAS: readonly TenseFormulaCard[] = [
  {
    key: 'past',
    titleMl: 'ഭൂതകാലം',
    titleAr: 'الْمَاضِي',
    titleEn: 'Past',
    markerSummaryAr: 'ـتُ · ـنَا · ـتَ · ـتِ · ـتْ · ـُوا',
    formulaMl: 'ക്രിയയുടെ അവസാനമാണ് കർത്താവിനെ കാണിക്കുന്ന പ്രത്യയം (Suffix) ചേർക്കുന്നത്.',
    negationAr: 'مَا ذَهَبَ / لَمْ يَذْهَبْ',
    negationMl: 'നിഷേധം: مَا + ഭൂതകാലം അല്ലെങ്കിൽ لَمْ + ജസ്മ് (ـْ)',
    unitsLabel: 'യൂണിറ്റ് 9 · 18 · 33',
  },
  {
    key: 'present',
    titleMl: 'വർത്തമാനകാലം',
    titleAr: 'الْمُضَارِع',
    titleEn: 'Present',
    markerSummaryAr: 'أَ · نَ · يَ · تَ (أَنَيْتَ)',
    formulaMl: 'ക്രിയയുടെ തുടക്കത്തിൽ أَ / نَ / تَ / يَ എന്നീ അക്ഷരങ്ങൾ (Prefix) ചേർക്കുന്നു.',
    negationAr: 'لَا يَذْهَبُ',
    negationMl: 'നിഷേധം: لَا + വർത്തമാനകാലം (അവസാനം ളമ്മ് ـُ)',
    unitsLabel: 'യൂണിറ്റ് 9 · 18 · 28',
  },
  {
    key: 'future',
    titleMl: 'ഭാവികാലം',
    titleAr: 'الْمُسْتَقْبَل',
    titleEn: 'Future',
    markerSummaryAr: 'سَـ (സമീപം) · سَوْفَ (ദീർഘം)',
    formulaMl: 'വർത്തമാനകാല ക്രിയയ്ക്ക് മുമ്പ് سَـ (ഉടൻ) അല്ലെങ്കിൽ سَوْفَ (പിന്നീട്) ചേർക്കുന്നു.',
    negationAr: 'لَنْ يَذْهَبَ',
    negationMl: 'നിഷേധം: لَنْ + നസ്ബ് (അവസാനം ഫത്ഹ് ـَ)',
    unitsLabel: 'യൂണിറ്റ് 21 · 32',
  },
] as const;

export const VERB_CURRICULUM_UNIT_META: readonly {
  unitNumber: number;
  shortTitleMl: string;
  tenseTagMl: string;
}[] = [
  { unitNumber: 9, shortTitleMl: 'ക്രിയകളും ദിനചര്യയും', tenseTagMl: 'അടിസ്ഥാനം' },
  { unitNumber: 18, shortTitleMl: 'ഭൂത-വർത്തമാനകാലങ്ങൾ', tenseTagMl: 'الْمَاضِي & الْمُضَارِع' },
  { unitNumber: 21, shortTitleMl: 'ഭാവികാലവും പദ്ധതികളും', tenseTagMl: 'سَـ & سَوْفَ' },
  { unitNumber: 22, shortTitleMl: 'ആജ്ഞകളും വിലക്കും', tenseTagMl: 'الْأَمْر & لَا' },
  { unitNumber: 28, shortTitleMl: 'കർമ്മണി പ്രയോഗം', tenseTagMl: 'فُعِلَ / يُفْعَلُ' },
  { unitNumber: 32, shortTitleMl: 'നസ്ബ് അവ്യയങ്ങൾ', tenseTagMl: 'أَنْ · لَنْ · كَيْ' },
  { unitNumber: 33, shortTitleMl: 'ജസ്മ് അവ്യയങ്ങൾ', tenseTagMl: 'لَمْ · لَا · لَمَّا' },
] as const;

export const VERB_CONJUGATIONS: readonly VerbConjugationEntry[] = [
  {
    id: 'dhahaba',
    rootAr: 'ذ - هـ - ب',
    baseAr: 'ذَهَبَ',
    baseTr: 'ദഹബ',
    meaningMl: 'പോകുക',
    meaningEn: 'To go',
    unitNumbers: [9, 18, 21],
    unitGroup: 'core',
    patternNoteMl: 'ഏറ്റവും കൂടുതൽ ഉപയോഗിക്കുന്ന ക്രിയ. വർത്തമാനകാലത്തിൽ മധ്യാക്ഷരത്തിന് ഫത്ഹ് (يَذْهَبُ).',
    examples: {
      past: {
        ar: 'أَمْسِ ذَهَبْتُ إِلَى السُّوقِ',
        tr: 'അംസി ദഹബ്തു ഇലസ്-സൂഖി',
        ml: 'ഇന്നലെ ഞാൻ മാർക്കറ്റിലേക്ക് പോയി',
      },
      present: {
        ar: 'الْيَوْمَ أَذْهَبُ إِلَى الْمَكْتَبِ',
        tr: 'അൽ-യൗമ അദ്ഹബു ഇലൽ മക്തബി',
        ml: 'ഇന്ന് ഞാൻ ഓഫീസിലേക്ക് പോകുന്നു',
      },
      futureSa: {
        ar: 'سَأَذْهَبُ إِلَى الْمَكْتَبِ غَدًا',
        tr: 'സഅദ്ഹബു ഇലൽ മക്തബി ഗദൻ',
        ml: 'നാളെ ഞാൻ ഓഫീസിലേക്ക് പോകും',
      },
      futureSawfa: {
        ar: 'سَوْفَ أَذْهَبُ إِلَى الْمَدِينَةِ الْأُسْبُوعَ الْقَادِمَ',
        tr: 'സൗഫ അദ്ഹബു ഇലൽ മദീനതിൽ ഉസ്ബൂഅൽ ഖാദിമ',
        ml: 'അടുത്ത ആഴ്ച ഞാൻ നഗരത്തിലേക്ക് പോകും',
      },
    },
    rows: {
      ana: {
        past: { ar: 'ذَهَبْتُ', tr: 'ദഹബ്തു', ml: 'ഞാൻ പോയി', prefix: '', stem: 'ذَهَبْ', suffix: 'تُ' },
        present: { ar: 'أَذْهَبُ', tr: 'അദ്ഹബു', ml: 'ഞാൻ പോകുന്നു', prefix: 'أَ', stem: 'ذْهَبُ', suffix: '' },
        futureMl: 'ഞാൻ പോകും',
      },
      nahnu: {
        past: { ar: 'ذَهَبْنَا', tr: 'ദഹബ്നാ', ml: 'നാം പോയി', prefix: '', stem: 'ذَهَبْ', suffix: 'نَا' },
        present: { ar: 'نَذْهَبُ', tr: 'നദ്ഹബു', ml: 'നാം പോകുന്നു', prefix: 'نَ', stem: 'ذْهَبُ', suffix: '' },
        futureMl: 'നാം പോകും',
      },
      anta: {
        past: { ar: 'ذَهَبْتَ', tr: 'ദഹബ്ത', ml: 'നീ (പു.) പോയി', prefix: '', stem: 'ذَهَبْ', suffix: 'تَ' },
        present: { ar: 'تَذْهَبُ', tr: 'തദ്ഹബു', ml: 'നീ (പു.) പോകുന്നു', prefix: 'تَ', stem: 'ذْهَبُ', suffix: '' },
        futureMl: 'നീ (പു.) പോകും',
      },
      anti: {
        past: { ar: 'ذَهَبْتِ', tr: 'ദഹബ്തി', ml: 'നീ (സ്ത്രീ.) പോയി', prefix: '', stem: 'ذَهَبْ', suffix: 'تِ' },
        present: { ar: 'تَذْهَبِينَ', tr: 'തദ്ഹബീന', ml: 'നീ (സ്ത്രീ.) പോകുന്നു', prefix: 'تَ', stem: 'ذْهَب', suffix: 'ِينَ' },
        futureMl: 'നീ (സ്ത്രീ.) പോകും',
      },
      huwa: {
        past: { ar: 'ذَهَبَ', tr: 'ദഹബ', ml: 'അവൻ പോയി', prefix: '', stem: 'ذَهَبَ', suffix: '' },
        present: { ar: 'يَذْهَبُ', tr: 'യദ്ഹബു', ml: 'അവൻ പോകുന്നു', prefix: 'يَ', stem: 'ذْهَبُ', suffix: '' },
        futureMl: 'അവൻ പോകും',
      },
      hiya: {
        past: { ar: 'ذَهَبَتْ', tr: 'ദഹബത്', ml: 'അവൾ പോയി', prefix: '', stem: 'ذَهَبَ', suffix: 'تْ' },
        present: { ar: 'تَذْهَبُ', tr: 'തദ്ഹബു', ml: 'അവൾ പോകുന്നു', prefix: 'تَ', stem: 'ذْهَبُ', suffix: '' },
        futureMl: 'അവൾ പോകും',
      },
      hum: {
        past: { ar: 'ذَهَبُوا', tr: 'ദഹബൂ', ml: 'അവർ പോയി', prefix: '', stem: 'ذَهَب', suffix: 'ُوا' },
        present: { ar: 'يَذْهَبُونَ', tr: 'യദ്ഹബൂന', ml: 'അവർ പോകുന്നു', prefix: 'يَ', stem: 'ذْهَب', suffix: 'ُونَ' },
        futureMl: 'അവർ പോകും',
      },
    },
  },
  {
    id: 'kataba',
    rootAr: 'ك - ت - ب',
    baseAr: 'كَتَبَ',
    baseTr: 'കതബ',
    meaningMl: 'എഴുതുക',
    meaningEn: 'To write',
    unitNumbers: [9, 18, 28],
    unitGroup: 'core',
    patternNoteMl: 'വർത്തമാനകാലത്തിൽ മധ്യാക്ഷരത്തിന് ളമ്മ് വരുന്നു (يَكْتُبُ). യൂണിറ്റ് 28-ൽ കർമ്മണി രൂപം كُتِبَ.',
    examples: {
      past: {
        ar: 'أَمْسِ كَتَبْتُ الدَّرْسَ',
        tr: 'അംസി കതബ്തുദ്-ദർസ',
        ml: 'ഇന്നലെ ഞാൻ പാഠം എഴുതി',
      },
      present: {
        ar: 'هُوَ يَكْتُبُ الرِّسَالَةَ الْآنَ',
        tr: 'ഹുവ യക്തുബുർ-രിസാലതൽ ആന',
        ml: 'അവൻ ഇപ്പോൾ കത്ത് എഴുതുന്നു',
      },
      futureSa: {
        ar: 'سَأَكْتُبُ الْوَاجِبَ بَعْدَ قَلِيلٍ',
        tr: 'സഅക്തുബുൽ വാജിബ ബഅ്ദ ഖലീലിൻ',
        ml: 'ഞാൻ അല്പസമയത്തിനകം ഗൃഹപാഠം എഴുതും',
      },
      futureSawfa: {
        ar: 'سَوْفَ نَكْتُبُ قِصَّةً جَمِيلَةً',
        tr: 'സൗഫ നക്തുബു ഖിസ്സതൻ ജമീലതൻ',
        ml: 'നാം മനോഹരമായ ഒരു കഥ എഴുതും',
      },
    },
    rows: {
      ana: {
        past: { ar: 'كَتَبْتُ', tr: 'കതബ്തു', ml: 'ഞാൻ എഴുതി', prefix: '', stem: 'كَتَبْ', suffix: 'تُ' },
        present: { ar: 'أَكْتُبُ', tr: 'അക്തുബു', ml: 'ഞാൻ എഴുതുന്നു', prefix: 'أَ', stem: 'كْتُبُ', suffix: '' },
        futureMl: 'ഞാൻ എഴുതും',
      },
      nahnu: {
        past: { ar: 'كَتَبْنَا', tr: 'കതബ്നാ', ml: 'നാം എഴുതി', prefix: '', stem: 'كَتَبْ', suffix: 'نَا' },
        present: { ar: 'نَكْتُبُ', tr: 'നക്തുബു', ml: 'നാം എഴുതുന്നു', prefix: 'نَ', stem: 'كْتُبُ', suffix: '' },
        futureMl: 'നാം എഴുതും',
      },
      anta: {
        past: { ar: 'كَتَبْتَ', tr: 'കതബ്ത', ml: 'നീ (പു.) എഴുതി', prefix: '', stem: 'كَتَبْ', suffix: 'تَ' },
        present: { ar: 'تَكْتُبُ', tr: 'തക്തുബു', ml: 'നീ (പു.) എഴുതുന്നു', prefix: 'تَ', stem: 'كْتُبُ', suffix: '' },
        futureMl: 'നീ (പു.) എഴുതും',
      },
      anti: {
        past: { ar: 'كَتَبْتِ', tr: 'കതബ്തി', ml: 'നീ (സ്ത്രീ.) എഴുതി', prefix: '', stem: 'كَتَبْ', suffix: 'تِ' },
        present: { ar: 'تَكْتُبِينَ', tr: 'തക്തുബീന', ml: 'നീ (സ്ത്രീ.) എഴുതുന്നു', prefix: 'تَ', stem: 'كْتُب', suffix: 'ِينَ' },
        futureMl: 'നീ (സ്ത്രീ.) എഴുതും',
      },
      huwa: {
        past: { ar: 'كَتَبَ', tr: 'കതബ', ml: 'അവൻ എഴുതി', prefix: '', stem: 'كَتَبَ', suffix: '' },
        present: { ar: 'يَكْتُبُ', tr: 'യക്തുബു', ml: 'അവൻ എഴുതുന്നു', prefix: 'يَ', stem: 'كْتُبُ', suffix: '' },
        futureMl: 'അവൻ എഴുതും',
      },
      hiya: {
        past: { ar: 'كَتَبَتْ', tr: 'കതബത്', ml: 'അവൾ എഴുതി', prefix: '', stem: 'كَتَبَ', suffix: 'تْ' },
        present: { ar: 'تَكْتُبُ', tr: 'തക്തുബു', ml: 'അവൾ എഴുതുന്നു', prefix: 'تَ', stem: 'كْتُبُ', suffix: '' },
        futureMl: 'അവൾ എഴുതും',
      },
      hum: {
        past: { ar: 'كَتَبُوا', tr: 'കതബൂ', ml: 'അവർ എഴുതി', prefix: '', stem: 'كَتَب', suffix: 'ُوا' },
        present: { ar: 'يَكْتُبُونَ', tr: 'യക്തുബൂന', ml: 'അവർ എഴുതുന്നു', prefix: 'يَ', stem: 'كْتُب', suffix: 'ُونَ' },
        futureMl: 'അവർ എഴുതും',
      },
    },
  },
  {
    id: 'qaraa',
    rootAr: 'ق - ر - أ',
    baseAr: 'قَرَأَ',
    baseTr: 'ഖറഅ',
    meaningMl: 'വായിക്കുക',
    meaningEn: 'To read',
    unitNumbers: [9, 18, 28],
    unitGroup: 'core',
    patternNoteMl: 'അവസാന അക്ഷരം ഹംസ (أ) ആയ ക്രിയ. വർത്തമാനകാലം يَقْرَأُ.',
    examples: {
      past: {
        ar: 'قَرَأْتُ كِتَابًا مُفِيدًا أَمْسِ',
        tr: 'ഖറഅ്തു കിതാബൻ മുഫീദൻ അംസി',
        ml: 'ഇന്നലെ ഞാൻ ഉപകാരപ്രദമായ ഒരു പുസ്തകം വായിച്ചു',
      },
      present: {
        ar: 'هِيَ تَقْرَأُ الْكِتَابَ فِي الْمَكْتَبَةِ',
        tr: 'ഹിയ തഖ്റഉൽ കിതാബ ഫിൽ മക്തബതി',
        ml: 'അവൾ ലൈബ്രറിയിൽ പുസ്തകം വായിക്കുന്നു',
      },
      futureSa: {
        ar: 'سَأَقْرَأُ الْقِصَّةَ هٰذَا الْمَسَاءَ',
        tr: 'സഅഖ്റഉൽ ഖിസ്സത ഹാദൽ മസാഅ',
        ml: 'ഇന്ന് വൈകുന്നേരം ഞാൻ കഥ വായിക്കും',
      },
      futureSawfa: {
        ar: 'سَوْفَ نَقْرَأُ الدَّرْسَ الْجَدِيدَ غَدًا',
        tr: 'സൗഫ നഖ്റഉദ്-ദർസൽ ജദീദ ഗദൻ',
        ml: 'നാളെ നാം പുതിയ പാഠം വായിക്കും',
      },
    },
    rows: {
      ana: {
        past: { ar: 'قَرَأْتُ', tr: 'ഖറഅ്തു', ml: 'ഞാൻ വായിച്ചു', prefix: '', stem: 'قَرَأْ', suffix: 'تُ' },
        present: { ar: 'أَقْرَأُ', tr: 'അഖ്റഉ', ml: 'ഞാൻ വായിക്കുന്നു', prefix: 'أَ', stem: 'قْرَأُ', suffix: '' },
        futureMl: 'ഞാൻ വായിക്കും',
      },
      nahnu: {
        past: { ar: 'قَرَأْنَا', tr: 'ഖറഅ്നാ', ml: 'നാം വായിച്ചു', prefix: '', stem: 'قَرَأْ', suffix: 'نَا' },
        present: { ar: 'نَقْرَأُ', tr: 'നഖ്റഉ', ml: 'നാം വായിക്കുന്നു', prefix: 'نَ', stem: 'قْرَأُ', suffix: '' },
        futureMl: 'നാം വായിക്കും',
      },
      anta: {
        past: { ar: 'قَرَأْتَ', tr: 'ഖറഅ്ത', ml: 'നീ (പു.) വായിച്ചു', prefix: '', stem: 'قَرَأْ', suffix: 'تَ' },
        present: { ar: 'تَقْرَأُ', tr: 'തഖ്റഉ', ml: 'നീ (പു.) വായിക്കുന്നു', prefix: 'تَ', stem: 'قْرَأُ', suffix: '' },
        futureMl: 'നീ (പു.) വായിക്കും',
      },
      anti: {
        past: { ar: 'قَرَأْتِ', tr: 'ഖറഅ്തി', ml: 'നീ (സ്ത്രീ.) വായിച്ചു', prefix: '', stem: 'قَرَأْ', suffix: 'تِ' },
        present: { ar: 'تَقْرَئِينَ', tr: 'തഖ്റഈന', ml: 'നീ (സ്ത്രീ.) വായിക്കുന്നു', prefix: 'تَ', stem: 'قْرَئ', suffix: 'ِينَ' },
        futureMl: 'നീ (സ്ത്രീ.) വായിക്കും',
      },
      huwa: {
        past: { ar: 'قَرَأَ', tr: 'ഖറഅ', ml: 'അവൻ വായിച്ചു', prefix: '', stem: 'قَرَأَ', suffix: '' },
        present: { ar: 'يَقْرَأُ', tr: 'യഖ്റഉ', ml: 'അവൻ വായിക്കുന്നു', prefix: 'يَ', stem: 'قْرَأُ', suffix: '' },
        futureMl: 'അവൻ വായിക്കും',
      },
      hiya: {
        past: { ar: 'قَرَأَتْ', tr: 'ഖറഅത്', ml: 'അവൾ വായിച്ചു', prefix: '', stem: 'قَرَأَ', suffix: 'تْ' },
        present: { ar: 'تَقْرَأُ', tr: 'തഖ്റഉ', ml: 'അവൾ വായിക്കുന്നു', prefix: 'تَ', stem: 'قْرَأُ', suffix: '' },
        futureMl: 'അവൾ വായിക്കും',
      },
      hum: {
        past: { ar: 'قَرَؤُوا', tr: 'ഖറഊ', ml: 'അവർ വായിച്ചു', prefix: '', stem: 'قَرَؤ', suffix: 'ُوا' },
        present: { ar: 'يَقْرَؤُونَ', tr: 'യഖ്റഊന', ml: 'അവർ വായിക്കുന്നു', prefix: 'يَ', stem: 'قْرَؤ', suffix: 'ُونَ' },
        futureMl: 'അവർ വായിക്കും',
      },
    },
  },
  {
    id: 'shariba',
    rootAr: 'ش - ر - ب',
    baseAr: 'شَرِبَ',
    baseTr: 'ശരിബ',
    meaningMl: 'കുടിക്കുക',
    meaningEn: 'To drink',
    unitNumbers: [9, 18],
    unitGroup: 'core',
    patternNoteMl: 'ഭൂതകാലത്തിൽ മധ്യാക്ഷരത്തിന് കസ്റ് (شَرِبَ), വർത്തമാനകാലത്തിൽ ഫത്ഹ് (يَشْرَبُ).',
    examples: {
      past: {
        ar: 'شَرِبَ أَحْمَدُ الْمَاءَ الْبَارِدَ',
        tr: 'ശരിബ അഹ്മദുൽ മാഅൽ ബാരിദ',
        ml: 'അഹമ്മദ് തണുത്ത വെള്ളം കുടിച്ചു',
      },
      present: {
        ar: 'أَشْرَبُ الْقَهْوَةَ كُلَّ صَبَاحٍ',
        tr: 'അശ്റബുൽ ഖഹ്വത കുല്ല സബാഹിൻ',
        ml: 'ഞാൻ എല്ലാ രാവിലെയും കാപ്പി കുടിക്കുന്നു',
      },
      futureSa: {
        ar: 'سَأَشْرَبُ الشَّايَ بَعْدَ الطَّعَامِ',
        tr: 'സഅശ്റബുശ്-ശായ ബഅ്ദത്ത്വആമി',
        ml: 'ഭക്ഷണത്തിന് ശേഷം ഞാൻ ചായ കുടിക്കും',
      },
      futureSawfa: {
        ar: 'سَوْفَ نَشْرَبُ الْعَصِيرَ فِي الْمَطْعَمِ',
        tr: 'സൗഫ നശ്റബുൽ അസീറ ഫിൽ മത്അമി',
        ml: 'നാം റെസ്റ്റോറന്റിൽ ജ്യൂസ് കുടിക്കും',
      },
    },
    rows: {
      ana: {
        past: { ar: 'شَرِبْتُ', tr: 'ശരിബ്തു', ml: 'ഞാൻ കുടിച്ചു', prefix: '', stem: 'شَرِبْ', suffix: 'تُ' },
        present: { ar: 'أَشْرَبُ', tr: 'അശ്റബു', ml: 'ഞാൻ കുടിക്കുന്നു', prefix: 'أَ', stem: 'شْرَبُ', suffix: '' },
        futureMl: 'ഞാൻ കുടിക്കും',
      },
      nahnu: {
        past: { ar: 'شَرِبْنَا', tr: 'ശരിബ്നാ', ml: 'നാം കുടിച്ചു', prefix: '', stem: 'شَرِبْ', suffix: 'نَا' },
        present: { ar: 'نَشْرَبُ', tr: 'നശ്റബു', ml: 'നാം കുടിക്കുന്നു', prefix: 'نَ', stem: 'شْرَبُ', suffix: '' },
        futureMl: 'നാം കുടിക്കും',
      },
      anta: {
        past: { ar: 'شَرِبْتَ', tr: 'ശരിബ്ത', ml: 'നീ (പു.) കുടിച്ചു', prefix: '', stem: 'شَرِبْ', suffix: 'تَ' },
        present: { ar: 'تَشْرَبُ', tr: 'തശ്റബു', ml: 'നീ (പു.) കുടിക്കുന്നു', prefix: 'تَ', stem: 'شْرَبُ', suffix: '' },
        futureMl: 'നീ (പു.) കുടിക്കും',
      },
      anti: {
        past: { ar: 'شَرِبْتِ', tr: 'ശരിബ്തി', ml: 'നീ (സ്ത്രീ.) കുടിച്ചു', prefix: '', stem: 'شَرِبْ', suffix: 'تِ' },
        present: { ar: 'تَشْرَبِينَ', tr: 'തശ്റബീന', ml: 'നീ (സ്ത്രീ.) കുടിക്കുന്നു', prefix: 'تَ', stem: 'شْرَب', suffix: 'ِينَ' },
        futureMl: 'നീ (സ്ത്രീ.) കുടിക്കും',
      },
      huwa: {
        past: { ar: 'شَرِبَ', tr: 'ശരിബ', ml: 'അവൻ കുടിച്ചു', prefix: '', stem: 'شَرِبَ', suffix: '' },
        present: { ar: 'يَشْرَبُ', tr: 'യശ്റബു', ml: 'അവൻ കുടിക്കുന്നു', prefix: 'يَ', stem: 'شْرَبُ', suffix: '' },
        futureMl: 'അവൻ കുടിക്കും',
      },
      hiya: {
        past: { ar: 'شَرِبَتْ', tr: 'ശരിബത്', ml: 'അവൾ കുടിച്ചു', prefix: '', stem: 'شَرِبَ', suffix: 'تْ' },
        present: { ar: 'تَشْرَبُ', tr: 'തശ്റബു', ml: 'അവൾ കുടിക്കുന്നു', prefix: 'تَ', stem: 'شْرَبُ', suffix: '' },
        futureMl: 'അവൾ കുടിക്കും',
      },
      hum: {
        past: { ar: 'شَرِبُوا', tr: 'ശരിബൂ', ml: 'അവർ കുടിച്ചു', prefix: '', stem: 'شَرِب', suffix: 'ُوا' },
        present: { ar: 'يَشْرَبُونَ', tr: 'യശ്റബൂന', ml: 'അവർ കുടിക്കുന്നു', prefix: 'يَ', stem: 'شْرَب', suffix: 'ُونَ' },
        futureMl: 'അവർ കുടിക്കും',
      },
    },
  },
  {
    id: 'akala',
    rootAr: 'أ - ك - ل',
    baseAr: 'أَكَلَ',
    baseTr: 'അകല',
    meaningMl: 'കഴിക്കുക',
    meaningEn: 'To eat',
    unitNumbers: [9, 18],
    unitGroup: 'core',
    patternNoteMl: 'അന (أَنَا) വർത്തമാനകാലത്തിൽ രണ്ട് അലിഫ് ചേർന്ന് മദ്ദ് ആകുന്നു: آكُلُ (ആകുലു).',
    examples: {
      past: {
        ar: 'أَكَلْنَا الْفَطُورَ فِي الْبَيْتِ',
        tr: 'അകൽനാൽ ഫതൂറ ഫിൽ ബയ്തി',
        ml: 'നാം വീട്ടിൽ പ്രഭാതഭക്ഷണം കഴിച്ചു',
      },
      present: {
        ar: 'آكُلُ الْخُبْزَ وَالْفَاكِهَةَ',
        tr: 'ആകുലുൽ ഖുബ്സ വൽ-ഫാകിഹത',
        ml: 'ഞാൻ റൊട്ടിയും പഴങ്ങളും കഴിക്കുന്നു',
      },
      futureSa: {
        ar: 'سَآكُلُ الْغَدَاءَ مَعَ عَائِلَتِي',
        tr: 'സആകുലുൽ ഗദാഅ മഅ ആഇലതീ',
        ml: 'ഞാൻ കുടുംബത്തോടൊപ്പം ഉച്ചഭക്ഷണം കഴിക്കും',
      },
      futureSawfa: {
        ar: 'سَوْفَ يَأْكُلُونَ الْعَشَاءَ فِي الْمَسَاءِ',
        tr: 'സൗഫ യഅ്കുലൂനൽ അശാഅ ഫിൽ മസാഇ',
        ml: 'അവർ വൈകുന്നേരം അത്താഴം കഴിക്കും',
      },
    },
    rows: {
      ana: {
        past: { ar: 'أَكَلْتُ', tr: 'അകൽതു', ml: 'ഞാൻ കഴിച്ചു', prefix: '', stem: 'أَكَلْ', suffix: 'تُ' },
        present: { ar: 'آكُلُ', tr: 'ആകുലു', ml: 'ഞാൻ കഴിക്കുന്നു', prefix: 'آ', stem: 'كُلُ', suffix: '' },
        futureMl: 'ഞാൻ കഴിക്കും',
      },
      nahnu: {
        past: { ar: 'أَكَلْنَا', tr: 'അകൽനാ', ml: 'നാം കഴിച്ചു', prefix: '', stem: 'أَكَلْ', suffix: 'نَا' },
        present: { ar: 'نَأْكُلُ', tr: 'നഅ്കുലു', ml: 'നാം കഴിക്കുന്നു', prefix: 'نَ', stem: 'أْكُلُ', suffix: '' },
        futureMl: 'നാം കഴിക്കും',
      },
      anta: {
        past: { ar: 'أَكَلْتَ', tr: 'അകൽത', ml: 'നീ (പു.) കഴിച്ചു', prefix: '', stem: 'أَكَلْ', suffix: 'تَ' },
        present: { ar: 'تَأْكُلُ', tr: 'തഅ്കുലു', ml: 'നീ (പു.) കഴിക്കുന്നു', prefix: 'تَ', stem: 'أْكُلُ', suffix: '' },
        futureMl: 'നീ (പു.) കഴിക്കും',
      },
      anti: {
        past: { ar: 'أَكَلْتِ', tr: 'അകൽതി', ml: 'നീ (സ്ത്രീ.) കഴിച്ചു', prefix: '', stem: 'أَكَلْ', suffix: 'تِ' },
        present: { ar: 'تَأْكُلِينَ', tr: 'തഅ്കുലീന', ml: 'നീ (സ്ത്രീ.) കഴിക്കുന്നു', prefix: 'تَ', stem: 'أْكُل', suffix: 'ِينَ' },
        futureMl: 'നീ (സ്ത്രീ.) കഴിക്കും',
      },
      huwa: {
        past: { ar: 'أَكَلَ', tr: 'അകല', ml: 'അവൻ കഴിച്ചു', prefix: '', stem: 'أَكَلَ', suffix: '' },
        present: { ar: 'يَأْكُلُ', tr: 'യഅ്കുലു', ml: 'അവൻ കഴിക്കുന്നു', prefix: 'يَ', stem: 'أْكُلُ', suffix: '' },
        futureMl: 'അവൻ കഴിക്കും',
      },
      hiya: {
        past: { ar: 'أَكَلَتْ', tr: 'അകലത്', ml: 'അവൾ കഴിച്ചു', prefix: '', stem: 'أَكَلَ', suffix: 'تْ' },
        present: { ar: 'تَأْكُلُ', tr: 'തഅ്കുലു', ml: 'അവൾ കഴിക്കുന്നു', prefix: 'تَ', stem: 'أْكُلُ', suffix: '' },
        futureMl: 'അവൾ കഴിക്കും',
      },
      hum: {
        past: { ar: 'أَكَلُوا', tr: 'അകലൂ', ml: 'അവർ കഴിച്ചു', prefix: '', stem: 'أَكَل', suffix: 'ُوا' },
        present: { ar: 'يَأْكُلُونَ', tr: 'യഅ്കുലൂന', ml: 'അവർ കഴിക്കുന്നു', prefix: 'يَ', stem: 'أْكُل', suffix: 'ُونَ' },
        futureMl: 'അവർ കഴിക്കും',
      },
    },
  },
  {
    id: 'fataha',
    rootAr: 'ف - ت - ح',
    baseAr: 'فَتَحَ',
    baseTr: 'ഫതഹ',
    meaningMl: 'തുറക്കുക',
    meaningEn: 'To open',
    unitNumbers: [18, 22, 28],
    unitGroup: 'core',
    patternNoteMl: 'ആജ്ഞാരൂപം اِفْتَحْ (തുറക്കൂ — യൂണിറ്റ് 22), കർമ്മണി രൂപം فُتِحَ (തുറക്കപ്പെട്ടു — യൂണിറ്റ് 28).',
    examples: {
      past: {
        ar: 'فَتَحَ الْمُعَلِّمُ بَابَ الْفَصْلِ',
        tr: 'ഫതഹൽ മുഅല്ലിമു ബാബൽ ഫസ്‌ലി',
        ml: 'അധ്യാപകൻ ക്ലാസ്സിന്റെ വാതിൽ തുറന്നു',
      },
      present: {
        ar: 'أَفْتَحُ النَّافِذَةَ فِي الصَّبَاحِ',
        tr: 'അഫ്തഹുന്നാഫിദത ഫിസ്-സബാഹി',
        ml: 'ഞാൻ രാവിലെ ജനൽ തുറക്കുന്നു',
      },
      futureSa: {
        ar: 'سَأَفْتَحُ الْكِتَابَ الْآنَ',
        tr: 'സഅഫ്തഹുൽ കിതാബൽ ആന',
        ml: 'ഞാൻ ഇപ്പോൾ പുസ്തകം തുറക്കും',
      },
      futureSawfa: {
        ar: 'سَوْفَ يَفْتَحُونَ الْمَتْجَرَ غَدًا',
        tr: 'സൗഫ യഫ്തഹൂനൽ മത്ജറ ഗദൻ',
        ml: 'അവർ നാളെ കട തുറക്കും',
      },
    },
    rows: {
      ana: {
        past: { ar: 'فَتَحْتُ', tr: 'ഫതഹ്തു', ml: 'ഞാൻ തുറന്നു', prefix: '', stem: 'فَتَحْ', suffix: 'تُ' },
        present: { ar: 'أَفْتَحُ', tr: 'അഫ്തഹു', ml: 'ഞാൻ തുറക്കുന്നു', prefix: 'أَ', stem: 'فْتَحُ', suffix: '' },
        futureMl: 'ഞാൻ തുറക്കും',
      },
      nahnu: {
        past: { ar: 'فَتَحْنَا', tr: 'ഫതഹ്നാ', ml: 'നാം തുറന്നു', prefix: '', stem: 'فَتَحْ', suffix: 'نَا' },
        present: { ar: 'نَفْتَحُ', tr: 'നഫ്തഹു', ml: 'നാം തുറക്കുന്നു', prefix: 'نَ', stem: 'فْتَحُ', suffix: '' },
        futureMl: 'നാം തുറക്കും',
      },
      anta: {
        past: { ar: 'فَتَحْتَ', tr: 'ഫതഹ്ത', ml: 'നീ (പു.) തുറന്നു', prefix: '', stem: 'فَتَحْ', suffix: 'تَ' },
        present: { ar: 'تَفْتَحُ', tr: 'തഫ്തഹു', ml: 'നീ (പു.) തുറക്കുന്നു', prefix: 'تَ', stem: 'فْتَحُ', suffix: '' },
        futureMl: 'നീ (പു.) തുറക്കും',
      },
      anti: {
        past: { ar: 'فَتَحْتِ', tr: 'ഫതഹ്തി', ml: 'നീ (സ്ത്രീ.) തുറന്നു', prefix: '', stem: 'فَتَحْ', suffix: 'تِ' },
        present: { ar: 'تَفْتَحِينَ', tr: 'തഫ്തഹീന', ml: 'നീ (സ്ത്രീ.) തുറക്കുന്നു', prefix: 'تَ', stem: 'فْتَح', suffix: 'ِينَ' },
        futureMl: 'നീ (സ്ത്രീ.) തുറക്കും',
      },
      huwa: {
        past: { ar: 'فَتَحَ', tr: 'ഫതഹ', ml: 'അവൻ തുറന്നു', prefix: '', stem: 'فَتَحَ', suffix: '' },
        present: { ar: 'يَفْتَحُ', tr: 'യഫ്തഹു', ml: 'അവൻ തുറക്കുന്നു', prefix: 'يَ', stem: 'فْتَحُ', suffix: '' },
        futureMl: 'അവൻ തുറക്കും',
      },
      hiya: {
        past: { ar: 'فَتَحَتْ', tr: 'ഫതഹത്', ml: 'അവൾ തുറന്നു', prefix: '', stem: 'فَتَحَ', suffix: 'تْ' },
        present: { ar: 'تَفْتَحُ', tr: 'തഫ്തഹു', ml: 'അവൾ തുറക്കുന്നു', prefix: 'تَ', stem: 'فْتَحُ', suffix: '' },
        futureMl: 'അവൾ തുറക്കും',
      },
      hum: {
        past: { ar: 'فَتَحُوا', tr: 'ഫതഹൂ', ml: 'അവർ തുറന്നു', prefix: '', stem: 'فَتَح', suffix: 'ُوا' },
        present: { ar: 'يَفْتَحُونَ', tr: 'യഫ്തഹൂന', ml: 'അവർ തുറക്കുന്നു', prefix: 'يَ', stem: 'فْتَح', suffix: 'ُونَ' },
        futureMl: 'അവർ തുറക്കും',
      },
    },
  },
  {
    id: 'safara',
    rootAr: 'س - ف - ر',
    baseAr: 'سَافَرَ',
    baseTr: 'സാഫറ',
    meaningMl: 'യാത്ര ചെയ്യുക',
    meaningEn: 'To travel',
    unitNumbers: [14, 21],
    unitGroup: 'advanced',
    patternNoteMl: 'നാലക്ഷര ക്രിയ (فَاعَلَ മാതൃക) — വർത്തമാനകാല പ്രിഫിക്സിന് ളമ്മ് വരുന്നു: أُسَافِرُ, يُسَافِرُ.',
    examples: {
      past: {
        ar: 'سَافَرْتُ إِلَى دُبَيَّ أَمْسِ',
        tr: 'സാഫർതു ഇലാ ദുബയ്യ അംസി',
        ml: 'ഇന്നലെ ഞാൻ ദുബായിലേക്ക് യാത്ര ചെയ്തു',
      },
      present: {
        ar: 'يُسَافِرُ أَبِي بِالطَّائِرَةِ كُلَّ شَهْرٍ',
        tr: 'യുസാഫിറു അബീ ബിത്ത്വാഇറതി കുല്ല ശഹ്‌രിൻ',
        ml: 'എന്റെ ഉപ്പ എല്ലാ മാസവും വിമാനത്തിൽ യാത്ര ചെയ്യുന്നു',
      },
      futureSa: {
        ar: 'سَأُسَافِرُ غَدًا إِلَى الرِّيَاضِ',
        tr: 'സഉസാഫിറു ഗദൻ ഇലർ-രിയാളി',
        ml: 'നാളെ ഞാൻ റിയാദിലേക്ക് യാത്ര ചെയ്യും',
      },
      futureSawfa: {
        ar: 'سَوْفَ نُسَافِرُ فِي الْعُطْلَةِ الْقَادِمَةِ',
        tr: 'സൗഫ നുസാഫിറു ഫിൽ ഉത്‌ലതിൽ ഖാദിമതി',
        ml: 'വരുന്ന അവധിക്കാലത്ത് നാം യാത്ര ചെയ്യും',
      },
    },
    rows: {
      ana: {
        past: { ar: 'سَافَرْتُ', tr: 'സാഫർതു', ml: 'ഞാൻ യാത്ര ചെയ്തു', prefix: '', stem: 'سَافَرْ', suffix: 'تُ' },
        present: { ar: 'أُسَافِرُ', tr: 'ഉസാഫിറു', ml: 'ഞാൻ യാത്ര ചെയ്യുന്നു', prefix: 'أُ', stem: 'سَافِرُ', suffix: '' },
        futureMl: 'ഞാൻ യാത്ര ചെയ്യും',
      },
      nahnu: {
        past: { ar: 'سَافَرْنَا', tr: 'സാഫർനാ', ml: 'നാം യാത്ര ചെയ്തു', prefix: '', stem: 'سَافَرْ', suffix: 'نَا' },
        present: { ar: 'نُسَافِرُ', tr: 'നുസാഫിറു', ml: 'നാം യാത്ര ചെയ്യുന്നു', prefix: 'نُ', stem: 'سَافِرُ', suffix: '' },
        futureMl: 'നാം യാത്ര ചെയ്യും',
      },
      anta: {
        past: { ar: 'سَافَرْتَ', tr: 'സാഫർത', ml: 'നീ (പു.) യാത്ര ചെയ്തു', prefix: '', stem: 'سَافَرْ', suffix: 'تَ' },
        present: { ar: 'تُسَافِرُ', tr: 'തുസാഫിറു', ml: 'നീ (പു.) യാത്ര ചെയ്യുന്നു', prefix: 'تُ', stem: 'سَافِرُ', suffix: '' },
        futureMl: 'നീ (പു.) യാത്ര ചെയ്യും',
      },
      anti: {
        past: { ar: 'سَافَرْتِ', tr: 'സാഫർതി', ml: 'നീ (സ്ത്രീ.) യാത്ര ചെയ്തു', prefix: '', stem: 'سَافَرْ', suffix: 'تِ' },
        present: { ar: 'تُسَافِرِينَ', tr: 'തുസാഫിരീന', ml: 'നീ (സ്ത്രീ.) യാത്ര ചെയ്യുന്നു', prefix: 'تُ', stem: 'سَافِر', suffix: 'ِينَ' },
        futureMl: 'നീ (സ്ത്രീ.) യാത്ര ചെയ്യും',
      },
      huwa: {
        past: { ar: 'سَافَرَ', tr: 'സാഫറ', ml: 'അവൻ യാത്ര ചെയ്തു', prefix: '', stem: 'سَافَرَ', suffix: '' },
        present: { ar: 'يُسَافِرُ', tr: 'യുസാഫിറു', ml: 'അവൻ യാത്ര ചെയ്യുന്നു', prefix: 'يُ', stem: 'سَافِرُ', suffix: '' },
        futureMl: 'അവൻ യാത്ര ചെയ്യും',
      },
      hiya: {
        past: { ar: 'سَافَرَتْ', tr: 'സാഫറത്', ml: 'അവൾ യാത്ര ചെയ്തു', prefix: '', stem: 'سَافَرَ', suffix: 'تْ' },
        present: { ar: 'تُسَافِرُ', tr: 'തുസാഫിറു', ml: 'അവൾ യാത്ര ചെയ്യുന്നു', prefix: 'تُ', stem: 'سَافِرُ', suffix: '' },
        futureMl: 'അവൾ യാത്ര ചെയ്യും',
      },
      hum: {
        past: { ar: 'سَافَرُوا', tr: 'സാഫറൂ', ml: 'അവർ യാത്ര ചെയ്തു', prefix: '', stem: 'سَافَر', suffix: 'ُوا' },
        present: { ar: 'يُسَافِرُونَ', tr: 'യുസാഫിറൂന', ml: 'അവർ യാത്ര ചെയ്യുന്നു', prefix: 'يُ', stem: 'سَافِر', suffix: 'ُونَ' },
        futureMl: 'അവർ യാത്ര ചെയ്യും',
      },
    },
  },
  {
    id: 'taallama',
    rootAr: 'ع - ل - م',
    baseAr: 'تَعَلَّمَ',
    baseTr: 'തഅല്ലമ',
    meaningMl: 'പഠിക്കുക',
    meaningEn: 'To learn',
    unitNumbers: [21, 32],
    unitGroup: 'advanced',
    patternNoteMl: 'തഫഅ്അല (تَفَعَّلَ) മാതൃക — യൂണിറ്റ് 21-ലും 32-ലും ഭാവി-നസ്ബ് പ്രയോഗങ്ങളിൽ പ്രധാനം.',
    examples: {
      past: {
        ar: 'تَعَلَّمْتُ اللُّغَةَ الْعَرَبِيَّةَ بِسُهُولَةٍ',
        tr: 'തഅല്ലംതുൽ ലുഗതൽ അറബിയ്യത ബി-സുഹൂലതിൻ',
        ml: 'ഞാൻ അറബി ഭാഷ എളുപ്പത്തിൽ പഠിച്ചു',
      },
      present: {
        ar: 'نَتَعَلَّمُ قَوَاعِدَ النَّحْوِ الْيَوْمَ',
        tr: 'നതഅല്ലമു ഖവാഇദൻ-നഹ്‌വിൽ യൗമ',
        ml: 'ഇന്ന് നാം വ്യാകരണ നിയമങ്ങൾ പഠിക്കുന്നു',
      },
      futureSa: {
        ar: 'سَأَتَعَلَّمُ كَلِمَاتٍ جَدِيدَةً الْيَوْمَ',
        tr: 'സഅതഅല്ലമു കലിമാതിൻ ജദീദതൻ അൽ-യൗമ',
        ml: 'ഇന്ന് ഞാൻ പുതിയ വാക്കുകൾ പഠിക്കും',
      },
      futureSawfa: {
        ar: 'سَوْفَ أَتَعَلَّمُ التَّحَدُّثَ بِطَلَاقَةٍ',
        tr: 'സൗഫ അതഅല്ലമുത്തഹദ്ദുഥ ബി-ത്വലാഖതിൻ',
        ml: 'ഞാൻ ഒഴുക്കോടെ സംസാരിക്കാൻ പഠിക്കും',
      },
    },
    rows: {
      ana: {
        past: { ar: 'تَعَلَّمْتُ', tr: 'തഅല്ലംതു', ml: 'ഞാൻ പഠിച്ചു', prefix: '', stem: 'تَعَلَّمْ', suffix: 'تُ' },
        present: { ar: 'أَتَعَلَّمُ', tr: 'അതഅല്ലമു', ml: 'ഞാൻ പഠിക്കുന്നു', prefix: 'أَ', stem: 'تَعَلَّمُ', suffix: '' },
        futureMl: 'ഞാൻ പഠിക്കും',
      },
      nahnu: {
        past: { ar: 'تَعَلَّمْنَا', tr: 'തഅല്ലംനാ', ml: 'നാം പഠിച്ചു', prefix: '', stem: 'تَعَلَّمْ', suffix: 'نَا' },
        present: { ar: 'نَتَعَلَّمُ', tr: 'നതഅല്ലമു', ml: 'നാം പഠിക്കുന്നു', prefix: 'نَ', stem: 'تَعَلَّمُ', suffix: '' },
        futureMl: 'നാം പഠിക്കും',
      },
      anta: {
        past: { ar: 'تَعَلَّمْتَ', tr: 'തഅല്ലംത', ml: 'നീ (പു.) പഠിച്ചു', prefix: '', stem: 'تَعَلَّمْ', suffix: 'تَ' },
        present: { ar: 'تَتَعَلَّمُ', tr: 'തതഅല്ലമു', ml: 'നീ (പു.) പഠിക്കുന്നു', prefix: 'تَ', stem: 'تَعَلَّمُ', suffix: '' },
        futureMl: 'നീ (പു.) പഠിക്കും',
      },
      anti: {
        past: { ar: 'تَعَلَّمْتِ', tr: 'തഅല്ലംതി', ml: 'നീ (സ്ത്രീ.) പഠിച്ചു', prefix: '', stem: 'تَعَلَّمْ', suffix: 'تِ' },
        present: { ar: 'تَتَعَلَّمِينَ', tr: 'തതഅല്ലമീന', ml: 'നീ (സ്ത്രീ.) പഠിക്കുന്നു', prefix: 'تَ', stem: 'تَعَلَّم', suffix: 'ِينَ' },
        futureMl: 'നീ (സ്ത്രീ.) പഠിക്കും',
      },
      huwa: {
        past: { ar: 'تَعَلَّمَ', tr: 'തഅല്ലമ', ml: 'അവൻ പഠിച്ചു', prefix: '', stem: 'تَعَلَّمَ', suffix: '' },
        present: { ar: 'يَتَعَلَّمُ', tr: 'യതഅല്ലമു', ml: 'അവൻ പഠിക്കുന്നു', prefix: 'يَ', stem: 'تَعَلَّمُ', suffix: '' },
        futureMl: 'അവൻ പഠിക്കും',
      },
      hiya: {
        past: { ar: 'تَعَلَّمَتْ', tr: 'തഅല്ലമത്', ml: 'അവൾ പഠിച്ചു', prefix: '', stem: 'تَعَلَّمَ', suffix: 'تْ' },
        present: { ar: 'تَتَعَلَّمُ', tr: 'തതഅല്ലമു', ml: 'അവൾ പഠിക്കുന്നു', prefix: 'تَ', stem: 'تَعَلَّمُ', suffix: '' },
        futureMl: 'അവൾ പഠിക്കും',
      },
      hum: {
        past: { ar: 'تَعَلَّمُوا', tr: 'തഅല്ലമൂ', ml: 'അവർ പഠിച്ചു', prefix: '', stem: 'تَعَلَّم', suffix: 'ُوا' },
        present: { ar: 'يَتَعَلَّمُونَ', tr: 'യതഅല്ലമൂന', ml: 'അവർ പഠിക്കുന്നു', prefix: 'يَ', stem: 'تَعَلَّم', suffix: 'ُونَ' },
        futureMl: 'അവർ പഠിക്കും',
      },
    },
  },
  {
    id: 'amila',
    rootAr: 'ع - م - ل',
    baseAr: 'عَمِلَ',
    baseTr: 'അമില',
    meaningMl: 'ജോലി ചെയ്യുക',
    meaningEn: 'To work',
    unitNumbers: [11, 21, 33],
    unitGroup: 'advanced',
    patternNoteMl: 'ഭൂതകാലത്തിൽ മധ്യാക്ഷരത്തിന് കസ്റ് (عَمِلَ), വർത്തമാനകാലത്തിൽ ഫത്ഹ് (يَعْمَلُ).',
    examples: {
      past: {
        ar: 'عَمِلَ أَخِي فِي الْمُسْتَشْفَى',
        tr: 'അമില അഖീ ഫിൽ മുസ്തശ്ഫാ',
        ml: 'എന്റെ സഹോദരൻ ആശുപത്രിയിൽ ജോലി ചെയ്തു',
      },
      present: {
        ar: 'أَعْمَلُ فِي شَرِكَةٍ كَبِيرَةٍ',
        tr: 'അഅ്മലു ഫീ ശരികതിൻ കബീറതിൻ',
        ml: 'ഞാൻ ഒരു വലിയ കമ്പനിയിൽ ജോലി ചെയ്യുന്നു',
      },
      futureSa: {
        ar: 'سَأَعْمَلُ بِجِدٍّ لِأَنْجَحَ',
        tr: 'സഅഅ്മലു ബി-ജിദ്ദിൻ ലി-അൻജഹ',
        ml: 'വിജയിക്കാൻ ഞാൻ കഠിനമായി പ്രയത്നിക്കും',
      },
      futureSawfa: {
        ar: 'سَوْفَ نَعْمَلُ مَعًا فِي الْمَشْرُوعِ',
        tr: 'സൗഫ നഅ്മലു മഅൻ ഫിൽ മശ്റൂഇ',
        ml: 'നാം പദ്ധതിയിൽ ഒരുമിച്ച് പ്രവർത്തിക്കും',
      },
    },
    rows: {
      ana: {
        past: { ar: 'عَمِلْتُ', tr: 'അമിൽതു', ml: 'ഞാൻ ജോലി ചെയ്തു', prefix: '', stem: 'عَمِلْ', suffix: 'تُ' },
        present: { ar: 'أَعْمَلُ', tr: 'അഅ്മലു', ml: 'ഞാൻ ജോലി ചെയ്യുന്നു', prefix: 'أَ', stem: 'عْمَلُ', suffix: '' },
        futureMl: 'ഞാൻ ജോലി ചെയ്യും',
      },
      nahnu: {
        past: { ar: 'عَمِلْنَا', tr: 'അമിൽനാ', ml: 'നാം ജോലി ചെയ്തു', prefix: '', stem: 'عَمِلْ', suffix: 'نَا' },
        present: { ar: 'نَعْمَلُ', tr: 'നഅ്മലു', ml: 'നാം ജോലി ചെയ്യുന്നു', prefix: 'نَ', stem: 'عْمَلُ', suffix: '' },
        futureMl: 'നാം ജോലി ചെയ്യും',
      },
      anta: {
        past: { ar: 'عَمِلْتَ', tr: 'അമിൽത', ml: 'നീ (പു.) ജോലി ചെയ്തു', prefix: '', stem: 'عَمِلْ', suffix: 'تَ' },
        present: { ar: 'تَعْمَلُ', tr: 'തഅ്മലു', ml: 'നീ (പു.) ജോലി ചെയ്യുന്നു', prefix: 'تَ', stem: 'عْمَلُ', suffix: '' },
        futureMl: 'നീ (പു.) ജോലി ചെയ്യും',
      },
      anti: {
        past: { ar: 'عَمِلْتِ', tr: 'അമിൽതി', ml: 'നീ (സ്ത്രീ.) ജോലി ചെയ്തു', prefix: '', stem: 'عَمِلْ', suffix: 'تِ' },
        present: { ar: 'تَعْمَلِينَ', tr: 'തഅ്മലീന', ml: 'നീ (സ്ത്രീ.) ജോലി ചെയ്യുന്നു', prefix: 'تَ', stem: 'عْمَل', suffix: 'ِينَ' },
        futureMl: 'നീ (സ്ത്രീ.) ജോലി ചെയ്യും',
      },
      huwa: {
        past: { ar: 'عَمِلَ', tr: 'അമില', ml: 'അവൻ ജോലി ചെയ്തു', prefix: '', stem: 'عَمِلَ', suffix: '' },
        present: { ar: 'يَعْمَلُ', tr: 'യഅ്മലു', ml: 'അവൻ ജോലി ചെയ്യുന്നു', prefix: 'يَ', stem: 'عْمَلُ', suffix: '' },
        futureMl: 'അവൻ ജോലി ചെയ്യും',
      },
      hiya: {
        past: { ar: 'عَمِلَتْ', tr: 'അമിലത്', ml: 'അവൾ ജോലി ചെയ്തു', prefix: '', stem: 'عَمِلَ', suffix: 'تْ' },
        present: { ar: 'تَعْمَلُ', tr: 'തഅ്മലു', ml: 'അവൾ ജോലി ചെയ്യുന്നു', prefix: 'تَ', stem: 'عْمَلُ', suffix: '' },
        futureMl: 'അവൾ ജോലി ചെയ്യും',
      },
      hum: {
        past: { ar: 'عَمِلُوا', tr: 'അമിലൂ', ml: 'അവർ ജോലി ചെയ്തു', prefix: '', stem: 'عَمِل', suffix: 'ُوا' },
        present: { ar: 'يَعْمَلُونَ', tr: 'യഅ്മലൂന', ml: 'അവർ ജോലി ചെയ്യുന്നു', prefix: 'يَ', stem: 'عْمَل', suffix: 'ُونَ' },
        futureMl: 'അവർ ജോലി ചെയ്യും',
      },
    },
  },
  {
    id: 'darasa',
    rootAr: 'د - ر - س',
    baseAr: 'دَرَسَ',
    baseTr: 'ദറസ',
    meaningMl: 'അഭ്യസിക്കുക',
    meaningEn: 'To study',
    unitNumbers: [21, 32, 33],
    unitGroup: 'advanced',
    patternNoteMl: 'كَتَبَ പോലെ വർത്തമാനകാലത്തിൽ മധ്യാക്ഷരത്തിന് ളമ്മ് വരുന്നു (يَدْرُسُ).',
    examples: {
      past: {
        ar: 'دَرَسْتُ النَّحْوَ فِي الْجَامِعَةِ',
        tr: 'ദറസ്തുൻ-നഹ്‌വ ഫിൽ ജാമിഅതി',
        ml: 'ഞാൻ സർവകലാശാലയിൽ വ്യാകരണം അഭ്യസിച്ചു',
      },
      present: {
        ar: 'تَدْرُسُ فَاطِمَةُ الطِّبَّ',
        tr: 'തദ്‌റുസു ഫാത്തിമത്തുത്ത്വിബ്ബ',
        ml: 'ഫാത്തിമ വൈദ്യശാസ്ത്രം പഠിക്കുന്നു',
      },
      futureSa: {
        ar: 'سَأَدْرُسُ لِلِامْتِحَانِ اللَّيْلَةَ',
        tr: 'സഅദ്‌റുസു ലിൽ-ഇംതിഹാനിൽ ലയ്‌ലത',
        ml: 'ഇന്ന് രാത്രി ഞാൻ പരീക്ഷയ്ക്കായി പഠിക്കും',
      },
      futureSawfa: {
        ar: 'سَوْفَ يَدْرُسُونَ فِي كُلِّيَّةِ اللُّغَاتِ',
        tr: 'സൗഫ യദ്‌റുസൂന ഫീ കുല്ലിയ്യതിൽ ലുഗാതി',
        ml: 'അവർ ഭാഷാ കോളേജിൽ പഠിക്കും',
      },
    },
    rows: {
      ana: {
        past: { ar: 'دَرَسْتُ', tr: 'ദറസ്തു', ml: 'ഞാൻ അഭ്യസിച്ചു', prefix: '', stem: 'دَرَسْ', suffix: 'تُ' },
        present: { ar: 'أَدْرُسُ', tr: 'അദ്‌റുസു', ml: 'ഞാൻ അഭ്യസിക്കുന്നു', prefix: 'أَ', stem: 'دْرُسُ', suffix: '' },
        futureMl: 'ഞാൻ അഭ്യസിക്കും',
      },
      nahnu: {
        past: { ar: 'دَرَسْنَا', tr: 'ദറസ്നാ', ml: 'നാം അഭ്യസിച്ചു', prefix: '', stem: 'دَرَسْ', suffix: 'نَا' },
        present: { ar: 'نَدْرُسُ', tr: 'നദ്‌റുസു', ml: 'നാം അഭ്യസിക്കുന്നു', prefix: 'نَ', stem: 'دْرُسُ', suffix: '' },
        futureMl: 'നാം അഭ്യസിക്കും',
      },
      anta: {
        past: { ar: 'دَرَسْتَ', tr: 'ദറസ്ത', ml: 'നീ (പു.) അഭ്യസിച്ചു', prefix: '', stem: 'دَرَسْ', suffix: 'تَ' },
        present: { ar: 'تَدْرُسُ', tr: 'തദ്‌റുസു', ml: 'നീ (പു.) അഭ്യസിക്കുന്നു', prefix: 'تَ', stem: 'دْرُسُ', suffix: '' },
        futureMl: 'നീ (പു.) അഭ്യസിക്കും',
      },
      anti: {
        past: { ar: 'دَرَسْتِ', tr: 'ദറസ്തി', ml: 'നീ (സ്ത്രീ.) അഭ്യസിച്ചു', prefix: '', stem: 'دَرَسْ', suffix: 'تِ' },
        present: { ar: 'تَدْرُسِينَ', tr: 'തദ്‌റുസീന', ml: 'നീ (സ്ത്രീ.) അഭ്യസിക്കുന്നു', prefix: 'تَ', stem: 'دْرُس', suffix: 'ِينَ' },
        futureMl: 'നീ (സ്ത്രീ.) അഭ്യസിക്കും',
      },
      huwa: {
        past: { ar: 'دَرَسَ', tr: 'ദറസ', ml: 'അവൻ അഭ്യസിച്ചു', prefix: '', stem: 'دَرَسَ', suffix: '' },
        present: { ar: 'يَدْرُسُ', tr: 'യദ്‌റുസു', ml: 'അവൻ അഭ്യസിക്കുന്നു', prefix: 'يَ', stem: 'دْرُسُ', suffix: '' },
        futureMl: 'അവൻ അഭ്യസിക്കും',
      },
      hiya: {
        past: { ar: 'دَرَسَتْ', tr: 'ദറസത്', ml: 'അവൾ അഭ്യസിച്ചു', prefix: '', stem: 'دَرَسَ', suffix: 'تْ' },
        present: { ar: 'تَدْرُسُ', tr: 'തദ്‌റുസു', ml: 'അവൾ അഭ്യസിക്കുന്നു', prefix: 'تَ', stem: 'دْرُسُ', suffix: '' },
        futureMl: 'അവൾ അഭ്യസിക്കും',
      },
      hum: {
        past: { ar: 'دَرَسُوا', tr: 'ദറസൂ', ml: 'അവർ അഭ്യസിച്ചു', prefix: '', stem: 'دَرَس', suffix: 'ُوا' },
        present: { ar: 'يَدْرُسُونَ', tr: 'യദ്‌റുസൂന', ml: 'അവർ അഭ്യസിക്കുന്നു', prefix: 'يَ', stem: 'دْرُس', suffix: 'ُونَ' },
        futureMl: 'അവർ അഭ്യസിക്കും',
      },
    },
  },
];

export function stripArabicTashkeelForSearch(value: string): string {
  return value
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .trim()
    .toLowerCase();
}

export function buildFutureConjugation(
  row: PronounVerbRow,
  marker: FutureMarker
): ConjugationForm {
  const { present, futureMl } = row;
  if (marker === 'sawfa') {
    return {
      ar: `سَوْفَ ${present.ar}`,
      tr: `സൗഫ ${present.tr}`,
      ml: futureMl,
      prefix: `سَوْفَ ${present.prefix}`,
      stem: present.stem,
      suffix: present.suffix,
    };
  }
  return {
    ar: `سَ${present.ar}`,
    tr: `സ${present.tr}`,
    ml: futureMl,
    prefix: `سَ${present.prefix}`,
    stem: present.stem,
    suffix: present.suffix,
  };
}

export function filterVerbEntries(
  verbs: readonly VerbConjugationEntry[],
  options: { unitGroup?: VerbUnitGroup; query?: string }
): VerbConjugationEntry[] {
  const unitGroup = options.unitGroup ?? 'all';
  const rawQuery = (options.query ?? '').trim();
  const normalizedQuery = stripArabicTashkeelForSearch(rawQuery);

  return verbs.filter((verb) => {
    if (unitGroup !== 'all' && verb.unitGroup !== unitGroup) {
      return false;
    }
    if (!normalizedQuery) return true;

    const haystack = [
      verb.baseAr,
      verb.rootAr,
      verb.baseTr,
      verb.meaningMl,
      verb.meaningEn,
      ...verb.unitNumbers.map((n) => `യൂണിറ്റ് ${n} unit ${n}`),
    ]
      .map(stripArabicTashkeelForSearch)
      .join(' ');

    return haystack.includes(normalizedQuery);
  });
}

export function computeVerbUnitMastery(
  completedLessonIds: readonly string[],
  units: readonly Unit[]
): VerbUnitMasteryRow[] {
  const completedSet = new Set(completedLessonIds);
  const unitByNumber = new Map<number, Unit>();
  for (const unit of units) {
    unitByNumber.set(unit.number, unit);
  }

  return VERB_CURRICULUM_UNIT_META.map((meta) => {
    const unit = unitByNumber.get(meta.unitNumber);
    const totalCount = unit ? unit.lessons.length : 0;
    const completedCount = unit
      ? unit.lessons.filter((lesson) => completedSet.has(lesson.id)).length
      : 0;
    const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return {
      unitNumber: meta.unitNumber,
      unitId: unit?.id ?? `u${meta.unitNumber}`,
      shortTitleMl: meta.shortTitleMl,
      tenseTagMl: meta.tenseTagMl,
      completedCount,
      totalCount,
      percent,
    };
  });
}
