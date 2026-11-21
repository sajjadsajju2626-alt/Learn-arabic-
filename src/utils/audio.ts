export type ToneType = 'correct' | 'wrong' | 'complete' | 'tap';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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

export function speakArabic(text: string, enabled: boolean, rate = 0.9): void {
  if (!enabled || !text || typeof window === 'undefined' || !('speechSynthesis' in window)) {
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
    window.speechSynthesis.speak(utter);
  } catch {
    // Speech synthesis unavailable
  }
}
