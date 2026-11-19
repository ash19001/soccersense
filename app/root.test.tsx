/**
 * The root's ads (app/root.tsx): Google AdSense's script, as AdSense gives it, in the head
 * of every page but the approval desk (the product owner, 2026-11-19: "i want to have ads").
 */
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, test } from "vitest";

import { ADSENSE_CLIENT, ADSENSE_SCRIPT, AdSense } from "./root";

const at = (path: string) =>
  renderToString(
    <MemoryRouter initialEntries={[path]}>
      <AdSense />
    </MemoryRouter>,
  );

describe("the ads", () => {
  test("AdSense's script, loaded on its own time, for this site's account", () => {
    expect(ADSENSE_CLIENT).toBe("ca-pub-4492876763866232");
    expect(ADSENSE_SCRIPT).toBe(
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4492876763866232",
    );
    for (const path of ["/", "/play/home", "/play/furthest", "/how-to-play"]) {
      const html = at(path);
      expect(html, path).toContain(`src="${ADSENSE_SCRIPT}"`);
      expect(html, path).toContain('crossorigin="anonymous"');
      expect(html, path).toMatch(/<script async=""/);
    }
  });

  test("none on the approval desk", () => {
    expect(at("/admin")).toBe("");
    expect(at("/admin/players")).toBe("");
    // a page whose address only starts the same is not the desk
    expect(at("/administrator")).toContain(ADSENSE_SCRIPT);
  });

  test("ads.txt names the account, as AdSense asks", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const text = readFileSync(join(process.cwd(), "public", "ads.txt"), "utf8");
    expect(text.trim()).toBe(
      "google.com, pub-4492876763866232, DIRECT, f08c47fec0942fa0",
    );
  });
});
