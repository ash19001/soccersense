import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    // The API in development: `pnpm api` runs the Worker on port 8787 (wrangler dev), and
    // the dev server passes /api to it. With no Worker running the requests fail, and the
    // game carries on as it does on any static host (the clock reads the `Date` header).
    proxy: {
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: true },
    },
  },
});
