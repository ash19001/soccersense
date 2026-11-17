import { defineConfig } from "vitest/config";

// Separate from vite.config.ts: the React Router Vite plugin doesn't run under Vitest.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // The Worker's tests ask for Node themselves (`// @vitest-environment node`).
    include: [
      "app/**/*.test.{ts,tsx}",
      "worker/**/*.test.ts",
      "tools/**/*.test.ts",
    ],
  },
});
