import type { LessonQuestion } from '../types/learning';

export type ToneType = 'correct' | 'wrong' | 'complete' | 'tap';

export interface ArabicAudioState {
  status: 'idle' | 'loading' | 'playing' | 'paused';
  sourceId: string | null;
}

export interface ArabicAudioSource {
  url: string;
  crossOrigin: boolean;
  provider: 'letter-mp3' | 'hisnmuslim';
}

export interface SpeechVoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

interface CachedAudioMeta {
  key: string;
  sources: ArabicAudioSource[];
  sourceIndex: number;
  ready: boolean;
  failed: boolean;
}

type AudioStateListener = (state: ArabicAudioState) => void;

export const PRIMARY_ARABIC_VOICE_ID = 'ar-SA-HamedNeural';
export const PRIMARY_ARABIC_VOICE_LABEL = 'Hamed - Saudi Arabic Natural Male Voice';
export const BUFFER_TIMEOUT_MS = 800;

export const BASE_ARABIC_LETTERS = [
  'ا',
  'ب',
  'ت',
  'ث',
  'ج',
  'ح',
  'خ',
  'د',
  'ذ',
  'ر',
  'ز',
  'س',
  'ش',
  'ص',
  'ض',
  'ط',
  'ظ',
  'ع',
  'غ',
  'ف',
  'ق',
  'ك',
  'ل',
  'م',
  'ن',
  'ه',
  'و',
  'ي',
] as const;

export const audioCache = new Map<string, HTMLAudioElement>();
const audioCacheMeta = new WeakMap<HTMLAudioElement, CachedAudioMeta>();

let sharedAudioCtx: AudioContext | null = null;
let activeCloudAudio: HTMLAudioElement | null = null;
let activePlayToken = 0;
let fallbackSafetyTimer: number | null = null;
let bufferTimeoutTimer: number | null = null;
let lastSpokenPayload: { text: string; rate: number; sourceId: string | null } | null = null;
let currentAudioState: ArabicAudioState = { status: 'idle', sourceId: null };
const audioListeners = new Set<AudioStateListener>();

function setAudioState(next: ArabicAudioState): void {
  if (
    currentAudioState.status === next.status &&
    currentAudioState.sourceId === next.sourceId
  ) {
    return;
  }
  currentAudioState = next;
  audioListeners.forEach((listener) => listener(currentAudioState));
}

export function getArabicAudioState(): ArabicAudioState {
  return currentAudioState;
}

export function subscribeArabicAudioState(listener: AudioStateListener): () => void {
  audioListeners.add(listener);
  listener(currentAudioState);
  return () => {
    audioListeners.delete(listener);
  };
}

export function getArabicLetterAudioUrl(arabicText: string): string | null {
  const cleaned = arabicText.trim();
  const idx = (BASE_ARABIC_LETTERS as readonly string[]).indexOf(cleaned);
  if (idx === -1) return null;
  const letterIndex = String(idx + 1).padStart(2, '0');
  return `https://raw.githubusercontent.com/mustafa0x/arabic-alphabet-audio/master/mp3/${letterIndex}.mp3`;
}

const ALLAH_BARE_FORMS = new Set(['الله', 'لله', 'بالله', 'والله', 'تالله', 'فالله']);

/**
 * Connected Hamzatul Wasl elision prepositions before "ال" (e.g. فِي الْمَسْجِدِ -> فِلْمَسْجِدْ).
 */
const WASL_PREP_PREFIXES: Record<string, string> = {
  في: 'فِ',
  الى: 'إِلَ',
  على: 'عَلَ',
};

/**
 * Normalizes Arabic Du'a & Dhikr text for resilient lookup across Harakat,
 * Superscript Alif, Alif variants, Tatweel, and punctuation.
 */
