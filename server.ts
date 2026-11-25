import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const GEMINI_MODEL = 'gemini-2.5-flash';

interface IncomingTurnHistory {
  speaker: 'character' | 'user';
  text: string;
}

interface VideoCallReplyRequestBody {
  userSpokenText: string;
  characterKey: 'tariq' | 'layla';
  characterNameEn: string;
  characterNameMl: string;
  characterNameAr: string;
  sceneTitleMl: string;
  sceneSettingMl: string;
  unitNumber: number;
  turnIndex: number;
  totalTurns: number;
  history?: IncomingTurnHistory[];
  nextTopicAr?: string;
  nextTopicMl?: string;
}

interface DynamicHintItem {
  ar: string;
  tr: string;
  ml: string;
}

interface DynamicVideoCallReplyPayload {
  replyArabic: string;
  replyTransliteration: string;
  replyMalayalam: string;
  nextHints: DynamicHintItem[];
  xpEarned: number;
  isFinalTurn: boolean;
}

// Lightweight in-memory per-IP rate limiter (60 requests / 60s)
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (rateBuckets.size > 500) {
      for (const [key, entry] of rateBuckets.entries()) {
        if (now >= entry.resetAt) rateBuckets.delete(key);
      }
    }
    return false;
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    return true;
  }
  bucket.count += 1;
  return false;
}

function clampString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function countArabicWordsServer(text: string): number {
  const stripped = text
    .replace(/[\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[.,!؟،؛:"'()[\]«»\-–—…]/g, ' ')
    .trim();
  if (!stripped) return 0;
  return stripped.split(/\s+/).filter((w) => /[\u0621-\u064A]/.test(w)).length;
}

let cachedAiClient: GoogleGenAI | null = null;
let cachedApiKey = '';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!cachedAiClient || cachedApiKey !== apiKey) {
    cachedApiKey = apiKey;
    cachedAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedAiClient;
}

function parseValidatedBody(raw: unknown): VideoCallReplyRequestBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const userSpokenText = clampString(obj.userSpokenText, 400);
  if (!userSpokenText) return null;

  const characterKey = obj.characterKey === 'layla' ? 'layla' : 'tariq';
  const unitNumber = Math.min(35, Math.max(15, Math.floor(Number(obj.unitNumber) || 15)));
  const totalTurns = Math.min(8, Math.max(1, Math.floor(Number(obj.totalTurns) || 5)));
  const turnIndex = Math.min(totalTurns - 1, Math.max(0, Math.floor(Number(obj.turnIndex) || 0)));

  const history: IncomingTurnHistory[] = [];
  if (Array.isArray(obj.history)) {
    for (const item of obj.history.slice(-10)) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;
      const speaker = entry.speaker === 'user' ? 'user' : 'character';
      const text = clampString(entry.text, 260);
      if (text) history.push({ speaker, text });
    }
  }

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
    unitNumber,
    turnIndex,
    totalTurns,
    history,
  };
}

