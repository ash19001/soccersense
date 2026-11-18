/**
 * Secrets the Worker hands out: the token in a sign-in link, the token in a session's
 * cookie, the values that tie a trip to Google back to the browser that started it.
 *
 * Each is 32 random bytes, so it cannot be guessed. The database never holds one: it holds
 * the token's SHA-256 (`hashOf`), so whoever reads the database cannot sign in with what
 * they find there.
 */

const encoder = new TextEncoder();

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** The text a base64url string holds, or null if it is not one. */
export function textFromBase64Url(text: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** A new secret: 32 random bytes, as 43 characters that are safe in a link or a cookie. */
export function randomToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

/** What a token of ours looks like: anything else is not looked up. */
export function isToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

/** SHA-256 of a text, as base64url: what is kept in a token's place. */
export async function hashOf(text: string): Promise<string> {
  return toBase64Url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text))),
  );
}