export function normalizeDuaLookupKey(arabicText: string): string {
  return String(arabicText ?? '')
    .trim()
    .replace(/[\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[.,!؟،؛:"'()\[\]«»\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verified Hisn al-Muslim MP3 IDs hosted at https://www.hisnmuslim.com/audio/ar/<id>.mp3
 */
export const HISNMUSLIM_DUA_AUDIO_IDS: Readonly<Record<string, string>> = {
  'الحمد لله الذي احيانا': '1',
  'الحمد لله الذي احيانا بعد ما اماتنا واليه النشور': '1',
  'لا اله الا الله وحده لا شريك له': '2',
  'الحمد لله الذي عافاني في جسدي': '3',
  'اللهم اني اعوذ بك من الخبث والخبائث': '10',
  'بسم الله اللهم اني اعوذ بك من الخبث والخبائث': '10',
  'غفرانك': '11',
  'بسم الله توكلت على الله': '16',
  'بسم الله توكلت على الله ولا حول ولا قوة الا بالله': '16',
  'اللهم اني اعوذ بك ان اضل او اضل': '17',
  'بسم الله ولجنا وبسم الله خرجنا': '18',
  'بسم الله ولجنا وبسم الله خرجنا وعلى الله ربنا توكلنا': '18',
  'اعوذ بالله العظيم وبوجهه الكريم': '20',
  'بسم الله والصلاة والسلام على رسول الله': '21',
  'اصبحنا واصبح الملك لله': '77',
  'بسم الله الذي لا يضر مع اسمه شيء في الارض ولا في السماء': '86',
  'سبحان الله وبحمده': '91',
  'سبحان الله وبحمده عدد خلقه': '94',
  'استغفر الله واتوب اليه': '96',
  'لا باس طهور ان شاء الله': '147',
  'اسال الله العظيم رب العرش العظيم ان يشفيك': '148',
  'اللهم صيبا نافعا': '172',
  'اللهم بارك لنا فيه واطعمنا خيرا منه': '179',
  'الحمد لله الذي اطعمني هذا': '180',
  'جزاك الله خيرا': '198',
  'جزاكم الله خيرا': '198',
  'بسم الله والحمد لله سبحان الذي سخر لنا هذا': '206',
  'سبحان الذي سخر لنا هذا': '206',
  'سبحان الله وبحمده سبحان الله العظيم': '256',
  'سبحان الله والحمد لله ولا اله الا الله والله اكبر': '257',
};

export function getDuaAudioUrl(arabicText: string): string | null {
  const key = normalizeDuaLookupKey(arabicText);
  if (!key) return null;
  const id = HISNMUSLIM_DUA_AUDIO_IDS[key];
  if (!id) return null;
  return `https://www.hisnmuslim.com/audio/ar/${id}.mp3`;
}

function formatSingleArabicToken(core: string, applyPausal: boolean): string {
  let word = core;
  const bareWord = word.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
  const isAllahForm = ALLAH_BARE_FORMS.has(bareWord);

  // 1. Sun-letter (Al-Shamsiyyah) assimilation
  if (!isAllahForm) {
    // Prefixed ال (كَالـ, بِالـ, وَالـ, فَالـ) + Sun letter + Shadda -> strip Alif + silent Lam
    word = word.replace(
      /^([كبوف][\u064E-\u0650]?)ا[\u064E]?ل\u0652?([تثدذرزسشصضطظلن])([\u064E-\u0650\u0670]*\u0651)/,
      '$1$2$3'
    );
    // Word-initial ال / اَل + Sun letter + Shadda -> strip silent Lam, keep Alif
    word = word.replace(
      /^ا([\u064E]?)ل\u0652?([تثدذرزسشصضطظلن])([\u064E-\u0650\u0670]*\u0651)/,
      'ا$1$2$3'
    );
    // Preposition لِـ + ال (لِلـ) + Sun letter + Shadda -> strip silent Lam
    word = word.replace(
      /^(ل[\u0650]?)ل\u0652?([تثدذرزسشصضطظلن])([\u064E-\u0650\u0670]*\u0651)/,
      '$1$2$3'
    );
  }

  // 2. End-of-sentence Pausal Sukoon (Al-Waqf) on multi-word sentences only
  if (applyPausal) {
    const baseLetters = word.match(/[\u0621-\u064A]/g);
    if (baseLetters && baseLetters.length >= 3) {
      if (/\u0651[\u064E\u064F\u0650]$/.test(word)) {
        word = word.slice(0, -1);
      } else if (/[\u064E\u064F\u0650]$/.test(word)) {
        word = word.slice(0, -1) + '\u0652';
      }
    }
  }

  return word;
}

/**
 * Formats vocalized Arabic text for natural spoken TTS pronunciation without
 * altering the visual text shown to learners:
 * 1. Single-word taps preserve their exact final Harakat (e.g. الْمَسْجِدُ -> الْمَسْجِدُ "Al-masjidu"),
 *    while still applying Sun-letter assimilation (كَالسَّيْفِ -> كَسَّيْفِ).
 * 2. Full multi-word sentences apply:
 *    - Sun-letter (Al-Shamsiyyah) assimilation (كَالسَّيْفِ -> كَسَّيْفِ),
 *    - Connected Hamzat al-Wasl elision (فِي الْمَسْجِدِ -> فِلْمَسْجِدْ, فِي السُّوقِ -> فِسُّوقْ),
 *    - End-of-sentence pausal Sukoon (الْوَقْف) on the final word (>= 3 base letters) while
 *      preserving Tanween Fath (ـًا) and single-letter Harakat syllables.
 */
export function formatForArabicTTS(rawText: string): string {
  const cleaned = String(rawText ?? '').trim();
  if (!cleaned) return '';

  const tokens = cleaned.split(/\s+/);
  const isMultiWord = tokens.length > 1;
  const lastIdx = tokens.length - 1;
  const wordRegex =
    /^([^\u0621-\u065F\u0670-\u06D3\u06D5-\u06ED]*)([\u0621-\u065F\u0670-\u06D3\u06D5-\u06ED]+)([^\u0621-\u065F\u0670-\u06D3\u06D5-\u06ED]*)$/;

  const formattedTokens: string[] = [];
  for (let idx = 0; idx < tokens.length; idx++) {
    const token = tokens[idx];
    const match = token.match(wordRegex);
    if (!match) {
      formattedTokens.push(token);
      continue;
    }

    const [, leadPunct, core, trailPunct] = match;
    const bare = core
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
      .replace(/[أإآٱ]/g, 'ا');

    // Check connected Wasl preposition merging with following "ال..." token
    const nextToken = idx + 1 < tokens.length ? tokens[idx + 1] : null;
    const nextMatch = !trailPunct && nextToken ? nextToken.match(wordRegex) : null;
    const prepPrefix =
      WASL_PREP_PREFIXES[bare] ?? (core === 'مِنَ' ? 'مِنَ' : undefined);

    if (prepPrefix && nextMatch && !nextMatch[1]) {
      const nextCore = nextMatch[2];
      const nextTrail = nextMatch[3];
      const nextBare = nextCore.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
      if (!ALLAH_BARE_FORMS.has(nextBare) && /^ا[\u064E]?ل/.test(nextCore)) {
        const formattedNext = formatSingleArabicToken(
          nextCore,
          isMultiWord && idx + 1 === lastIdx
        );
        const elidedNext = formattedNext.replace(/^ا[\u064E]?/, '');
        formattedTokens.push(`${leadPunct}${prepPrefix}${elidedNext}${nextTrail}`);
        idx += 1;
        continue;
      }
    }

    const formattedWord = formatSingleArabicToken(core, isMultiWord && idx === lastIdx);
    formattedTokens.push(`${leadPunct}${formattedWord}${trailPunct}`);
  }

  return formattedTokens.join(' ');
}

export function buildHamedNeuralTtsUrl(arabicText: string): string {
  const ttsText = formatForArabicTTS(arabicText);
  return `speech://ar-SA-HamedNeural?text=${encodeURIComponent(ttsText)}`;
}

export function buildArabicTtsUrl(arabicText: string): string {
  return (
    getArabicLetterAudioUrl(arabicText) ??
    getDuaAudioUrl(arabicText) ??
    buildHamedNeuralTtsUrl(arabicText)
  );
}

export function buildArabicAudioSources(arabicText: string): ArabicAudioSource[] {
  const cleaned = arabicText.trim();
  if (!cleaned) return [];

  const sources: ArabicAudioSource[] = [];
  const letterUrl = getArabicLetterAudioUrl(cleaned);
  if (letterUrl) {
    sources.push({ url: letterUrl, crossOrigin: true, provider: 'letter-mp3' });
  } else {
    const duaUrl = getDuaAudioUrl(cleaned);
    if (duaUrl) {
      sources.push({ url: duaUrl, crossOrigin: true, provider: 'hisnmuslim' });
    }
  }
  return sources;
}

export function isHamedNeuralVoice(voice: SpeechVoiceLike | null | undefined): boolean {
  if (!voice) return false;
  const lang = (voice.lang || '').toLowerCase();
  if (!lang.startsWith('ar')) return false;
  const name = (voice.name || '').toLowerCase();
  return /hamed|ar-sa-hamed/.test(name);
}

export function scoreArabicVoice(voice: SpeechVoiceLike): number {
  const lang = (voice.lang || '').toLowerCase();
  if (!lang.startsWith('ar')) return -1;
  const name = (voice.name || '').toLowerCase();

  let score = 10;
  // Exclusive primary preference for ar-SA-HamedNeural (Hamed - Saudi Arabic Natural Male)
  if (/hamed/.test(name)) score += 220;
  else if (lang === 'ar-sa') score += 60;
  else if (lang.startsWith('ar-ae') || lang.startsWith('ar-eg') || lang.startsWith('ar-001')) {
    score += 30;
  }

  if (/natural|neural|online|wavenet|studio|enhanced|premium/.test(name)) score += 40;
  if (/google/.test(name)) score += 25;
  if (/espeak|eloquence|compact/.test(name)) score -= 40;
  return Math.max(1, score);
}

export function selectBestArabicVoice<T extends SpeechVoiceLike>(voices: readonly T[]): T | null {
  let best: T | null = null;
  let bestScore = -1;
  for (const voice of voices) {
    const s = scoreArabicVoice(voice);
    if (s > bestScore) {
      bestScore = s;
      best = voice;
    }
  }
  return bestScore >= 0 ? best : null;
}

export function isPremiumNeuralArabicVoice(voice: SpeechVoiceLike | null | undefined): boolean {
  return isHamedNeuralVoice(voice);
}

export function resolveArabicPlaybackRate(rate: number): number {
  return rate < 0.75 ? 0.65 : 1.0;
}

export function collectQuestionArabicTexts(question: LessonQuestion): string[] {
  const texts = new Set<string>();
  const add = (value?: string) => {
    const trimmed = value?.trim();
    if (trimmed) texts.add(trimmed);
  };

  if ('arabic' in question && question.arabic) {
    add(question.arabic);
  }
  if ((question.type === 'mcq' || question.type === 'listen') && question.isArabicOption) {
    question.options.forEach(add);
  }
  if (question.type === 'wordbank' && question.isArabicWords) {
    question.words.forEach(add);
  }
  if (question.type === 'pairs' || question.type === 'audio_pairs') {
    question.pairs.forEach((pair) => add(pair.ar));
  }
  if (question.type === 'fill_blank') {
    question.options.forEach(add);
    add(question.sentence.replace(/_+/, question.answer.trim()).replace(/\s+/g, ' ').trim());
  }
  if (question.type === 'radio_select3') {
    question.words.forEach(add);
  }

  return Array.from(texts);
}

function isAudioReady(audio: HTMLAudioElement | null): boolean {
  if (!audio) return false;
  const meta = audioCacheMeta.get(audio);
  return Boolean(meta?.ready || (typeof audio.readyState === 'number' && audio.readyState >= 2));
}

function attachBgErrorHandler(audio: HTMLAudioElement): void {
  const meta = audioCacheMeta.get(audio);
  if (!meta) return;
  audio.onerror = () => {
    if (audioCache.get(meta.key) !== audio) return;
    const nextIdx = meta.sourceIndex + 1;
    if (nextIdx < meta.sources.length) {
      createCachedAudioEntry(meta.key, meta.sources, nextIdx);
    } else {
      meta.failed = true;
      audioCache.delete(meta.key);
    }
  };
}

function detachPlaybackHandlers(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  audio.onloadedmetadata = null;
  audio.onplaying = null;
  audio.onended = null;
  attachBgErrorHandler(audio);
}

function createCachedAudioEntry(
  key: string,
  sources: ArabicAudioSource[],
  sourceIndex: number
): HTMLAudioElement | null {
  if (typeof Audio === 'undefined' || sourceIndex >= sources.length) return null;
  const source = sources[sourceIndex];
  try {
    const audio = new Audio();
    if (source.crossOrigin) {
      audio.crossOrigin = 'anonymous';
    }
    audio.preload = 'auto';
    audio.src = source.url;

    const meta: CachedAudioMeta = {
      key,
      sources,
      sourceIndex,
      ready: false,
      failed: false,
    };
    audioCacheMeta.set(audio, meta);

    const markReady = () => {
      meta.ready = true;
    };
    if (typeof audio.addEventListener === 'function') {
      audio.addEventListener('canplay', markReady);
      audio.addEventListener('canplaythrough', markReady);
      audio.addEventListener('loadeddata', markReady);
    } else {
      audio.oncanplay = markReady;
      audio.onloadeddata = markReady;
    }
    attachBgErrorHandler(audio);

    audioCache.set(key, audio);
    if (typeof audio.load === 'function') {
      audio.load();
    }
    return audio;
  } catch {
    return null;
  }
}

export function preloadArabicAudio(text: string): HTMLAudioElement | null {
  const cleaned = text?.trim();
  if (!cleaned || typeof Audio === 'undefined') return null;

  const existing = audioCache.get(cleaned);
  if (existing) {
    const meta = audioCacheMeta.get(existing);
    if (meta && !meta.failed) {
      return existing;
    }
  }

  const sources = buildArabicAudioSources(cleaned);
  return createCachedAudioEntry(cleaned, sources, 0);
}

export function preloadArabicAudioBatch(texts: string[]): void {
  texts.forEach((t) => {
    preloadArabicAudio(t);
  });
}

export function clearArabicAudioCache(): void {
  audioCache.forEach((audio) => {
    try {
      audio.pause();
    } catch {
      // Ignore cleanup errors
    }
  });
  audioCache.clear();
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

export function playTone(type: ToneType, enabled: boolean): void {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.09);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(185, now);
      osc.frequency.linearRampToValueAtTime(130, now + 0.22);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'complete') {
      osc.type = 'triangle';
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
      });
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.52);
      osc.start(now);
      osc.stop(now + 0.52);
    } else if (type === 'tap') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch {
    // Audio playback unavailable in headless/restricted environment
  }
}

