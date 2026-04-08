import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { assertAuthorizedRequest, getAccessStatus, readClientAccessHeaders } from './accessControl.js';
import {
  normalizeGatewayError,
  RequestError,
  generateChatResponse,
  generateRollingContextSummary,
  generateConversationSummary,
  getConfiguredModel,
} from './askDrKristofService.js';
import {
  getConfiguredTranscriptionModel,
  transcribeAudio,
} from './openAiTranscriptionService.js';

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
        if (!request.url) {
          return next();
        }

        const pathname = request.url.split('?')[0];

        if (request.method === 'GET' && pathname === '/api/access') {
          const status = getAccessStatus(readClientAccessHeaders(request.headers));
          sendJson(response, status.authorized ? 200 : 401, status);
          return;
        }

        if (request.method !== 'POST') {
          return next();
        }

        try {
          if (pathname === '/api/chat') {
            assertAuthorizedRequest(request.headers);
            const body = await readJsonBody(request);
            const completion = await generateChatResponse(body);
            sendJson(response, 200, {
              text: completion.text,
              followUpChips: completion.followUpChips,
              model: getConfiguredModel(),
            });
            return;
          }

          if (pathname === '/api/summary') {
            assertAuthorizedRequest(request.headers);
            const body = await readJsonBody(request);
            const text = await generateConversationSummary(body);
            sendJson(response, 200, { text, model: getConfiguredModel() });
            return;
          }

          if (pathname === '/api/context-summary') {
            assertAuthorizedRequest(request.headers);
            const body = await readJsonBody(request);
            const text = await generateRollingContextSummary(body);
            sendJson(response, 200, { text, model: getConfiguredModel() });
            return;
          }

          if (pathname === '/api/transcribe') {
            assertAuthorizedRequest(request.headers);
            const body = await readJsonBody(request);
            const text = await transcribeAudio(body);
            sendJson(response, 200, { text, model: getConfiguredTranscriptionModel() });
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
