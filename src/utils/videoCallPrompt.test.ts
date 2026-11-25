import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GEMINI_VIDEO_CALL_MODEL,
  buildGeminiConversationContents,
  buildTariqSystemInstruction,
  extractPreviouslyAskedQuestions,
  isGenericLearnerName,
  parseValidatedVideoCallBody,
  resolveServerGeminiApiKey,
  sanitizeGeminiVideoCallPayload,
} from './videoCallPrompt';
import {
  canUseServerGeminiEndpoint,
  detectArabicIntent,
  generateSmartArabicReply,
} from './videoCallConversation';
import { UNIT_VIDEO_CALLS } from '../data/unitVideoCalls';

test('resolveServerGeminiApiKey reads GEMINI_API_KEY automatically and ignores placeholder values', () => {
  assert.equal(GEMINI_VIDEO_CALL_MODEL, 'gemini-2.5-flash');
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

test('Offline Smart Arabic Intent Engine handles "هل تعرف اسمي؟" naturally without parroting and respects offline status', () => {
  assert.equal(canUseServerGeminiEndpoint({ protocol: 'https:', hostname: 'example.run.app' }, true), true);
  assert.equal(canUseServerGeminiEndpoint({ protocol: 'https:', hostname: 'example.run.app' }, false), false);
  assert.equal(canUseServerGeminiEndpoint({ protocol: 'https:', hostname: 'user.github.io' }, true), false);

  const intentRes = detectArabicIntent('هل تعرف اسمي؟');
  assert.equal(intentRes.intent, 'name_identity');

  const scenario = UNIT_VIDEO_CALLS.u15;
  assert.ok(scenario);

  const unknownNameReply = generateSmartArabicReply({
    userSpokenText: 'هل تعرف اسمي؟',
    scenario,
    turnIndex: 0,
    history: [{ speaker: 'character', text: scenario.turns[0].characterAr }],
    learnerName: 'പഠിതാവ്',
  });
  assert.equal(unknownNameReply.intent, 'name_identity');
  assert.ok(/[\u064B-\u0652]/.test(unknownNameReply.replyArabic));
  assert.ok(unknownNameReply.replyArabic.includes('لَا أَعْرِفُ اسْمَكَ'));
  assert.equal(unknownNameReply.replyArabic.includes('«'), false);

  const knownNameReply = generateSmartArabicReply({
    userSpokenText: 'هل تعرف اسمي؟',
    scenario,
    turnIndex: 1,
    history: [
      { speaker: 'character', text: scenario.turns[0].characterAr },
      { speaker: 'user', text: 'اسمي سجاد' },
    ],
    learnerName: 'Sajjad',
  });
  assert.equal(knownNameReply.intent, 'name_identity');
  assert.ok(knownNameReply.replyArabic.includes('أَتَذَكَّرُكَ'));
});
