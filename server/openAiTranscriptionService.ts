import { RequestError } from './askDrKristofService.js';

const DEFAULT_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';

export interface TranscriptionPayload {
  audioDataUrl: string;
  fileName?: string;
  language?: string;
  mimeType?: string;
}

function readConfiguredValue(value: string | undefined) {
  const normalized = value?.trim();

  if (!normalized || normalized.toLowerCase() === 'undefined' || normalized.toLowerCase() === 'null') {
    return undefined;
  }

  return normalized;
}

export function getConfiguredTranscriptionModel() {
  return readConfiguredValue(process.env.OPENAI_TRANSCRIPTION_MODEL) || DEFAULT_TRANSCRIPTION_MODEL;
}

function getOpenAIApiKey() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new RequestError(
      'OpenAI voice input is not configured. Add OPENAI_API_KEY to your environment before recording audio.',
      500,
    );
  }

  return apiKey;
}

function parseAudioDataUrl(audioDataUrl: string) {
  const match = audioDataUrl.match(/^data:([^,]+);base64,(.+)$/);

  if (!match) {
    throw new RequestError('Audio payload is invalid.', 400);
  }

  return {
    mimeType: match[1],
    base64: match[2],
  };
}

function extractOpenAIErrorMessage(rawBody: string) {
  try {
    const parsed = JSON.parse(rawBody) as { error?: { message?: string }; message?: string };
    return parsed.error?.message || parsed.message || rawBody;
  } catch {
    return rawBody;
  }
}

export async function transcribeAudio(payload: TranscriptionPayload) {
  const audioDataUrl = payload.audioDataUrl?.trim();

  if (!audioDataUrl) {
    throw new RequestError('Audio payload is required.', 400);
  }

  const { mimeType: dataUrlMimeType, base64 } = parseAudioDataUrl(audioDataUrl);
  const audioBuffer = Buffer.from(base64, 'base64');
  const resolvedMimeType = readConfiguredValue(payload.mimeType) || dataUrlMimeType || 'audio/webm';
  const fileName = payload.fileName?.trim() || 'voice-note.webm';
  const apiKey = getOpenAIApiKey();

  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: resolvedMimeType }), fileName);
  formData.append('model', getConfiguredTranscriptionModel());

  if (payload.language?.trim()) {
    formData.append('language', payload.language.trim());
  }

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const rawBody = await response.text();

  if (!response.ok) {
    const message = extractOpenAIErrorMessage(rawBody);

    if (response.status === 401 || response.status === 403) {
      throw new RequestError(
        `OpenAI rejected the transcription request. Verify OPENAI_API_KEY in your environment. (${message})`,
        502,
      );
    }

    if (response.status === 429) {
      throw new RequestError('OpenAI is rate-limited right now. Please try recording again shortly.', 503);
    }

    if (response.status >= 500) {
      throw new RequestError('OpenAI transcription is temporarily unavailable. Please try again shortly.', 503);
    }

    throw new RequestError(`OpenAI transcription failed. (${message})`, 502);
  }

  try {
    const data = JSON.parse(rawBody) as { text?: string };
    const text = data.text?.trim();

    if (!text) {
      throw new RequestError('OpenAI returned an empty transcription.', 502);
    }

    return text;
  } catch (error) {
    if (error instanceof RequestError) {
      throw error;
    }

    throw new RequestError('OpenAI transcription response was invalid.', 502);
  }
}
