/**
 * The Worker's entry (wrangler.jsonc, `main`): Cloudflare calls `fetch` for every request
 * to `/api/*`, and `scheduled` once a night (`triggers`). The work is in ./app.ts and
 * ./tidy.ts, which are handed the time so they can be tested.
 */

import { handle } from "./app";
import type { Env } from "./env";
import { tidy } from "./tidy";

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env, Date.now());
  },
  async scheduled(
    _controller: unknown,
    env: Env,
    context: { waitUntil(promise: Promise<unknown>): void },
  ): Promise<void> {
    if (env.DB) context.waitUntil(tidy(env.DB, Date.now()));
  },
};
