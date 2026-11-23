import type { VideoCallReplySuggestion, VideoCallScenario, VideoCallTurn } from '../types/learning';
import { countSpokenArabicWords, normalizeArabicSpeech } from './learningEngine';

export type VideoCallIntent =
  | 'greeting'
  | 'food_drink'
  | 'travel'
  | 'family'
  | 'feelings_positive'
  | 'feelings_tired'
  | 'weather'
  | 'time'
  | 'work_study'
  | 'gratitude_farewell'
  | 'affirmative'
  | 'negative'
  | 'custom_mirror';

export interface VideoCallChatEntry {
  speaker: 'character' | 'user';
  text: string;
}

export interface DynamicVideoCallResponse {
  replyArabic: string;
  replyTransliteration: string;
  replyMalayalam: string;
  nextHints: VideoCallReplySuggestion[];
  xpEarned: number;
  isFinalTurn: boolean;
  intent?: VideoCallIntent;
  source: 'gemini' | 'smart_local';
}

export interface DynamicVideoCallRequest {
  userSpokenText: string;
  scenario: VideoCallScenario;
  turnIndex: number;
  history: VideoCallChatEntry[];
}

interface KeywordRule {
  intent: VideoCallIntent;
  keywords: readonly string[];
}

const INTENT_RULES: readonly KeywordRule[] = [
  {
    intent: 'greeting',
    keywords: [
      'السلام',
      'سلام',
      'مرحبا',
      'اهلا',
      'صباح',
      'مساء',
      'حياك',
      'هلا',
      'كيف حالك',
      'كيفك',
    ],
  },
  {
    intent: 'food_drink',
    keywords: [
      'قهوه',
      'شاي',
      'ماء',
      'طعام',
      'اكل',
      'اشرب',
      'خبز',
      'ارز',
      'رز',
      'دجاج',
      'لحم',
      'سمك',
      'فاكهه',
      'عصير',
      'حليب',
      'تمر',
      'كبسه',
      'مطعم',
      'مقهي',
      'لذيذ',
      'جائع',
      'عطشان',
      'فطور',
      'غداء',
      'عشاء',
      'حلي',
      'سكر',
    ],
  },
  {
    intent: 'travel',
    keywords: [
      'سفر',
      'مسافر',
      'اسافر',
      'مطار',
      'طائره',
      'جواز',
      'تاشيره',
      'فيزا',
      'دبي',
      'الرياض',
      'جده',
      'الدوحه',
      'مسقط',
      'الكويت',
      'مكه',
      'المدينه',
      'فندق',
      'تذكره',
      'حقيبه',
      'بوابه',
      'رحله',
      'سياره',
      'قطار',
      'شارع',
    ],
  },
  {
    intent: 'family',
    keywords: [
      'ابي',
      'امي',
      'اخي',
      'اختي',
      'عائله',
      'عائلتي',
      'اسره',
      'اسرتي',
      'ابني',
      'بنتي',
      'ولدي',
      'زوجي',
      'زوجتي',
      'اطفال',
      'اولاد',
      'جد',
      'جده',
      'صديق',
      'صديقي',
      'اصدقاء',
      'اصدقائي',
      'بيت',
      'بيتي',
    ],
  },
  {
    intent: 'feelings_tired',
    keywords: [
      'تعبان',
      'متعب',
      'حزين',
      'مريض',
      'قلق',
      'صعب',
      'مشكله',
      'مشغول',
      'بردان',
      'صداع',
      'الم',
    ],
  },
  {
    intent: 'feelings_positive',
    keywords: [
      'بخير',
      'الحمد',
      'سعيد',
      'فرحان',
      'ممتاز',
      'رائع',
      'جميل',
      'جيد',
      'مبسوط',
      'مرتاح',
      'احب',
      'اعجبني',
      'مشتاق',
      'مستعد',
    ],
  },
  {
    intent: 'weather',
    keywords: [
      'جو',
      'طقس',
      'حار',
      'حر',
      'بارد',
      'برد',
      'مطر',
      'تمطر',
      'شمس',
      'مشمس',
      'غائم',
      'رياح',
      'صيف',
      'شتاء',
      'ربيع',
      'معتدل',
    ],
  },
  {
    intent: 'time',
    keywords: [
      'ساعه',
      'اليوم',
      'غدا',
      'بكره',
      'امس',
      'اسبوع',
      'شهر',
      'سنه',
      'مبكرا',
      'متاخر',
      'وقت',
      'الان',
      'دقيقه',
      'ليل',
      'نهار',
      'جمعه',
      'سبت',
      'احد',
      'اثنين',
    ],
  },
  {
    intent: 'work_study',
    keywords: [
      'عمل',
      'عملي',
      'مكتب',
      'شركه',
      'طبيب',
      'مهندس',
      'معلم',
      'استاذ',
      'طالب',
      'مدرسه',
      'جامعه',
      'كتاب',
      'درس',
      'عربيه',
      'لغه',
      'اقرا',
      'اكتب',
      'ادرس',
      'اتعلم',
      'امتحان',
      'مشروع',
      'وظيفه',
    ],
  },
  {
    intent: 'gratitude_farewell',
    keywords: [
      'شكرا',
      'جزاك',
      'عفوا',
      'مع السلامه',
      'الي اللقاء',
      'وداعا',
      'يعطيك',
      'تشرفت',
      'الله يحفظك',
    ],
  },
  {
    intent: 'negative',
    keywords: [
      'لا',
      'مش',
      'ليس',
      'لن',
      'لم',
      'ابدا',
      'للاسف',
      'لا اعرف',
      'لا اريد',
      'ما في',
      'ما عندي',
    ],
  },
  {
    intent: 'affirmative',
    keywords: [
      'نعم',
      'ايوه',
      'اكيد',
      'طبعا',
      'موافق',
      'حسنا',
      'طيب',
      'تمام',
      'بالتاكيد',
      'صح',
      'صحيح',
      'اكيد',
      'ان شاء الله',
    ],
  },
];

