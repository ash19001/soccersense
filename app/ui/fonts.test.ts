import { afterEach, describe, expect, test, vi } from "vitest";

import { HEADING_FACES, fetchHeadingFaces } from "./fonts";

function giveFonts(load: (face: string) => Promise<unknown>): void {
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { load },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (document as { fonts?: unknown }).fonts;
});

describe("fetchHeadingFaces", () => {
  test("asks the browser for every heading face", () => {
    const load = vi.fn<(face: string) => Promise<unknown>>(() =>
      Promise.resolve([]),
    );
    giveFonts(load);
    fetchHeadingFaces();
    expect(HEADING_FACES).toEqual(['1em "Jersey 20"']);
    expect(load.mock.calls.map(([face]) => face)).toEqual([...HEADING_FACES]);
  });

  test("does nothing with no font loading API, and at build time", () => {
    expect(() => fetchHeadingFaces()).not.toThrow();
    vi.stubGlobal("document", undefined);
    expect(() => fetchHeadingFaces()).not.toThrow();
  });

  test("never throws, whether the load fails at once or later", async () => {
    giveFonts(() => {
      throw new SyntaxError("bad face");
    });
    expect(() => fetchHeadingFaces()).not.toThrow();

    const rejected = Promise.reject(new Error("offline"));
    giveFonts(() => rejected);
    expect(() => fetchHeadingFaces()).not.toThrow();
    // The rejection is handled: nothing reaches the page as an unhandled rejection.
    await rejected.catch(() => undefined);
  });
});
