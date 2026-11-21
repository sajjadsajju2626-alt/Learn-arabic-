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

type AudioStateListener = (state: ArabicAudioState) => void;

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

let sharedAudioCtx: AudioContext | null = null;
let activeCloudAudio: HTMLAudioElement | null = null;
let activePlayToken = 0;
let fallbackSafetyTimer: number | null = null;
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

  if (fallbackSafetyTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(fallbackSafetyTimer);
    fallbackSafetyTimer = null;
  }

  if (activeCloudAudio) {
    try {
      activeCloudAudio.onloadedmetadata = null;
      activeCloudAudio.onplaying = null;
      activeCloudAudio.onended = null;
      activeCloudAudio.onerror = null;
      activeCloudAudio.pause();
      activeCloudAudio.currentTime = 0;
    } catch {
      // Ignore cleanup errors
    }
    activeCloudAudio = null;
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
  const sources = buildArabicAudioSources(cleaned);

  setAudioState({ status: 'loading', sourceId: resolvedSource });

  const trySource = (index: number) => {
    if (token !== activePlayToken) return;
    if (index >= sources.length || typeof Audio === 'undefined') {
      speakOfflineFallback(cleaned, targetRate, token, resolvedSource);
      return;
    }

    const source = sources[index];
    let advanced = false;
    let audio: HTMLAudioElement | null = null;

    const tryNext = () => {
      if (advanced || token !== activePlayToken) return;
      advanced = true;
      if (activeCloudAudio === audio) {
        activeCloudAudio = null;
      }
      trySource(index + 1);
    };

    try {
      audio = new Audio();
      if (source.crossOrigin) {
        audio.crossOrigin = 'anonymous';
      }
      audio.preload = 'auto';
      audio.src = source.url;
      audio.playbackRate = targetRate;
      activeCloudAudio = audio;

      audio.onloadedmetadata = () => {
        if (token === activePlayToken && audio) {
          audio.playbackRate = targetRate;
        }
      };

      audio.onplaying = () => {
        if (token !== activePlayToken || !audio) return;
        audio.playbackRate = targetRate;
        setAudioState({ status: 'playing', sourceId: resolvedSource });
      };

      audio.onended = () => {
        if (token !== activePlayToken) return;
        if (activeCloudAudio === audio) {
          activeCloudAudio = null;
        }
        setAudioState({ status: 'idle', sourceId: null });
      };

      audio.onerror = tryNext;

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(tryNext);
      }
    } catch {
      tryNext();
    }
  };

  trySource(0);
}
