import { act, render } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { GameLayout } from "./GameLayout";
import { PixelRoot } from "./PixelRoot";
import { isWide, pixelScale, pixelVariables, usePixelRootScale } from "./scale";
import { SCALE_BOOT, WIDE_BOOT } from "./scale-boot";
import { WideMarkScript, useWideMark } from "./wide-mark";

interface Visual {
  width: number;
  height: number;
  scale?: number;
}

interface Booted {
  style: Record<string, string>;
  attributes: Record<string, string>;
}

/** Runs the script as the browser would, with a stand-in for the element it sits in. */
function boot(
  width: number,
  height: number,
  dpr: number,
  {
    classes = ["ss-root", "ss-game"],
    visual,
  }: { classes?: string[]; visual?: Visual } = {},
): Booted {
  const style: Record<string, string> = {};
  const attributes: Record<string, string> = {};
  const element = {
    style: {
      setProperty: (name: string, value: string) => {
        style[name] = value;
      },
    },
    setAttribute: (name: string, value: string) => {
      attributes[name] = value;
    },
    classList: { contains: (name: string) => classes.includes(name) },
  };
  const run = new Function(
    "document",
    "window",
    "innerWidth",
    "innerHeight",
    "devicePixelRatio",
    SCALE_BOOT,
  );
  run(
    { currentScript: { parentElement: element } },
    { visualViewport: visual },
    width,
    height,
    dpr,
  );
  return { style, attributes };
}

/** The side scale.ts `readScale` gives `pixelScale`: the visual viewport's, where it agrees. */
function exact(inner: number, visual: number | undefined): number {
  return visual !== undefined && Math.abs(visual - inner) < 1 ? visual : inner;
}

const WIDTHS = [
  280, 320, 360, 375, 390, 412, 414, 480, 600, 768, 820, 900, 1024, 1280, 1350,
  1366, 1440, 1536, 1745, 1920, 2560, 3840,
];
const HEIGHTS = [
  457, 568, 640, 720, 768, 800, 823, 844, 864, 915, 930, 940, 1024, 1080, 1440,
  2160,
];
const RATIOS = [
  0.05,
  0.5,
  0.9,
  1,
  1.1,
  1.25,
  1.5,
  1.75,
  2,
  2.25,
  2.5,
  2.625,
  2.75,
  3,
  3.5,
  4,
  20,
  0,
  -1,
  Number.NaN,
  Number.POSITIVE_INFINITY,
];

