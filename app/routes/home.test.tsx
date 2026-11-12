import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import {
  MemoryRouter,
  type NavigateFunction,
  createRoutesStub,
  useLocation,
  useParams,
} from "react-router";
import {
  type MockInstance,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import { menuLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { factForDay } from "~/data/facts";
import { leaderboardFor } from "~/data/leaderboard";
import { dayKeyFor, storageKey } from "~/game";
import { FONT_3x5, Surface } from "~/pixel";
import { strings } from "~/i18n";
import { MenuScene } from "~/scenes";
import { LOCKED_MODES } from "~/scenes/menu";
import Home, { meta } from "./home";

// `useNavigate` can be swapped for a spy, to count what the page asks for. With no spy it
// is the real one, and the stub router below really navigates.
const nav = vi.hoisted(() => ({ spy: null as NavigateFunction | null }));

vi.mock("react-router", async (importOriginal) => {
  const real = await importOriginal<typeof import("react-router")>();
  return {
    ...real,
    useNavigate: () => {
      const go = real.useNavigate();
      return nav.spy ?? go;
    },
  };
});

// --- helpers -----------------------------------------------------------------------------------

/** The page reads the address bar itself (the debug overrides), not the router's location. */
function setSearch(search: string): void {
  window.history.replaceState(null, "", `/${search}`);
}

function PlayStub() {
  const { mode } = useParams();
  const { search } = useLocation();
  return (
    <p>
      play {mode} {search}
    </p>
  );
}

function mount(strict = false) {
  const Stub = createRoutesStub([
    { path: "/", Component: Home },
    { path: "/play/:mode", Component: PlayStub },
    { path: "/how-to-play", Component: () => <p>the rules</p> },
  ]);
  const page = <Stub initialEntries={["/"]} />;
  return render(strict ? <StrictMode>{page}</StrictMode> : page);
}

/** Every scene the page has made, oldest first: each gets its scores as it is made. */
let made: MockInstance<MenuScene["setScores"]>;

function scenes(): MenuScene[] {
  return [...new Set(made.mock.contexts)] as MenuScene[];
}

function theScene(): MenuScene {
  const all = scenes();
  expect(all.length).toBeGreaterThan(0);
  return all[all.length - 1];
}

/** Run the scene as the canvas host would, for `seconds`. There is no canvas in the tests. */
function run(scene: MenuScene, seconds: number): void {
  act(() => {
    for (let t = 0; t < seconds; t += 1 / 60) scene.update(1 / 60);
  });
}

/** The airship's sign at rest as a scene draws it at 480 x 270, before anything moves. */
function signOf(scene: MenuScene): number[] {
  const s = new Surface(480, 270);
  scene.resize(480, 270);
  scene.setLighting(lightingFor({ elevation: 45, morning: false }));
  scene.draw(s);
  const z = menuLayout(480, 270).scoreboard;
  const out: number[] = [];
  for (let y = z.y + 2; y < z.y + z.h - 2; y++) {
    for (let x = z.x + 2; x < z.x + z.w - 2; x++) out.push(s.get(x, y));
  }
  return out;
}

/** The sign a scene of day `day` with that day's fact shows. */
function signForDay(day: number): number[] {
  return signOf(
    new MenuScene({
      seed: day,
      fact: factForDay(day).text,
      labels: strings.home.canvas,
      intro: false,
    }),
  );
}

function card(name: RegExp): HTMLElement {
  return screen.getByRole("button", { name });
}

/** A finished game, as app/game/storage.ts keeps it. */
function saveGame(day: number, mode: "home" | "away", points: number[]): void {
  const turns = points.map((p, i) => ({
    questionId: `q${i}`,
    input: "x",
    answerId: "a",
    grade: "power",
    points: p,
    km: 10,
    rank: 2,
    msLeft: 1000,
  }));
  const total = points.reduce((sum, p) => sum + p, 0);
  window.localStorage.setItem(
    storageKey(dayKeyFor(day), mode),
    JSON.stringify({ total, turns }),
  );
}

beforeEach(() => {
  made = vi.spyOn(MenuScene.prototype, "setScores");
  nav.spy = null;
  setSearch("?day=1");
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setSearch("");
});

// --- tests -------------------------------------------------------------------------------------

describe("home page: at build time", () => {
  test("renders to HTML with no browser to read", () => {
    // What the prerender has: no window, no document, no storage. Touching one throws.
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("localStorage", undefined);
    vi.stubGlobal("navigator", undefined);
    let html: string;
    try {
      html = renderToString(
        <MemoryRouter>
          <Home />
        </MemoryRouter>,
      );
    } finally {
      vi.unstubAllGlobals();
    }

    // The name, the two modes and the "?" button are in the page from the start; the
    // rules' dialog is not (it is only ever opened by the button).
    expect(html).toContain(
      `<h1 tabindex="-1" class="ss-sr">${strings.siteName}</h1>`,
    );
    expect(html).toContain(strings.home.modes.home.line);
    expect(html).toContain(strings.home.modes.away.line);
    expect(html).toContain(`aria-label="${strings.howToPlay.title}"`);
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain("<dialog");
    expect(html).toContain("<canvas");
    // With no script there is no picture: the page still says what it is.
    expect(html).toMatch(
      new RegExp(
        `<noscript>.*${strings.siteName}.*seven questions.*</noscript>`,
      ),
    );
    // Nothing that depends on the day: no stadium, no day number, no scene.
    expect(html).toContain(strings.home.dayPending);
    expect(html).not.toContain("Anfield");
    expect(html).not.toContain(strings.home.day(1));
    expect(made).not.toHaveBeenCalled();
  });

  test("has a real title and description", () => {
    const tags = meta({} as Parameters<typeof meta>[0]) ?? [];
    expect(tags).toContainEqual({ title: strings.home.title });
    expect(tags).toContainEqual({
      name: "description",
      content: strings.home.description,
    });
    expect(strings.home.title).toContain(strings.siteName);
    expect(strings.home.description.length).toBeGreaterThan(60);
  });
});

describe("home page: in the browser", () => {
  // This test must be the first one to mount the page: the entrance belongs to the first
  // showing after a page load, and the module that remembers it lives as long as this file.
  test("the entrance plays the first time the page is shown, and not on coming back", () => {
    const first = mount();
    expect(theScene().phase).toBe("intro");
    first.unmount();

    mount();
    expect(scenes()).toHaveLength(2);
    expect(theScene().phase).toBe("idle");
  });

  test("after mounting it knows the day: the fact for screen readers, the day number", () => {
    mount();
    expect(
      screen.getByRole("heading", { level: 1, name: strings.siteName }),
    ).toHaveClass("ss-sr");
    const line = screen.getByText(strings.home.fact(factForDay(1).text));
    expect(line).toHaveClass("ss-sr");
    expect(line.textContent).toBe(
      "Fact of the day: The penalty kick was the idea of William McCrum, a goalkeeper from County Armagh, and arrived in 1891.",
    );
    expect(screen.getByText(strings.home.day(1))).toBeInTheDocument();
    // The way to the rules: a button that opens them over the menu.
    expect(
      screen.getByRole("button", { name: strings.howToPlay.title }),
    ).toHaveAttribute("aria-expanded", "false");
    // Nothing sits in the top slot: the logo is in the picture.
    expect(document.querySelector(".ss-game__top")).toBeEmptyDOMElement();
    expect(document.querySelector(".ss-game__canvas canvas")).not.toBeNull();
  });

  test.each([1, 2])(
    "?day=%i puts that day's fact on the airship and in the hidden line",
    (day) => {
      setSearch(`?day=${day}`);
      mount();
      expect(screen.getByText(strings.home.day(day))).toBeInTheDocument();
      expect(
        screen.getByText(strings.home.fact(factForDay(day).text)),
      ).toHaveClass("ss-sr");
      const sign = signOf(theScene());
      expect(sign).toEqual(signForDay(day));
      expect(sign).not.toEqual(signForDay(day === 1 ? 2 : 1));
    },
  );

  test("?day=2 and ?day=1 have different facts", () => {
    expect(factForDay(2).text).not.toBe(factForDay(1).text);
    expect(factForDay(2).text).toMatch(/^The first official international/);
  });

  test("?stadium is the game's: the home page's sign keeps the day's fact", () => {
    setSearch("?day=5&stadium=cairo-international-stadium");
    mount();
    expect(screen.getByText(strings.home.day(5))).toBeInTheDocument();
    expect(
      screen.getByText(strings.home.fact(factForDay(5).text)),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Cairo/)).toBeNull();
  });

  test("the ? button opens the rules over the menu, and they close back to it", () => {
    mount();
    const help = screen.getByRole("button", { name: strings.howToPlay.title });
    expect(help).toHaveAttribute("aria-haspopup", "dialog");
    act(() => help.focus());
    fireEvent.click(help);
    // A modal dialog named by its heading, over the menu (the scene is still there).
    const dialog = screen.getByRole("dialog", {
      name: strings.howToPlay.heading,
    });
    expect(dialog).toHaveAttribute("open");
    expect(help).toHaveAttribute("aria-expanded", "true");
    expect(scenes()).toHaveLength(1);
    // The day in a line, the six shots and the career; nothing on the modes.
    expect(
      within(dialog).getByText(strings.howToPlay.intro),
    ).toBeInTheDocument();
    expect(dialog).toHaveAccessibleDescription(strings.howToPlay.intro);
    expect(dialog.textContent).not.toMatch(/\b(HOME|AWAY)\b/);
    for (const shot of [
      "worldie",
      "golazo",
      "trivela",
      "toepoke",
      "tapin",
      "miss",
    ] as const) {
      expect(
        within(dialog).getByText(strings.play.shots[shot]).closest("li"),
      ).toHaveAttribute("data-grade", shot);
    }
    expect(
      within(dialog).getByText(strings.play.tiers.park),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(strings.play.tiers.winner),
    ).toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/niche/i);
    // The focus is in it; closing puts it back on the "?" button.
    const close = within(dialog).getByRole("button", {
      name: strings.howToPlay.close,
    });
    expect(close).toHaveFocus();
    fireEvent.click(close);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(help).toHaveFocus();
    expect(help).toHaveAttribute("aria-expanded", "false");
    // Escape closes it too. The page never left the menu for the old rules page.
    fireEvent.click(help);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(help).toHaveFocus();
    expect(screen.queryByText("the rules")).toBeNull();
  });

  test("the sign's header is in the small font", () => {
    for (const ch of strings.home.canvas.header.toUpperCase()) {
      expect(FONT_3x5.glyphs[ch.charCodeAt(0)], ch).toBeDefined();
    }
  });

  test("strict mode still makes one scene, and it is the one the page listens to", () => {
    mount(true);
    expect(scenes()).toHaveLength(1);
    act(() => theScene().onHover?.("away"));
    expect(card(/AWAY/)).toHaveClass("is-lit");
  });

  test("a mode played today shows its score on the caption and on the ball", () => {
    saveGame(1, "home", [100, 100, 100, 78, 100]);
    saveGame(2, "away", [50]); // another day's game is not today's
    mount();
    expect(made).toHaveBeenLastCalledWith({ home: 478, away: null });
    expect(screen.getByText("478")).toHaveClass("ss-menu__score");
    expect(screen.getByText(strings.home.played(478))).toHaveClass("ss-sr");
    expect(document.querySelectorAll(".ss-menu__score")).toHaveLength(1);
  });

  test("a game finished in another tab shows when this one comes back into view", () => {
    mount();
    expect(document.querySelector(".ss-menu__score")).toBeNull();
    saveGame(1, "away", [61, 9]);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(scenes()).toHaveLength(1);
    expect(made).toHaveBeenLastCalledWith({ home: null, away: 70 });
    expect(screen.getByText("70")).toHaveClass("ss-menu__score");
  });
});

