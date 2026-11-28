export const GEMINI_VIDEO_CALL_MODEL = 'gemini-2.5-flash';
export const GEMINI_API_KEY_STORAGE_KEY = 'gemini_api_key';
export const GEMINI_REST_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface IncomingTurnHistory {
  speaker: 'character' | 'user';
  text: string;
}

export interface VideoCallReplyRequestBody {
  userSpokenText: string;
  characterKey: 'tariq' | 'layla';
  characterNameEn: string;
  characterNameMl: string;
  characterNameAr: string;
  sceneTitleMl: string;
  sceneSettingMl: string;
  learnerName?: string;
  unitNumber: number;
  turnIndex: number;
  totalTurns: number;
  history: IncomingTurnHistory[];
}

export interface DynamicHintItem {
  ar: string;
  tr: string;
  ml: string;
}

export interface DynamicVideoCallReplyPayload {
  replyArabic: string;
  replyTransliteration: string;
  replyMalayalam: string;
  nextHints: DynamicHintItem[];
  xpEarned: number;
  isFinalTurn: boolean;
}

export interface GeminiContentTurn {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

const GENERIC_LEARNER_NAMES = new Set([
  'പഠിതാവ്',
  'learner',
  'student',
  'user',
  'guest',
  'friend',
  'arabic learner',
]);

export function clampString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLen);
}

export function resolveServerGeminiApiKey(
  env: Record<string, string | undefined>
): string | null {
  const candidates = [env.GEMINI_API_KEY, env.API_KEY];
  for (const raw of candidates) {
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    if (!trimmed) continue;
    if (trimmed === 'MY_GEMINI_API_KEY' || trimmed === 'YOUR_GEMINI_API_KEY') continue;
    return trimmed;
  }
  return null;
}

export function isGenericLearnerName(name?: string): boolean {
  const cleaned = clampString(name, 60).toLowerCase();
  if (!cleaned) return true;
  return GENERIC_LEARNER_NAMES.has(cleaned);
}

