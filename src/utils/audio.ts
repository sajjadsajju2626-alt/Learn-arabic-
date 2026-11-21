export type ToneType = 'correct' | 'wrong' | 'complete' | 'tap';

export interface ArabicAudioState {
  status: 'idle' | 'loading' | 'playing';
  sourceId: string | null;
}

type AudioStateListener = (state: ArabicAudioState) => void;

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

export function buildArabicTtsUrl(arabicText: string): string {
  return `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ar&q=${encodeURIComponent(
    arabicText.trim()
  )}`;
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

    // Safety guard so headless browsers without TTS voices never leave the UI pulsing indefinitely
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

  setAudioState({ status: 'loading', sourceId: resolvedSource });

  try {
    if (typeof Audio === 'undefined') {
      speakOfflineFallback(cleaned, targetRate, token, resolvedSource);
      return;
    }

    const audio = new Audio(buildArabicTtsUrl(cleaned));
    audio.preload = 'auto';
    audio.playbackRate = targetRate;
    activeCloudAudio = audio;

    let fellBack = false;
    const triggerFallback = () => {
      if (fellBack || token !== activePlayToken) return;
      fellBack = true;
      if (activeCloudAudio === audio) {
        activeCloudAudio = null;
      }
      speakOfflineFallback(cleaned, targetRate, token, resolvedSource);
    };

    audio.onloadedmetadata = () => {
      if (token !== activePlayToken) return;
      audio.playbackRate = targetRate;
    };

    audio.onplaying = () => {
      if (token !== activePlayToken) return;
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

    audio.onerror = triggerFallback;

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(triggerFallback);
    }
  } catch {
    speakOfflineFallback(cleaned, targetRate, token, resolvedSource);
  }
}
