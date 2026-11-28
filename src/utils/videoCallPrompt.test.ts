import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GEMINI_API_KEY_STORAGE_KEY,
  GEMINI_VIDEO_CALL_MODEL,
  buildGeminiConversationContents,
  buildGeminiRestEndpoint,
  buildGeminiRestRequestBody,
  buildGeminiTestPingBody,
  buildTariqSystemInstruction,
  extractGeminiRestError,
  extractGeminiRestText,
  extractPreviouslyAskedQuestions,
  isGenericLearnerName,
  parseValidatedVideoCallBody,
  resolveServerGeminiApiKey,
  sanitizeGeminiVideoCallPayload,
} from './videoCallPrompt';
import {
  MISSING_API_KEY_ERROR_ML,
  canUseServerGeminiEndpoint,
  getSavedGeminiApiKey,
  requestDynamicVideoCallReply,
  saveGeminiApiKey,
  testAndSaveGeminiApiKey,
} from './videoCallConversation';
import { UNIT_VIDEO_CALLS } from '../data/unitVideoCalls';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

test('resolveServerGeminiApiKey reads GEMINI_API_KEY automatically and ignores placeholder values', () => {
  assert.equal(GEMINI_VIDEO_CALL_MODEL, 'gemini-2.5-flash');
  assert.equal(GEMINI_API_KEY_STORAGE_KEY, 'gemini_api_key');
  assert.equal(resolveServerGeminiApiKey({ GEMINI_API_KEY: 'AIza-live-test-key' }), 'AIza-live-test-key');
  assert.equal(resolveServerGeminiApiKey({ GEMINI_API_KEY: 'MY_GEMINI_API_KEY' }), null);
  assert.equal(resolveServerGeminiApiKey({ GEMINI_API_KEY: '   ', API_KEY: 'AIza-fallback-key' }), 'AIza-fallback-key');
  assert.equal(resolveServerGeminiApiKey({}), null);
});

test('parseValidatedVideoCallBody preserves full conversationHistory and learnerName', () => {
  const history = Array.from({ length: 16 }, (_, idx) => ({
    speaker: idx % 2 === 0 ? 'character' : 'user',
    text: `رسالة رقم ${idx + 1}`,
  }));

  const parsed = parseValidatedVideoCallBody({
    userSpokenText: 'هل تعرف اسمي؟',
    characterKey: 'tariq',
    learnerName: 'Sajjad',
    unitNumber: 15,
    turnIndex: 2,
    totalTurns: 5,
    conversationHistory: history,
  });

  assert.ok(parsed);
  assert.equal(parsed.userSpokenText, 'هل تعرف اسمي؟');
  assert.equal(parsed.learnerName, 'Sajjad');
  assert.equal(parsed.history.length, 16);
  assert.equal(isGenericLearnerName('പഠിതാവ്'), true);
  assert.equal(isGenericLearnerName('Sajjad'), false);
});

test('extractPreviouslyAskedQuestions and buildTariqSystemInstruction prevent repeating questions and handle name queries', () => {
  const parsed = parseValidatedVideoCallBody({
    userSpokenText: 'هل تعرف اسمي؟',
    learnerName: 'Sajjad',
    unitNumber: 15,
    turnIndex: 1,
    totalTurns: 5,
    history: [
      {
        speaker: 'character',
        text: 'أَهْلًا وَسَهْلًا يَا صَدِيقِي! كَيْفَ حَالُكَ الْيَوْمَ؟ وَمَاذَا تُحِبُّ أَنْ نَتَحَدَّثَ عَنْهُ؟',
      },
      { speaker: 'user', text: 'هل تعرف اسمي؟' },
    ],
  });
  assert.ok(parsed);

  const asked = extractPreviouslyAskedQuestions(parsed.history);
  assert.equal(asked.length, 2);
  assert.ok(asked[0].includes('كَيْفَ حَالُكَ'));

  const systemPrompt = buildTariqSystemInstruction(parsed, 6);
  assert.ok(systemPrompt.includes('طَارِق'));
  assert.ok(systemPrompt.includes('Sajjad'));
  assert.ok(systemPrompt.includes('PREVIOUSLY ASKED QUESTIONS'));
  assert.ok(systemPrompt.includes('كَيْفَ حَالُكَ'));
  assert.ok(systemPrompt.includes('FULL HARAKAT'));
});

