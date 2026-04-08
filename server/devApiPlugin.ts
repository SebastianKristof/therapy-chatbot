import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import {
  normalizeGatewayError,
  RequestError,
  generateChatResponse,
  generateConversationSummary,
  getConfiguredModel,
} from './askDrKristofService.js';

async function readJsonBody(request: IncomingMessage) {
  const chunks: Uint8Array[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

export function devApiPlugin(): Plugin {
  return {
    name: 'ask-dr-kristof-dev-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.method !== 'POST' || !request.url) {
          return next();
        }

        const pathname = request.url.split('?')[0];

        try {
          if (pathname === '/api/chat') {
            const body = await readJsonBody(request);
            const text = await generateChatResponse(body);
            sendJson(response, 200, { text, model: getConfiguredModel() });
            return;
          }

          if (pathname === '/api/summary') {
            const body = await readJsonBody(request);
            const text = await generateConversationSummary(body);
            sendJson(response, 200, { text, model: getConfiguredModel() });
            return;
          }

          next();
        } catch (error) {
          if (error instanceof SyntaxError) {
            sendJson(response, 400, { error: 'Request body must be valid JSON.' });
            return;
          }

          const normalizedError = normalizeGatewayError(error);
          if (normalizedError) {
            sendJson(response, normalizedError.status, { error: normalizedError.message });
            return;
          }

          if (error instanceof RequestError) {
            sendJson(response, error.status, { error: error.message });
            return;
          }

          next(error as Error);
        }
      });
    },
  };
}
