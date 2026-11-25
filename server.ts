import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  GEMINI_VIDEO_CALL_MODEL,
  buildGeminiConversationContents,
  buildTariqSystemInstruction,
  countArabicWordsServer,
  parseValidatedVideoCallBody,
  resolveServerGeminiApiKey,
  sanitizeGeminiVideoCallPayload,
} from './src/utils/videoCallPrompt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

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

let cachedAiClient: GoogleGenAI | null = null;
let cachedApiKey = '';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = resolveServerGeminiApiKey(process.env);
  if (!apiKey) {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleVideoCallReply(req: Request, res: Response): Promise<void> {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(clientIp)) {
    res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
    return;
  }

  const body = parseValidatedVideoCallBody(req.body);
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

  const systemInstruction = buildTariqSystemInstruction(body, expectedTurnXp);
  const contents = buildGeminiConversationContents(body);

  const generateOnce = async () =>
    ai.models.generateContent({
      model: GEMINI_VIDEO_CALL_MODEL,
      contents,
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
                'Natural Arabic response from Tariq with FULL Harakat diacritics on every word. Directly answers the user without repeating prior questions or parroting.',
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
              description:
                'Up to 3 suggested vocalized Arabic replies tailored to the new follow-up question.',
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

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await generateOnce();
      const rawText = (response.text ?? '').trim();
      const payload = sanitizeGeminiVideoCallPayload(rawText, expectedTurnXp, isFinalTurn);
      if (!payload) {
        res.status(200).json({ available: false });
        return;
      }

      res.json({
        available: true,
        ...payload,
      });
      return;
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      if (attempt === 0 && (status === undefined || status >= 500 || status === 429)) {
        await sleep(350);
        continue;
      }
      break;
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'Gemini request failed';
  console.warn('[video-call-reply] Falling back to Smart Arabic Engine:', message);
  res.status(200).json({ available: false });
}

async function startServer(): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

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
