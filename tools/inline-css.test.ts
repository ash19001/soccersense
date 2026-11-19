// @vitest-environment node
/**
 * The stylesheet written into every built page (tools/inline-css.ts): the styles are in the
 * page's own HTML, just before the link React still asks for, and that link is switched off
 * so that the browser does not fetch the file as well.
 */
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  INLINED,
  inlineBuiltStyles,
  inlineStyles,
  wantsStyles,
} from "./inline-css";

const HREF = "/assets/root-AbC123_-.css";
const LINK = `<link rel="stylesheet" href="${HREF}"/>`;
/** A page's head as the build writes it: the stylesheet's link is its last thing. */
const page = (body = "<p>hello</p>") =>
  `<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/>` +
  `<link rel="preload" href="/assets/jersey-10.woff2" as="font" type="font/woff2" crossorigin="anonymous"/>` +
  `<link rel="modulepreload" href="/assets/entry.client-x.js"/>${LINK}</head>` +
  `<body>${body}</body></html>`;
const CSS = "@layer base{body{margin:0}}.ss-root{--px:3px}";

describe("the stylesheet written into a page", () => {
  test("the styles go in just before their link, and the link is switched off", () => {
    const out = inlineStyles(page(), (href) => {
      expect(href).toBe(HREF);
      return CSS;
    });
    expect(out).toContain(
      `<style ${INLINED}="${HREF}">${CSS}</style>` +
        `<link rel="stylesheet" href="${HREF}" disabled=""/></head>`,
    );
    // React looks for the link by these two, and must find them as it wrote them
    expect(out).toContain(`<link rel="stylesheet" href="${HREF}"`);
    // nothing else in the page has changed
    expect(
      out
        .replace(`<style ${INLINED}="${HREF}">${CSS}</style>`, "")
        .replace(' disabled=""', ""),
    ).toBe(page());
    // everything a browser fetches early is still ahead of the styles
    expect(out.indexOf('rel="modulepreload"')).toBeLessThan(
      out.indexOf("<style"),
    );
  });

  test("a page that has been through it comes back as it is", () => {
    const once = inlineStyles(page(), () => CSS);
    expect(inlineStyles(once, () => CSS)).toBe(once);
  });

  test("the styles are written as they are: a dollar sign is not a pattern", () => {
    const odd = '.a::after{content:"$& $1 $$"}';
    expect(inlineStyles(page(), () => odd)).toContain(`>${odd}</style>`);
  });

  test("styles that would close the <style> early are refused", () => {
    for (const bad of ['.a{content:"</style>"}', ".a{}</STYLE >"]) {
      expect(() => inlineStyles(page(), () => bad)).toThrow(/<\/style/);
    }
  });

  test("an address in the styles must be written out in full: a page is not where the stylesheet was", () => {
    const fine =
      '@font-face{src:url(/assets/jersey-10.woff2)format("woff2")}' +
      `.a{background:url("data:image/svg+xml,%3Csvg fill='url(%23g)'/%3E")}` +
      ".b{mask:url(#clip)}";
    expect(inlineStyles(page(), () => fine)).toContain(`>${fine}</style>`);
    for (const bad of [
      "@font-face{src:url(jersey-10.woff2)}",
      '.a{background:url("../img/ball.png")}',
    ]) {
      expect(() => inlineStyles(page(), () => bad)).toThrow(
        /not written out in full/,
      );
    }
  });

  test("a page with no stylesheet comes back as it is", () => {
    const bare = page().replace(LINK, "");
    expect(inlineStyles(bare, () => CSS)).toBe(bare);
  });

  test("a page with two stylesheets is refused: the site has one, and a route's own would outstay its page", () => {
    const two = page().replace(
      LINK,
      `${LINK}<link rel="stylesheet" href="/assets/play-Zz9.css"/>`,
    );
    expect(() => inlineStyles(two, () => CSS)).toThrow(/2 stylesheets/);
  });
});

