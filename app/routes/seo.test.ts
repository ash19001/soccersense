// @vitest-environment node
// What the pages tell search engines and link previews (seo.ts), and the files in public/
// that go with it (robots.txt, sitemap.xml), which `pnpm seo` writes.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { MetaDescriptor } from "react-router";
import { describe, expect, it } from "vitest";

import { MODES, playPath } from "~/game";
import { strings } from "~/i18n";
import { meta as rootMeta } from "../root";
import routes from "../routes";
import { meta as homeMeta } from "./home";
import { meta as rulesMeta } from "./how-to-play";
import { meta as playMeta } from "./play";
import { meta as privacyMeta } from "./privacy";
import { meta as termsMeta } from "./terms";
import {
  PAGES,
  SITE_URL,
  SOCIAL_IMAGE,
  fallbackMeta,
  pageMeta,
  robotsTxt,
  siteData,
  sitemapXml,
} from "./seo";

const SITE = "https://quiz.example";
const PAGE = {
  path: "/how-to-play",
  title: "How to play · soccersense",
  description: "Seven football questions a day.",
};

/** A tag's value, by the name or property it is known by. */
function content(tags: MetaDescriptor[], key: string): string | undefined {
  for (const tag of tags) {
    const t = tag as Record<string, unknown>;
    if (t.name === key || t.property === key) return String(t.content);
  }
  return undefined;
}

/** The page's address of record, if it gives one. */
function canonical(tags: MetaDescriptor[]): string | undefined {
  for (const tag of tags) {
    const t = tag as Record<string, unknown>;
    if (t.tagName === "link" && t.rel === "canonical") return String(t.href);
  }
  return undefined;
}

function title(tags: MetaDescriptor[]): string | undefined {
  for (const tag of tags) {
    const t = tag as Record<string, unknown>;
    if (typeof t.title === "string") return t.title;
  }
  return undefined;
}

/** A route's tags, as the router asks for them. */
function tagsOf(
  meta: (args: never) => MetaDescriptor[] | undefined,
  pathname: string,
): MetaDescriptor[] {
  return meta({ location: { pathname } } as never) ?? [];
}

/** Every page players are sent to, with the tags it gives. */
const PUBLIC: readonly { path: string; tags: MetaDescriptor[] }[] = [
  { path: "/", tags: tagsOf(homeMeta, "/") },
  ...MODES.map((mode) => ({
    path: playPath(mode),
    tags: tagsOf(playMeta, playPath(mode)),
  })),
  { path: "/how-to-play", tags: tagsOf(rulesMeta, "/how-to-play") },
  { path: "/privacy", tags: tagsOf(privacyMeta, "/privacy") },
  { path: "/terms", tags: tagsOf(termsMeta, "/terms") },
];

describe("the site's address", () => {
  it("is not set yet, or is https and a host with nothing after it", () => {
    if (SITE_URL !== "") expect(SITE_URL).toMatch(/^https:\/\/[a-z0-9.-]+$/);
  });
});

