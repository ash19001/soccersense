// Where the home screen's Support pop-up sends people (Support in ~/ui, opened by the heart
// button beside the day). One place to change them.
//
// PLACEHOLDERS: both addresses below are on example.com, a domain reserved for examples
// that never belongs to anyone. The product owner replaces them with the real pages (an
// ideas form, a "buy me a coffee" page; a mailto: address works for ideas too). Until a
// link is replaced, its button in the pop-up says "Coming soon" and cannot be pressed.

/** Where "Send us an idea" goes: a form, a page or a `mailto:` address. */
export const IDEAS_URL = "https://example.com/soccersense/ideas";

/** Where "Buy us a coffee" goes: a tipping page. */
export const COFFEE_URL = "https://example.com/soccersense/coffee";

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