describe("home page: today's leaderboard", () => {
  const text = strings.home.leaderboard;

  test("is not in the build-time page: it needs the day", () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("localStorage", undefined);
    let html: string;
    try {
      html = renderToString(
        <MemoryRouter>
          <Home />
        </MemoryRouter>,
      );
    } finally {
      vi.unstubAllGlobals();
    }
    expect(html).not.toContain(text.heading);
    expect(html).not.toContain("ss-lb");
  });

  test("opens from the trophy (the test window is not a monitor) with the day's top ten", () => {
    mount();
    const trophy = screen.getByRole("button", { name: text.open });
    fireEvent.click(trophy);
    const sheet = screen.getByRole("dialog", { name: text.heading });
    const table = within(sheet).getByRole("table", {
      name: text.caption(strings.home.modes.home.label),
    });
    // Ten players and the header row; nobody is YOU before playing.
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(within(table).queryByText(text.you)).toBeNull();
    const board = leaderboardFor(1, "home");
    expect(within(sheet).getByText(text.played(board.total))).toBeTruthy();
    expect(
      within(table).getByRole("rowheader", { name: board.rows[0]!.name }),
    ).toBeTruthy();
  });

  test("a mode played today puts the player in its table, at their rank", () => {
    saveGame(1, "away", [100, 100, 100, 100, 80, 0, 0]);
    mount();
    fireEvent.click(screen.getByRole("button", { name: text.open }));
    // Only AWAY was played, so the sheet opens on AWAY.
    const sheet = screen.getByRole("dialog");
    expect(
      within(sheet).getByRole("tab", { name: strings.home.modes.away.label }),
    ).toHaveAttribute("aria-selected", "true");
    const board = leaderboardFor(1, "away", 480);
    const rank = board.yourRank ?? 0;
    expect(rank).toBeGreaterThan(10);
    const you = within(sheet).getByRole("rowheader", {
      name: text.youSpoken(rank, board.total),
    });
    expect(you.closest("tr")).toHaveTextContent(`${rank}${text.you}`);
    expect(you.closest("tr")?.lastElementChild).toHaveTextContent("480");
    expect(within(sheet).getByText(text.played(board.total))).toBeTruthy();
  });

  test("the trophy steps aside with the captions when a mode is chosen", () => {
    mount();
    fireEvent.click(card(/^HOME/));
    expect(
      screen.getByRole("button", { name: text.open, hidden: true }),
    ).toHaveClass("is-stowed");
  });
});

