import { createGateway, generateText, type ModelMessage } from 'ai';
import { APICallError } from '@ai-sdk/provider';
import { SYSTEM_PROMPT_BASE } from '../src/config/modeDefinitions.js';
import type { FollowUpChip, Message, Mode, RagDebugInfo } from '../src/types.js';
import { formatKnowledgeContext, retrieveKnowledgeContext } from './knowledgeBase.js';
import { resolveGuidanceForTurn } from './guidanceService.js';

const DEFAULT_GATEWAY_MODEL = 'google/gemini-3-flash';
const LONG_DASH_PATTERN = /[—–‒―]/g;
const VALID_MODES = new Set<Mode>([
  'reflect',
  'trigger',
  'reinforce',
  'prepare',
  'ask_process',
  'ask_experience',
  'chat',
]);

export class RequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'RequestError';
  }
}

function readConfiguredValue(value: string | undefined) {
  const normalized = value?.trim();

  if (!normalized || normalized.toLowerCase() === 'undefined' || normalized.toLowerCase() === 'null') {
    return undefined;
  }

  return normalized;
}

function hasGatewayStatusCode(error: unknown): error is { statusCode?: number } {
  return !!error && typeof error === 'object' && 'statusCode' in error;
}

function isGatewayAuthenticationFailure(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    error.name === 'GatewayAuthenticationError' ||
    message.includes('unauthenticated request to ai gateway') ||
    message.includes('ai gateway authentication failed') ||
    message.includes('invalid api key')
  );
}

export function normalizeGatewayError(error: unknown): RequestError | null {
  if (error instanceof RequestError) {
    return error;
  }

  if (isGatewayAuthenticationFailure(error)) {
    return new RequestError(
      'AI Gateway authentication failed. Verify AI_GATEWAY_API_KEY and restart the dev server if you changed .env while it was running.',
      502,
    );
  }

  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return new RequestError(
        'The AI provider rejected the request. Check your gateway credentials and provider configuration.',
        502,
      );
    }

    if (error.statusCode === 429) {
      return new RequestError('The AI service is rate-limited right now. Please try again shortly.', 503);
    }

    if (error.statusCode && error.statusCode >= 500) {
      return new RequestError('The AI service is temporarily unavailable. Please try again shortly.', 503);
    }
  }

  if (hasGatewayStatusCode(error) && error.statusCode === 401) {
    return new RequestError(
      'AI Gateway authentication failed. Verify AI_GATEWAY_API_KEY and restart the dev server if you changed .env while it was running.',
      502,
    );
  }

  return null;
}

export interface ChatPayload {
  mode: Mode;
  history: Message[];
  userInput: string;
  contextSummary?: string;
  debugRag?: boolean;
}

export interface SummaryPayload {
  history: Message[];
  mode?: Mode;
  contextSummary?: string;
}

export interface ContextSummaryRequestPayload {
  history: Message[];
  mode?: Mode;
  existingSummary?: string;
}

export interface ChatCompletionPayload {
  text: string;
  followUpChips: FollowUpChip[];
  ragDebug?: RagDebugInfo;
}

type SupportIntent = 'open_conversation' | 'guided_reflection' | 'process_question';

export function getConfiguredModel() {
  return readConfiguredValue(process.env.AI_GATEWAY_MODEL) || DEFAULT_GATEWAY_MODEL;
}

function getGatewayModel() {
  const apiKey = readConfiguredValue(process.env.AI_GATEWAY_API_KEY);

  if (!apiKey) {
    throw new RequestError(
      'AI Gateway is not configured. Add AI_GATEWAY_API_KEY to your environment before sending requests.',
      500,
    );
  }

  return createGateway({ apiKey })(getConfiguredModel());
}

function isRagDebugEnabled(requestDebugFlag: boolean | undefined) {
  if (requestDebugFlag === true) {
    return true;
  }

  const envValue = readConfiguredValue(process.env.RAG_DEBUG);

  if (!envValue) {
    return false;
  }

  return envValue.toLowerCase() === 'true' || envValue === '1';
}

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    (candidate.role === 'user' || candidate.role === 'assistant') &&
    typeof candidate.content === 'string' &&
    typeof candidate.timestamp === 'number'
  );
}

function assertValidHistory(history: unknown): asserts history is Message[] {
  if (!Array.isArray(history) || !history.every(isMessage)) {
    throw new RequestError('Request history is invalid.', 400);
  }
}

function assertValidMode(mode: unknown): asserts mode is Mode {
  if (typeof mode !== 'string' || !VALID_MODES.has(mode as Mode)) {
    throw new RequestError('Request mode is invalid.', 400);
  }
}

function toModelMessages(history: Message[], userInput?: string): ModelMessage[] {
  const messages: ModelMessage[] = history.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  if (userInput) {
    messages.push({
      role: 'user',
      content: userInput,
    });
  }

  return messages;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ');
}

