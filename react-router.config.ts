import type { Config } from "@react-router/dev/config";

export default {
  // Static site: no runtime server. Routes can't export `action` or `headers`,
  // and `loader` only runs at build time.
  ssr: false,
  // Render every static route in app/routes.ts to HTML at build time (SEO).
  // Any other path is served build/client/__spa-fallback.html.
  prerender: true,
} satisfies Config;
