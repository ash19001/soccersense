import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { OLD_DETAIL_STORAGE_KEY, forgetDetailChoice } from "./forget-detail";
import { PixelRoot } from "./PixelRoot";
import { pixelScale, usePixelRootScale } from "./scale";

function at(search: string) {
  window.history.replaceState(null, "", `/${search}`);
}

beforeEach(() => {
  window.sessionStorage.clear();
  at("");
});

afterEach(() => {
  window.sessionStorage.clear();
  at("");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("forgetDetailChoice", () => {
  test("forgets a choice the tab remembers from when there were two levels", () => {
    expect(OLD_DETAIL_STORAGE_KEY).toBe("soccersense:detail");
    window.sessionStorage.setItem(OLD_DETAIL_STORAGE_KEY, "1");
    window.sessionStorage.setItem("soccersense:other", "kept");
    forgetDetailChoice();
    expect(window.sessionStorage.getItem(OLD_DETAIL_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem("soccersense:other")).toBe("kept");
    // again: nothing to forget, nothing happens
    expect(() => forgetDetailChoice()).not.toThrow();
  });

  test("blocked storage: nothing throws", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => forgetDetailChoice()).not.toThrow();
  });
});

describe("PixelRoot", () => {
  test("the build-time render is the default scale, whatever the tab remembers", () => {
    window.sessionStorage.setItem(OLD_DETAIL_STORAGE_KEY, "1");
    at("?detail=1");
    const html = renderToString(<PixelRoot>x</PixelRoot>);
    expect(html).toContain("--px:3px");
    // Nothing was touched during render.
    expect(window.sessionStorage.getItem(OLD_DETAIL_STORAGE_KEY)).toBe("1");
  });

  test("forgets the old choice after mounting; ?detail=1 changes nothing, and every render has the one canvas", () => {
    vi.stubGlobal("innerWidth", 1920);
    vi.stubGlobal("innerHeight", 1080);
    vi.stubGlobal("devicePixelRatio", 1);
    window.sessionStorage.setItem(OLD_DETAIL_STORAGE_KEY, "1");
    at("?detail=1");
    const seen: ReturnType<typeof usePixelRootScale>[] = [];
    function Probe() {
      seen.push(usePixelRootScale());
      return null;
    }
    render(
      <PixelRoot>
        <Probe />
      </PixelRoot>,
    );
    expect(window.sessionStorage.getItem(OLD_DETAIL_STORAGE_KEY)).toBeNull();
    expect(seen.length).toBeGreaterThan(0);
    for (const scale of seen) {
      expect(scale).toEqual(pixelScale(1920, 1080, 1));
    }
    expect(seen.at(-1)).toMatchObject({
      canvasW: 960,
      canvasH: 540,
      canvasDp: 2,
    });
  });
});