function resolveSupportIntent(mode: Mode, userInput: string): SupportIntent {
  const text = normalizeText(`${mode} ${userInput}`);
  const processHints = [
    'hypnosis',
    'process',
    'normal',
    'normal?',
    'is this normal',
    'should i',
    'should i be',
    'what does this mean',
    'what should i expect',
    'after session',
    'medically',
    'concerned',
    'weird',
    'sleep',
    'deep',
  ];

  const reflectionHints = [
    'reflect',
    'trigger',
    'reinforce',
    'prepare',
    'session',
    'came up',
    'what changed',
    'pattern',
    'bring this to session',
    'next session',
    'what stood out',
  ];

  if (mode === 'ask_process' || mode === 'ask_experience') {
    return 'process_question';
  }

  if (processHints.some((hint) => text.includes(hint))) {
    return 'process_question';
  }

  if (reflectionHints.some((hint) => text.includes(hint))) {
    return 'guided_reflection';
  }

  if (mode === 'chat') {
    return 'open_conversation';
  }

  return 'guided_reflection';
}

function buildIntentInstruction(intent: SupportIntent) {
  switch (intent) {
    case 'process_question':
      return `
        The user is asking about hypnosis, the process, or whether an experience is normal.
        Respond in a calm, direct, bounded way.
        Normalize common experiences without overexplaining.
        If there is uncertainty or a safety concern, say so plainly.
        Keep the answer practical and concise.
      `;

    case 'guided_reflection':
      return `
        The user is in a reflection, trigger, reinforcement, or preparation track.
        Help them organize what matters, name the pattern, and surface a useful next step.
        Favor containment, clarity, and session-ready language.
        Do not over-interpret or try to do full therapy.
      `;

    case 'open_conversation':
    default:
      return `
        The user wants open conversation.
        Start by clarifying the core issue if needed.
        Keep the response human, steady, and useful.
        Offer one clear next step or question rather than several.
      `;
  }
}

function buildChatSystemInstruction(
  intent: SupportIntent,
  contextSummary?: string,
  knowledgeContext?: string,
  guidanceContext?: string,
) {
  return `
    ${SYSTEM_PROMPT_BASE}
    Current Support Intent: ${intent}
    Intent Guidance: ${buildIntentInstruction(intent)}
    ${contextSummary ? `Conversation Memory Summary:\n${contextSummary}` : 'Conversation Memory Summary: None yet.'}
    ${knowledgeContext ? `Retrieved Dr. Kristof Material Context:\n${knowledgeContext}` : 'Retrieved Dr. Kristof Material Context: None for this turn.'}
    ${guidanceContext ? `Curated Guidance Patterns:\n${guidanceContext}` : 'Curated Guidance Patterns: None for this turn.'}

    Guidelines for this response:
    - If curated guidance patterns are present, treat them as high-priority examples for wording, boundaries, and structure.
    - For guidance patterns labeled adapt, preserve the core intent while tailoring to the user's exact situation.
    - If retrieved material context is present, keep the answer consistent with it.
    - If retrieved material context is absent or insufficient, be transparent about uncertainty and avoid making up source claims.
    - Keep it concise and easy to read.
    - Structure the answer as 2-3 short paragraphs by default.
    - Use markdown formatting naturally: use **bold** and *italics* for emphasis, and short lists when they improve clarity.
    - Do not force formatting into every response; keep it human and avoid over-structured output.
    - Never use long dashes (— or –). Use commas, periods, or a simple hyphen (-) instead.
    - Return valid JSON only. No markdown fences. No extra prose outside the JSON.
    - Use this exact shape: {"answer":"string","followUpChips":[{"label":"string","prompt":"string"}]}.
    - The answer should be the assistant reply shown in chat.
    - followUpChips must contain 2 to 4 short, relevant next-turn options based on this specific answer.
    - Labels should be brief and natural. Prompts should be full user turns.
    - Do not use generic filler chips like "Explain more" unless the answer actually explained something.
    - If the answer mainly invites the user to share more, the chips should suggest concrete ways they might continue.
    - If the conversation seems to be reaching a natural conclusion, keep the chips practical and grounded.
  `;
}

