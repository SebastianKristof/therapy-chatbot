import { createGateway, generateText, type ModelMessage } from 'ai';
import { APICallError } from '@ai-sdk/provider';
import { getModeDefinition, SYSTEM_PROMPT_BASE } from '../src/config/modeDefinitions.js';
import type { Message, Mode } from '../src/types.js';

const DEFAULT_GATEWAY_MODEL = 'google/gemini-3-flash';
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
}

export interface SummaryPayload {
  history: Message[];
}

export function getConfiguredModel() {
  return process.env.AI_GATEWAY_MODEL?.trim() || DEFAULT_GATEWAY_MODEL;
}

function getGatewayModel() {
  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();

  if (!apiKey) {
    throw new RequestError(
      'AI Gateway is not configured. Add AI_GATEWAY_API_KEY to your environment before sending requests.',
      500,
    );
  }

  return createGateway({ apiKey })(getConfiguredModel());
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

function buildChatSystemInstruction(mode: Mode) {
  const modeDefinition = getModeDefinition(mode);
  const modeInstruction =
    modeDefinition?.systemInstruction || 'You are a supportive AI companion.';

  return `
    ${SYSTEM_PROMPT_BASE}
    Current Mode: ${modeDefinition?.title || 'Chat'}
    Mode Specific Instruction: ${modeInstruction}

    Guidelines for this response:
    - Keep it concise and easy to read.
    - Ask a clear, gentle follow-up question if appropriate.
    - If the conversation seems to be reaching a natural conclusion, provide a short "Useful Takeaway" or "Reflection Summary".
  `;
}

export async function generateChatResponse(payload: ChatPayload) {
  assertValidMode(payload.mode);
  assertValidHistory(payload.history);

  if (!payload.userInput?.trim()) {
    throw new RequestError('Request userInput is required.', 400);
  }

  const { text } = await generateText({
    model: getGatewayModel(),
    system: buildChatSystemInstruction(payload.mode),
    messages: toModelMessages(payload.history, payload.userInput),
    temperature: 0.7,
  });

  return text || "I'm sorry, I couldn't generate a response. Please try again.";
}

export async function generateConversationSummary(payload: SummaryPayload) {
  assertValidHistory(payload.history);

  const { text } = await generateText({
    model: getGatewayModel(),
    system: `
      ${SYSTEM_PROMPT_BASE}
      Task: Summarize the key insights, takeaways, or themes from this conversation.
      Format: A short, thoughtful list of 2-3 points.
      Goal: Help the user leave with something useful to reflect on or bring to their next session.
    `,
    messages: toModelMessages(payload.history),
    temperature: 0.5,
  });

  return text || 'No summary available.';
}