describe("home page: the captions and the ball", () => {
  test("hovering or focusing a caption lights its patch on the ball", () => {
    const hovered = vi.spyOn(MenuScene.prototype, "setHovered");
    mount();
    const scene = theScene();

    fireEvent.pointerEnter(card(/HOME/), { pointerType: "mouse" });
    expect(hovered).toHaveBeenLastCalledWith("home");
    expect(hovered.mock.contexts.at(-1)).toBe(scene);
    fireEvent.pointerLeave(card(/HOME/), { pointerType: "mouse" });
    expect(hovered).toHaveBeenLastCalledWith(null);

    act(() => card(/AWAY/).focus());
    expect(hovered).toHaveBeenLastCalledWith("away");
    act(() => card(/AWAY/).blur());
    expect(hovered).toHaveBeenLastCalledWith(null);
  });

  test("hovering a patch on the ball lights its caption", () => {
    mount();
    const scene = theScene();
    act(() => scene.onHover?.("home"));
    expect(card(/HOME/)).toHaveClass("is-lit");
    expect(card(/AWAY/)).not.toHaveClass("is-lit");
    act(() => scene.onHover?.(null));
    expect(card(/HOME/)).not.toHaveClass("is-lit");
  });

  test("a locked patch puts up a notice naming its mode for 2.5 seconds, and it is announced", () => {
    vi.useFakeTimers();
    mount();
    const scene = theScene();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("");

    act(() => scene.onLocked?.("nextgen"));
    // the words on screen are the words read out
    expect(status.textContent).toBe(strings.home.soon.nextgen);
    expect(status.textContent).toContain(strings.home.canvas.nextgen);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // A second press, on another patch, names that one and starts the wait again.
    act(() => scene.onLocked?.("furthest"));
    expect(status.textContent).toBe(strings.home.soon.furthest);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(status.textContent).toBe(strings.home.soon.furthest);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(status).toHaveTextContent("");
  });

  test("every locked mode has a notice that names it", () => {
    for (const mode of LOCKED_MODES) {
      expect(strings.home.soon[mode]).toContain(strings.home.canvas[mode]);
    }
  });
});