export function stopArabicAudio(): void {
  activePlayToken += 1;

  if (bufferTimeoutTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(bufferTimeoutTimer);
    bufferTimeoutTimer = null;
  }

  if (fallbackSafetyTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(fallbackSafetyTimer);
    fallbackSafetyTimer = null;
  }

  if (activeCloudAudio) {
    const prev = activeCloudAudio;
    activeCloudAudio = null;
    try {
      detachPlaybackHandlers(prev);
      prev.pause();
      prev.currentTime = 0;
    } catch {
      // Ignore cleanup errors
    }
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore speechSynthesis cancel errors
    }
  }

  setAudioState({ status: 'idle', sourceId: null });
}

export function pauseArabicAudio(): boolean {
  if (currentAudioState.status !== 'playing' && currentAudioState.status !== 'loading') {
    return false;
  }
  if (fallbackSafetyTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(fallbackSafetyTimer);
    fallbackSafetyTimer = null;
  }
  if (activeCloudAudio && !activeCloudAudio.paused) {
    try {
      activeCloudAudio.pause();
      setAudioState({ status: 'paused', sourceId: currentAudioState.sourceId });
      return true;
    } catch {
      // Fall through to speechSynthesis
    }
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        setAudioState({ status: 'paused', sourceId: currentAudioState.sourceId });
        return true;
      }
    } catch {
      // Ignore speechSynthesis pause errors
    }
  }
  setAudioState({ status: 'paused', sourceId: currentAudioState.sourceId });
  return true;
}

