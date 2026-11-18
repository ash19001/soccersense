// Where the home screen's Support pop-up sends people (Support in ~/ui, opened by the heart
// button beside the day). One place to change them.
//
// "Send us an idea" is an email to the game's own address, written by the player's own
// mail app with its subject and a first line filled in (`mailLink`; the product owner,
// 2026-11-18: "just opens email sending email to us with prefilled data"). No form and no
// other company: what is sent goes from the player's mail to ours.
//
// "Buy us a coffee" is the game's Ko-fi page (the product owner, 2026-11-18): tips go
// through Ko-fi, not Paddle, which takes no donations; Paddle is for membership. A link
// set to a placeholder (example.com and the like) makes its button say "Coming soon".

/** Where "Send us an idea" goes: the game's address (the privacy notice's contact too). */
export const IDEAS_EMAIL = "info@soccersense.io";

/** Where "Buy us a coffee" goes: the game's tipping page, on Ko-fi. */
export const COFFEE_URL = "https://ko-fi.com/soccersense";

/** A `mailto:` link to `to`, its subject and its body filled in. */
export function mailLink(to: string, subject: string, body: string): string {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Hosts that are only ever placeholders (RFC 2606 and RFC 6761). */
const PLACEHOLDER_HOSTS = ["example.com", "example.org", "example.net"];
const PLACEHOLDER_ENDINGS = [".example", ".invalid", ".test", ".localhost"];

/**
 * The link, if it is a real one a button can open: an `https:` or `http:` page, or a
 * `mailto:` address, that is not a placeholder. Anything else (empty, a placeholder, a
 * `javascript:` address, not an address at all) is null, and its button says "Coming soon".
 */
export function usableLink(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol === "mailto:") {
    const at = parsed.pathname.lastIndexOf("@");
    if (at <= 0) return null;
    return isPlaceholderHost(parsed.pathname.slice(at + 1))
      ? null
      : parsed.href;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  return isPlaceholderHost(parsed.hostname) ? null : parsed.href;
}

function isPlaceholderHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (h === "") return true;
  if (PLACEHOLDER_HOSTS.some((p) => h === p || h.endsWith(`.${p}`))) {
    return true;
  }
  return PLACEHOLDER_ENDINGS.some((e) => h.endsWith(e) || h === e.slice(1));
}