test('buildGeminiConversationContents constructs valid multi-turn contents starting with user and without duplicating latest turn', () => {
  const parsed = parseValidatedVideoCallBody({
    userSpokenText: 'هل تعرف اسمي؟',
    unitNumber: 15,
    turnIndex: 0,
    totalTurns: 5,
    history: [
      {
        speaker: 'character',
        text: 'أَهْلًا وَسَهْلًا يَا صَدِيقِي! كَيْفَ حَالُكَ الْيَوْمَ؟',
      },
      {
        speaker: 'user',
        text: 'هل تعرف اسمي؟',
      },
    ],
  });
  assert.ok(parsed);

  const contents = buildGeminiConversationContents(parsed);
  assert.equal(contents[0].role, 'user');
  assert.equal(contents[1].role, 'model');
  assert.equal(contents[2].role, 'user');
  assert.equal(contents[2].parts.length, 1);
  assert.equal(contents[2].parts[0].text, 'هل تعرف اسمي؟');
});

test('sanitizeGeminiVideoCallPayload strips guillemets and parses structured JSON cleanly', () => {
  const payload = sanitizeGeminiVideoCallPayload(
    '```json\n{"replyArabic":"نَعَمْ بِالطَّبْعِ يَا «صَدِيقِي»! كَيْفَ يُمْكِنُنِي مُسَاعَدَتُكَ الْيَوْمَ؟","replyTransliteration":"നഅം","replyMalayalam":"അതെ","nextHints":[{"ar":"أُرِيدُ تَعَلُّمَ الْعَرَبِيَّةِ","tr":"ഉരീദു","ml":"എനിക്ക് അറബി പഠിക്കണം"}],"xpEarned":6}\n```',
    6,
    false
  );
  assert.ok(payload);
  assert.equal(payload.replyArabic.includes('«'), false);
  assert.equal(payload.replyArabic.includes('»'), false);
  assert.equal(payload.nextHints.length, 1);
  assert.equal(payload.xpEarned, 6);
});

test('Direct REST helpers build trimmed gemini-2.5-flash URL, test ping, and extract responses/errors accurately', () => {
  const endpoint = buildGeminiRestEndpoint('  AIzaSyTestKey123  ');
  assert.equal(
    endpoint,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyTestKey123'
  );

  const ping = buildGeminiTestPingBody();
  assert.equal(ping.contents[0].parts[0].text, 'Hi');

  const extractedText = extractGeminiRestText({
    candidates: [{ content: { parts: [{ text: '{"replyArabic":"أَهْلًا"}' }] } }],
  });
  assert.equal(extractedText, '{"replyArabic":"أَهْلًا"}');

  assert.equal(
    extractGeminiRestError({ error: { message: 'API key not valid. Please pass a valid API key.' } }, 400),
    'API key not valid. Please pass a valid API key.'
  );
  assert.equal(extractGeminiRestError(null, 403), 'Gemini API error (HTTP 403)');
});

