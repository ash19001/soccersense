/**
 * Hosting (wrangler.jsonc, tools/not-found.ts): the Cloudflare Worker serves what the build
 * writes, at the addresses the game links to, and has a page for an address that is not
 * one. The deploy of 2026-11-17 failed without this configuration.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { NOT_FOUND, SHELL, writeNotFoundPage } from "../../tools/not-found";
import { PAGES } from "./seo";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const text = (name: string) => readFileSync(join(root, name), "utf8");

/** wrangler.jsonc without its comments (none of its strings holds "//"). */
function wrangler(): {
  name: string;
  main?: string;
  compatibility_date: string;
  assets: Record<string, string>;
} {
  return JSON.parse(text("wrangler.jsonc").replace(/^\s*\/\/.*$/gm, ""));
}

describe("hosting on Cloudflare", () => {
  test("the Worker is the built site as static files, and nothing else", () => {
    const config = wrangler();
    expect(config.name).toMatch(/^[a-z0-9-]+$/);
    expect(config.compatibility_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // no Worker code: the site is frontend only
    expect(config.main).toBeUndefined();
    // where `react-router build` puts the pages
    expect(config.assets.directory).toBe("./build/client");
  });

  test("a page is served at the address the game links to: no closing slash", () => {
    expect(wrangler().assets.html_handling).toBe("drop-trailing-slash");
    for (const page of PAGES) {
      if (page !== "/") expect(page.endsWith("/")).toBe(false);
    }
  });

  test("an address that is not a page gets the app's shell as 404.html", () => {
    expect(wrangler().assets.not_found_handling).toBe("404-page");
    expect(SHELL).toBe("__spa-fallback.html");
    expect(NOT_FOUND).toBe("404.html");
    // the build writes it, after React Router has written the shell
    const build: string = JSON.parse(text("package.json")).scripts.build;
    expect(build).toMatch(/^react-router build && .*tools\/not-found\.ts$/);
    // and says so plainly if there is no shell to copy
    expect(() => writeNotFoundPage(join(root, "no-such-build"))).toThrow(
      /run the build first/,
    );
  });

  test("pnpm lets wrangler's runtime install: an unlisted build script stops a deploy", () => {
    expect(text("pnpm-workspace.yaml")).toMatch(/^ {2}workerd: true$/m);
  });
});