describe("the script that sets the scale before the page's code has loaded", () => {
  test("writes exactly the units, the orientation and the wide mark that scale.ts gives", () => {
    let checked = 0;
    for (const width of WIDTHS) {
      for (const height of HEIGHTS) {
        for (const dpr of RATIOS) {
          const scale = pixelScale(width, height, dpr);
          const where = `${width}x${height}@${dpr}`;
          const game = boot(width, height, dpr);
          expect(game.style, where).toEqual(pixelVariables(scale));
          expect(game.attributes["data-orientation"], where).toBe(
            scale.portrait ? "portrait" : "landscape",
          );
          expect("data-wide" in game.attributes, where).toBe(isWide(scale));
          expect("data-boot-wide" in game.attributes, where).toBe(
            isWide(scale),
          );
          checked += 1;
        }
      }
    }
    expect(checked).toBe(WIDTHS.length * HEIGHTS.length * RATIOS.length);
  });

  test("measures the window as scale.ts does: the visual viewport's fraction at a fractional ratio", () => {
    // 1920 device pixels at 110%: the window says 1745, the visual viewport 1745.4545.
    const cases: [number, number, number, Visual][] = [
      [1745, 981, 1.1, { width: 1745.4545, height: 981.8182, scale: 1 }],
      [1536, 864, 1.25, { width: 1536, height: 864, scale: 1 }],
      [1280, 720, 1.5, { width: 1280, height: 720 }],
      // Pinched in, or with a keyboard up, it measures something else and is not believed.
      [412, 823, 2.625, { width: 206, height: 411.5, scale: 2 }],
      [412, 823, 2.625, { width: 412, height: 500, scale: 1 }],
      [390, 844, 3, { width: 195, height: 422, scale: 0.5 }],
    ];
    for (const [width, height, dpr, visual] of cases) {
      const pinch = visual.scale ?? 1;
      const scale = pixelScale(
        exact(width, visual.width * pinch),
        exact(height, visual.height * pinch),
        dpr,
      );
      const got = boot(width, height, dpr, { visual });
      expect(got.style).toEqual(pixelVariables(scale));
      expect("data-wide" in got.attributes).toBe(isWide(scale));
    }
  });

  test("marks only a game layout that fills the window as wide", () => {
    expect(boot(1920, 1080, 1).attributes).toHaveProperty("data-wide", "");
    // A page that is not a game layout, and a contained one (a phone-sized frame).
    expect(
      boot(1920, 1080, 1, { classes: ["ss-root", "ss-page"] }).attributes,
    ).not.toHaveProperty("data-wide");
    expect(
      boot(1920, 1080, 1, {
        classes: ["ss-root", "ss-game", "ss-game--contained"],
      }).attributes,
    ).not.toHaveProperty("data-wide");
    expect(boot(390, 844, 3).attributes).not.toHaveProperty("data-wide");
    // Every root on a wide screen is noted as such, for the marks inside it (WIDE_BOOT).
    for (const classes of [
      ["ss-root", "ss-game"],
      ["ss-root", "ss-page"],
      ["ss-root", "ss-game", "ss-game--contained"],
    ]) {
      expect(boot(1920, 1080, 1, { classes }).attributes).toHaveProperty(
        "data-boot-wide",
        "",
      );
      expect(boot(390, 844, 3, { classes }).attributes).not.toHaveProperty(
        "data-boot-wide",
      );
    }
  });

  test("is plain old JavaScript that can sit in a script element, and does nothing with nowhere to write", () => {
    // Runs before anything else has loaded, in any browser: no modern syntax.
    expect(SCALE_BOOT).not.toMatch(/=>|`|\b(?:let|const|class)\b|\?\.|\?\?/);
    // Written into the HTML as it is.
    expect(SCALE_BOOT).not.toMatch(/<\/|<!--|\n/);
    expect(SCALE_BOOT.length).toBeLessThan(1400);
    const run = new Function("document", "window", SCALE_BOOT);
    expect(() => run({ currentScript: null }, {})).not.toThrow();
    expect(() =>
      run({ currentScript: { parentElement: null } }, {}),
    ).not.toThrow();
  });
});

describe("PixelRoot and the script", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  test("the build-time HTML has the script first inside the root; a page rendered in the browser has none", () => {
    const html = renderToString(
      <PixelRoot>
        <p>inside</p>
      </PixelRoot>,
    );
    expect(html).toContain(`data-orientation="portrait"><script>(function(){`);
    expect(html.indexOf("<script>")).toBeLessThan(
      html.indexOf("<p>inside</p>"),
    );
    // What React writes into the HTML is the script itself, character for character.
    const written = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
    expect(written).toBe(SCALE_BOOT);

    const { container } = render(
      <PixelRoot>
        <p>inside</p>
      </PixelRoot>,
    );
    expect(container.querySelector("script")).toBeNull();
  });

  test("taking over a page the script has already set up: the real units, no script left, nothing reported", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("innerWidth", 1536);
    vi.stubGlobal("innerHeight", 864);
    vi.stubGlobal("devicePixelRatio", 1.25);
    const real = pixelVariables(pixelScale(1536, 864, 1.25));

    const page = (
      <GameLayout bottom={<p>captions</p>}>
        <p>middle</p>
      </GameLayout>
    );
    const host = document.createElement("div");
    document.body.append(host);
    host.innerHTML = renderToString(page);
    const root = host.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--px")).toBe("3px");

    // The script, as the browser runs it while it reads the page (jsdom does not run a
    // script that arrives through innerHTML). It was written for a window since resized:
    // one unit is from the old window, and the wide mark is there.
    const script = root.querySelector("script") as HTMLScriptElement;
    expect(script.parentElement).toBe(root);
    for (const [name, value] of Object.entries(real)) {
      root.style.setProperty(name, value);
    }
    root.style.setProperty("--tx", "9px");
    root.setAttribute("data-orientation", "landscape");
    root.setAttribute("data-wide", "");
    root.setAttribute("data-boot-wide", "");

    let app: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      app = hydrateRoot(host, page);
    });

    // The script's note to the marks inside the root is taken off again.
    expect(root).not.toHaveAttribute("data-boot-wide");
    for (const [name, value] of Object.entries(real)) {
      expect(root.style.getPropertyValue(name), name).toBe(value);
    }
    expect(root).toHaveAttribute("data-orientation", "landscape");
    expect(root).toHaveAttribute("data-live");
    expect(root).toHaveAttribute("data-wide");
    expect(root.querySelector("script")).toBeNull();
    expect(errors).not.toHaveBeenCalled();
    await act(async () => {
      app?.unmount();
    });
  });

  test("a wide mark left by the script on a window that is no longer wide is taken off", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("innerWidth", 390);
    vi.stubGlobal("innerHeight", 844);
    vi.stubGlobal("devicePixelRatio", 3);

    const page = <GameLayout bottom={<p>captions</p>} />;
    const host = document.createElement("div");
    document.body.append(host);
    host.innerHTML = renderToString(page);
    const root = host.firstElementChild as HTMLElement;
    // As the script left it on a monitor's window, before the window was made a phone's.
    root.setAttribute("data-wide", "");
    root.setAttribute("data-orientation", "landscape");
    root.style.setProperty("--px", "4px");

    let app: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      app = hydrateRoot(host, page);
    });
    expect(root).not.toHaveAttribute("data-wide");
    expect(root).toHaveAttribute("data-orientation", "portrait");
    expect(root.style.getPropertyValue("--px")).toBe("3px");
    await act(async () => {
      app?.unmount();
    });
  });
});

/** A part of a page that marks itself wide, as the rules card and the legal pages do. */
function Part({ wide }: { wide: boolean }) {
  const mark = useWideMark(wide);
  return (
    <div
      ref={mark}
      className="part"
      data-wide={wide ? "" : undefined}
      suppressHydrationWarning
    >
      <WideMarkScript />
      <p>words</p>
    </div>
  );
}

describe("a part that marks itself wide before the page's code has loaded", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  /** Runs WIDE_BOOT for a part inside a root that the first script did or did not note. */
  function mark(noted: boolean, inRoot = true): Record<string, string> {
    const attributes: Record<string, string> = {};
    const root = {
      hasAttribute: (name: string) => noted && name === "data-boot-wide",
    };
    const part = {
      closest: (selector: string) =>
        inRoot && selector === ".ss-root" ? root : null,
      setAttribute: (name: string, value: string) => {
        attributes[name] = value;
      },
    };
    const run = new Function("document", WIDE_BOOT);
    run({ currentScript: { parentElement: part } });
    return attributes;
  }

  test("the script marks its part only where the root's script found the screen wide", () => {
    expect(mark(true)).toEqual({ "data-wide": "" });
    expect(mark(false)).toEqual({});
    expect(mark(true, false)).toEqual({});
    expect(WIDE_BOOT).not.toMatch(/=>|`|\b(?:let|const|class)\b|<\/|\n/);
    const run = new Function("document", WIDE_BOOT);
    expect(() => run({ currentScript: null })).not.toThrow();
  });

  test("the build-time HTML has the script first inside the part; in the browser there is none", () => {
    const html = renderToString(<Part wide={false} />);
    expect(html).toBe(
      `<div class="part"><script>${WIDE_BOOT}</script><p>words</p></div>`,
    );
    const { container } = render(<Part wide />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("data-wide");
  });

  test("taking over a part the script has marked: the mark stays on a wide screen, and comes off if the screen is not", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const [width, height, wide] of [
      [1920, 1080, true],
      [390, 844, false],
    ] as const) {
      vi.stubGlobal("innerWidth", width);
      vi.stubGlobal("innerHeight", height);
      vi.stubGlobal("devicePixelRatio", 1);
      const page = (
        <PixelRoot>
          <Wide />
        </PixelRoot>
      );
      const host = document.createElement("div");
      document.body.append(host);
      host.innerHTML = renderToString(page);
      const part = host.querySelector(".part") as HTMLElement;
      // As the script left it on a monitor.
      part.setAttribute("data-wide", "");
      let app: ReturnType<typeof hydrateRoot> | undefined;
      await act(async () => {
        app = hydrateRoot(host, page);
      });
      expect(part.hasAttribute("data-wide"), `${width}`).toBe(wide);
      expect(part.querySelector("script")).toBeNull();
      await act(async () => {
        app?.unmount();
      });
      host.remove();
    }
    expect(errors).not.toHaveBeenCalled();
  });
});

/** The part, wide where its root's screen is: as the real ones decide it. */
function Wide() {
  return <Part wide={isWide(usePixelRootScale())} />;
}
