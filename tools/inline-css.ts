/**
 * inline-css: after the build, write the site's stylesheet into the game's own pages (the
 * home screen and the mode pages).
 *
 *   ./node_modules/.bin/tsx tools/inline-css.ts        (run by `pnpm build`)
 *
 * The build leaves each page asking for its styles as a file of their own
 * (`<link rel="stylesheet" href="/assets/root-….css">`). Until that file is in, the browser
 * can show nothing, and a script that measures the page meanwhile measures it with no
 * styles at all. The ads' script does (it lays the page out and asks what is at a point),
 * and on PageSpeed's own run it arrives first, from Google's servers next door: everything
 * "moved" when the styles landed (a layout shift of 1.0 on the phone, 2026-11-19), and the
 * first paint was counted as waiting for the ads' script too. With the styles in the page
 * itself there is no such wait: the first answer from the server is enough to paint.
 *
 * The link stays where it was, switched off (`disabled`: a browser does not fetch a
 * stylesheet that is). It has to stay: React renders the whole document, `<Links />`
 * (app/root.tsx) asks for that link, and a page whose HTML did not have it would fail to
 * be taken over (React's error 418) and be rendered again from nothing. React matches a
 * link in the head by its `rel` and `href` and leaves every other attribute as it found it,
 * so the link is taken over and stays off. React Router and Vite both look for it before
 * they would add the stylesheet themselves on a move to another page, find it, and add
 * nothing. The `<style>` goes just before the link, where React, which is looking for a
 * link there, passes over it; everything the browser fetches early (the fonts, the
 * scripts) is still ahead of it in the head.
 *
 * The site has one stylesheet, the root's (app/app.css). A page that links more than one
 * stops the build: a route's own styles, written into the page, would stay in it after the
 * player has moved on to another route, and that needs thinking about first.
 *
 * Only the game's pages (`wantsStyles`). A page that no longer waits for its stylesheet is
 * painted before its fonts have come, on any connection slower than a tenth of a second,
 * in a stand-in face, and laid out again when they land. On the home screen and a mode
 * page that moves next to nothing (a few short captions: a layout shift under 0.01). On a
 * page of words (the rules, the privacy notice, the terms) all the text moves: 0.03 to 0.18
 * measured, for a page that scored 98 as it was. Those keep their stylesheet as a file, and
 * with it their old order: the fonts are asked for first and are in by the first paint.
 * (Nothing of theirs is laid out before the styles are in either: the scale's script, the
 * first thing in their body, waits for a stylesheet that is still on its way.)
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** A stylesheet's link, exactly as React writes it into a built page's head. */
const LINK = /<link rel="stylesheet" href="(\/[^"]+\.css)"\/>/g;

/** What marks the styles written into a page: the address of the file they came from. */
export const INLINED = "data-inlined";

/**
 * `html` with the stylesheet it links to written into it, in a `<style>` just before the
 * link, and the link switched off. `read` gives a stylesheet's text from its address
 * ("/assets/root-….css"). A page that has been through here already, or links no
 * stylesheet, comes back unchanged.
 */
export function inlineStyles(
  html: string,
  read: (href: string) => string,
): string {
  const links = html.match(LINK) ?? [];
  if (links.length > 1) {
    throw new Error(
      `a page links ${links.length} stylesheets (${links.join(" ")}): this tool is ` +
        "written for one stylesheet for the whole site (see its header)",
    );
  }
  return html.replace(LINK, (link, href: string) => {
    const css = read(href);
    // A <style> ends at the first "</style": nothing in the styles may hold one.
    if (/<\/style/i.test(css)) {
      throw new Error(
        `${href} holds "</style": it cannot be written into a page`,
      );
    }
    // In a page, an address is read from the page's own, not from the stylesheet's. (What
    // is inside a quoted data: picture is that picture's own business.)
    const outside = css.replace(/url\(\s*(["'])data:[\s\S]*?\1\s*\)/gi, "");
    const relative = /url\(\s*["']?(?!\/|data:|https?:|#)[^)]*\)/i.exec(
      outside,
    );
    if (relative) {
      throw new Error(
        `${href} has an address that is not written out in full, ${relative[0]}: ` +
          "written into a page it would point somewhere else",
      );
    }
    return `<style ${INLINED}="${href}">${css}</style>${link.slice(0, -2)} disabled=""/>`;
  });
}

/** Every `.html` file under `dir`, at any depth. */
function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return pages(file);
    return entry.name.endsWith(".html") ? [file] : [];
  });
}

/**
 * Whether a built page gets its styles written in: the game's own pages, by their place in
 * the built site ("index.html", "play/home/index.html"). See the top of this file for why
 * the others do not.
 */
export function wantsStyles(page: string): boolean {
  const at = page.split(path.sep).join("/");
  return at === "index.html" || at.startsWith("play/");
}

/**
 * Writes the stylesheet into the pages of the built site in `dir` that want it
 * (`wantsStyles`). Returns the pages it changed. Throws if one of those links a stylesheet
 * in a way this tool does not know, or if none of them carries the styles afterwards: the
 * build has changed how it links them, and this tool has to follow. Every other page is
 * left exactly as the build wrote it.
 * (`pnpm check` does not run the build: a throw here is first seen as a failed deploy.)
 */
export function inlineBuiltStyles(
  dir: string,
  wanted: (page: string) => boolean = wantsStyles,
): string[] {
  const sheets = new Map<string, string>();
  const read = (href: string) => {
    let css = sheets.get(href);
    if (css === undefined) {
      css = readFileSync(path.join(dir, href), "utf8");
      sheets.set(href, css);
    }
    return css;
  };
  const changed: string[] = [];
  /** The pages that carry the styles: written in now, or by an earlier run. */
  let styled = 0;
  for (const file of pages(dir)) {
    if (!wanted(path.relative(dir, file))) continue;
    const html = readFileSync(file, "utf8");
    const out = inlineStyles(html, read);
    if (out !== html) {
      writeFileSync(file, out);
      changed.push(file);
      styled++;
    } else if (html.includes(`<style ${INLINED}="`)) {
      styled++;
    } else if (/<link\b[^>]*\brel=["']?stylesheet/i.test(html)) {
      throw new Error(
        `${file} links a stylesheet in a way this tool does not know: has the build ` +
          "changed how it links its styles?",
      );
    }
  }
  if (styled === 0) {
    throw new Error(
      `no page of the game under ${dir} has a stylesheet link to write in: has the ` +
        "build changed how it links its styles, or where it writes its pages?",
    );
  }
  return changed;
}

function main(): void {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const changed = inlineBuiltStyles(path.join(root, "build", "client"));
  console.log(`styles written into ${changed.length} pages`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
