import {
  normalizeGatewayError,
  RequestError,
  generateChatResponse,
  getConfiguredModel,
} from '../server/askDrKristofService.js';

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
    const completion = await generateChatResponse(body);

    return json(200, {
      text: completion.text,
      followUpChips: completion.followUpChips,
      model: getConfiguredModel(),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return json(400, { error: 'Request body must be valid JSON.' });
    }

    const normalizedError = normalizeGatewayError(error);
    if (normalizedError) {
      return json(normalizedError.status, { error: normalizedError.message });
    }

    if (error instanceof RequestError) {
      return json(error.status, { error: error.message });
    }

    console.error('AI Gateway chat error:', error);
    return json(500, {
      error: 'The server could not generate a response.',
    });
  }
}
