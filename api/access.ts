import { getAccessStatus, readClientAccessHeaders } from '../server/accessControl.js';

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function GET(request: Request) {
  const status = getAccessStatus(readClientAccessHeaders(request.headers));
  return json(status.authorized ? 200 : 401, status);
}
