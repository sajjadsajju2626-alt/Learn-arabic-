import type { VideoCallReplySuggestion, VideoCallScenario } from '../types/learning';
import { countSpokenArabicWords } from './learningEngine';
import {
  GEMINI_API_KEY_STORAGE_KEY,
  buildGeminiRestEndpoint,
  buildGeminiRestRequestBody,
  buildGeminiTestPingBody,
  extractGeminiRestError,
  extractGeminiRestText,
  parseValidatedVideoCallBody,
  sanitizeGeminiVideoCallPayload,
  sanitizeReplyArabic,
} from './videoCallPrompt';

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
  source: 'gemini_direct' | 'gemini_server';
}

export interface DynamicVideoCallRequest {
  userSpokenText: string;
  scenario: VideoCallScenario;
  turnIndex: number;
  history: VideoCallChatEntry[];
  learnerName?: string;
}

export interface DynamicVideoCallOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  apiKey?: string;
  location?: { protocol?: string; hostname?: string };
  online?: boolean;
}

export type GeminiKeyTestResult =
  | { ok: true; key: string }
  | { ok: false; error: string };

export const MISSING_API_KEY_ERROR_ML =
  'AI സംഭാഷണം തുടങ്ങാൻ പ്രൊഫൈൽ ടാബിൽ (Profile) നിങ്ങളുടെ Gemini API Key നൽകി "പരിശോധിച്ച് സേവ് ചെയ്യുക" അമർത്തുക.';

/**
 * Cleanly combines accumulated speech segments across pauses and recognition restarts
 * without dropping words or duplicating whitespace.
 */
