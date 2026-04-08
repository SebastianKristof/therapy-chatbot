import { getAccessHeaders } from '../lib/access';

interface TranscriptionResponse {
  error?: string;
  model?: string;
  text?: string;
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

  const data = (await response.json().catch(() => ({}))) as TranscriptionResponse;

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}.`);
  }

  return data;
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Failed to read the recorded audio.'));
    };

    reader.onerror = () => {
      reject(new Error('Failed to read the recorded audio.'));
    };

    reader.readAsDataURL(blob);
  });
}

function inferFileName(mimeType: string) {
  if (mimeType.includes('mp4')) {
    return 'voice-note.m4a';
  }

  if (mimeType.includes('wav')) {
    return 'voice-note.wav';
  }

  if (mimeType.includes('ogg')) {
    return 'voice-note.ogg';
  }

  return 'voice-note.webm';
}

export async function transcribeRecording(blob: Blob): Promise<string> {
  const audioDataUrl = await readBlobAsDataUrl(blob);

  const data = await postJson('/api/transcribe', {
    audioDataUrl,
    fileName: inferFileName(blob.type || 'audio/webm'),
    mimeType: blob.type || 'audio/webm',
  });

  return data.text || '';
}