describe("a page's tags", () => {
  it("always gives its title and description, to a search and to a link's preview", () => {
    for (const site of ["", SITE]) {
      const tags = pageMeta(PAGE, site);
      expect(tags).toContainEqual({ title: PAGE.title });
      expect(content(tags, "description")).toBe(PAGE.description);
      expect(content(tags, "og:title")).toBe(PAGE.title);
      expect(content(tags, "og:description")).toBe(PAGE.description);
      expect(content(tags, "og:type")).toBe("website");
      expect(content(tags, "og:site_name")).toBe(strings.siteName);
      expect(content(tags, "og:locale")).toBe("en_GB");
      // may be indexed, and its picture shown large
      expect(content(tags, "robots")).toMatch(/^index, follow/);
      expect(content(tags, "robots")).not.toMatch(/noindex/);
    }
  });

  it("says nothing that needs the site's address until it is set", () => {
    const tags = pageMeta(PAGE, "");
    expect(canonical(tags)).toBeUndefined();
    expect(content(tags, "og:url")).toBeUndefined();
    expect(content(tags, "og:image")).toBeUndefined();
    // no picture, so the small card
    expect(content(tags, "twitter:card")).toBe("summary");
    // and no address at all, whole or in part
    expect(JSON.stringify(tags)).not.toMatch(/https?:|social-card/);
  });

  it("with the address set, gives its address of record and the preview's picture, in full", () => {
    const tags = pageMeta(PAGE, SITE);
    expect(canonical(tags)).toBe("https://quiz.example/how-to-play");
    expect(content(tags, "og:url")).toBe("https://quiz.example/how-to-play");
    expect(content(tags, "og:image")).toBe(
      "https://quiz.example/social-card.png",
    );
    expect(content(tags, "og:image:type")).toBe("image/png");
    expect(content(tags, "og:image:width")).toBe("1200");
    expect(content(tags, "og:image:height")).toBe("630");
    expect(content(tags, "og:image:alt")).toBe(strings.seo.cardAlt);
    expect(content(tags, "twitter:card")).toBe("summary_large_image");
    // the home page's address ends at the slash
    expect(canonical(pageMeta({ ...PAGE, path: "/" }, SITE))).toBe(
      "https://quiz.example/",
    );
  });

  it("gives every tag once", () => {
    for (const site of ["", SITE]) {
      const keys = pageMeta(PAGE, site).map((tag) => {
        const t = tag as Record<string, unknown>;
        return String(t.name ?? t.property ?? t.rel ?? Object.keys(t)[0]);
      });
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe("the pages players are sent to", () => {
  it("each have a title and a description of their own, short enough to be shown whole", () => {
    const titles = PUBLIC.map((page) => title(page.tags));
    const descriptions = PUBLIC.map((page) =>
      content(page.tags, "description"),
    );
    expect(new Set(titles).size).toBe(PUBLIC.length);
    expect(new Set(descriptions).size).toBe(PUBLIC.length);
    for (const page of PUBLIC) {
      const t = title(page.tags) ?? "";
      const d = content(page.tags, "description") ?? "";
      // a search result cuts a title at about 60 characters and a description at about 160
      expect(t.length, page.path).toBeGreaterThan(10);
      expect(t.length, page.path).toBeLessThanOrEqual(60);
      expect(d.length, page.path).toBeGreaterThan(50);
      expect(d.length, page.path).toBeLessThanOrEqual(160);
      // every title carries the site's name, and football is named in one or the other
      expect(t, page.path).toContain(strings.siteName);
      expect(`${t} ${d}`, page.path).toMatch(/football/i);
      expect(content(page.tags, "og:title")).toBe(t);
      expect(content(page.tags, "og:description")).toBe(d);
    }
  });

  it("say what the game is on the home page: daily football trivia, and the four ways to play", () => {
    const home = PUBLIC[0].tags;
    expect(title(home)).toMatch(/daily football trivia/i);
    const d = content(home, "description") ?? "";
    expect(d).toMatch(/daily football trivia/i);
    expect(d).toMatch(/most common/);
    expect(d).toMatch(/most uncommon/);
    expect(d).toMatch(/oldest/);
    expect(d).toMatch(/most recent/);
  });

  it("are each what `pageMeta` makes of their own address", () => {
    for (const page of PUBLIC) {
      const made = pageMeta({
        path: page.path,
        title: title(page.tags) ?? "",
        description: content(page.tags, "description") ?? "",
      });
      // the home page adds the site's own data after them
      expect(page.tags.slice(0, made.length), page.path).toEqual(made);
    }
    expect(PUBLIC[0].tags.slice(pageMeta(PAGE).length)).toEqual(siteData());
  });

  it("file NEXT-GEN's second address, /play/nextgen, under its first", () => {
    expect(tagsOf(playMeta, "/play/nextgen")).toEqual(
      tagsOf(playMeta, "/play/next-gen"),
    );
    expect(playPath("nextgen")).toBe("/play/next-gen");
  });

  it("are the pages listed for search engines: every route but the development pages, the approval desk, the sign-in page and that second address", () => {
    const paths = routes.map((route) =>
      route.index ? "/" : `/${route.path ?? ""}`,
    );
    expect(paths).toContain("/play/nextgen");
    expect(paths.some((path) => path.startsWith("/dev/"))).toBe(true);
    // /admin is the product owner's desk: on the site, never listed
    expect(paths).toContain("/admin");
    // /enter is where a sign-in link lands: nothing to find there without one
    expect(paths).toContain("/enter");
    const listed = paths.filter(
      (path) =>
        !path.startsWith("/dev/") &&
        path !== "/play/nextgen" &&
        path !== "/admin" &&
        path !== "/enter",
    );
    expect([...PAGES].sort()).toEqual([...listed].sort());
    expect(PAGES).toEqual(PUBLIC.map((page) => page.path));
  });
});

describe("an address that is not a page", () => {
  it("asks not to be indexed: a static host answers it 200, with the one fallback page", () => {
    const tags = tagsOf(rootMeta, "/no-such-page");
    expect(tags).toEqual(fallbackMeta());
    expect(content(tags, "robots")).toBe("noindex");
    expect(title(tags)).toBe(`${strings.errors.title} · ${strings.siteName}`);
    // nothing to show in a search result or a preview
    expect(content(tags, "description")).toBeUndefined();
    expect(JSON.stringify(tags)).not.toMatch(/og:|twitter:|canonical/);
  });
});

describe("the home page's structured data", () => {
  it("is left out until the site's address is set", () => {
    expect(siteData("")).toEqual([]);
  });

  it("names the site and the game, each by its address, and claims nothing it cannot show", () => {
    const tags = siteData(SITE);
    expect(tags).toHaveLength(1);
    const data = (tags[0] as Record<string, unknown>)[
      "script:ld+json"
    ] as Record<string, unknown>;
    expect(data["@context"]).toBe("https://schema.org");
    const graph = data["@graph"] as Record<string, unknown>[];
    expect(graph.map((entry) => entry["@type"])).toEqual([
      "WebSite",
      "VideoGame",
    ]);
    for (const entry of graph) {
      expect(entry.url).toBe("https://quiz.example/");
      expect(entry.name).toBe(strings.siteName);
      expect(entry.description).toBe(strings.home.description);
    }
    expect(graph[1].image).toBe("https://quiz.example/social-card.png");
    // no ratings, reviews or prices: none are shown on the page
    const keys = graph.flatMap((entry) => Object.keys(entry));
    expect(
      keys.filter((key) => /^(aggregateRating|review|offers|price)$/.test(key)),
    ).toEqual([]);
    // and it is plain data, whole after a trip through JSON
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });
});

describe("robots.txt and the sitemap", () => {
  it("let every crawler into every page, the development pages too (they say noindex themselves)", () => {
    for (const site of ["", SITE]) {
      const text = robotsTxt(site);
      expect(text).toMatch(/^User-agent: \*\nAllow: \/$/m);
      expect(text).not.toMatch(/Disallow/);
      expect(text.endsWith("\n")).toBe(true);
    }
    expect(robotsTxt("")).not.toMatch(/Sitemap/);
    expect(robotsTxt(SITE)).toMatch(
      /^Sitemap: https:\/\/quiz\.example\/sitemap\.xml$/m,
    );
  });

  it("list every page in full, and only once the address is set", () => {
    expect(sitemapXml("")).toBeNull();
    const xml = sitemapXml(SITE) ?? "";
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(
      true,
    );
    const listed = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(listed).toEqual(PAGES.map((path) => `${SITE}${path}`));
    expect(listed).toContain("https://quiz.example/");
    expect(listed).toContain("https://quiz.example/play/next-gen");
    expect(xml).not.toMatch(/nextgen|\/dev\//);
  });
});

describe("the files in public/", () => {
  const dir = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "public",
  );
  const read = (name: string): string | null =>
    existsSync(join(dir, name)) ? readFileSync(join(dir, name), "utf8") : null;

  it("are what `pnpm seo` writes for the address as it is set now", () => {
    expect(read("robots.txt"), "run `pnpm seo`").toBe(robotsTxt());
    expect(read("sitemap.xml"), "run `pnpm seo`").toBe(sitemapXml());
  });

  it("include the link preview's picture, where the pages say it is", () => {
    expect(existsSync(join(dir, SOCIAL_IMAGE.path.slice(1)))).toBe(true);
  });
});