describe("home page: choosing a mode", () => {
  test("a caption starts the kick-off, steps aside, and the page moves on once", () => {
    const go = vi.fn();
    nav.spy = go as unknown as NavigateFunction;
    const choose = vi.spyOn(MenuScene.prototype, "choose");
    const kickoffs: string[] = [];
    setSearch("?day=3&time=21:30");
    vi.useFakeTimers();
    mount();
    const scene = theScene();
    const menu = document.querySelector(".ss-menu");
    expect(menu).not.toHaveAttribute("inert");

    fireEvent.click(card(/HOME/));
    expect(choose).toHaveBeenLastCalledWith("home");
    expect(scene.phase).toBe("kickoff");
    // The captions are out of the way from the moment the kick-off starts.
    expect(menu).toHaveClass("is-stowed");
    expect(menu).toHaveAttribute("inert");
    expect(go).not.toHaveBeenCalled();

    // Pressing again, either mode, changes nothing.
    const listen = scene.onKickoff;
    scene.onKickoff = (mode) => {
      kickoffs.push(mode);
      listen?.(mode);
    };
    fireEvent.click(card(/HOME/));
    fireEvent.click(card(/AWAY/));
    expect(choose).toHaveLastReturnedWith(false);
    expect(kickoffs).toEqual([]);
    expect(scene.phase).toBe("kickoff");

    // The scene plays it out and says so: the page goes to the mode, overrides and all.
    run(scene, 2);
    expect(scene.phase).toBe("done");
    expect(go).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledWith({
      pathname: "/play/home",
      search: "?day=3&time=21:30",
    });

    // Nothing asks twice: not the scene, not the page's own patience.
    act(() => scene.onChoose?.("home"));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(go).toHaveBeenCalledTimes(1);
  });

  test("a patch on the ball does the same", () => {
    const go = vi.fn();
    nav.spy = go as unknown as NavigateFunction;
    mount();
    const scene = theScene();
    // What the scene does when a press on the AWAY patch is released.
    act(() => {
      expect(scene.choose("away")).toBe(true);
    });
    expect(document.querySelector(".ss-menu")).toHaveClass("is-stowed");
    run(scene, 2);
    expect(go).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledWith({
      pathname: "/play/away",
      search: "?day=1",
    });
  });

  test("the page really arrives at the mode's page", async () => {
    mount();
    fireEvent.click(card(/AWAY/));
    run(theScene(), 2);
    expect(await screen.findByText("play away ?day=1")).toBeInTheDocument();
    // The home page is gone, and with it everything that could choose again.
    expect(screen.queryByRole("button", { name: /HOME/ })).toBeNull();
  });

  test("if the scene never finishes (no canvas), the page moves on by itself", () => {
    const go = vi.fn();
    nav.spy = go as unknown as NavigateFunction;
    vi.useFakeTimers();
    mount();
    fireEvent.click(card(/HOME/));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(go).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(go).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledWith({
      pathname: "/play/home",
      search: "?day=1",
    });
  });

  test("if the page is still there long after it asked to leave, the menu comes back", () => {
    // The mode's page never arrives (its code could not be fetched, say).
    const go = vi.fn();
    nav.spy = go as unknown as NavigateFunction;
    vi.useFakeTimers();
    mount();
    const scene = theScene();
    const menu = document.querySelector(".ss-menu");
    fireEvent.click(card(/HOME/));
    run(scene, 2);
    expect(go).toHaveBeenCalledTimes(1);
    expect(scene.phase).toBe("done");
    expect(menu).toHaveClass("is-stowed");

    act(() => {
      vi.advanceTimersByTime(7000);
    });
    expect(menu).toHaveClass("is-stowed");
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    // Not ink for ever: the ball is back at rest and the captions are back in reach.
    expect(scene.phase).toBe("idle");
    expect(menu).not.toHaveClass("is-stowed");
    expect(menu).not.toHaveAttribute("inert");
    expect(go).toHaveBeenCalledTimes(1);

    // And a mode can be chosen again.
    fireEvent.click(card(/AWAY/));
    run(scene, 2);
    expect(go).toHaveBeenCalledTimes(2);
    expect(go).toHaveBeenLastCalledWith({
      pathname: "/play/away",
      search: "?day=1",
    });
  });

  test("a navigation that fails outright brings the menu back at once", async () => {
    const go = vi.fn(() => Promise.reject(new Error("no such page")));
    nav.spy = go as unknown as NavigateFunction;
    mount();
    const scene = theScene();
    fireEvent.click(card(/HOME/));
    run(scene, 2);
    expect(go).toHaveBeenCalledTimes(1);
    await act(async () => {
      await Promise.resolve();
    });
    expect(scene.phase).toBe("idle");
    expect(document.querySelector(".ss-menu")).not.toHaveClass("is-stowed");
  });

  test("pointing at a mode starts fetching its page, ahead of the kick-off", () => {
    mount();
    const preloads = () =>
      document.querySelectorAll('link[rel="modulepreload"]').length;
    expect(preloads()).toBe(0);
    fireEvent.pointerEnter(card(/AWAY/), { pointerType: "mouse" });
    expect(preloads()).toBeGreaterThan(0);
  });

  test("the next page's heading face is fetched ahead: soon after the menu is up, at once when a mode is pointed at", () => {
    // Nothing on the menu is set in Jersey 20, so the browser would fetch it only when the
    // mode page's heading needs it, and show that heading in a stand-in face meanwhile.
    const load = vi.fn(() => Promise.resolve([]));
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { load },
    });
    try {
      vi.useFakeTimers();
      mount();
      expect(load).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(load).toHaveBeenCalledWith('1em "Jersey 20"');

      load.mockClear();
      fireEvent.pointerEnter(card(/HOME/), { pointerType: "mouse" });
      expect(load).toHaveBeenCalledWith('1em "Jersey 20"');
    } finally {
      delete (document as { fonts?: unknown }).fonts;
    }
  });

  test("a mode pointed at before the menu has waited fetches the face at once", () => {
    const load = vi.fn(() => Promise.resolve([]));
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { load },
    });
    try {
      vi.useFakeTimers();
      mount();
      fireEvent.pointerEnter(card(/AWAY/), { pointerType: "mouse" });
      expect(load).toHaveBeenCalledWith('1em "Jersey 20"');
    } finally {
      delete (document as { fonts?: unknown }).fonts;
    }
  });

  test("a mode chosen while the ball is still arriving keeps its scene through midnight", () => {
    // Chosen during the entrance, a mode is struck only when the ball has settled: the scene
    // has said onKickoff, but its phase is not "kickoff" yet. A new day must not replace it
    // (and its kick-off) with a fresh scene at rest under stowed captions.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 10, 12, 23, 59, 58)));
    setSearch("");
    mount();
    const before = theScene();
    act(() => before.onKickoff?.("home"));
    expect(before.phase).not.toBe("kickoff");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(theScene()).toBe(before);
    expect(screen.getByText(strings.home.day(3))).toBeInTheDocument();
  });

  test("a new day at midnight UTC brings its fact, at rest", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 10, 12, 23, 59, 30)));
    setSearch("");
    mount();
    const before = theScene();
    expect(screen.getByText(strings.home.day(3))).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(40_000);
    });
    expect(screen.getByText(strings.home.day(4))).toBeInTheDocument();
    expect(
      screen.getByText(strings.home.fact(factForDay(4).text)),
    ).toBeInTheDocument();
    expect(theScene()).not.toBe(before);
    expect(signOf(theScene())).toEqual(signForDay(4));
    expect(theScene().phase).toBe("idle");
    // The page listens to the new scene.
    act(() => theScene().onHover?.("home"));
    expect(card(/HOME/)).toHaveClass("is-lit");
  });
});
