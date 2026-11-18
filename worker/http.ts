/**
 * The API's answers: JSON, never cached, and the server's time on every one. Each also says
 * it is not to be read as anything but what it is, and not to be shown in a page or a frame
 * (the site's own files carry their headers in public/_headers).
 */

/** The headers every answer of the API carries, besides its own. */
export const API_HEADERS: Readonly<Record<string, string>> = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
};

/**
 * The header that carries the server's time in milliseconds since 1970. The game's clock
 * (app/ui/game-clock.ts) reads it in place of `Date`, which is only to the second.
 */
export const SERVER_TIME_HEADER = "x-server-time";

/** A JSON answer made at `now`. A HEAD request gets the same headers and no body. */
export function json(
  body: unknown,
  now: number,
  init: { status?: number; head?: boolean } = {},
): Response {
  return new Response(init.head ? null : JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      ...API_HEADERS,
      "content-type": "application/json; charset=utf-8",
      [SERVER_TIME_HEADER]: String(Math.round(now)),
    },
  });
}

/** An error, as `{ "error": code }`. */
export function failure(code: string, status: number, now: number): Response {
  return json({ error: code }, now, { status });
}

/** The answer to a method the address does not take, or null if it takes this one. */
export function wrongMethod(
  request: Request,
  allowed: readonly string[],
  now: number,
): Response | null {
  if (allowed.includes(request.method)) return null;
  const response = failure("method_not_allowed", 405, now);
  response.headers.set("allow", allowed.join(", "));
  return response;
}
