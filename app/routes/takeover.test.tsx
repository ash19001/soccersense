// Every page is built ahead of time, and its build-time HTML carries small scripts that
// run before the page's code (the real scale, the wide marks, the mode card: ~/ui/scale-boot,
// ~/ui/wide-mark, play/Game.tsx). React then takes the page over as those scripts left it.
// If it ever could not, it would throw the page away and draw it again (and say so in the
// console); this holds each page to being taken over without a word, on a phone and on a
// monitor.

import { act } from "@testing-library/react";
import type { ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { MemoryRouter, createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { resetArrivalFocus } from "~/ui/useArrivalFocus";

import Enter from "./enter";
import Home from "./home";
import HowToPlay from "./how-to-play";
import Play from "./play";
import Privacy from "./privacy";
import Terms from "./terms";

/** A page, the same tree for the build and for the browser. */
function pageAt(path: string): ReactNode {
  if (path === "/") {
    return (
      <MemoryRouter initialEntries={["/"]}>
        <Home />
      </MemoryRouter>
    );
  }
  if (path.startsWith("/play/")) {
    return (
      <MemoryRouter initialEntries={[path]}>
        <Play />
      </MemoryRouter>
    );
  }
  const Component =
    path === "/how-to-play"
      ? HowToPlay
      : path === "/privacy"
        ? Privacy
        : path === "/terms"
          ? Terms
          : Enter;
  const Stub = createRoutesStub([{ path, Component }]);
  return <Stub initialEntries={[path]} />;
}

/** The page as the build renders it: no browser to read. */
function built(path: string): string {
  const stub = path === "/" || path.startsWith("/play/");
  if (stub) {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("localStorage", undefined);
    vi.stubGlobal("navigator", undefined);
  }
  try {
    return renderToString(pageAt(path));
  } finally {
    if (stub) vi.unstubAllGlobals();
  }
}

/** Runs the scripts written into `host`'s HTML, in order, as a browser does while it reads. */
function runScripts(host: HTMLElement): number {
  const scripts = [...host.querySelectorAll("script")];
  for (const script of scripts) {
    Object.defineProperty(document, "currentScript", {
      configurable: true,
      get: () => script,
    });
    try {
      new Function(script.textContent ?? "")();
    } finally {
      // back to the document's own (jsdom's: null outside a running script)
      delete (document as { currentScript?: unknown }).currentScript;
    }
  }
  return scripts.length;
}

const SCREENS = [
  { name: "a phone", width: 390, height: 844, ratio: 3, wide: false },
  { name: "a monitor", width: 1920, height: 1080, ratio: 1, wide: true },
] as const;

const PAGES = [
  "/",
  "/play/home",
  "/play/away",
  "/play/retro",
  "/play/next-gen",
  "/play/closest",
  "/play/furthest",
  "/how-to-play",
  "/privacy",
  "/terms",
  "/enter",
];

beforeEach(() => {
  resetArrivalFocus();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

describe("React taking a built page over", () => {
  for (const screen of SCREENS) {
    for (const path of PAGES) {
      test(`${path} on ${screen.name}: as its scripts left it, without a word`, async () => {
        const html = built(path);

        // the browser the page then opens in
        vi.stubGlobal("innerWidth", screen.width);
        vi.stubGlobal("innerHeight", screen.height);
        vi.stubGlobal("devicePixelRatio", screen.ratio);
        // nothing answers: the pages make do (and say nothing in the console)
        vi.stubGlobal(
          "fetch",
          vi.fn(() => Promise.reject(new Error("offline"))),
        );
        window.history.replaceState(null, "", path);
        const errors = vi.spyOn(console, "error").mockImplementation(() => {});
        const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});

        const host = document.createElement("div");
        document.body.append(host);
        host.innerHTML = html;
        const root = host.querySelector(".ss-root") as HTMLElement;
        expect(root, "the page's root").not.toBeNull();
        // the scale's script is the first thing inside the root
        expect(root.firstElementChild?.tagName).toBe("SCRIPT");
        expect(runScripts(host)).toBeGreaterThan(0);
        // what the scripts found is on the root before any of the page's code has run
        expect(root.getAttribute("data-orientation")).toBe(
          screen.wide ? "landscape" : "portrait",
        );
        expect(root.hasAttribute("data-boot-wide")).toBe(screen.wide);
        expect(root.style.getPropertyValue("--px")).toMatch(/^\d+(\.\d+)?px$/);
        const units = root.style.getPropertyValue("--px");
        const first = [...root.children].find(
          (child) => child.tagName !== "SCRIPT",
        );

        const failed = vi.fn();
        let app: ReturnType<typeof hydrateRoot> | undefined;
        await act(async () => {
          app = hydrateRoot(host, pageAt(path), {
            onRecoverableError: failed,
          });
        });

        // taken over as it was: nothing thrown away and rendered again, nothing said
        expect(failed).not.toHaveBeenCalled();
        expect(errors.mock.calls).toEqual([]);
        expect(warnings.mock.calls).toEqual([]);
        expect(host.querySelector(".ss-root")).toBe(root);
        if (first) expect(first.isConnected).toBe(true);
        // live: the scripts are gone, the root's own note to the parts inside it too, and
        // the units are the ones the script worked out (the page agrees with it)
        expect(root.querySelector("script")).toBeNull();
        expect(root).not.toHaveAttribute("data-boot-wide");
        expect(root.style.getPropertyValue("--px")).toBe(units);
        // a part that marks itself wide is marked on a monitor and not on a phone
        for (const part of root.querySelectorAll(
          ".ss-doc__page, .ss-help, .ss-enter",
        )) {
          expect(part.hasAttribute("data-wide"), part.className).toBe(
            screen.wide,
          );
        }

        await act(async () => {
          app?.unmount();
        });
        host.remove();
      });
    }
  }
});
