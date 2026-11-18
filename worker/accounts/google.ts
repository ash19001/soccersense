/**
 * Signing in with Google ("Sign in with Google", OpenID Connect's code flow).
 *
 * 1. The page sends the browser to `/api/account/google`. The Worker makes two random
 *    values, a `state` and a `verifier`, keeps them in a short-lived cookie on that browser
 *    and sends it on to Google with the state and the verifier's hash (PKCE).
 * 2. The person picks their Google account. Google sends the browser back to
 *    `/api/account/google/callback` with a one-time `code` and the state.
 * 3. The Worker checks the state against the cookie (so the way back belongs to the trip
 *    this browser started), then swaps the code, with the verifier and the client's secret,
 *    for who the person is. That answer comes straight from Google to the Worker over
 *    HTTPS, never through the browser, so it is Google's word.
 *
 * All that is asked of Google is the person's id there and their email address
 * (`openid email`): no name, no picture, no contacts. An address Google has not verified
 * is not taken.
 *
 * The client's id and secret are the product owner's, put in Cloudflare as the secrets
 * `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The address Google is to send people back
 * to has to be listed on that client: `https://soccersense.io/api/account/google/callback`.
 */

import { checkEmail } from "~/game/account";

import type { Env, Outside } from "../env";
import { hashOf, randomToken, textFromBase64Url } from "./tokens";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
/** Who a token of Google's says it is from. */
const ISSUERS: readonly unknown[] = [
  "https://accounts.google.com",
  "accounts.google.com",
];

type GoogleEnv = Pick<Env, "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET">;

/** Whether signing in with Google is set up: the client's id and secret are both there. */
export const googleReady = (env: GoogleEnv): boolean =>
  (env.GOOGLE_CLIENT_ID ?? "").length > 0 &&
  (env.GOOGLE_CLIENT_SECRET ?? "").length > 0;

/** The start of a trip to Google: where to send the browser, and what it carries (`state.verifier`). */
export async function googleStart(
  env: GoogleEnv,
  redirectUri: string,
): Promise<{ url: string; trip: string }> {
  const state = randomToken();
  const verifier = randomToken();
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", await hashOf(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  // Always ask which Google account: a shared computer may be signed in to someone else's.
  url.searchParams.set("prompt", "select_account");
  return { url: url.href, trip: `${state}.${verifier}` };
}

/** The two halves of what the browser carried, or null if it is not a trip of ours. */
export function tripParts(
  trip: string | null,
): { state: string; verifier: string } | null {
  const [state, verifier, ...rest] = (trip ?? "").split(".");
  if (!state || !verifier || rest.length > 0) return null;
  return { state, verifier };
}

export interface GooglePerson {
  /** Google's id for the person: it stays the same if their address changes. */
  id: string;
  email: string;
}

/**
 * Swaps the code Google sent back for who the person is. Null if Google will not swap it,
 * or says anything but: this is for our client, it has not run out, and the address is
 * verified.
 */
export async function googlePerson(
  env: GoogleEnv,
  code: string,
  verifier: string,
  redirectUri: string,
  now: number,
  outside: Outside,
): Promise<GooglePerson | null> {
  let said: unknown;
  try {
    const response = await outside(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID ?? "",
        client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }).toString(),
    });
    if (!response.ok) return null;
    said = await response.json();
  } catch {
    return null;
  }
  const idToken =
    typeof said === "object" && said !== null
      ? (said as Record<string, unknown>).id_token
      : undefined;
  if (typeof idToken !== "string") return null;
  // The token came straight from Google over HTTPS in answer to our secret, so what it
  // says is read without checking its signature (as Google's own guide allows).
  const payload = textFromBase64Url(idToken.split(".")[1] ?? "");
  if (payload === null) return null;
  let claims: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed !== "object" || parsed === null) return null;
    claims = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const email = checkEmail(claims.email);
  const verified =
    claims.email_verified === true || claims.email_verified === "true";
  if (
    !ISSUERS.includes(claims.iss) ||
    claims.aud !== env.GOOGLE_CLIENT_ID ||
    typeof claims.exp !== "number" ||
    claims.exp * 1000 <= now ||
    typeof claims.sub !== "string" ||
    claims.sub === "" ||
    !email.ok ||
    !verified
  ) {
    return null;
  }
  return { id: claims.sub, email: email.email };
}
