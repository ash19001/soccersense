/**
 * not-found: after the build, write build/client/404.html, the page the host serves for an
 * address that is not a page.
 *
 *   ./node_modules/.bin/tsx tools/not-found.ts        (run by `pnpm build`)
 *
 * The site is static: every page is a file (`prerender: true`), and React Router writes one
 * more, `__spa-fallback.html`, the app's shell with no page in it, to be served for any
 * other address. A host has to be told to do that. Cloudflare's static assets
 * (wrangler.jsonc, `not_found_handling: "404-page"`) serve the nearest `404.html` with a
 * "404 Not Found", so the shell is copied to that name: an address that is not a page then
 * loads the app, which shows the Offside! page (the root's error boundary, whose `meta`
 * asks not to be indexed), and search engines are told plainly that there is nothing there.
 */

import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The shell React Router writes, and the name the host looks for. */
export const SHELL = "__spa-fallback.html";
export const NOT_FOUND = "404.html";

/** Copies the shell in `dir` to `404.html`. Throws if the build has not written it. */
export function writeNotFoundPage(dir: string): string {
  const from = path.join(dir, SHELL);
  if (!existsSync(from)) {
    throw new Error(
      `${from} is missing: run the build first (react-router build writes it when ` +
        "`ssr` is false).",
    );
  }
  const to = path.join(dir, NOT_FOUND);
  copyFileSync(from, to);
  return to;
}

function main(): void {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  console.log(writeNotFoundPage(path.join(root, "build", "client")));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
