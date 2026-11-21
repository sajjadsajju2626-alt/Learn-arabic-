import type { LessonQuestion } from '../types/learning';

export type ToneType = 'correct' | 'wrong' | 'complete' | 'tap';

export interface ArabicAudioState {
  status: 'idle' | 'loading' | 'playing';
  sourceId: string | null;
}

export interface ArabicAudioSource {
  url: string;
  crossOrigin: boolean;
  provider: 'letter-mp3' | 'streamelements' | 'youdao';
}

interface CachedAudioMeta {
  key: string;
  sources: ArabicAudioSource[];
  sourceIndex: number;
  ready: boolean;
  failed: boolean;
}

type AudioStateListener = (state: ArabicAudioState) => void;

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

export function buildStreamElementsTtsUrl(arabicText: string): string {
  return `https://api.streamelements.com/kappa/v2/speech?voice=ar-XA-Wavenet-B&text=${encodeURIComponent(
    arabicText.trim()
  )}`;
}

export function buildYoudaoTtsUrl(arabicText: string): string {
  return `https://dictation.youdao.com/dictvoice?audio=${encodeURIComponent(
    arabicText.trim()
  )}&le=ar`;
}

export function buildArabicTtsUrl(arabicText: string): string {
  return getArabicLetterAudioUrl(arabicText) ?? buildStreamElementsTtsUrl(arabicText);
}

export function buildArabicAudioSources(arabicText: string): ArabicAudioSource[] {
  const cleaned = arabicText.trim();
  if (!cleaned) return [];

  const sources: ArabicAudioSource[] = [];
  const letterUrl = getArabicLetterAudioUrl(cleaned);
  if (letterUrl) {
    sources.push({ url: letterUrl, crossOrigin: true, provider: 'letter-mp3' });
  }
  sources.push({
    url: buildStreamElementsTtsUrl(cleaned),
    crossOrigin: true,
    provider: 'streamelements',
  });
  sources.push({
    url: buildYoudaoTtsUrl(cleaned),
    crossOrigin: false,
    provider: 'youdao',
  });
  return sources;
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
  if (question.type === 'pairs') {
    question.pairs.forEach((pair) => add(pair.ar));
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

function speakOfflineFallback(
  text: string,
  rate: number,
  token: number,
  sourceId: string | null
): void {
  if (token !== activePlayToken) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    setAudioState({ status: 'idle', sourceId: null });
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ar-SA';
    utter.rate = rate;

    const voices = window.speechSynthesis.getVoices();
    const arVoice = voices.find((v) => v.lang.toLowerCase().startsWith('ar'));
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

    fallbackSafetyTimer = window.setTimeout(() => {
      if (token === activePlayToken) {
        setAudioState({ status: 'idle', sourceId: null });
      }
    }, 2400);
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

  if (typeof Audio === 'undefined') {
    speakOfflineFallback(cleaned, targetRate, token, resolvedSource);
    return;
  }

  const playAudioElement = (audio: HTMLAudioElement | null) => {
    if (token !== activePlayToken) return;
    if (!audio) {
      speakOfflineFallback(cleaned, targetRate, token, resolvedSource);
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
        speakOfflineFallback(cleaned, targetRate, token, resolvedSource);
      }
    };

    if (!alreadyBuffered) {
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
        speakOfflineFallback(cleaned, targetRate, token, resolvedSource);
      }, BUFFER_TIMEOUT_MS);
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