function sanitizeReplyArabic(text: string): string {
  return text
    .replace(/[«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function handleVideoCallReply(req: Request, res: Response): Promise<void> {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(clientIp)) {
    res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
    return;
  }

  const body = parseValidatedBody(req.body);
  if (!body) {
    res.status(400).json({ error: 'Invalid video call request payload.' });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.status(200).json({ available: false });
    return;
  }

  const isFinalTurn = body.turnIndex + 1 >= body.totalTurns;
  const spokenWords = Math.max(1, countArabicWordsServer(body.userSpokenText));
  const expectedTurnXp = Math.min(16, Math.max(2, spokenWords * 2));

  const historyLines = (body.history || [])
    .map((h) => `${h.speaker === 'user' ? 'Learner' : body.characterNameEn}: ${h.text}`)
    .join('\n');

  const systemInstruction = [
    `You are ${body.characterNameEn} (${body.characterNameAr}), a warm, genuine, natural native Arabic friend on an open-topic Video Call with a Malayalam-speaking Arabic learner.`,
    `There is NO fixed topic — talk naturally about whatever the learner brings up (daily life, feelings, food, travel, family, work, studies, weather, hobbies, plans, or questions about you).`,
    `STRICT RULES:`,
    `1. UNDERSTAND THE MEANING of what the learner actually said — even if it is short, conversational, or has minor mistakes — and reply genuinely to their meaning and intent.`,
    `2. NEVER parrot, echo, repeat verbatim, or quote the learner's raw words. NEVER use guillemets («...») or quotation marks to repeat what they said.`,
    `3. Write replyArabic in clear, natural Modern Standard Arabic (Fusha) with FULL Harakat/Tashkeel vowel marks on EVERY word (Fatha, Kasra, Damma, Sukoon, Shadda, Tanween) so Hamed TTS reads it clearly. Keep it concise and warm (1-2 natural sentences).`,
    isFinalTurn
      ? `4. This is the FINAL turn (${body.turnIndex + 1}/${body.totalTurns}). React warmly to what the learner just said and give a heartfelt, natural Arabic farewell without quoting their words verbatim and without asking a new question.`
      : `4. This is turn ${body.turnIndex + 1} of ${body.totalTurns}. First give a natural, meaningful reaction/answer to what the learner said, then immediately ask ONE directly related, natural follow-up question in vocalized Arabic that continues THEIR topic (do not jump to an unrelated script and do not repeat a question already in the conversation history).`,
    `5. Write replyTransliteration in natural Malayalam script phonetic transliteration (e.g., أَهْلًا وَسَهْلًا -> അഹ്‌ലൻ വ സഹ്‌ലൻ).`,
    `6. Write replyMalayalam in natural, idiomatic Malayalam translating what ${body.characterNameEn} just said.`,
    isFinalTurn
      ? `7. Return an empty array [] for nextHints since the call is finishing.`
      : `7. Provide exactly 3 nextHints tailored to answer YOUR new follow-up question: hint 1 short (2-3 Arabic words), hint 2 medium (4-6 Arabic words), hint 3 full natural sentence (6-9 Arabic words). Every hint must have full Harakat in "ar", Malayalam script phonetics in "tr", and Malayalam meaning in "ml".`,
    `8. Set xpEarned to ${expectedTurnXp}.`,
  ].join('\n');

  const userPrompt = [
    historyLines ? `Conversation so far:\n${historyLines}` : '',
    `Learner just spoke: "${body.userSpokenText}"`,
    `Reply naturally as ${body.characterNameEn} (without echoing or quoting their raw words) in the required JSON schema.`,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.75,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            replyArabic: {
              type: Type.STRING,
              description:
                'Natural Arabic response with full Harakat diacritics. Never quote or parrot the user.',
            },
            replyTransliteration: {
              type: Type.STRING,
              description: 'Natural Malayalam script phonetic transliteration of replyArabic.',
            },
            replyMalayalam: {
              type: Type.STRING,
              description: 'Natural Malayalam translation of replyArabic.',
            },
            nextHints: {
              type: Type.ARRAY,
              description: 'Up to 3 suggested Arabic replies for the learner to answer the follow-up question.',
              items: {
                type: Type.OBJECT,
                properties: {
                  ar: { type: Type.STRING, description: 'Vocalized Arabic reply with Harakat.' },
                  tr: { type: Type.STRING, description: 'Malayalam script transliteration.' },
                  ml: { type: Type.STRING, description: 'Malayalam meaning.' },
                },
                required: ['ar', 'tr', 'ml'],
              },
            },
            xpEarned: {
              type: Type.INTEGER,
              description: 'XP earned for this turn based on Arabic words spoken.',
            },
          },
          required: ['replyArabic', 'replyTransliteration', 'replyMalayalam', 'nextHints', 'xpEarned'],
        },
      },
    });

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      res.status(200).json({ available: false });
      return;
    }

    const parsed = JSON.parse(rawText) as Partial<DynamicVideoCallReplyPayload>;
    const replyArabic = sanitizeReplyArabic(clampString(parsed.replyArabic, 420));
    if (!replyArabic || !/[\u0621-\u064A]/.test(replyArabic)) {
      res.status(200).json({ available: false });
      return;
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

    const payload: DynamicVideoCallReplyPayload & { available: true } = {
      available: true,
      replyArabic,
      replyTransliteration: clampString(parsed.replyTransliteration, 460) || '',
      replyMalayalam: clampString(parsed.replyMalayalam, 460) || '',
      nextHints: isFinalTurn ? [] : cleanHints,
      xpEarned: expectedTurnXp,
      isFinalTurn,
    };

    res.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gemini request failed';
    console.warn('[video-call-reply] Falling back to Smart Arabic Engine:', message);
    res.status(200).json({ available: false });
  }
}

async function startServer(): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.post('/api/video-call-reply', (req, res) => {
    void handleVideoCallReply(req, res);
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
