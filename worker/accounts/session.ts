/**
 * The cookie that says who is signed in on a device.
 *
 * Only an account has one: a player with no account is given no cookie at all (the product
 * owner, 2026-11-17: nothing is stored about them). It holds a random token (./tokens.ts)
 * and nothing else; the database holds the token's hash, the account it stands for and
 * when it runs out (./store.ts). Scripts on the page cannot read it (`HttpOnly`), it is
 * only sent over HTTPS (`Secure`, and the `__Host-` name, which a browser accepts only
 * from this exact site), and another site's requests do not carry it (`SameSite=Lax`).
 */

/** How long a device stays signed in after it was last renewed: 90 days. */
export const SESSION_LIFE_MS = 90 * 24 * 60 * 60 * 1000;
/** A session with less than this left is given its full life again when the page asks who is signed in. */
export const SESSION_RENEW_MS = SESSION_LIFE_MS / 2;

/** How long a trip to Google may take before the way back is refused: 10 minutes. */
export const GOOGLE_TRIP_MS = 10 * 60 * 1000;

const isSecure = (request: Request): boolean =>
  new URL(request.url).protocol === "https:";

/**
 * A cookie's name for this request: with the `__Host-` prefix on the live site, and plain
 * on a developer's machine, where the Worker is reached over plain HTTP and a browser
 * would refuse the prefix.
 */
const named = (request: Request, name: string): string =>
  isSecure(request) ? `__Host-${name}` : name;

/** The value of one of the request's cookies, or null. */
function cookieOf(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at).trim() === name) {
      return part.slice(at + 1).trim();
    }
  }
  return null;
}

function setCookie(
  request: Request,
  name: string,
  value: string,
  maxAgeMs: number,
): string {
  return [
    `${named(request, name)}=${value}`,
    "Path=/",
    `Max-Age=${Math.max(0, Math.round(maxAgeMs / 1000))}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(isSecure(request) ? ["Secure"] : []),
  ].join("; ");
}

const SESSION = "ss";
const GOOGLE = "ss-google";

/** The session token the request carries, or null. */
export const sessionToken = (request: Request): string | null =>
  cookieOf(request, named(request, SESSION));

/** The `Set-Cookie` that signs a device in. */
export const sessionCookie = (request: Request, token: string): string =>
  setCookie(request, SESSION, token, SESSION_LIFE_MS);

/** The `Set-Cookie` that signs it out. */
export const noSessionCookie = (request: Request): string =>
  setCookie(request, SESSION, "", 0);

/** What a browser carries to Google and back: `<state>.<verifier>` (./google.ts). */
export const googleTrip = (request: Request): string | null =>
  cookieOf(request, named(request, GOOGLE));

export const googleTripCookie = (request: Request, value: string): string =>
  setCookie(request, GOOGLE, value, GOOGLE_TRIP_MS);

export const noGoogleTripCookie = (request: Request): string =>
  setCookie(request, GOOGLE, "", 0);
