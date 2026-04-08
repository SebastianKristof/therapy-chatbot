import { Message, Mode } from '../types';

interface TextResponse {
  text?: string;
  error?: string;
  model?: string;
}

async function postJson(url: string, payload: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
  userInput: string
): Promise<string> {
  try {
    const data = await postJson('/api/chat', {
      mode,
      history,
      userInput,
    });

    return data.text || "I'm sorry, I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error('AI Gateway chat error:', error);

    if (error instanceof Error) {
      return error.message;
    }

    return 'I am experiencing a technical difficulty. Please take a breath and try again in a moment.';
  }
}

export async function generateSummary(history: Message[]): Promise<string> {
  try {
    const data = await postJson('/api/summary', { history });
    return data.text || 'No summary available.';
  } catch (error) {
    console.error('AI Gateway summary error:', error);

    if (error instanceof Error) {
      return error.message;
    }

    return 'Summary unavailable.';
  }
}