test('testAndSaveGeminiApiKey trims spaces, pings gemini-2.5-flash, saves on success, and surfaces exact API error on failure', async () => {
  const storage = createMemoryStorage();
  let capturedUrl = '';
  let capturedBody = '';

  const okFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedBody = String(init?.body ?? '');
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hello!' }] } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  const okRes = await testAndSaveGeminiApiKey('   AIzaSyValidKey999   ', okFetch, storage);
  assert.equal(okRes.ok, true);
  assert.equal(
    capturedUrl,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyValidKey999'
  );
  assert.ok(capturedBody.includes('"Hi"'));
  assert.equal(getSavedGeminiApiKey(storage), 'AIzaSyValidKey999');

  const badFetch = (async () =>
    new Response(
      JSON.stringify({ error: { message: 'API key not valid. Please pass a valid API key.' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )) as typeof fetch;

  const storage2 = createMemoryStorage();
  const badRes = await testAndSaveGeminiApiKey('bad-key', badFetch, storage2);
  assert.equal(badRes.ok, false);
  if (!badRes.ok) {
    assert.equal(badRes.error, 'API key not valid. Please pass a valid API key.');
  }
  assert.equal(getSavedGeminiApiKey(storage2), '');
});

test('requestDynamicVideoCallReply calls direct REST gemini-2.5-flash with trimmed key, forwards full history, and surfaces real errors without hardcoded templates', async () => {
  const scenario = UNIT_VIDEO_CALLS.u15;
  assert.ok(scenario);

  const captured: { url: string; payload: Record<string, unknown> | null } = {
    url: '',
    payload: null,
  };
  const mockDirectFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.url = String(input);
    captured.payload = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    replyArabic: 'نَعَمْ يَا سَجَّادُ، أَنَا أَعْرِفُ اسْمَكَ! كَيْفَ كَانَ يَوْمُكَ الْيَوْمَ؟',
                    replyTransliteration: 'നഅം യാ സജ്ജാദ്, അന അഅ്രിഫു ഇസ്മക! കൈഫ കാന യൗമുകൽ യൗം?',
                    replyMalayalam: 'അതെ സജ്ജാദ്, എനിക്ക് നിങ്ങളുടെ പേര് അറിയാം! ഇന്നത്തെ ദിവസം എങ്ങനെയായിരുന്നു?',
                    nextHints: [
                      { ar: 'يَوْمِي مُمْتَازٌ', tr: 'യൗമീ മുംതാസ്', ml: 'എന്റെ ദിവസം മികച്ചതാണ്' },
                      { ar: 'ذَهَبْتُ إِلَى الْعَمَلِ الْيَوْمَ', tr: 'ദഹബ്തു ഇലൽ അമലിൽ യൗം', ml: 'ഇന്ന് ഞാൻ ജോലിക്ക് പോയി' },
                    ],
                    xpEarned: 6,
                  }),
                },
              ],
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  const reply = await requestDynamicVideoCallReply(
    {
      userSpokenText: 'هل تعرف اسمي؟',
      scenario,
      turnIndex: 0,
      history: [
        { speaker: 'character', text: scenario.turns[0].characterAr },
        { speaker: 'user', text: 'هل تعرف اسمي؟' },
      ],
      learnerName: 'Sajjad',
    },
    { apiKey: '  AIzaSyDirectRestKey  ', fetchImpl: mockDirectFetch }
  );

  assert.equal(
    captured.url,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyDirectRestKey'
  );
  assert.ok(captured.payload);
  assert.ok(Array.isArray(captured.payload.contents));
  assert.equal(reply.source, 'gemini_direct');
  assert.ok(reply.replyArabic.includes('سَجَّادُ'));
  assert.equal(reply.nextHints.length, 2);

  // Verify exact API error is thrown (no hardcoded template reply!)
  const errorFetch = (async () =>
    new Response(
      JSON.stringify({ error: { message: 'Quota exceeded for gemini-2.5-flash.' } }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )) as typeof fetch;

  await assert.rejects(
    () =>
      requestDynamicVideoCallReply(
        {
          userSpokenText: 'أحب القهوة',
          scenario,
          turnIndex: 0,
          history: [],
        },
        { apiKey: 'AIzaSyDirectRestKey', fetchImpl: errorFetch }
      ),
    /Quota exceeded for gemini-2\.5-flash\./
  );

  // Verify missing key on GitHub Pages throws actionable Profile setup error
  await assert.rejects(
    () =>
      requestDynamicVideoCallReply(
        {
          userSpokenText: 'أحب القهوة',
          scenario,
          turnIndex: 0,
          history: [],
        },
        {
          apiKey: '',
          location: { protocol: 'https:', hostname: 'user.github.io' },
          online: true,
          fetchImpl: errorFetch,
        }
      ),
    (err: unknown) => err instanceof Error && err.message === MISSING_API_KEY_ERROR_ML
  );

  // Storage trimming + endpoint detection sanity checks
  const st = createMemoryStorage();
  saveGeminiApiKey('  AIzaTrimmed  ', st);
  assert.equal(getSavedGeminiApiKey(st), 'AIzaTrimmed');
  assert.equal(canUseServerGeminiEndpoint({ protocol: 'https:', hostname: 'example.run.app' }, true), true);
  assert.equal(canUseServerGeminiEndpoint({ protocol: 'https:', hostname: 'user.github.io' }, true), false);

  const parsedForBody = parseValidatedVideoCallBody({
    userSpokenText: 'أريد القهوة',
    unitNumber: 15,
    turnIndex: 0,
    totalTurns: 5,
    history: [],
  });
  assert.ok(parsedForBody);
  const restBody = buildGeminiRestRequestBody(parsedForBody, 4);
  assert.equal(restBody.generationConfig.responseMimeType, 'application/json');
  assert.equal(restBody.generationConfig.responseSchema.type, 'OBJECT');
});
