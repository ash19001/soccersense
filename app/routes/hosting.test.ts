/**
 * Hosting (wrangler.jsonc, tools/not-found.ts): the Cloudflare Worker serves what the build
 * writes, at the addresses the game links to, and has a page for an address that is not
 * one. The deploy of 2026-11-17 failed without this configuration.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test, vi } from "vitest";

import { NOT_FOUND, SHELL, writeNotFoundPage } from "../../tools/not-found";
import { PAGES } from "./seo";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const text = (name: string) => readFileSync(join(root, name), "utf8");

/** wrangler.jsonc without its comments (none of its strings holds "//"). */
function wrangler(): {
  name: string;
  main?: string;
  compatibility_date: string;
  assets: Record<string, unknown>;
  d1_databases?: Record<string, string>[];
  ratelimits?: {
    name: string;
    namespace_id: string;
    simple: { limit: number; period: number };
  }[];
  vars?: Record<string, string>;
} {
  return JSON.parse(text("wrangler.jsonc").replace(/^\s*\/\/.*$/gm, ""));
}

describe("hosting on Cloudflare", () => {
  test("the Worker is the built site as static files, and the API", () => {
    const config = wrangler();
    expect(config.name).toMatch(/^[a-z0-9-]+$/);
    expect(config.compatibility_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // where `react-router build` puts the pages
    expect(config.assets.directory).toBe("./build/client");
    // the API's code, which reaches the files through this binding (worker/env.ts)
    expect(config.main).toBe("worker/index.ts");
    expect(config.assets.binding).toBe("ASSETS");
    // only the API runs code: every page is served straight from its file
    expect(config.assets.run_worker_first).toEqual(["/api/*"]);
  });

  test("the database is bound as DB, and the questions are the sample until the flag is switched", () => {
    const config = wrangler();
    expect(config.d1_databases).toEqual([
      { binding: "DB", database_name: "soccersense" },
    ]);
    // the game is in testing: real questions start only on this flag
    expect(config.vars?.QUESTIONS).toBe("sample");
  });

  test("accounts: the settings are here, and the secrets are not", () => {
    const config = wrangler();
    // who the sign-in email is from (worker/accounts/mail.ts)
    expect(config.vars?.MAIL_FROM).toMatch(
      /^soccersense <[a-z]+@soccersense\.io>$/,
    );
    // how often one connection may ask for a sign-in link (worker/env.ts, SIGN_IN_LIMIT)
    expect(config.ratelimits).toEqual([
      {
        name: "SIGN_IN_LIMIT",
        namespace_id: expect.stringMatching(/^\d+$/),
        simple: { limit: 5, period: 60 },
      },
    ]);
    // nothing in the file but these settings: every key and token that is secret is a
    // secret in Cloudflare, never in the repository. The bot check's site key and Google's
    // client id are not secret (every page that shows the check, and every link to Google's
    // sign-in, has them).
    expect(Object.keys(config.vars ?? {}).sort()).toEqual([
      "GOOGLE_CLIENT_ID",
      "MAIL_FROM",
      "QUESTIONS",
      "TURNSTILE_SITE_KEY",
    ]);
    // the Google client's id is not secret either (it is in every link to Google's sign-in)
    expect(config.vars?.GOOGLE_CLIENT_ID).toMatch(
      /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/,
    );
    expect(config.vars?.TURNSTILE_SITE_KEY).toMatch(
      /^0x4[0-9A-Za-z_-]{16,24}$/,
    );
    // a developer's own secrets for `pnpm api` are in a file git ignores
    expect(text(".gitignore")).toMatch(/^\.dev\.vars$/m);
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

  test("the development pages are on the dev server and never in the built site", async () => {
    // the product owner, 2026-11-17: "why can i access links like /dev/sound on prod. i
    // thought that was for dev only"
    const argv = process.argv;
    // the command that is reading app/routes.ts: `react-router <command>`
    const paths = async (command: string) => {
      process.argv = ["node", "react-router", command];
      vi.resetModules();
      const routes = (await import("../routes")).default;
      return routes.map((route) => (route.index ? "/" : `/${route.path}`));
    };
    try {
      const built = await paths("build");
      expect(built.filter((path) => path.startsWith("/dev"))).toEqual([]);
      // every page players are sent to is still there
      for (const page of PAGES) expect(built).toContain(page);
      // the dev server has them, and so does typegen, which makes their types
      for (const command of ["dev", "typegen"]) {
        const all = await paths(command);
        expect(all).toEqual(
          expect.arrayContaining(["/dev/ui", "/dev/sound", "/dev/stage"]),
        );
        expect(all.filter((path) => !path.startsWith("/dev"))).toEqual(built);
      }
    } finally {
      process.argv = argv;
      vi.resetModules();
    }
  });

  test("every file the site serves carries its security headers (public/_headers)", () => {
    const rules = text("public/_headers");
    const header = (name: string) =>
      new RegExp(`^  ${name}: (.+)$`, "m").exec(rules)?.[1] ?? "";
    // one rule, for every path
    expect(rules).toMatch(/^\/\*$/m);
    const csp = header("Content-Security-Policy");
    for (const part of [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
      "connect-src 'self' https://cloudflareinsights.com",
      "frame-src https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ]) {
      expect(csp).toContain(part);
    }
    // nothing but this site, the bot check's and Cloudflare Web Analytics'
    for (const origin of csp.match(/https?:\/\/[^\s;]+/g) ?? []) {
      expect([
        "https://challenges.cloudflare.com",
        "https://static.cloudflareinsights.com",
        "https://cloudflareinsights.com",
      ]).toContain(origin);
    }
    expect(header("Strict-Transport-Security")).toMatch(/^max-age=\d{8}/);
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("X-Frame-Options")).toBe("DENY");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(header("Cross-Origin-Opener-Policy")).toBe("same-origin");
  });

  test("no secret is in the repository's settings or the built site's words", () => {
    const config = text("wrangler.jsonc");
    for (const pattern of [
      /re_[A-Za-z0-9]{16,}/,
      /GOCSPX-/,
      // a Turnstile secret key (a site key is shorter, and public)
      /0x4AAAA[0-9A-Za-z_-]{25,}/,
      /eyJ[A-Za-z0-9_-]{10,}\.eyJ/,
    ]) {
      expect(config).not.toMatch(pattern);
      expect(text("public/_headers")).not.toMatch(pattern);
    }
  });

  test("pnpm lets wrangler's runtime install: an unlisted build script stops a deploy", () => {
    expect(text("pnpm-workspace.yaml")).toMatch(/^ {2}workerd: true$/m);
  });
});
