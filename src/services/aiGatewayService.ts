import { FollowUpChip, Message, Mode, type RagDebugInfo } from '../types';
import { getAccessHeaders } from '../lib/access';

interface TextResponse {
  text?: string;
  followUpChips?: FollowUpChip[];
  ragDebug?: RagDebugInfo;
  error?: string;
  model?: string;
}

export interface ChatCompletion {
  text: string;
  followUpChips: FollowUpChip[];
  ragDebug?: RagDebugInfo;
}

function isRagDebugRequested() {
  if (typeof window === 'undefined') {
    return false;
  }

  const queryDebug = new URLSearchParams(window.location.search).get('ragDebug');

  if (queryDebug === '1' || queryDebug === 'true') {
    return true;
  }

  return window.localStorage.getItem('askdrk_rag_debug') === 'true';
}

async function postJson(url: string, payload: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAccessHeaders(),
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as TextResponse;

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}.`);
  }

  return data;
}

export async function generateResponse(
  mode: Mode,
  history: Message[],
  userInput: string,
  contextSummary?: string,
): Promise<ChatCompletion> {
  try {
    const data = await postJson('/api/chat', {
      mode,
      history,
      userInput,
      contextSummary,
      debugRag: isRagDebugRequested(),
    });

    return {
      text: data.text || "I'm sorry, I couldn't generate a response. Please try again.",
      followUpChips: Array.isArray(data.followUpChips) ? data.followUpChips : [],
      ragDebug: data.ragDebug,
    };
  } catch (error) {
    console.error('AI Gateway chat error:', error);

    if (error instanceof Error) {
      return {
        text: error.message,
        followUpChips: [],
        ragDebug: undefined,
      };
    }

    return {
      text: 'I am experiencing a technical difficulty. Please take a breath and try again in a moment.',
      followUpChips: [],
      ragDebug: undefined,
    };
  }
}

export async function generateSummary(history: Message[], mode?: Mode, contextSummary?: string): Promise<string> {
  try {
    const data = await postJson('/api/summary', { history, mode, contextSummary });
    return data.text || 'No summary available.';
  } catch (error) {
    console.error('AI Gateway summary error:', error);

    if (error instanceof Error) {
      return error.message;
    }

    return 'Summary unavailable.';
  }
}

export async function generateContextSummary(
  history: Message[],
  mode?: Mode,
  existingSummary?: string,
): Promise<string> {
  try {
    const data = await postJson('/api/context-summary', {
      history,
      mode,
      existingSummary,
    });

    return data.text || existingSummary || '';
  } catch (error) {
    console.error('AI Gateway context summary error:', error);
    return existingSummary || '';
  }
}
