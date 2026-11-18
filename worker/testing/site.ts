/**
 * The whole site for the page's tests: the Worker's own `handle` behind a stand-in for
 * `fetch`, with a real SQLite in memory and a browser's cookie jar. The email service is
 * stood in for (the links it was asked to send are kept in `links`), and so is Turnstile's
 * check of a bot check's token (a token starting "pass-" passes, once), so nothing leaves
 * the machine. Tests only: nothing in the Worker or the app imports this.
 */

import { SITEVERIFY_URL } from "../accounts/check";
import { RESEND_URL } from "../accounts/mail";
import { handle } from "../app";
import type { Env, Outside } from "../env";
import { type MemoryD1, memoryD1 } from "./d1";

export interface TestSite {
  env: Env & { DB: MemoryD1 };
  /** Every request the page made: "POST /api/games/home/start". */
  calls: string[];
  /** While true, no request gets through. */
  down: boolean;
  /** Requests the Worker has not answered yet. */
  pending: number;
  /** The browser's cookies for the site. */
  cookies: Map<string, string>;
  /** The sign-in links the email service was asked to send, newest last. */
  links: string[];
  /** Stands in for `fetch`: hands the request to the Worker. */
  fetch(input: unknown, init?: RequestInit): Promise<Response>;
  /**
   * Signs this browser in to the account of an address (made if there is none), as the
   * emailed link does. Returns the account as the server gives it.
   */
  signIn(email: string): Promise<{ nickname: string; email: string }>;
  /** The token of the newest link. */
  lastToken(): string;
  close(): void;
}

export function testSite(
  over: Omit<Partial<Env>, "DB"> = {},
  origin = "http://localhost:3000",
): TestSite {
  const DB = memoryD1();
  const spent = new Set<string>();
  const outside: Outside = async (url, init) => {
    if (url === SITEVERIFY_URL) {
      const token = String(
        (JSON.parse(String(init.body)) as { response?: unknown }).response,
      );
      const success = token.startsWith("pass-") && !spent.has(token);
      spent.add(token);
      return new Response(JSON.stringify({ success }), { status: 200 });
    }
    if (url !== RESEND_URL) throw new Error(`an unexpected request to ${url}`);
    const mail = JSON.parse(String(init.body)) as { text: string };
    const link = /https?:\/\/\S+/.exec(mail.text)?.[0];
    if (link) site.links.push(link);
    return new Response(JSON.stringify({ id: "mail" }), { status: 200 });
  };
  const site: TestSite = {
    env: {
      DB,
      ASSETS: { fetch: async () => new Response("the site") },
      RESEND_API_KEY: "re_test_key",
      ...over,
    },
    calls: [],
    down: false,
    pending: 0,
    cookies: new Map(),
    links: [],
    async fetch(input, init = {}) {
      const url = new URL(String(input), origin);
      const method = init.method ?? "GET";
      site.calls.push(`${method} ${url.pathname}`);
      if (site.down) throw new TypeError("Failed to fetch");
      site.pending++;
      try {
        const headers = new Headers(init.headers);
        if (site.cookies.size > 0) {
          headers.set(
            "cookie",
            [...site.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
          );
        }
        // A browser says where a request that changes something is from.
        if (method !== "GET" && method !== "HEAD") {
          headers.set("origin", url.origin);
        }
        const response = await handle(
          new Request(url, {
            method,
            headers,
            ...(typeof init.body === "string" && { body: init.body }),
          }),
          site.env,
          // the server's clock at the moment the request reaches it
          Date.now(),
          outside,
        );
        for (const line of response.headers.getSetCookie()) {
          const [pair, ...attributes] = line.split("; ");
          const at = pair.indexOf("=");
          const name = pair.slice(0, at);
          const value = pair.slice(at + 1);
          if (value === "" || attributes.includes("Max-Age=0")) {
            site.cookies.delete(name);
          } else {
            site.cookies.set(name, value);
          }
        }
        return response;
      } finally {
        site.pending--;
      }
    },
    lastToken: () => site.links.at(-1)?.split("#")[1] ?? "",
    async signIn(email) {
      const post = (path: string, body: unknown) =>
        site.fetch(`${origin}/api/account/${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      await post("link", { email });
      const entered = await post("enter", { token: site.lastToken() });
      const said = (await entered.json()) as {
        account: { nickname: string; email: string } | null;
      };
      if (!said.account) throw new Error(`could not sign in as ${email}`);
      return said.account;
    },
    close: () => DB.close(),
  };
  return site;
}