const STOP_WORDS_NORM = new Set([
  'انا',
  'انت',
  'هو',
  'هي',
  'نحن',
  'في',
  'من',
  'الي',
  'علي',
  'عن',
  'مع',
  'هذا',
  'هذه',
  'ذلك',
  'تلك',
  'نعم',
  'لا',
  'جدا',
  'ان',
  'و',
  'يا',
]);

/**
 * Extracts a short, clean Arabic snippet (1-4 words) from what the user spoke
 * so Tariq or Layla can naturally mirror/acknowledge their exact words.
 */
export function extractMirrorSnippet(userSpokenText: string): string {
  const cleaned = String(userSpokenText ?? '')
    .replace(/[.,!؟،؛:"'()[\]«»\-–—…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';

  const arabicTokens = cleaned.split(/\s+/).filter((t) => /[\u0621-\u064A]/.test(t));
  if (arabicTokens.length === 0) return '';

  const meaningful = arabicTokens.filter((tok) => !STOP_WORDS_NORM.has(normalizeArabicSpeech(tok)));
  const chosen = meaningful.length > 0 ? meaningful.slice(0, 3) : arabicTokens.slice(0, 3);
  return chosen.join(' ');
}

/**
 * Detects the primary conversational intent from any spoken Arabic sentence.
 */
export function detectArabicIntent(userSpokenText: string): {
  intent: VideoCallIntent;
  matchedKeyword: string | null;
} {
  const norm = normalizeArabicSpeech(userSpokenText);
  if (!norm) {
    return { intent: 'custom_mirror', matchedKeyword: null };
  }
  const rawTokens = norm.split(/\s+/).filter(Boolean);
  const tokenSet = new Set<string>();
  for (const tok of rawTokens) {
    tokenSet.add(tok);
    if (tok.startsWith('ال') && tok.length > 3) tokenSet.add(tok.slice(2));
    if (tok.startsWith('وال') && tok.length > 4) tokenSet.add(tok.slice(3));
    if (tok.startsWith('بال') && tok.length > 4) tokenSet.add(tok.slice(3));
  }

  for (const rule of INTENT_RULES) {
    for (const kw of rule.keywords) {
      if (kw.includes(' ')) {
        if (norm.includes(kw)) {
          return { intent: rule.intent, matchedKeyword: kw };
        }
      } else if (tokenSet.has(kw)) {
        return { intent: rule.intent, matchedKeyword: kw };
      }
    }
  }

  // Secondary partial stem match for prefixed words (e.g., والقهوة, بالسفر, لعائلتي)
  for (const rule of INTENT_RULES) {
    if (rule.intent === 'negative' || rule.intent === 'affirmative') continue;
    for (const kw of rule.keywords) {
      if (kw.length < 3 || kw.includes(' ')) continue;
      for (const tok of tokenSet) {
        if (tok.includes(kw)) {
          return { intent: rule.intent, matchedKeyword: kw };
        }
      }
    }
  }

  return { intent: 'custom_mirror', matchedKeyword: null };
}

interface IntentTemplate {
  ackAr: (mirror: string) => string;
  ackTr: (mirror: string) => string;
  ackMl: (mirror: string) => string;
  followUpAr: string;
  followUpTr: string;
  followUpMl: string;
  hints: VideoCallReplySuggestion[];
}

function buildIntentTemplates(isLayla: boolean): Record<VideoCallIntent, IntentTemplate> {
  const friendAr = isLayla ? 'يَا صَدِيقِي' : 'يَا أَخِي';
  const friendTr = isLayla ? 'യാ സ്വദീഖീ' : 'യാ അഖീ';

  return {
    greeting: {
      ackAr: () => `وَعَلَيْكُمُ السَّلَامُ وَأَهْلًا بِكَ ${friendAr}!`,
      ackTr: () => `വ അലൈക്കുമുസ്സലാമു വ അഹ്‌ലൻ ബിക ${friendTr}!`,
      ackMl: () => 'വ അലൈക്കുമുസ്സലാം, നിങ്ങൾക്ക് സ്വാഗതം!',
      followUpAr: 'كَيْفَ حَالُكَ الْيَوْمَ؟ وَمَاذَا تَفْعَلُ الْآنَ؟',
      followUpTr: 'കൈഫ ഹാലുകൽ യൗം? വ മാദാ തഫ്അലുൽ ആൻ?',
      followUpMl: 'ഇന്ന് നിങ്ങൾക്ക് സുഖമാണോ? ഇപ്പോൾ എന്ത് ചെയ്യുകയാണ്?',
      hints: [
        { ar: 'بِخَيْرٍ وَالْحَمْدُ لِلّٰهِ', tr: 'ബിഖൈറിൻ വൽഹംദുലില്ലാഹ്', ml: 'സുഖമാണ്, അൽഹംദുലില്ലാഹ്' },
        {
          ar: 'أَنَا بِخَيْرٍ وَأَتَعَلَّمُ اللُّغَةَ الْعَرَبِيَّةَ الْآنَ',
          tr: 'അന ബിഖൈറിൻ വ അതഅല്ലമുല്ലുഗതൽ അറബിയ്യത്തൽ ആൻ',
          ml: 'എനിക്ക് സുഖമാണ്, ഇപ്പോൾ അറബി പഠിക്കുകയാണ്',
        },
        {
          ar: 'الْحَمْدُ لِلّٰهِ أَنَا سَعِيدٌ جِدًّا بِالتَّحَدُّثِ مَعَكَ الْيَوْمَ',
          tr: 'അൽഹംദുലില്ലാഹി അന സഈദുൻ ജിദ്ദൻ ബിത്തഹദ്ദുഥി മഅകൽ യൗം',
          ml: 'അൽഹംദുലില്ലാഹ്, ഇന്ന് നിങ്ങളോട് സംസാരിക്കാൻ വളരെ സന്തോഷമുണ്ട്',
        },
      ],
    },
    food_drink: {
      ackAr: (m) => (m ? `اِخْتِيَارٌ شَهِيٌّ! «${m}» رَائِعٌ جِدًّا!` : 'اِخْتِيَارٌ شَهِيٌّ وَلَذِيذٌ جِدًّا!'),
      ackTr: () => 'ഇഖ്തിയാറുൻ ശഹിയ്യുൻ! റാഇഉൻ ജിദ്ദൻ!',
      ackMl: () => 'വളരെ നല്ലതും രുചികരവുമായ തിരഞ്ഞെടുപ്പ്!',
      followUpAr: 'هَلْ تُفَضِّلُ الْقَهْوَةَ الْعَرَبِيَّةَ أَمِ الشَّايَ مَعَ الطَّعَامِ؟',
      followUpTr: 'ഹൽ തുഫള്‌ളിലുൽ ഖഹ്‌വത്തൽ അറബിയ്യത്ത അമിശ്ശായ മഅത്ത്വആം?',
      followUpMl: 'ഭക്ഷണത്തോടൊപ്പം അറബി കാപ്പിയാണോ ചായയാണോ നിങ്ങൾക്ക് കൂടുതൽ ഇഷ്ടം?',
      hints: [
        { ar: 'أُفَضِّلُ الشَّايَ', tr: 'ഉഫള്‌ളിലുശ്ശായ', ml: 'എനിക്ക് ചായയാണ് ഇഷ്ടം' },
        {
          ar: 'أُحِبُّ الْقَهْوَةَ الْعَرَبِيَّةَ مَعَ التَّمْرِ',
          tr: 'ഉഹിബ്ബുൽ ഖഹ്‌വത്തൽ അറബിയ്യത്ത മഅത്തംർ',
          ml: 'ഈന്തപ്പഴത്തോടൊപ്പം അറബി കാപ്പി എനിക്കിഷ്ടമാണ്',
        },
        {
          ar: 'أُفَضِّلُ الشَّايَ السَّاخِنَ بَعْدَ الطَّعَامِ وَأَشْرَبُ الْمَاءَ الْبَارِدَ',
          tr: 'ഉഫള്‌ളിലുശ്ശായസ്സാഖിന ബഅ്ദത്ത്വആമി വ അശ്‌റബുൽ മാഅൽ ബാരിദ്',
          ml: 'ഭക്ഷണത്തിന് ശേഷം ചൂട് ചായയും തണുത്ത വെള്ളവും കുടിക്കാൻ എനിക്കിഷ്ടമാണ്',
        },
      ],
    },
    travel: {
      ackAr: (m) => (m ? `مَا شَاءَ اللّٰهُ! «${m}» — سَفَرًا سَعِيدًا!` : 'مَا شَاءَ اللّٰهُ! سَفَرًا سَعِيدًا وَمُمْتِعًا!'),
      ackTr: () => 'മാ ശാ അല്ലാഹ്! സഫറൻ സഈദൻ വ മുംതിഅൻ!',
      ackMl: () => 'മാ ശാ അല്ലാഹ്! സന്തോഷകരമായ ശുഭയാത്ര ആശംസിക്കുന്നു!',
      followUpAr: 'كَمْ يَوْمًا سَتَبْقَى هُنَاكَ وَمَعَ مَنْ تُسَافِرُ؟',
      followUpTr: 'കം യൗമൻ സതബ്ഖാ ഹുനാക വ മഅ മൻ തുസാഫിർ?',
      followUpMl: 'നിങ്ങൾ അവിടെ എത്ര ദിവസം തങ്ങും, ആരുടെ കൂടെയാണ് യാത്ര?',
      hints: [
        { ar: 'لِمُدَّةِ أُسْبُوعٍ', tr: 'ലിമുദ്ദത്തി ഉസ്ബൂഇൻ', ml: 'ഒരാഴ്ചത്തേക്ക്' },
        {
          ar: 'سَأَبْقَى خَمْسَةَ أَيَّامٍ مَعَ عَائِلَتِي',
          tr: 'സഅബ്ഖാ ഖംസത്ത അയ്യാമിൻ മഅ ആഇലതീ',
          ml: 'എന്റെ കുടുംബത്തോടൊപ്പം അഞ്ച് ദിവസം തങ്ങും',
        },
        {
          ar: 'سَأُسَافِرُ لِلْعَمَلِ وَالزِّيَارَةِ وَأَبْقَى أُسْبُوعًا كَامِلًا إِنْ شَاءَ اللّٰهُ',
          tr: 'സഉസാഫിറു ലിൽഅമലി വസ്സിയാറത്തി വ അബ്ഖാ ഉസ്ബൂഅൻ കാമിലൻ ഇൻ ശാ അല്ലാഹ്',
          ml: 'ജോലിക്കും സന്ദർശനത്തിനുമായി യാത്ര ചെയ്ത് ഒരാഴ്ച പൂർണ്ണമായി തങ്ങും ഇൻ ശാ അല്ലാഹ്',
        },
      ],
    },
    family: {
      ackAr: (m) => (m ? `بَارَكَ اللّٰهُ فِي «${m}» وَحَفِظَهُمْ!` : 'بَارَكَ اللّٰهُ فِي عَائِلَتِكَ وَأَحِبَّائِكَ!'),
      ackTr: () => 'ബാറകല്ലാഹു ഫീ ആഇലതിക വ ഹഫിളഹും!',
      ackMl: () => 'നിങ്ങളുടെ കുടുംബത്തെയും പ്രിയപ്പെട്ടവരെയും അല്ലാഹു അനുഗ്രഹിക്കട്ടെ!',
      followUpAr: 'كَيْفَ تَقْضُونَ الْوَقْتَ مَعًا فِي عُطْلَةِ نِهَايَةِ الْأُسْبُوعِ؟',
      followUpTr: 'കൈഫ തഖ്‌ളൂനൽ വഖ്ത മഅൻ ഫീ ഉത്‌ലത്തി നിഹായത്തിൽ ഉസ്ബൂഅ്?',
      followUpMl: 'വാരാന്ത്യ അവധി ദിവസങ്ങളിൽ നിങ്ങൾ ഒരുമിച്ച് എങ്ങനെയാണ് സമയം ചെലവഴിക്കുന്നത്?',
      hints: [
        { ar: 'نَجْلِسُ فِي الْبَيْتِ', tr: 'നജ്‌ലിസു ഫിൽ ബയ്ത്ത്', ml: 'ഞങ്ങൾ വീട്ടിലിരിക്കും' },
        {
          ar: 'نَخْرُجُ إِلَى الْحَدِيقَةِ وَنَتَنَاوَلُ الْعَشَاءَ مَعًا',
          tr: 'നഖ്‌റുജു ഇലൽ ഹദീഖത്തി വ നതനാവലുൽ അശാഅ മഅൻ',
          ml: 'ഞങ്ങൾ പാർക്കിൽ പോയി ഒരുമിച്ച് അത്താഴം കഴിക്കും',
        },
        {
          ar: 'نَزُورُ الْأَقَارِبَ وَنَتَحَدَّثُ كَثِيرًا وَنَشْرَبُ الشَّايَ مَعَ الْعَائِلَةِ',
          tr: 'നസൂറുൽ അഖാരിബ വ നതഹദ്ദഥു കഥീറൻ വ നശ്‌റബുശ്ശായ മഅൽ ആഇല',
          ml: 'ഞങ്ങൾ ബന്ധുക്കളെ സന്ദർശിക്കുകയും കുടുംബത്തോടൊപ്പം സംസാരിച്ച് ചായ കുടിക്കുകയും ചെയ്യും',
        },
      ],
    },
    feelings_positive: {
      ackAr: (m) => (m ? `الْحَمْدُ لِلّٰهِ! يَسُرُّنِي جِدًّا سَمَاعُ «${m}»!` : 'الْحَمْدُ لِلّٰهِ! يَسُرُّنِي جِدًّا أَنَّكَ بِخَيْرٍ وَسَعِيدٌ!'),
      ackTr: () => 'അൽഹംദുലില്ലാഹ്! യസുർറുനീ ജിദ്ദൻ സമാഉ ദാലിക്!',
      ackMl: () => 'അൽഹംദുലില്ലാഹ്! ഇത് കേട്ടതിൽ എനിക്ക് വളരെ സന്തോഷം!',
      followUpAr: 'مَا أَجْمَلُ شَيْءٍ حَدَثَ مَعَكَ الْيَوْمَ؟',
      followUpTr: 'മാ അജ്മലു ശൈഇൻ ഹദഥ മഅകൽ യൗം?',
      followUpMl: 'ഇന്ന് നിങ്ങളുടെ ജീവിതത്തിൽ നടന്ന ഏറ്റവും നല്ല കാര്യം എന്താണ്?',
      hints: [
        { ar: 'تَعَلَّمْتُ كَلِمَاتٍ جَدِيدَةً', tr: 'തഅല്ലംതു കലിമാതിൻ ജദീദ', ml: 'ഞാൻ പുതിയ വാക്കുകൾ പഠിച്ചു' },
        {
          ar: 'تَحَدَّثْتُ بِالْعَرَبِيَّةِ وَشَعَرْتُ بِالسَّعَادَةِ',
          tr: 'തഹദ്ദഥ്തു ബിൽഅറബിയ്യത്തി വ ശഅർതു ബിസ്സആദ',
          ml: 'ഞാൻ അറബി സംസാരിക്കുകയും സന്തോഷം തോന്നുകയും ചെയ്തു',
        },
        {
          ar: 'أَنْجَزْتُ عَمَلِي مُبَكِّرًا وَالْآنَ أَتَدَرَّبُ عَلَى الْمُحَادَثَةِ الْعَرَبِيَّةِ',
          tr: 'അൻജസ്തു അമലീ മുബക്കിറൻ വൽആന അതദർറബു അലൽ മുഹാദഥത്തിൽ അറബിയ്യ',
          ml: 'എന്റെ ജോലി നേരത്തെ തീർത്തു, ഇപ്പോൾ അറബി സംഭാഷണം പരിശീലിക്കുകയാണ്',
        },
      ],
    },
    feelings_tired: {
      ackAr: (m) => (m ? `سَلَامَتُكَ ${friendAr}! أَتَفَهَّمُ «${m}»، خُذْ قِسْطًا مِنَ الرَّاحَةِ.` : `سَلَامَتُكَ ${friendAr}! لَا تَقْلَقْ وَخُذْ قِسْطًا مِنَ الرَّاحَةِ.`),
      ackTr: () => `സലാമത്തുക ${friendTr}! ഖുദ് ഖിസ്ത്വൻ മിനർറാഹ.`,
      ackMl: () => 'സലാമത്താകട്ടെ! ഞാൻ മനസ്സിലാക്കുന്നു, അല്പം വിശ്രമിക്കൂ.',
      followUpAr: 'هَلْ تَحْتَاجُ إِلَى كُوبِ شَايٍ دَافِئٍ أَمْ وَقْتٍ لِلرَّاحَةِ؟',
      followUpTr: 'ഹൽ തഹ്താജു ഇലാ കൂബി ശായിൻ ദാഫിഇൻ അം വഖ്തിൻ ലിർറാഹ?',
      followUpMl: 'നിങ്ങൾക്ക് ഒരു കപ്പ് ചൂട് ചായയാണോ അതോ വിശ്രമിക്കാനുള്ള സമയമാണോ വേണ്ടത്?',
      hints: [
        { ar: 'أَحْتَاجُ إِلَى الرَّاحَةِ', tr: 'അഹ്താജു ഇലർറാഹ', ml: 'എനിക്ക് വിശ്രമം വേണം' },
        {
          ar: 'أُرِيدُ كُوبَ شَايٍ دَافِئٍ وَرَاحَةً قَصِيرَةً',
          tr: 'ഉരീദു കൂബ ശായിൻ ദാഫിഇൻ വ റാഹത്തൻ ഖസ്വീറ',
          ml: 'എനിക്ക് ഒരു കപ്പ് ചൂട് ചായയും ചെറിയൊരു വിശ്രമവും വേണം',
        },
        {
          ar: 'شُكْرًا عَلَى سُؤَالِكَ، سَأَسْتَرِيحُ قَلِيلًا وَأَشْرَبُ الْمَاءَ إِنْ شَاءَ اللّٰهُ',
          tr: 'ശുക്റൻ അലാ സുആലിക, സഅസ്തരീഹു ഖലീലൻ വ അശ്‌റബുൽ മാഅ ഇൻ ശാ അല്ലാഹ്',
          ml: 'അന്വേഷിച്ചതിന് നന്ദി, ഞാൻ അല്പം വിശ്രമിച്ച് വെള്ളം കുടിക്കാം ഇൻ ശാ അല്ലാഹ്',
        },
      ],
    },
    weather: {
      ackAr: (m) => (m ? `فِعْلًا! «${m}» يُغَيِّرُ مِزَاجَ الْيَوْمِ كُلِّهِ!` : 'فِعْلًا! الْجَوُّ الْيَوْمَ مُلْفِتٌ جِدًّا!'),
      ackTr: () => 'ഫിഅ്ലൻ! ഹാദാ യുഗയ്യിറു മിസാജൽ യൗമി കുല്ലിഹ്!',
      ackMl: () => 'ശരിയാണ്! ഈ കാലാവസ്ഥ ദിവസത്തിന്റെ മുഴുവൻ മൂഡും മാറ്റുന്നു!',
      followUpAr: 'مَاذَا تُحِبُّ أَنْ تَفْعَلَ فِي مِثْلِ هٰذَا الْجَوِّ؟',
      followUpTr: 'മാദാ തുഹിബ്ബു അൻ തഫ്അല ഫീ മിഥ്‌ലി ഹാദൽ ജവ്വ്?',
      followUpMl: 'ഇതുപോലുള്ള കാലാവസ്ഥയിൽ എന്ത് ചെയ്യാനാണ് നിങ്ങൾക്ക് ഇഷ്ടം?',
      hints: [
        { ar: 'أُحِبُّ شُرْبَ الشَّايِ', tr: 'ഉഹിബ്ബു ശുർബശ്ശായ്', ml: 'ചായ കുടിക്കാൻ ഇഷ്ടമാണ്' },
        {
          ar: 'أُحِبُّ الْمَشْيَ فِي الْمَسَاءِ مَعَ أَصْدِقَائِي',
          tr: 'ഉഹിബ്ബുൽ മശ്‌യ ഫിൽ മസാഇ മഅ അസ്വ്ദിഖാഈ',
          ml: 'വൈകുന്നേരം സുഹൃത്തുക്കളോടൊപ്പം നടക്കാൻ എനിക്കിഷ്ടമാണ്',
        },
        {
          ar: 'أُفَضِّلُ الْجُلُوسَ فِي الْبَيْتِ وَقِرَاءَةَ كِتَابٍ مَعَ فِنْجَانِ قَهْوَةٍ',
          tr: 'ഉഫള്‌ളിലുൽ ജുലൂസ ഫിൽ ബയ്ത്തി വ ഖിറാഅത്ത കിതാബിൻ മഅ ഫിൻജാനി ഖഹ്‌വ',
          ml: 'ഒരു കപ്പ് കാപ്പിയുമായി വീട്ടിലിരുന്ന് പുസ്തകം വായിക്കാനാണ് എനിക്കിഷ്ടം',
        },
      ],
    },
    time: {
      ackAr: (m) => (m ? `تَوْقِيتٌ مُمْتَازٌ! «${m}» وَقْتٌ مُنَاسِبٌ جِدًّا.` : 'تَوْقِيتٌ مُمْتَازٌ! تَنْظِيمُ الْوَقْتِ مِفْتَاحُ النَّجَاحِ.'),
      ackTr: () => 'തൗഖീത്തുൻ മുംതാസുൻ! വഖ്തുൻ മുനാസിബുൻ ജിദ്ദൻ.',
      ackMl: () => 'മികച്ച സമയം! വളരെ അനുയോജ്യമായ സമയമാണിത്.',
      followUpAr: 'مَا هِيَ خُطَّتُكَ لِبَقِيَّةِ الْيَوْمِ؟',
      followUpTr: 'മാ ഹിയ ഖുത്ത്വതുക ലിബഖിയ്യത്തിൽ യൗം?',
      followUpMl: 'ഇന്നത്തെ ബാക്കി സമയത്തേക്കുള്ള നിങ്ങളുടെ പ്ലാൻ എന്താണ്?',
      hints: [
        { ar: 'سَأَدْرُسُ قَلِيلًا', tr: 'സഅദ്‌റുസു ഖലീലൻ', ml: 'ഞാൻ അല്പം പഠിക്കും' },
        {
          ar: 'سَأَلْتَقِي بِأَصْدِقَائِي فِي الْمَسَاءِ إِنْ شَاءَ اللّٰهُ',
          tr: 'സഅൽതഖീ ബിഅസ്വ്ദിഖാഈ ഫിൽ മസാഇ ഇൻ ശാ അല്ലാഹ്',
          ml: 'വൈകുന്നേരം സുഹൃത്തുക്കളെ കാണും ഇൻ ശാ അല്ലാഹ്',
        },
        {
          ar: 'سَأُكْمِلُ عَمَلِي ثُمَّ أَعُودُ إِلَى الْبَيْتِ وَأَتَنَاوَلُ الْعَشَاءَ مُبَكِّرًا',
          tr: 'സഉക്‌മിലു അമലീ ഥുമ്മ അഊദു ഇലൽ ബയ്ത്തി വ അതനാവലുൽ അശാഅ മുബക്കിറൻ',
          ml: 'ജോലി പൂർത്തിയാക്കി വീട്ടിൽ തിരിച്ചെത്തി നേരത്തെ അത്താഴം കഴിക്കും',
        },
      ],
    },
    work_study: {
      ackAr: (m) => (m ? `مَا شَاءَ اللّٰهُ! «${m}» مَجَالٌ رَائِعٌ، وَفَّقَكَ اللّٰهُ!` : 'مَا شَاءَ اللّٰهُ! اِجْتِهَادُكَ فِي التَّعَلُّمِ وَالْعَمَلِ رَائِعٌ!'),
      ackTr: () => 'മാ ശാ അല്ലാഹ്! മജാലുൻ റാഇഉൻ, വഫ്ഫഖകല്ലാഹ്!',
      ackMl: () => 'മാ ശാ അല്ലാഹ്! മികച്ച മേഖലയാണ്, അല്ലാഹു നിങ്ങൾക്ക് വിജയം നൽകട്ടെ!',
      followUpAr: 'مَا هُوَ هَدَفُكَ الْقَادِمُ فِي تَعَلُّمِ اللُّغَةِ الْعَرَبِيَّةِ؟',
      followUpTr: 'മാ ഹുവ ഹദഫുകൽ ഖാദിമു ഫീ തഅല്ലുമില്ലുഗത്തിൽ അറബിയ്യ?',
      followUpMl: 'അറബി ഭാഷ പഠിക്കുന്നതിൽ നിങ്ങളുടെ അടുത്ത ലക്ഷ്യം എന്താണ്?',
      hints: [
        { ar: 'التَّحَدُّثُ بِطَلَاقَةٍ', tr: 'അത്തഹദ്ദുഥു ബിത്വലാഖ', ml: 'ഒഴുക്കോടെ സംസാരിക്കുക' },
        {
          ar: 'أُرِيدُ أَنْ أَتَحَدَّثَ الْعَرَبِيَّةَ بِثِقَةٍ فِي الْعَمَلِ',
          tr: 'ഉരീദു അൻ അതഹദ്ദഥൽ അറബിയ്യത്ത ബിഥിഖത്തിൻ ഫിൽ അമൽ',
          ml: 'ജോലിസ്ഥലത്ത് ആത്മവിശ്വാസത്തോടെ അറബി സംസാരിക്കാൻ ആഗ്രഹിക്കുന്നു',
        },
        {
          ar: 'هَدَفِي أَنْ أَفْهَمَ اللُّغَةَ الْعَرَبِيَّةَ وَأَتَحَدَّثَ مَعَ الْعَرَبِ بِطَلَاقَةٍ كُلَّ يَوْمٍ',
          tr: 'ഹദഫീ അൻ അഫ്‌ഹമല്ലുഗത്തൽ അറബിയ്യത്ത വ അതഹദ്ദഥ മഅൽ അറബി ബിത്വലാഖത്തിൻ കുല്ല യൗം',
          ml: 'അറബി ഭാഷ നന്നായി മനസ്സിലാക്കി എല്ലാ ദിവസവും ഒഴുക്കോടെ സംസാരിക്കുകയാണ് എന്റെ ലക്ഷ്യം',
        },
      ],
    },
    gratitude_farewell: {
      ackAr: () => `عَفْوًا ${friendAr}، بِكُلِّ سُرُورٍ! وَجَزَاكَ اللّٰهُ خَيْرًا!`,
      ackTr: () => `അഫ്‌വൻ ${friendTr}, ബികുല്ലി സുറൂറിൻ! വ ജസാകല്ലാഹു ഖൈറൻ!`,
      ackMl: () => 'സന്തോഷത്തോടെ, നന്ദി! അല്ലാഹു നിങ്ങൾക്ക് നന്മ നൽകട്ടെ!',
      followUpAr: 'هَلْ هُنَاكَ شَيْءٌ آخَرُ تُحِبُّ أَنْ نَتَحَدَّثَ عَنْهُ؟',
      followUpTr: 'ഹൽ ഹുനാക ശൈഉൻ ആഖറു തുഹിബ്ബു അൻ നതഹദ്ദഥ അൻഹു?',
      followUpMl: 'നമുക്ക് സംസാരിക്കാൻ നിങ്ങൾ ആഗ്രഹിക്കുന്ന മറ്റെന്തെങ്കിലും കാര്യമുണ്ടോ?',
      hints: [
        { ar: 'كُلُّ شَيْءٍ وَاضِحٌ شُكْرًا', tr: 'കുല്ലു ശൈഇൻ വാളിഹുൻ ശുക്റൻ', ml: 'എല്ലാം വ്യക്തമാണ്, നന്ദി' },
        {
          ar: 'أُحِبُّ هٰذِهِ الْمُحَادَثَةَ الْعَرَبِيَّةَ كَثِيرًا',
          tr: 'ഉഹിബ്ബു ഹാദിഹിൽ മുഹാദഥത്തൽ അറബിയ്യത്ത കഥീറൻ',
          ml: 'ഈ അറബി സംഭാഷണം എനിക്ക് വളരെ ഇഷ്ടമാണ്',
        },
        {
          ar: 'شُكْرًا عَلَى وَقْتِكَ، اِسْتَفَدْتُ كَثِيرًا مِنْ هٰذِهِ الْمُكَالَمَةِ الْجَمِيلَةِ',
          tr: 'ശുക്റൻ അലാ വഖ്തിക, ഇസ്തഫദ്തു കഥീറൻ മിൻ ഹാദിഹിൽ മുകാലമത്തിൽ ജമീല',
          ml: 'നിങ്ങളുടെ സമയത്തിന് നന്ദി, ഈ മനോഹരമായ കോളിൽ നിന്ന് എനിക്ക് ഒരുപാട് പ്രയോജനം ലഭിച്ചു',
        },
      ],
    },
    affirmative: {
      ackAr: (m) => (m ? `مُمْتَازٌ! «${m}» — هٰذَا خَبَرٌ جَمِيلٌ جِدًّا!` : 'مُمْتَازٌ! هٰذَا رَائِعٌ جِدًّا!'),
      ackTr: () => 'മുംതാസുൻ! ഹാദാ ഖബറുൻ ജമീലുൻ ജിദ്ദൻ!',
      ackMl: () => 'ഗംഭീരം! വളരെ നല്ല വാർത്തയാണിത്!',
      followUpAr: '',
      followUpTr: '',
      followUpMl: '',
      hints: [],
    },
    negative: {
      ackAr: (m) => (m ? `لَا بَأْسَ أَبَدًا! أَتَفَهَّمُ «${m}»، مَا فِي مُشْكِلَة.` : 'لَا بَأْسَ أَبَدًا، مَا فِي مُشْكِلَة!'),
      ackTr: () => 'ലാ ബഅ്സ അബദൻ! അതഫഹ്ഹമു ദാലിക്, മാ ഫീ മുശ്‌കില.',
      ackMl: () => 'കുഴപ്പമില്ല! ഞാൻ മനസ്സിലാക്കുന്നു, ഒരു പ്രശ്നവുമില്ല.',
      followUpAr: '',
      followUpTr: '',
      followUpMl: '',
      hints: [],
    },
    custom_mirror: {
      ackAr: (m) => (m ? `جَمِيلٌ جِدًّا! أَعْجَبَنِي قَوْلُكَ: «${m}»!` : 'مُمْتَازٌ! كَلَامُكَ بِالْعَرَبِيَّةِ وَاضِحٌ جِدًّا!'),
      ackTr: () => 'ജമീലുൻ ജിദ്ദൻ! അഅ്ജബനീ ഖൗലുക!',
      ackMl: () => 'വളരെ മനോഹരം! നിങ്ങൾ അറബിയിൽ പറഞ്ഞത് എനിക്ക് വളരെ ഇഷ്ടമായി!',
      followUpAr: '',
      followUpTr: '',
      followUpMl: '',
      hints: [],
    },
  };
}

/**
 * Smart Arabic Intent & Keyword Conversational Engine (100% offline-capable).
 * Analyzes what the user spoke in Arabic, mirrors/acknowledges their specific words,
 * and crafts a natural follow-up question + refreshed Arabic hints for GitHub Pages / APK.
 */
export function generateSmartArabicReply(req: DynamicVideoCallRequest): DynamicVideoCallResponse {
  const { userSpokenText, scenario, turnIndex } = req;
  const totalTurns = scenario.turns.length;
  const isFinalTurn = turnIndex + 1 >= totalTurns;
  const nextScenarioTurn: VideoCallTurn | undefined = scenario.turns[turnIndex + 1];
  const isLayla = scenario.characterKey === 'layla';

  const spokenWords = Math.max(1, countSpokenArabicWords(userSpokenText));
  const xpEarned = Math.min(16, Math.max(2, spokenWords * 2));
  const mirror = extractMirrorSnippet(userSpokenText);
  const { intent } = detectArabicIntent(userSpokenText);
  const templates = buildIntentTemplates(isLayla);
  const tpl = templates[intent];

  const ackAr = tpl.ackAr(mirror);
  const ackTr = tpl.ackTr(mirror);
  const ackMl = tpl.ackMl(mirror);

  if (isFinalTurn) {
    const closingAr = `${ackAr} شُكْرًا جَزِيلًا عَلَى هٰذِهِ الْمُكَالَمَةِ الرَّائِعَةِ! إِلَى اللِّقَاءِ!`;
    const closingTr = `${ackTr} ശുക്റൻ ജസീലൻ അലാ ഹാദിഹിൽ മുകാലമത്തിർറാഇഅ! ഇലല്ലിഖാഅ്!`;
    const closingMl = `${ackMl} ഈ മനോഹരമായ വീഡിയോ കോളിന് വളരെ നന്ദി! വീണ്ടും കാണാം!`;
    return {
      replyArabic: closingAr,
      replyTransliteration: closingTr,
      replyMalayalam: closingMl,
      nextHints: [],
      xpEarned,
      isFinalTurn: true,
      intent,
      source: 'smart_local',
    };
  }

  // Decide whether to ask the intent-tailored follow-up question (when user introduced a custom topic)
  // or smoothly advance to the scenario's next contextual question while mirroring their words.
  const useIntentFollowUp =
    Boolean(tpl.followUpAr) &&
    tpl.hints.length > 0 &&
    turnIndex % 2 === 0;

  if (useIntentFollowUp) {
    return {
      replyArabic: `${ackAr} ${tpl.followUpAr}`,
      replyTransliteration: `${ackTr} ${tpl.followUpTr}`,
      replyMalayalam: `${ackMl} ${tpl.followUpMl}`,
      nextHints: tpl.hints,
      xpEarned,
      isFinalTurn: false,
      intent,
      source: 'smart_local',
    };
  }

  const nextQAr = nextScenarioTurn?.characterAr || tpl.followUpAr || 'وَمَا رَأْيُكَ فِي ذٰلِكَ؟';
  const nextQTr = nextScenarioTurn?.characterTr || tpl.followUpTr || 'വ മാ റഅ്‌യുക ഫീ ദാലിക്?';
  const nextQMl = nextScenarioTurn?.characterMl || tpl.followUpMl || 'അതിനെക്കുറിച്ച് നിങ്ങളുടെ അഭിപ്രായം എന്താണ്?';
  const nextHints =
    nextScenarioTurn && nextScenarioTurn.suggestedReplies.length > 0
      ? nextScenarioTurn.suggestedReplies
      : tpl.hints;

  return {
    replyArabic: `${ackAr} ${nextQAr}`,
    replyTransliteration: `${ackTr} ${nextQTr}`,
    replyMalayalam: `${ackMl} ${nextQMl}`,
    nextHints,
    xpEarned,
    isFinalTurn: false,
    intent,
    source: 'smart_local',
  };
}

/**
 * Checks whether the runtime host can reach the server-side Gemini endpoint
 * (automatically skips static hosts like GitHub Pages or Android WebView file/capacitor origins).
 */
export function canUseServerGeminiEndpoint(loc?: { protocol?: string; hostname?: string }): boolean {
  const target =
    loc ?? (typeof window !== 'undefined' ? window.location : { protocol: '', hostname: '' });
  const proto = String(target.protocol || '').toLowerCase();
  const host = String(target.hostname || '').toLowerCase();
  if (proto !== 'http:' && proto !== 'https:') return false;
  if (!host || host.endsWith('.github.io')) return false;
  return true;
}

/**
 * Requests a dynamic Arabic reply for whatever the learner spoke:
 * - Automatically calls server-side Gemini 2.5 Flash (`/api/video-call-reply`) when available.
 * - Seamlessly falls back to the Smart Arabic Intent & Keyword Conversational Engine on
 *   GitHub Pages, Android APK, or offline sessions without requiring any API key input.
 */
export async function requestDynamicVideoCallReply(
  req: DynamicVideoCallRequest,
  timeoutMs = 6000
): Promise<DynamicVideoCallResponse> {
  const nextScenarioTurn = req.scenario.turns[req.turnIndex + 1];

  if (canUseServerGeminiEndpoint() && typeof fetch === 'function') {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer =
      controller && typeof window !== 'undefined'
        ? window.setTimeout(() => controller.abort(), timeoutMs)
        : null;

    try {
      const response = await fetch('/api/video-call-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller?.signal,
        body: JSON.stringify({
          userSpokenText: req.userSpokenText,
          characterKey: req.scenario.characterKey,
          characterNameEn: req.scenario.characterNameEn,
          characterNameMl: req.scenario.characterNameMl,
          characterNameAr: req.scenario.characterNameAr,
          sceneTitleMl: req.scenario.sceneTitleMl,
          sceneSettingMl: req.scenario.sceneSettingMl,
          unitNumber: req.scenario.unitNumber,
          turnIndex: req.turnIndex,
          totalTurns: req.scenario.turns.length,
          history: req.history.slice(-8),
          nextTopicAr: nextScenarioTurn?.characterAr || '',
          nextTopicMl: nextScenarioTurn?.characterMl || '',
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as Partial<DynamicVideoCallResponse>;
        if (
          typeof data.replyArabic === 'string' &&
          /[\u0621-\u064A]/.test(data.replyArabic)
        ) {
          const fallback = generateSmartArabicReply(req);
          const validHints =
            Array.isArray(data.nextHints) && data.nextHints.length > 0
              ? data.nextHints.filter(
                  (h): h is VideoCallReplySuggestion =>
                    Boolean(h && typeof h.ar === 'string' && h.ar.trim() && typeof h.ml === 'string')
                )
              : fallback.nextHints;

          return {
            replyArabic: data.replyArabic.trim(),
            replyTransliteration:
              typeof data.replyTransliteration === 'string' && data.replyTransliteration.trim()
                ? data.replyTransliteration.trim()
                : fallback.replyTransliteration,
            replyMalayalam:
              typeof data.replyMalayalam === 'string' && data.replyMalayalam.trim()
                ? data.replyMalayalam.trim()
                : fallback.replyMalayalam,
            nextHints: fallback.isFinalTurn ? [] : validHints.slice(0, 3),
            xpEarned:
              typeof data.xpEarned === 'number' && data.xpEarned > 0
                ? Math.round(data.xpEarned)
                : fallback.xpEarned,
            isFinalTurn: fallback.isFinalTurn,
            source: 'gemini',
          };
        }
      }
    } catch {
      // Static hosting, offline, or aborted request -> seamlessly fall back to Smart Arabic Engine
    } finally {
      if (timer !== null && typeof window !== 'undefined') {
        window.clearTimeout(timer);
      }
    }
  }

  return generateSmartArabicReply(req);
}
