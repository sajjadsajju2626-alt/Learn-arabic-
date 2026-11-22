import type {
  GuidebookEntry,
  ListenQuestion,
  RadioMcqQuestion,
  RadioSelect3Question,
  RadioTfQuestion,
  UnitStory,
} from '../types/learning';

export type PodcastQuestion = RadioTfQuestion | RadioSelect3Question | RadioMcqQuestion;

export const PODCAST_QUESTION_TYPES = ['radio_tf', 'radio_select3', 'radio_mcq'] as const;

interface SpokenClipCandidate {
  ar: string;
  tr: string;
  ml: string;
  callerAvatar: '🧕' | '🧔';
  callerNameMl: string;
}

const FALLBACK_DISTRACTOR_WORDS: readonly string[] = [
  'الْمَدْرَسَةُ',
  'السَّيَّارَةُ',
  'الْمَطَارُ',
  'الْقَمِيصُ',
  'الشَّايُ',
  'الْمَكْتَبَةُ',
  'الْحَدِيقَةُ',
  'الْمَسْجِدُ',
  'الطَّعَامُ',
  'الْمَاءُ',
  'الصَّبَاحُ',
  'الْمَسَاءُ',
  'السُّوقُ',
  'الْبَيْتُ',
  'الْكِتَابُ',
  'الطَّبِيبُ',
];

const FALLBACK_DISTRACTOR_ML: readonly string[] = [
  'ഞാൻ നാളെ വിമാനത്താവളത്തിലേക്ക് യാത്ര ചെയ്യും.',
  'എനിക്ക് ഒരു കപ്പ് ചൂടുള്ള ചായയും റൊട്ടിയും വേണം.',
  'ഇന്ന് കാലാവസ്ഥ വളരെ തണുപ്പും മഴയുമുള്ളതാണ്.',
  'വിദ്യാർത്ഥി ലൈബ്രറിയിൽ പുതിയ പുസ്തകം വായിക്കുന്നു.',
  'പള്ളി വലിയ മാർക്കറ്റിന് തൊട്ടടുത്താണ്.',
];