export function mergeSpeechTranscripts(
  committed: string,
  sessionFinal: string,
  sessionInterim: string
): string {
  const parts = [committed, sessionFinal, sessionInterim]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Strips any guillemet quote echoing («...») so Tariq never parrots raw user text.
 */
export function stripQuotedEcho(text: string): string {
  return sanitizeReplyArabic(String(text ?? ''));
}

/**
 * Reads and trims the saved Gemini API key from localStorage (`gemini_api_key`).
 */
export function getSavedGeminiApiKey(
  storage?: Pick<Storage, 'getItem'> | null
): string {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return '';
    return String(store.getItem(GEMINI_API_KEY_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

/**
 * Trims and persists the Gemini API key in localStorage (`gemini_api_key`).
 */
export function saveGeminiApiKey(
  rawKey: string,
  storage?: Pick<Storage, 'setItem' | 'removeItem'> | null
): string {
  const cleanKey = String(rawKey ?? '').trim();
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return cleanKey;
    if (cleanKey) {
      store.setItem(GEMINI_API_KEY_STORAGE_KEY, cleanKey);
    } else {
      store.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    }
  } catch {
    // Ignore restricted storage environments
  }
  return cleanKey;
}

/**
 * Sends a 1-word test ping directly to Gemini 2.5 Flash REST API and saves the trimmed key on success.
 */
export async function testAndSaveGeminiApiKey(
  rawKey: string,
  fetchImpl?: typeof fetch,
  storage?: Pick<Storage, 'setItem' | 'removeItem'> | null
): Promise<GeminiKeyTestResult> {
  const cleanKey = String(rawKey ?? '').trim();
  if (!cleanKey) {
    return {
      ok: false,
      error: 'ദയവായി ഒരു സാധുവായ Gemini API Key നൽകുക (Please enter a valid Gemini API key).',
    };
  }

  const doFetch = fetchImpl ?? (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) {
    return { ok: false, error: 'Fetch API is not available in this environment.' };
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    controller && typeof setTimeout === 'function'
      ? setTimeout(() => controller.abort(), 15000)
      : null;

  try {
    const response = await doFetch(buildGeminiRestEndpoint(cleanKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller?.signal,
      body: JSON.stringify(buildGeminiTestPingBody()),
    });

    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        error: extractGeminiRestError(data, response.status),
      };
    }

    saveGeminiApiKey(cleanKey, storage);
    return { ok: true, key: cleanKey };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'Request timed out while contacting Gemini API. Please check your internet connection.'
          : err.message
        : 'Failed to contact Gemini API.';
    return { ok: false, error: message };
  } finally {
    if (timer !== null && typeof clearTimeout === 'function') {
      clearTimeout(timer);
    }
  }
}

/**
 * Checks whether the runtime host can reach the server-side Gemini endpoint
 * (automatically skips static hosts like GitHub Pages or Android WebView file/capacitor origins).
 */
export function canUseServerGeminiEndpoint(
  loc?: { protocol?: string; hostname?: string },
  online?: boolean
): boolean {
  const isOnline =
    typeof online === 'boolean'
      ? online
      : typeof navigator === 'undefined' || navigator.onLine !== false;
  if (!isOnline) return false;
  const target =
    loc ?? (typeof window !== 'undefined' ? window.location : { protocol: '', hostname: '' });
  const proto = String(target.protocol || '').toLowerCase();
  const host = String(target.hostname || '').toLowerCase();
  if (proto !== 'http:' && proto !== 'https:') return false;
  if (!host || host.endsWith('.github.io')) return false;
  return true;
}

/**
 * Requests a natural, real-time vocalized Arabic reply from Gemini 2.5 Flash:
 * 1. If a trimmed Gemini API key is saved in `localStorage.getItem('gemini_api_key')` (or passed via options),
 *    calls `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=...`
 *    directly using native `fetch()` (works on GitHub Pages, Android WebView APK, and any browser).
 * 2. Otherwise, when hosted with the AI Studio backend, calls `/api/video-call-reply` (server-side `process.env.GEMINI_API_KEY`).
 * 3. Never uses hardcoded template replies — surfaces the exact API or setup error if unavailable.
 */
export async function requestDynamicVideoCallReply(
  req: DynamicVideoCallRequest,
  options: DynamicVideoCallOptions = {}
): Promise<DynamicVideoCallResponse> {
  const timeoutMs = options.timeoutMs ?? 20000;
  const doFetch = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) {
    throw new Error('Network fetch is not available in this browser.');
  }

  const fullHistory = (req.history || []).slice(-30);
  const validated = parseValidatedVideoCallBody({
    userSpokenText: req.userSpokenText,
    characterKey: req.scenario.characterKey,
    characterNameEn: req.scenario.characterNameEn,
    characterNameMl: req.scenario.characterNameMl,
    characterNameAr: req.scenario.characterNameAr,
    sceneTitleMl: req.scenario.sceneTitleMl,
    sceneSettingMl: req.scenario.sceneSettingMl,
    learnerName: req.learnerName,
    unitNumber: req.scenario.unitNumber,
    turnIndex: req.turnIndex,
    totalTurns: req.scenario.turns.length,
    history: fullHistory,
    conversationHistory: fullHistory,
  });

  if (!validated) {
    throw new Error('സംസാരിച്ച അറബി വാചകം ശൂന്യമാണ്. ദയവായി വീണ്ടും സംസാരിക്കുക.');
  }

  const isFinalTurn = validated.turnIndex + 1 >= validated.totalTurns;
  const spokenWords = Math.max(1, countSpokenArabicWords(validated.userSpokenText));
  const expectedTurnXp = Math.min(16, Math.max(2, spokenWords * 2));

  const cleanApiKey =
    typeof options.apiKey === 'string'
      ? options.apiKey.trim()
      : getSavedGeminiApiKey();

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    controller && typeof setTimeout === 'function'
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  try {
    // 1. Direct REST fetch() to Gemini 2.5 Flash using saved user key
    if (cleanApiKey) {
      const restEndpoint = buildGeminiRestEndpoint(cleanApiKey);
      const restBody = buildGeminiRestRequestBody(validated, expectedTurnXp);
      const response = await doFetch(restEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller?.signal,
        body: JSON.stringify(restBody),
      });

      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(extractGeminiRestError(data, response.status));
      }

      const rawText = extractGeminiRestText(data);
      const payload = sanitizeGeminiVideoCallPayload(rawText, expectedTurnXp, isFinalTurn);
      if (!payload) {
        throw new Error('Gemini 2.5 Flash returned an empty or unreadable Arabic response. Please try again.');
      }

      return {
        ...payload,
        source: 'gemini_direct',
      };
    }

    // 2. Server-side Gemini endpoint in AI Studio (uses process.env.GEMINI_API_KEY securely on server)
    if (canUseServerGeminiEndpoint(options.location, options.online)) {
      const response = await doFetch('/api/video-call-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller?.signal,
        body: JSON.stringify({
          userSpokenText: validated.userSpokenText,
          characterKey: validated.characterKey,
          characterNameEn: validated.characterNameEn,
          characterNameMl: validated.characterNameMl,
          characterNameAr: validated.characterNameAr,
          sceneTitleMl: validated.sceneTitleMl,
          sceneSettingMl: validated.sceneSettingMl,
          learnerName: validated.learnerName,
          unitNumber: validated.unitNumber,
          turnIndex: validated.turnIndex,
          totalTurns: validated.totalTurns,
          history: validated.history,
          conversationHistory: validated.history,
        }),
      });

      let data: Record<string, unknown> | null = null;
      try {
        data = (await response.json()) as Record<string, unknown>;
      } catch {
        data = null;
      }

      if (response.ok && data && data.available === true) {
        const cleanArabic = stripQuotedEcho(typeof data.replyArabic === 'string' ? data.replyArabic : '');
        if (cleanArabic && /[\u0621-\u064A]/.test(cleanArabic)) {
          const rawHints = Array.isArray(data.nextHints) ? data.nextHints : [];
          const validHints: VideoCallReplySuggestion[] = rawHints
            .filter(
              (h): h is VideoCallReplySuggestion =>
                Boolean(h && typeof h.ar === 'string' && h.ar.trim() && typeof h.ml === 'string')
            )
            .map((h) => ({
              ar: stripQuotedEcho(h.ar),
              tr: typeof h.tr === 'string' ? h.tr.trim() : '',
              ml: h.ml.trim(),
            }))
            .slice(0, 3);

          return {
            replyArabic: cleanArabic,
            replyTransliteration:
              typeof data.replyTransliteration === 'string' ? data.replyTransliteration.trim() : '',
            replyMalayalam:
              typeof data.replyMalayalam === 'string' ? data.replyMalayalam.trim() : '',
            nextHints: isFinalTurn ? [] : validHints,
            xpEarned:
              typeof data.xpEarned === 'number' && data.xpEarned > 0
                ? Math.round(data.xpEarned)
                : expectedTurnXp,
            isFinalTurn,
            source: 'gemini_server',
          };
        }
      }

      const serverError =
        data && typeof data.error === 'string' && data.error.trim() && data.error !== 'NO_SERVER_KEY'
          ? data.error.trim()
          : '';
      if (serverError) {
        throw new Error(serverError);
      }
    }

    throw new Error(MISSING_API_KEY_ERROR_ML);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Gemini API മറുപടി വരാൻ സമയമെടുത്തു (Request timed out). ദയവായി വീണ്ടും ശ്രമിക്കുക.');
    }
    throw err instanceof Error ? err : new Error('Failed to reach Gemini 2.5 Flash.');
  } finally {
    if (timer !== null && typeof clearTimeout === 'function') {
      clearTimeout(timer);
    }
  }
}
