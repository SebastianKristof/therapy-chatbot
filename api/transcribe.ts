import {
  RequestError,
} from '../server/askDrKristofService.js';
import {
  getConfiguredTranscriptionModel,
  transcribeAudio,
} from '../server/openAiTranscriptionService.js';

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = await transcribeAudio(body);

    return json(200, {
      text,
      model: getConfiguredTranscriptionModel(),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return json(400, { error: 'Request body must be valid JSON.' });
    }

    if (error instanceof RequestError) {
      return json(error.status, { error: error.message });
    }

    console.error('OpenAI transcription error:', error);
    return json(500, {
      error: 'The server could not transcribe the audio.',
    });
  }
}