function extractJsonObject(raw: string) {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function normalizeGeneratedText(value: string) {
  return value.replace(LONG_DASH_PATTERN, '-');
}

function sanitizeFollowUpChips(value: unknown): FollowUpChip[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<string>();
  const chips: FollowUpChip[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const candidate = item as Record<string, unknown>;
    const label = typeof candidate.label === 'string' ? normalizeGeneratedText(candidate.label).trim() : '';
    const prompt = typeof candidate.prompt === 'string' ? normalizeGeneratedText(candidate.prompt).trim() : '';

    if (!label || !prompt) {
      continue;
    }

    const key = `${label}::${prompt}`.toLowerCase();

    if (unique.has(key)) {
      continue;
    }

    unique.add(key);
    chips.push({
      label: label.slice(0, 48),
      prompt: prompt.slice(0, 180),
    });

    if (chips.length === 4) {
      break;
    }
  }

  return chips;
}

function parseChatCompletion(raw: string): ChatCompletionPayload {
  try {
    const parsed = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>;
    const text = typeof parsed.answer === 'string' ? normalizeGeneratedText(parsed.answer).trim() : '';

    if (!text) {
      throw new Error('Missing answer field.');
    }

    return {
      text,
      followUpChips: sanitizeFollowUpChips(parsed.followUpChips),
    };
  } catch {
    return {
      text: normalizeGeneratedText(raw || "I'm sorry, I couldn't generate a response. Please try again."),
      followUpChips: [],
    };
  }
}

export async function generateChatResponse(payload: ChatPayload) {
  assertValidMode(payload.mode);
  assertValidHistory(payload.history);

  if (!payload.userInput?.trim()) {
    throw new RequestError('Request userInput is required.', 400);
  }

  const supportIntent = resolveSupportIntent(payload.mode, payload.userInput);
  const debugEnabled = isRagDebugEnabled(payload.debugRag);
  const guidanceResolution = await resolveGuidanceForTurn({
    mode: payload.mode,
    userInput: payload.userInput,
  });

  if (guidanceResolution.verbatimResponse) {
    const baseResponse: ChatCompletionPayload = {
      text: normalizeGeneratedText(guidanceResolution.verbatimResponse.text),
      followUpChips: sanitizeFollowUpChips(guidanceResolution.verbatimResponse.followUpChips),
    };

    if (!debugEnabled) {
      return baseResponse;
    }

    return {
      ...baseResponse,
      ragDebug: {
        mode: payload.mode,
        supportIntent,
        usedVerbatimGuidance: true,
        guidanceMatchId: guidanceResolution.verbatimResponse.matchId,
        guidanceMatchScore: guidanceResolution.verbatimResponse.score,
        guidanceContextApplied: false,
        knowledgeItems: [],
        knowledgeContextPreview: '',
      },
    };
  }

  const retrievedKnowledge = await retrieveKnowledgeContext({
    mode: payload.mode,
    userInput: payload.userInput,
    contextSummary: payload.contextSummary,
  });
  const knowledgeContext = formatKnowledgeContext(retrievedKnowledge);

  const { text } = await generateText({
    model: getGatewayModel(),
    system: buildChatSystemInstruction(
      supportIntent,
      payload.contextSummary,
      knowledgeContext,
      guidanceResolution.guidanceContext,
    ),
    messages: toModelMessages(payload.history, payload.userInput),
    temperature: 0.7,
  });

  const completion = parseChatCompletion(text || '');

  if (!debugEnabled) {
    return completion;
  }

  return {
    ...completion,
    ragDebug: {
      mode: payload.mode,
      supportIntent,
      usedVerbatimGuidance: false,
      guidanceContextApplied: Boolean(guidanceResolution.guidanceContext.trim()),
      knowledgeItems: retrievedKnowledge,
      knowledgeContextPreview: knowledgeContext,
    },
  };
}

export async function generateConversationSummary(payload: SummaryPayload) {
  assertValidHistory(payload.history);
  const lastUserMessage = [...payload.history].reverse().find((message) => message.role === 'user')?.content || '';
  const supportIntent = resolveSupportIntent(payload.mode || 'chat', lastUserMessage);

  const { text } = await generateText({
    model: getGatewayModel(),
    system: `
      ${SYSTEM_PROMPT_BASE}
      Task: Summarize the entire conversation, not just the final exchange.
      Current Support Intent: ${supportIntent}
      Goal: Help the user leave with something useful to reflect on or bring to their next session.
      ${payload.contextSummary ? `Earlier Conversation Memory Summary:\n${payload.contextSummary}` : 'Earlier Conversation Memory Summary: None.'}

      Return markdown with exactly these four section headings:
      ## Main Issue
      ## Important Patterns
      ## Useful Takeaway
      ## What To Bring To Session

      Requirements:
      - Base the summary on the whole conversation from beginning to end.
      - Do not focus mainly on the final reply or final question.
      - "Main Issue" should state the central concern or theme in 1-2 sentences.
      - "Important Patterns" should capture 2-4 concise points that came up across the conversation.
      - "Useful Takeaway" should give one grounded takeaway the user can leave with now.
      - "What To Bring To Session" should name concrete material worth bringing to the next session.
      - Keep the tone thoughtful, calm, and specific.
    `,
    messages: toModelMessages(payload.history),
    temperature: 0.5,
  });

  return normalizeGeneratedText(text || 'No summary available.');
}

export async function generateRollingContextSummary(payload: ContextSummaryRequestPayload) {
  assertValidHistory(payload.history);

  const { text } = await generateText({
    model: getGatewayModel(),
    system: `
      ${SYSTEM_PROMPT_BASE}
      Task: Maintain a compact rolling conversation memory summary for future chat turns.
      Goal: Preserve the core issue, important patterns, process questions, emotionally relevant details, and anything worth bringing to session.
      Existing Summary:
      ${payload.existingSummary || 'None yet.'}

      Requirements:
      - Merge the existing summary with the new archived messages.
      - Keep the result under 180 words.
      - Focus on durable context, not sentence-level recap.
      - Mention unresolved questions or themes if they matter.
      - Return plain text only.
    `,
    messages: toModelMessages(payload.history),
    temperature: 0.3,
  });

  return normalizeGeneratedText(text?.trim() || payload.existingSummary || '');
}
