/**
 * The one email the game sends: a sign-in link, to someone who has just asked for it.
 *
 * It goes through Resend (resend.com), with the key the product owner puts in Cloudflare as
 * the secret `RESEND_API_KEY`, from the address in the setting `MAIL_FROM` (wrangler.jsonc;
 * its domain has to be verified in Resend). Without the key no email can be sent: on the
 * live site that way of signing in is then off; on a developer's own machine the link is
 * written to the Worker's log in the email's place (`pnpm api` prints it), so signing in
 * can be tried with nothing set up.
 *
 * The words of the email are here, not in app/i18n: they are the server's, and never part
 * of the page.
 */

import type { Env, Outside } from "../env";
import { LINK_LIFE_MS } from "./store";

export const RESEND_URL = "https://api.resend.com/emails";
/** Who the email is from, unless `MAIL_FROM` says otherwise. */
export const DEFAULT_FROM = "soccersense <signin@soccersense.io>";
/** Where a reply to it goes: the game's own address (the product owner, 2026-11-18). */
export const REPLY_TO = "info@soccersense.io";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Whether emails can be sent: the key is set. */
export const mailReady = (env: Pick<Env, "RESEND_API_KEY">): boolean =>
  (env.RESEND_API_KEY ?? "").length > 0;

const escape = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** The sign-in email for an address: the link, how long it works, and what to do if it was not asked for. */
export function signInMail(to: string, link: string): Mail {
  const minutes = Math.round(LINK_LIFE_MS / 60_000);
  const lasts = `The link works once, for ${minutes} minutes.`;
  const notYou =
    "If you didn't ask for it, ignore this email: nobody can sign in without the link.";
  const href = escape(link);
  return {
    to,
    subject: "Your soccersense sign-in link",
    text: ["Sign in to soccersense:", "", link, "", lasts, notYou, ""].join(
      "\n",
    ),
    html: [
      '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:16px;line-height:1.5;color:#14182b">',
      '<p style="margin:0 0 16px">Sign in to <strong>soccersense</strong>:</p>',
      `<p style="margin:0 0 16px"><a href="${href}" style="display:inline-block;padding:12px 20px;background:#e8452c;color:#ffffff;font-weight:bold;text-decoration:none;border-radius:4px">SIGN IN</a></p>`,
      `<p style="margin:0 0 16px;font-size:14px">Or paste this into your browser:<br><a href="${href}" style="color:#1a56c4;word-break:break-all">${href}</a></p>`,
      `<p style="margin:0;font-size:14px;color:#555b70">${lasts} ${notYou}</p>`,
      "</div>",
    ].join(""),
  };
}

/**
 * Sends an email through Resend. True once Resend has taken it; false if there is no key
 * or Resend would not take it (its limit is reached, the sending domain is not verified).
 */
export async function sendMail(
  env: Pick<Env, "RESEND_API_KEY" | "MAIL_FROM">,
  mail: Mail,
  outside: Outside,
): Promise<boolean> {
  if (!mailReady(env)) return false;
  try {
    const response = await outside(RESEND_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
        // Resend turns away requests that do not say what is calling.
        "user-agent": "soccersense",
      },
      body: JSON.stringify({
        from: (env.MAIL_FROM ?? "").trim() || DEFAULT_FROM,
        to: [mail.to],
        reply_to: REPLY_TO,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
