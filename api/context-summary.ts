import {
  normalizeGatewayError,
  RequestError,
  generateRollingContextSummary,
  getConfiguredModel,
} from '../server/askDrKristofService.js';
import { assertAuthorizedRequest } from '../server/accessControl.js';

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
    assertAuthorizedRequest(request.headers);
    const body = await request.json();
    const text = await generateRollingContextSummary(body);

    return json(200, {
      text,
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

    console.error('AI Gateway context summary error:', error);
    return json(500, {
      error: 'The server could not update the conversation memory.',
    });
  }
}
