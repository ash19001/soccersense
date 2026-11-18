/**
 * What each page tells search engines and link previews about itself.
 *
 *   export const meta = () => pageMeta({ path: "/how-to-play", title, description });
 *
 *   pageMeta(page)     a page's tags: its title and description, and the same for a
 *                      link's preview (Open Graph, which chats, feeds and X all read)
 *   siteData()         the home page's structured data: the site and the game, by name
 *   fallbackMeta()     the tags of the page served for an address that is not a page
 *   PAGES              every page a search engine should list
 *   robotsTxt()        the text of public/robots.txt
 *   sitemapXml()       the text of public/sitemap.xml
 *   socialCardWords()  what the link preview's picture says
 *
 * THE ONE SETTING IS `SITE_URL`, the address the site is served at. A preview's picture, a
 * page's address of record (its canonical link) and a sitemap must all be written out in
 * full, "https://..." and all: a link's preview is fetched by a server that does not run
 * the page, so nothing here can be worked out in the browser. Until the address is set,
 * everything that needs it is left out, and nothing false is said in its place. Once it is
 * set, run `pnpm seo` to write the sitemap (tools/seo.ts); a test fails until that is done.
 *
 * Pure: every word comes from the interface text, and nothing here reads the address bar.
 */

import type { MetaDescriptor } from "react-router";

import { MODES, playPath } from "~/game";
import { strings } from "~/i18n";
import type { SocialCardWords } from "~/scenes/social-card";

/**
 * The address the site is served at: "https://" and the host, with nothing after it (no
 * path, no closing slash). Empty until the site has one.
 */
export const SITE_URL = "https://soccersense.io" as string;

/** The link preview's picture: where it is served, and its size (scenes/social-card.ts). */
export const SOCIAL_IMAGE = Object.freeze({
  path: "/social-card.png",
  type: "image/png",
  width: 1200,
  height: 630,
});

/**
 * Every page a search engine should list, by the address it is known by: the home page, a
 * page for each mode and the rules. Not the development pages (/dev/..., which ask not to
 * be indexed), and not /play/nextgen, a second address of NEXT-GEN's page.
 */
export const PAGES: readonly string[] = Object.freeze([
  "/",
  ...MODES.map(playPath),
  "/how-to-play",
  "/privacy",
  "/terms",
]);

/** A page, as it describes itself. */
export interface PageInfo {
  /**
   * The address the page is known by, from the site's root: "/", "/play/next-gen". A page
   * reached at a second address gives the first one here, and search engines file both
   * under it.
   */
  path: string;
  /** The tab's title, and the heading of a search result or a link's preview. */
  title: string;
  /** The lines under that heading: what the page is, in a sentence or two. */
  description: string;
}

/** `path` in full, on `site`: "https://example.com/play/home". */
function address(site: string, path: string): string {
  return `${site}${path}`;
}

/**
 * A page's tags. Always: its title and description, leave to index it and to show its
 * picture large, and the same title and description for a link's preview. With the site's
 * address set: the page's address of record as well, and the preview's picture.
 */
export function pageMeta(
  page: PageInfo,
  site: string = SITE_URL,
): MetaDescriptor[] {
  const tags: MetaDescriptor[] = [
    { title: page.title },
    { name: "description", content: page.description },
    { name: "robots", content: "index, follow, max-image-preview:large" },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: strings.siteName },
    { property: "og:locale", content: "en_GB" },
    { property: "og:title", content: page.title },
    { property: "og:description", content: page.description },
  ];
  if (site === "") {
    // No picture to point at: the small card, with the words alone.
    tags.push({ name: "twitter:card", content: "summary" });
    return tags;
  }
  const url = address(site, page.path);
  tags.push(
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:url", content: url },
    { property: "og:image", content: address(site, SOCIAL_IMAGE.path) },
    { property: "og:image:type", content: SOCIAL_IMAGE.type },
    { property: "og:image:width", content: String(SOCIAL_IMAGE.width) },
    { property: "og:image:height", content: String(SOCIAL_IMAGE.height) },
    { property: "og:image:alt", content: strings.seo.cardAlt },
    { name: "twitter:card", content: "summary_large_image" },
  );
  return tags;
}

/**
 * The tags of a page that has none of its own: the one document served for every address
 * that is not a page (build/client/__spa-fallback.html), which says "not found" once its
 * script runs, and the error page. A static host answers such an address "200 OK", so
 * without this a search engine could list any mistyped address as a page of the site. It
 * asks not to be indexed, and gives no description and no preview.
 */
export function fallbackMeta(): MetaDescriptor[] {
  return [
    { title: `${strings.errors.title} · ${strings.siteName}` },
    { name: "robots", content: "noindex" },
  ];
}

/**
 * The home page's structured data (schema.org, as JSON-LD): the site by its name, which is
 * what a search engine shows as the site's name, and the game as a game. Nothing is claimed
 * that the page does not show: no ratings, no price list. Empty until the site's address is
 * set, for every entry is known by its address.
 */
export function siteData(site: string = SITE_URL): MetaDescriptor[] {
  if (site === "") return [];
  const home = address(site, "/");
  return [
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebSite",
            "@id": `${home}#website`,
            url: home,
            name: strings.siteName,
            description: strings.home.description,
            inLanguage: "en",
          },
          {
            "@type": "VideoGame",
            "@id": `${home}#game`,
            url: home,
            name: strings.siteName,
            description: strings.home.description,
            image: address(site, SOCIAL_IMAGE.path),
            genre: strings.seo.genre,
            gamePlatform: strings.seo.platform,
            applicationCategory: "Game",
            operatingSystem: "Any",
            inLanguage: "en",
            isAccessibleForFree: true,
          },
        ],
      },
    },
  ];
}

/**
 * public/robots.txt: every page may be crawled. The development pages are not shut out
 * here: each asks not to be indexed (a "noindex" tag), and a crawler that is not let in
 * never reads that. With the site's address set, it also says where the sitemap is.
 */
export function robotsTxt(site: string = SITE_URL): string {
  const lines = [
    "# Written by `pnpm seo` (tools/seo.ts) from app/routes/seo.ts. Do not edit by hand.",
    "User-agent: *",
    "Allow: /",
  ];
  if (site !== "") lines.push("", `Sitemap: ${address(site, "/sitemap.xml")}`);
  return `${lines.join("\n")}\n`;
}

/**
 * public/sitemap.xml: `PAGES`, each in full. Null until the site's address is set: a
 * sitemap of addresses that are not whole is not one.
 */
export function sitemapXml(site: string = SITE_URL): string | null {
  if (site === "") return null;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<!-- Written by `pnpm seo` (tools/seo.ts) from app/routes/seo.ts. Do not edit by hand. -->",
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...PAGES.map((path) => `  <url><loc>${address(site, path)}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");
}

/** What the link preview's picture says: the home screen's words, and its airship's sign. */
export function socialCardWords(): SocialCardWords {
  return { labels: strings.home.canvas, sign: strings.seo.cardSign };
}