export function resumeArabicAudio(enabled = true): boolean {
  if (!enabled) return false;
  if (currentAudioState.status !== 'paused') {
    if (lastSpokenPayload) {
      speakArabic(
        lastSpokenPayload.text,
        enabled,
        lastSpokenPayload.rate,
        lastSpokenPayload.sourceId ?? undefined
      );
      return true;
    }
    return false;
  }
  if (activeCloudAudio && activeCloudAudio.paused) {
    try {
      const p = activeCloudAudio.play();
      setAudioState({ status: 'playing', sourceId: currentAudioState.sourceId });
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          if (lastSpokenPayload) {
            speakArabic(
              lastSpokenPayload.text,
              enabled,
              lastSpokenPayload.rate,
              lastSpokenPayload.sourceId ?? undefined
            );
          }
        });
      }
      return true;
    } catch {
      // Fall through to replay
    }
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setAudioState({ status: 'playing', sourceId: currentAudioState.sourceId });
        return true;
      }
    } catch {
      // Fall through to replay
    }
  }
  if (lastSpokenPayload) {
    speakArabic(
      lastSpokenPayload.text,
      enabled,
      lastSpokenPayload.rate,
      lastSpokenPayload.sourceId ?? undefined
    );
    return true;
  }
  return false;
}

function speakOfflineFallback(
  text: string,
  rate: number,
  token: number,
  sourceId: string | null,
  preferredVoice?: SpeechSynthesisVoice | null
): void {
  if (token !== activePlayToken) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    setAudioState({ status: 'idle', sourceId: null });
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = preferredVoice?.lang || 'ar-SA';
    utter.rate = rate;

    const voices = window.speechSynthesis.getVoices();
    const arVoice = preferredVoice ?? selectBestArabicVoice(voices);
    if (arVoice) {
      utter.voice = arVoice;
    }

    utter.onstart = () => {
      if (token !== activePlayToken) return;
      if (fallbackSafetyTimer !== null) {
        window.clearTimeout(fallbackSafetyTimer);
        fallbackSafetyTimer = null;
      }
      setAudioState({ status: 'playing', sourceId });
    };

    utter.onend = () => {
      if (token !== activePlayToken) return;
      if (fallbackSafetyTimer !== null) {
        window.clearTimeout(fallbackSafetyTimer);
        fallbackSafetyTimer = null;
      }
      setAudioState({ status: 'idle', sourceId: null });
    };

    utter.onerror = () => {
      if (token !== activePlayToken) return;
      if (fallbackSafetyTimer !== null) {
        window.clearTimeout(fallbackSafetyTimer);
        fallbackSafetyTimer = null;
      }
      setAudioState({ status: 'idle', sourceId: null });
    };

    setAudioState({ status: 'playing', sourceId });
    window.speechSynthesis.speak(utter);

    const safetyMs = Math.max(2400, Math.min(8000, Math.round((text.length * 110) / Math.max(rate, 0.6))));
    fallbackSafetyTimer = window.setTimeout(() => {
      if (token === activePlayToken) {
        setAudioState({ status: 'idle', sourceId: null });
      }
    }, safetyMs);
  } catch {
    if (token === activePlayToken) {
      setAudioState({ status: 'idle', sourceId: null });
    }
  }
}

