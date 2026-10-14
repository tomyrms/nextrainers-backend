// Shared response helpers. Permissive CORS so any local frontend can call this API.
const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization,cache-control",
  "access-control-max-age": "86400",
};

export function json(data: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(data ?? null), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}

export function empty(status = 204): Response {
  return new Response(null, { status, headers: CORS });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