describe("the built site's pages", () => {
  const made: string[] = [];
  const site = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), "ss-inline-"));
    made.push(dir);
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(join(dir, name, ".."), { recursive: true });
      writeFileSync(join(dir, name), text);
    }
    return dir;
  };
  afterEach(() => {
    for (const dir of made.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the game's pages get the styles: the home screen and every mode page", () => {
    const game = [
      "index.html",
      "play/home/index.html",
      "play/next-gen/index.html",
      "play/furthest/index.html",
    ];
    // pages of words, the sign-in page, the desk, and the shell (also served as 404.html):
    // an early first paint would show their text in a stand-in face and move it all when
    // the fonts land, so they keep their stylesheet as a file
    const others = [
      "how-to-play/index.html",
      "privacy/index.html",
      "terms/index.html",
      "enter/index.html",
      "admin/index.html",
      "__spa-fallback.html",
      "404.html",
    ];
    const dir = site({
      [HREF.slice(1)]: CSS,
      ...Object.fromEntries(
        [...game, ...others].map((name) => [name, page(name)]),
      ),
    });
    const changed = inlineBuiltStyles(dir);
    expect(changed.map((file) => file.slice(dir.length + 1)).sort()).toEqual(
      game.map((name) => join(name)).sort(),
    );
    for (const name of game) {
      const html = readFileSync(join(dir, name), "utf8");
      expect(html, name).toContain(
        `<style ${INLINED}="${HREF}">${CSS}</style>`,
      );
      expect(html, name).toContain(
        `<link rel="stylesheet" href="${HREF}" disabled=""/>`,
      );
      expect(html, name).toContain(`<body>${name}</body>`);
    }
    for (const name of others) {
      // exactly as the build wrote it
      expect(readFileSync(join(dir, name), "utf8"), name).toBe(page(name));
    }
    // the file itself stays: the other pages ask for it, and a page of an older build may
    expect(readFileSync(join(dir, HREF.slice(1)), "utf8")).toBe(CSS);
    // run again, nothing changes and nothing is wrong
    expect(inlineBuiltStyles(dir)).toEqual([]);
  });

  test("which pages are the game's is told by their place in the built site", () => {
    for (const name of ["index.html", "play/home/index.html", "play/x.html"]) {
      expect(wantsStyles(name), name).toBe(true);
      // as the file system writes it on Windows
      expect(wantsStyles(join(name)), name).toBe(true);
    }
    for (const name of [
      "how-to-play/index.html",
      "privacy/index.html",
      "404.html",
      "__spa-fallback.html",
      "player/index.html",
      "plays.html",
      "about/play/index.html",
    ]) {
      expect(wantsStyles(name), name).toBe(false);
    }
  });

  test("a page that links its stylesheet another way stops the build: the tool has to follow the build", () => {
    for (const other of [
      `<link href="${HREF}" rel="stylesheet">`,
      `<link rel="stylesheet" href="${HREF}">`,
      `<link rel='stylesheet' href='${HREF}'/>`,
      `<LINK REL=stylesheet HREF=${HREF}>`,
    ]) {
      const dir = site({
        [HREF.slice(1)]: CSS,
        "play/home/index.html": page("a game"),
        "index.html": page().replace(LINK, other),
      });
      expect(() => inlineBuiltStyles(dir), other).toThrow(
        /index\.html links a stylesheet in a way this tool does not know/,
      );
    }
  });

  test("a plain page from public/ (no stylesheet at all) is left as it is, and does not stop the build", () => {
    // what a search engine or an ad network asks a site to serve, to show whose it is
    const plain = "google-site-verification: google0123456789abcdef.html";
    const bare =
      "<!doctype html><html><head><title>t</title></head><body>hello</body></html>";
    const dir = site({
      [HREF.slice(1)]: CSS,
      "index.html": page(),
      "google0123456789abcdef.html": plain,
      "about/plain.html": bare,
    });
    const changed = inlineBuiltStyles(dir);
    expect(changed.map((file) => file.slice(dir.length + 1))).toEqual([
      "index.html",
    ]);
    expect(readFileSync(join(dir, "google0123456789abcdef.html"), "utf8")).toBe(
      plain,
    );
    expect(readFileSync(join(dir, "about/plain.html"), "utf8")).toBe(bare);
  });

  test("a site in which no page got its styles stops the build", () => {
    // the build no longer links a stylesheet at all: nothing was written in, and saying
    // "styles written into 0 pages" would be a quiet way to lose them
    const dir = site({
      [HREF.slice(1)]: CSS,
      "index.html": page().replace(LINK, ""),
      "play/home/index.html": page("a game").replace(LINK, ""),
    });
    expect(() => inlineBuiltStyles(dir)).toThrow(
      /no page of the game under .* has a stylesheet link to write in/,
    );
    // nor does one whose only pages with styles are not the game's
    const words = site({
      [HREF.slice(1)]: CSS,
      "privacy/index.html": page("words"),
    });
    expect(() => inlineBuiltStyles(words)).toThrow(/no page of the game under/);
    // and so does a folder with no page in it (the build did not run)
    expect(() => inlineBuiltStyles(site({ [HREF.slice(1)]: CSS }))).toThrow(
      /no page of the game under/,
    );
  });
});
