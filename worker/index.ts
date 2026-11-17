/**
 * The Worker's entry (wrangler.jsonc, `main`): Cloudflare calls `fetch` for every request
 * to `/api/*`. The work is in ./app.ts, which is handed the time so it can be tested.
 */

import { handle } from "./app";
import type { Env } from "./env";

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env, Date.now());
  },
};
