/**
 * The bot check on asking for a sign-in link: Cloudflare Turnstile.
 *
 * The page shows Turnstile's widget (app/ui/BotCheck.tsx), which decides in the browser,
 * mostly without asking anything of the person, that a person is there, and hands the page
 * a token. The page sends the token with its request for a link; the Worker asks Turnstile
 * whether the token is good (`siteverify`), and sends no link if it is not. A token works
 * once, for five minutes.
 *
 * The widget's site key, `TURNSTILE_SITE_KEY`, is not a secret (every page that shows the
 * check has it): it is in wrangler.jsonc. Its secret key, `TURNSTILE_SECRET_KEY`, is the
 * product owner's, set in Cloudflare as a secret. Without both there is no check: asking
 * for a link is held back only by the limits in ./api.ts.
 */

import type { Env, Outside } from "../env";

export const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
/** The longest token Turnstile makes. */
export const MAX_CHECK_TOKEN = 2048;

type CheckEnv = Pick<Env, "TURNSTILE_SITE_KEY" | "TURNSTILE_SECRET_KEY">;

/** The site key the page shows the check with, or null where there is no check. */
export function checkSiteKey(env: CheckEnv): string | null {
  const site = env.TURNSTILE_SITE_KEY ?? "";
  const secret = env.TURNSTILE_SECRET_KEY ?? "";
  return site !== "" && secret !== "" ? site : null;
}

/**
 * Whether Turnstile says the token is good: made for this widget, not used before, not run
 * out. Anything else, Turnstile not answering included, is no.
 */
export async function passesCheck(
  env: CheckEnv,
  token: unknown,
  ip: string | null,
  outside: Outside,
): Promise<boolean> {
  if (typeof token !== "string" || token === "") return false;
  if (token.length > MAX_CHECK_TOKEN) return false;
  try {
    const response = await outside(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY ?? "",
        response: token,
        ...(ip !== null && { remoteip: ip }),
      }),
    });
    if (!response.ok) return false;
    const said: unknown = await response.json();
    return (
      typeof said === "object" &&
      said !== null &&
      (said as Record<string, unknown>).success === true
    );
  } catch {
    return false;
  }
}