function stripDiacriticsForCompare(text: string): string {
  return String(text ?? '')
    .normalize('NFC')
    .replace(/[\u200B-\u200F\uFEFF\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[^\u0621-\u064A0-9a-zA-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPureVocalizedArabic(text: string): boolean {
  const cleaned = String(text ?? '').trim();
  if (!cleaned) return false;
  if (/[\u0D00-\u0D7F]/.test(cleaned)) return false; // Exclude mixed Malayalam strings
  if (/[→\/]/.test(cleaned)) return false;
  return /[\u0621-\u064A]/.test(cleaned);
}

/**
 * Extracts distinct vocalized Arabic words (>= 2 base letters) from a spoken clip.
 */
export function extractArabicChipWords(arabicText: string): string[] {
  const tokens = String(arabicText ?? '')
    .split(/\s+/)
    .map((tok) => tok.replace(/^[^\u0621-\u065F\u0670-\u06ED]+|[^\u0621-\u065F\u0670-\u06ED]+$/g, ''))
    .filter((tok) => {
      if (!tok || /[\u0D00-\u0D7F]/.test(tok)) return false;
      const baseLetters = tok.match(/[\u0621-\u064A]/g);
      return Boolean(baseLetters && baseLetters.length >= 2);
    });

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const tok of tokens) {
    const key = stripDiacriticsForCompare(tok);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(tok);
  }
  return unique;
}

function normalizeCallerAvatar(rawAvatar?: string, fallbackIdx = 0): '🧕' | '🧔' {
  if (rawAvatar === '🧕') return '🧕';
  if (rawAvatar === '🧔') return '🧔';
  return fallbackIdx % 2 === 0 ? '🧕' : '🧔';
}

function collectUnitClips(
  unitNumber: number,
  story?: UnitStory,
  guidebook?: GuidebookEntry[],
  extraListening?: ListenQuestion[]
): { clips: SpokenClipCandidate[]; allUnitWords: string[]; allUnitMl: string[] } {
  const clips: SpokenClipCandidate[] = [];
  const seenAr = new Set<string>();
  const allUnitWords: string[] = [];
  const seenWords = new Set<string>();
  const allUnitMl: string[] = [];
  const seenMl = new Set<string>();

  const pushWords = (ar: string) => {
    for (const w of extractArabicChipWords(ar)) {
      const k = stripDiacriticsForCompare(w);
      if (k && !seenWords.has(k)) {
        seenWords.add(k);
        allUnitWords.push(w);
      }
    }
  };

  const pushMl = (ml: string) => {
    const cleanMl = String(ml ?? '').trim();
    const key = cleanMl.toLowerCase();
    if (cleanMl && !seenMl.has(key)) {
      seenMl.add(key);
      allUnitMl.push(cleanMl);
    }
  };

  const pushClip = (clip: SpokenClipCandidate) => {
    if (!isPureVocalizedArabic(clip.ar) || !clip.ml.trim() || !clip.tr.trim()) return;
    const arKey = stripDiacriticsForCompare(clip.ar);
    if (!arKey || seenAr.has(arKey)) return;
    seenAr.add(arKey);
    clips.push(clip);
    pushWords(clip.ar);
    pushMl(clip.ml);
  };

  // 1. Story dialogue lines (richest conversational Arabic audio)
  if (story) {
    const lineSteps = story.steps.filter((s) => s.kind === 'line');
    lineSteps.forEach((step, idx) => {
      if (step.kind !== 'line') return;
      const speaker = story.characters[step.speaker];
      const callerAvatar = normalizeCallerAvatar(speaker?.avatar, idx + unitNumber);
      const callerNameMl =
        speaker?.nameMl?.replace(/\s*\(.*?\)/g, '').trim() ||
        (callerAvatar === '🧕' ? 'ഫാത്തിമ' : 'ഉമർ');
      pushClip({
        ar: step.ar.trim(),
        tr: step.tr.trim(),
        ml: step.ml.trim(),
        callerAvatar,
        callerNameMl,
      });
    });
  }

  // 2. Guidebook expressions (vocalized Arabic + transliteration + Malayalam)
  (guidebook ?? []).forEach((g, idx) => {
    const ar = g.ar.split(' / ')[0].trim();
    const tr = g.tr.split(' / ')[0].trim();
    const ml = g.ml.split(' / ')[0].trim();
    const callerAvatar: '🧕' | '🧔' = (idx + unitNumber) % 2 === 0 ? '🧕' : '🧔';
    pushClip({
      ar,
      tr,
      ml,
      callerAvatar,
      callerNameMl: callerAvatar === '🧕' ? 'ഫാത്തിമ' : 'ഉമർ',
    });
  });

  // 3. Extra listening questions from unit expansion packs
  (extraListening ?? []).forEach((lq, idx) => {
    const callerAvatar: '🧕' | '🧔' = (idx + unitNumber + 1) % 2 === 0 ? '🧕' : '🧔';
    pushClip({
      ar: lq.arabic.trim(),
      tr: (lq.translit ?? '').trim(),
      ml: lq.answer.trim(),
      callerAvatar,
      callerNameMl: callerAvatar === '🧕' ? 'ഫാത്തിമ' : 'ഉമർ',
    });
    lq.options.forEach(pushMl);
  });

  return { clips, allUnitWords, allUnitMl };
}

/**
 * Deterministically builds all 3 Duolingo-style Arabic Radio / Podcast exercises
 * (`radio_tf`, `radio_select3`, `radio_mcq`) for any of the 35 curriculum units.
 */
export function buildUnitPodcastQuestions(params: {
  unitNumber: number;
  unitTitleAr: string;
  story?: UnitStory;
  guidebook?: GuidebookEntry[];
  extraListening?: ListenQuestion[];
}): [RadioTfQuestion, RadioSelect3Question, RadioMcqQuestion] {
  const { unitNumber, unitTitleAr, story, guidebook, extraListening } = params;
  const { clips, allUnitWords, allUnitMl } = collectUnitClips(
    unitNumber,
    story,
    guidebook,
    extraListening
  );

  // Choose 3 distinct clips cleanly:
  // Clip for radio_select3 MUST have >= 3 distinct Arabic words (>= 2 base letters each).
  let select3Idx = clips.findIndex((c) => extractArabicChipWords(c.ar).length >= 3);
  let select3Clip: SpokenClipCandidate;
  if (select3Idx >= 0) {
    select3Clip = clips[select3Idx];
  } else {
    // Combine first two clips if single entries are very short (e.g. single words)
    const c0 = clips[0] ?? {
      ar: 'اَلسَّلَامُ عَلَيْكُمْ يَا صَدِيقِي',
      tr: 'അസ്സലാമു അലൈക്കും യാ സ്വദീഖീ',
      ml: 'നിങ്ങൾക്ക് സമാധാനമുണ്ടാകട്ടെ കൂട്ടുകാരാ.',
      callerAvatar: '🧔' as const,
      callerNameMl: 'ഉമർ',
    };
    const c1 = clips[1] ?? {
      ar: 'أَنَا أَقْرَأُ الْكِتَابَ الْجَدِيدَ',
      tr: 'അനാ അഖ്റഉൽ കിതാബൽ ജദീദ',
      ml: 'ഞാൻ പുതിയ പുസ്തകം വായിക്കുന്നു.',
      callerAvatar: '🧕' as const,
      callerNameMl: 'ഫാത്തിമ',
    };
    select3Clip = {
      ar: `${c0.ar} ${c1.ar}`,
      tr: `${c0.tr} ${c1.tr}`,
      ml: `${c0.ml} ${c1.ml}`,
      callerAvatar: c0.callerAvatar,
      callerNameMl: c0.callerNameMl,
    };
    select3Idx = 0;
  }

  // Pick a distinct clip for radio_tf
  const tfIdx = clips.findIndex((_, i) => i !== select3Idx && extractArabicChipWords(clips[i].ar).length >= 2);
  const tfClip =
    tfIdx >= 0
      ? clips[tfIdx]
      : clips.find((_, i) => i !== select3Idx) ?? select3Clip;

  // Pick a third distinct clip for radio_mcq
  const mcqIdx = clips.findIndex(
    (_, i) => i !== select3Idx && i !== tfIdx && extractArabicChipWords(clips[i].ar).length >= 2
  );
  const mcqClip =
    mcqIdx >= 0
      ? clips[mcqIdx]
      : clips.find((_, i) => i !== select3Idx && i !== tfIdx) ?? tfClip;

  const episodeTitleAr = `إِذَاعَةُ الْعَرَبِيَّةِ · ${unitTitleAr}`;

  // 1. Radio True / False (radio_tf)
  const isTrueStatement = unitNumber % 2 === 1;
  const tfMlNorm = tfClip.ml.trim().toLowerCase();
  const contrastingMl =
    allUnitMl.find((m) => m.trim().toLowerCase() !== tfMlNorm && m.length >= 6) ??
    FALLBACK_DISTRACTOR_ML[unitNumber % FALLBACK_DISTRACTOR_ML.length];

  const radioTf: RadioTfQuestion = {
    type: 'radio_tf',
    prompt: 'റേഡിയോ സംഭാഷണം കേട്ട് താഴെ പറയുന്നത് ശരിയാണോ തെറ്റാണോ എന്ന് തിരഞ്ഞെടുക്കുക',
    arabic: tfClip.ar,
    translit: tfClip.tr,
    transcriptAr: tfClip.ar,
    transcriptMl: tfClip.ml,
    callerAvatar: tfClip.callerAvatar,
    callerNameMl: tfClip.callerNameMl,
    episodeTitleAr,
    statementMl: isTrueStatement
      ? `${tfClip.callerNameMl} പറയുന്നത്: "${tfClip.ml}"`
      : `${tfClip.callerNameMl} പറയുന്നത്: "${contrastingMl}"`,
    answer: isTrueStatement,
  };

  // 2. Radio Select 3 Words You Hear (radio_select3)
  const clipWords = extractArabicChipWords(select3Clip.ar);
  // Prefer richer content words (>= 3 base Arabic letters) while preserving natural order
  const rankedClipWords = [...clipWords].sort((a, b) => {
    const lenA = a.match(/[\u0621-\u064A]/g)?.length ?? 0;
    const lenB = b.match(/[\u0621-\u064A]/g)?.length ?? 0;
    return lenB - lenA;
  });
  const chosenSet = new Set(rankedClipWords.slice(0, 3).map((w) => stripDiacriticsForCompare(w)));
  const spokenAnswers = clipWords.filter((w) => chosenSet.has(stripDiacriticsForCompare(w))).slice(0, 3);

  const allClipKeys = new Set(clipWords.map((w) => stripDiacriticsForCompare(w)));
  const distractors: string[] = [];
  const usedDistractorKeys = new Set<string>();
  const distractorPool = [...allUnitWords, ...FALLBACK_DISTRACTOR_WORDS];

  for (const cand of distractorPool) {
    if (distractors.length >= 2) break;
    const key = stripDiacriticsForCompare(cand);
    const baseLen = cand.match(/[\u0621-\u064A]/g)?.length ?? 0;
    if (!key || baseLen < 3 || allClipKeys.has(key) || usedDistractorKeys.has(key)) continue;
    usedDistractorKeys.add(key);
    distractors.push(cand);
  }
  // Extra safety fill if pool somehow had fewer than 2 long words
  for (const cand of FALLBACK_DISTRACTOR_WORDS) {
    if (distractors.length >= 2) break;
    const key = stripDiacriticsForCompare(cand);
    if (!key || allClipKeys.has(key) || usedDistractorKeys.has(key)) continue;
    usedDistractorKeys.add(key);
    distractors.push(cand);
  }

  const radioSelect3: RadioSelect3Question = {
    type: 'radio_select3',
    prompt: 'കേട്ട സംഭാഷണത്തിലെ 3 വാക്കുകൾ തിരഞ്ഞെടുക്കുക',
    arabic: select3Clip.ar,
    translit: select3Clip.tr,
    transcriptAr: select3Clip.ar,
    transcriptMl: select3Clip.ml,
    callerAvatar: select3Clip.callerAvatar,
    callerNameMl: select3Clip.callerNameMl,
    episodeTitleAr,
    words: [...spokenAnswers, ...distractors],
    answers: spokenAnswers,
  };

  // 3. Radio Multiple Choice (radio_mcq) — 3 vertically stacked Malayalam choices
  const mcqCorrect = mcqClip.ml.trim();
  const mcqOptions: string[] = [mcqCorrect];
  const seenOptMl = new Set<string>([mcqCorrect.toLowerCase()]);

  for (const candMl of [...allUnitMl, ...FALLBACK_DISTRACTOR_ML]) {
    if (mcqOptions.length >= 3) break;
    const trimmed = candMl.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seenOptMl.has(key)) continue;
    seenOptMl.add(key);
    mcqOptions.push(trimmed);
  }

  const radioMcq: RadioMcqQuestion = {
    type: 'radio_mcq',
    prompt: `${mcqClip.callerNameMl} റേഡിയോയിൽ പറഞ്ഞത് എന്താണ്? ശരിയായ ഉത്തരം തിരഞ്ഞെടുക്കുക`,
    arabic: mcqClip.ar,
    translit: mcqClip.tr,
    transcriptAr: mcqClip.ar,
    transcriptMl: mcqClip.ml,
    callerAvatar: mcqClip.callerAvatar,
    callerNameMl: mcqClip.callerNameMl,
    episodeTitleAr,
    options: mcqOptions,
    answer: mcqCorrect,
  };

  return [radioTf, radioSelect3, radioMcq];
}