export function speakArabic(
  text: string,
  enabled: boolean,
  rate = 1.0,
  sourceId?: string
): void {
  stopArabicAudio();

  const cleaned = text?.trim();
  if (!enabled || !cleaned || typeof window === 'undefined') {
    return;
  }

  const token = ++activePlayToken;
  const targetRate = resolveArabicPlaybackRate(rate);
  const resolvedSource = sourceId ?? null;
  lastSpokenPayload = { text: cleaned, rate: targetRate, sourceId: resolvedSource };
  const ttsText = formatForArabicTTS(cleaned);
  const hasDirectHumanMp3 = Boolean(getArabicLetterAudioUrl(cleaned) || getDuaAudioUrl(cleaned));

  const voices =
    'speechSynthesis' in window ? window.speechSynthesis.getVoices() : [];
  const bestVoice = selectBestArabicVoice(voices);

  // For lessons, stories, and podcasts (non-letter, non-HisnMuslim-Du'a), use native browser
  // ar-SA-HamedNeural (Microsoft Hamed) directly if available; otherwise stream /api/tts ar-SA-HamedNeural MP3
  if (!hasDirectHumanMp3 && isHamedNeuralVoice(bestVoice)) {
    speakOfflineFallback(ttsText, targetRate, token, resolvedSource, bestVoice);
    return;
  }

  if (typeof Audio === 'undefined') {
    speakOfflineFallback(ttsText, targetRate, token, resolvedSource, bestVoice);
    return;
  }

  const playAudioElement = (audio: HTMLAudioElement | null) => {
    if (token !== activePlayToken) return;
    if (!audio) {
      speakOfflineFallback(ttsText, targetRate, token, resolvedSource, bestVoice);
      return;
    }

    const meta = audioCacheMeta.get(audio);
    const alreadyBuffered = isAudioReady(audio);
    let settled = false;
    let timedOut = false;

    setAudioState({ status: alreadyBuffered ? 'playing' : 'loading', sourceId: resolvedSource });
    activeCloudAudio = audio;

    const clearBufferTimer = () => {
      if (bufferTimeoutTimer !== null) {
        window.clearTimeout(bufferTimeoutTimer);
        bufferTimeoutTimer = null;
      }
    };

    const advanceToBackup = () => {
      if (settled || timedOut || token !== activePlayToken) return;
      settled = true;
      clearBufferTimer();
      detachPlaybackHandlers(audio);
      if (activeCloudAudio === audio) {
        activeCloudAudio = null;
      }

      if (meta && meta.sourceIndex + 1 < meta.sources.length) {
        const nextAudio = createCachedAudioEntry(meta.key, meta.sources, meta.sourceIndex + 1);
        playAudioElement(nextAudio);
      } else {
        if (meta) {
          meta.failed = true;
          if (audioCache.get(meta.key) === audio) {
            audioCache.delete(meta.key);
          }
        }
        speakOfflineFallback(ttsText, targetRate, token, resolvedSource, bestVoice);
      }
    };

    if (!alreadyBuffered) {
      const currentProvider = meta?.sources[meta.sourceIndex]?.provider;
      const timeoutMs =
        currentProvider === 'hisnmuslim'
          ? Math.max(BUFFER_TIMEOUT_MS, 2500)
          : BUFFER_TIMEOUT_MS;
      bufferTimeoutTimer = window.setTimeout(() => {
        if (settled || token !== activePlayToken) return;
        timedOut = true;
        settled = true;
        bufferTimeoutTimer = null;
        detachPlaybackHandlers(audio);
        try {
          audio.pause();
          audio.currentTime = 0;
          audio.preload = 'auto';
          if (!isAudioReady(audio) && typeof audio.load === 'function') {
            audio.load();
          }
        } catch {
          // Ignore pause/load errors
        }
        if (activeCloudAudio === audio) {
          activeCloudAudio = null;
        }
        speakOfflineFallback(ttsText, targetRate, token, resolvedSource, bestVoice);
      }, timeoutMs);
    }

    audio.onloadedmetadata = () => {
      if (token === activePlayToken && !timedOut) {
        audio.playbackRate = targetRate;
      }
    };

    audio.onplaying = () => {
      if (token !== activePlayToken || timedOut) return;
      settled = true;
      clearBufferTimer();
      if (meta) meta.ready = true;
      audio.playbackRate = targetRate;
      setAudioState({ status: 'playing', sourceId: resolvedSource });
    };

    audio.onended = () => {
      if (token !== activePlayToken) return;
      clearBufferTimer();
      detachPlaybackHandlers(audio);
      if (activeCloudAudio === audio) {
        activeCloudAudio = null;
      }
      setAudioState({ status: 'idle', sourceId: null });
    };

    audio.onerror = advanceToBackup;

    try {
      try {
        audio.currentTime = 0;
      } catch {
        // Some browsers disallow setting currentTime before metadata loads
      }
      audio.playbackRate = targetRate;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(advanceToBackup);
      }
    } catch {
      advanceToBackup();
    }
  };

  playAudioElement(preloadArabicAudio(cleaned));
}