export function countArabicWordsServer(text: string): number {
  const stripped = text
    .replace(/[\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[.,!؟،؛:"'()[\]«»\-–—…]/g, ' ')
    .trim();
  if (!stripped) return 0;
  return stripped.split(/\s+/).filter((w) => /[\u0621-\u064A]/.test(w)).length;
}

export function sanitizeReplyArabic(text: string): string {
  return text
    .replace(/[«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseValidatedVideoCallBody(raw: unknown): VideoCallReplyRequestBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const userSpokenText = clampString(obj.userSpokenText, 450);
  if (!userSpokenText) return null;

  const characterKey = obj.characterKey === 'layla' ? 'layla' : 'tariq';
  const unitNumber = Math.min(35, Math.max(15, Math.floor(Number(obj.unitNumber) || 15)));
  const totalTurns = Math.min(8, Math.max(1, Math.floor(Number(obj.totalTurns) || 5)));
  const turnIndex = Math.min(totalTurns - 1, Math.max(0, Math.floor(Number(obj.turnIndex) || 0)));

  const rawHistory = Array.isArray(obj.conversationHistory)
    ? obj.conversationHistory
    : Array.isArray(obj.history)
      ? obj.history
      : [];

  const history: IncomingTurnHistory[] = [];
  for (const item of rawHistory.slice(-30)) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const speaker = entry.speaker === 'user' ? 'user' : 'character';
    const text = clampString(entry.text, 320);
    if (text) history.push({ speaker, text });
  }

  const learnerName = clampString(obj.learnerName, 60);

  return {
    userSpokenText,
    characterKey,
    characterNameEn: clampString(obj.characterNameEn, 40) || (characterKey === 'layla' ? 'Layla' : 'Tariq'),
    characterNameMl: clampString(obj.characterNameMl, 40) || (characterKey === 'layla' ? 'ലൈല' : 'താരിഖ്'),
    characterNameAr: clampString(obj.characterNameAr, 40) || (characterKey === 'layla' ? 'لَيْلَى' : 'طَارِق'),
    sceneTitleMl: clampString(obj.sceneTitleMl, 120) || 'വീഡിയോ കോൾ: താരിഖുമായി സംസാരിക്കാം',
    sceneSettingMl:
      clampString(obj.sceneSettingMl, 160) ||
      'അറബി കഫേയിൽ നിന്ന് താരിഖ് നിങ്ങളെ വിളിക്കുന്നു · ഏത് വിഷയത്തെക്കുറിച്ചും സംസാരിക്കാം',
    ...(learnerName ? { learnerName } : {}),
    unitNumber,
    turnIndex,
    totalTurns,
    history,
  };
}

export function extractPreviouslyAskedQuestions(history: readonly IncomingTurnHistory[]): string[] {
  const seen = new Set<string>();
  const questions: string[] = [];

  for (const entry of history) {
    if (entry.speaker !== 'character') continue;
    const segments = entry.text.match(/[^.!؟?]+[؟?]/g) || [];
    for (const seg of segments) {
      const cleaned = seg.trim();
      if (cleaned.length < 4) continue;
      const key = cleaned.replace(/[\u064B-\u065F\u0670\s]+/g, '');
      if (!seen.has(key)) {
        seen.add(key);
        questions.push(cleaned);
      }
    }
  }

  return questions;
}

export function buildTariqSystemInstruction(
  body: VideoCallReplyRequestBody,
  expectedTurnXp: number
): string {
  const isFinalTurn = body.turnIndex + 1 >= body.totalTurns;
  const previousQuestions = extractPreviouslyAskedQuestions(body.history);
  const hasRealLearnerName = !isGenericLearnerName(body.learnerName);

  const lines: string[] = [
    `You are ${body.characterNameEn} (${body.characterNameAr}), a warm, genuine, natural native Arabic friend on a real-time open-topic Video Call with a Malayalam-speaking Arabic learner.`,
    `There is NO fixed script — converse freely and naturally about whatever the learner says (greetings, personal questions like "هل تعرف اسمي؟", daily life, feelings, food, travel, family, work, studies, weather, hobbies, plans, or custom thoughts).`,
    hasRealLearnerName
      ? `LEARNER PROFILE CONTEXT: The learner's profile name is "${body.learnerName}". If they ask whether you know their name (e.g. "هل تعرف اسمي؟"), warmly confirm and address them by name in Arabic script (or if they introduce a different name in the conversation, use that name).`
      : `LEARNER PROFILE CONTEXT: You do NOT know the learner's real name yet unless they tell you during this call. If they ask whether you know their name (e.g. "هل تعرف اسمي؟") before telling you, answer honestly and warmly that you don't know it yet and ask for their name in vocalized Arabic.`,
    `STRICT RULES:`,
    `1. DIRECTLY & NATURALLY ANSWER WHAT THE USER JUST SAID: First understand the exact meaning and intent of their latest utterance (even if short, colloquial, or slightly imperfect) and give a direct, truthful, engaging answer to it.`,
    `2. NEVER PARROT OR QUOTE RAW USER WORDS: Never echo the user's message verbatim and never use guillemets («...») or quotation marks to repeat what they spoke.`,
    `3. FULL HARAKAT / TASHKEEL ON EVERY ARABIC WORD: Write replyArabic in clear, natural Modern Standard Arabic (Fusha) with complete vowel marks (Fatha, Kasra, Damma, Sukoon, Shadda, Tanween) on EVERY word so Hamed TTS pronounces it clearly. Keep replyArabic warm and concise (1-2 natural sentences).`,
    isFinalTurn
      ? `4. FINAL TURN (${body.turnIndex + 1}/${body.totalTurns}): Directly answer or react warmly to what the learner just said, then give a heartfelt, natural Arabic farewell without asking any new question.`
      : `4. TURN ${body.turnIndex + 1} OF ${body.totalTurns}: After directly answering/reacting to what the learner just said, end with ONE fresh, contextually connected follow-up question in vocalized Arabic that naturally continues THEIR topic.`,
    `5. NEVER REPEAT A PREVIOUSLY ASKED QUESTION: Do not repeat or rephrase any question already asked earlier in this conversation.`,
    `6. Write replyTransliteration in natural Malayalam script phonetic transliteration (e.g. أَهْلًا وَسَهْلًا -> അഹ്‌ലൻ വ സഹ്‌ലൻ).`,
    `7. Write replyMalayalam in natural, idiomatic Malayalam translating exactly what ${body.characterNameEn} just said.`,
    isFinalTurn
      ? `8. Return an empty array [] for nextHints since this is the final turn.`
      : `8. Provide exactly 3 nextHints tailored directly to answer YOUR new follow-up question: hint 1 short (2-3 Arabic words), hint 2 medium (4-6 Arabic words), hint 3 full natural sentence (6-9 Arabic words). Every hint must have full Harakat in "ar", Malayalam script phonetics in "tr", and natural Malayalam meaning in "ml".`,
    `9. Set xpEarned to ${expectedTurnXp}.`,
  ];

  if (previousQuestions.length > 0) {
    lines.push(
      `PREVIOUSLY ASKED QUESTIONS (DO NOT REPEAT OR PARAPHRASE ANY OF THESE):\n${previousQuestions
        .map((q, idx) => `${idx + 1}. ${q}`)
        .join('\n')}`
    );
  }

  return lines.join('\n');
}

export function buildGeminiConversationContents(
  body: VideoCallReplyRequestBody
): GeminiContentTurn[] {
  const turns: GeminiContentTurn[] = [];

  for (const entry of body.history) {
    const role: 'user' | 'model' = entry.speaker === 'user' ? 'user' : 'model';
    const text = entry.text.trim();
    if (!text) continue;

    // Gemini multi-turn contents must begin with a 'user' turn
    if (turns.length === 0 && role === 'model') {
      turns.push({
        role: 'user',
        parts: [{ text: 'ابدأ المكالمة ورحب بي.' }],
      });
    }

    const last = turns[turns.length - 1];
    if (last && last.role === role) {
      last.parts.push({ text });
    } else {
      turns.push({ role, parts: [{ text }] });
    }
  }

  const latestUserText = body.userSpokenText.trim();
  const lastTurn = turns[turns.length - 1];
  const alreadyHasLatest =
    lastTurn?.role === 'user' &&
    lastTurn.parts[lastTurn.parts.length - 1]?.text.trim() === latestUserText;

  if (!alreadyHasLatest) {
    if (lastTurn && lastTurn.role === 'user') {
      lastTurn.parts.push({ text: latestUserText });
    } else {
      turns.push({ role: 'user', parts: [{ text: latestUserText }] });
    }
  }

  return turns;
}

export function sanitizeGeminiVideoCallPayload(
  rawText: string,
  expectedTurnXp: number,
  isFinalTurn: boolean
): DynamicVideoCallReplyPayload | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  const unwrapped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: Partial<DynamicVideoCallReplyPayload>;
  try {
    parsed = JSON.parse(unwrapped) as Partial<DynamicVideoCallReplyPayload>;
  } catch {
    return null;
  }

  const replyArabic = sanitizeReplyArabic(clampString(parsed.replyArabic, 440));
  if (!replyArabic || !/[\u0621-\u064A]/.test(replyArabic)) {
    return null;
  }

  const cleanHints: DynamicHintItem[] = Array.isArray(parsed.nextHints)
    ? parsed.nextHints
        .slice(0, 3)
        .map((h) => ({
          ar: sanitizeReplyArabic(clampString((h as DynamicHintItem)?.ar, 220)),
          tr: clampString((h as DynamicHintItem)?.tr, 240),
          ml: clampString((h as DynamicHintItem)?.ml, 240),
        }))
        .filter((h) => h.ar.length > 0 && h.ml.length > 0)
    : [];

  return {
    replyArabic,
    replyTransliteration: clampString(parsed.replyTransliteration, 480) || '',
    replyMalayalam: clampString(parsed.replyMalayalam, 480) || '',
    nextHints: isFinalTurn ? [] : cleanHints,
    xpEarned: expectedTurnXp,
    isFinalTurn,
  };
}

export function buildGeminiRestEndpoint(rawApiKey: string): string {
  const cleanKey = String(rawApiKey ?? '').trim();
  if (!cleanKey) {
    throw new Error('Gemini API key is empty.');
  }
  return `${GEMINI_REST_BASE_URL}/${GEMINI_VIDEO_CALL_MODEL}:generateContent?key=${encodeURIComponent(cleanKey)}`;
}

export function buildGeminiTestPingBody() {
  return {
    contents: [
      {
        role: 'user',
        parts: [{ text: 'Hi' }],
      },
    ],
    generationConfig: {
      maxOutputTokens: 16,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
}

export function buildGeminiRestRequestBody(
  body: VideoCallReplyRequestBody,
  expectedTurnXp: number
) {
  const systemInstruction = buildTariqSystemInstruction(body, expectedTurnXp);
  const contents = buildGeminiConversationContents(body);
  return {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents,
    generationConfig: {
      temperature: 0.75,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          replyArabic: {
            type: 'STRING',
            description:
              'Natural Arabic response from Tariq with FULL Harakat diacritics on every word. Directly answers the user without repeating prior questions or parroting.',
          },
          replyTransliteration: {
            type: 'STRING',
            description: 'Natural Malayalam script phonetic transliteration of replyArabic.',
          },
          replyMalayalam: {
            type: 'STRING',
            description: 'Natural Malayalam translation of replyArabic.',
          },
          nextHints: {
            type: 'ARRAY',
            description:
              'Up to 3 suggested vocalized Arabic replies tailored to the new follow-up question.',
            items: {
              type: 'OBJECT',
              properties: {
                ar: { type: 'STRING', description: 'Vocalized Arabic reply with Harakat.' },
                tr: { type: 'STRING', description: 'Malayalam script transliteration.' },
                ml: { type: 'STRING', description: 'Malayalam meaning.' },
              },
              required: ['ar', 'tr', 'ml'],
            },
          },
          xpEarned: {
            type: 'INTEGER',
            description: 'XP earned for this turn based on Arabic words spoken.',
          },
        },
        required: ['replyArabic', 'replyTransliteration', 'replyMalayalam', 'nextHints', 'xpEarned'],
      },
    },
  };
}

export function extractGeminiRestText(json: unknown): string {
  if (!json || typeof json !== 'object') return '';
  const candidates = (json as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return '';
  const first = candidates[0] as {
    content?: { parts?: Array<{ text?: unknown }> };
  };
  const parts = first?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}

export function extractGeminiRestError(json: unknown, status?: number): string {
  if (json && typeof json === 'object') {
    const errObj = (json as { error?: unknown }).error;
    if (typeof errObj === 'string' && errObj.trim()) {
      return errObj.trim();
    }
    if (errObj && typeof errObj === 'object') {
      const msg = (errObj as { message?: unknown }).message;
      if (typeof msg === 'string' && msg.trim()) {
        return msg.trim();
      }
    }
  }
  if (typeof status === 'number' && status > 0) {
    return `Gemini API error (HTTP ${status})`;
  }
  return 'Gemini API request failed.';
}

