import { act, fireEvent, render, screen } from "@testing-library/react";
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

import { dayKeyFor, storageKey } from "~/game";
import { strings } from "~/i18n";
import { MenuScene } from "~/scenes";
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

function card(name: RegExp): HTMLElement {
  return screen.getByRole("button", { name });
}

/** A finished game, as app/game/storage.ts keeps it. */
function saveGame(day: number, mode: "home" | "away", points: number[]): void {
  const turns = points.map((p, i) => ({
    questionId: `q${i}`,
    input: "x",
    answerId: "a",
    grade: "goal",
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

    // The name, the two modes and the way to the rules are in the page from the start.
    expect(html).toContain(
      `<h1 tabindex="-1" class="ss-sr">${strings.siteName}</h1>`,
    );
    expect(html).toContain(strings.home.modes.home.line);
    expect(html).toContain(strings.home.modes.away.line);
    expect(html).toContain('href="/how-to-play"');
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

  test("after mounting it knows the day: the stadium for screen readers, the day number", () => {
    mount();
    expect(
      screen.getByRole("heading", { level: 1, name: strings.siteName }),
    ).toHaveClass("ss-sr");
    const line = screen.getByText(
      strings.home.stadium("Anfield", "Liverpool", "England"),
    );
    expect(line).toHaveClass("ss-sr");
    expect(screen.getByText(strings.home.day(1))).toBeInTheDocument();
    // The way to the rules, with the address's query carried along.
    expect(
      screen.getByRole("link", { name: strings.howToPlay.title }),
    ).toHaveAttribute("href", "/how-to-play?day=1");
    // Nothing sits in the top slot: the logo is in the picture.
    expect(document.querySelector(".ss-game__top")).toBeEmptyDOMElement();
    expect(document.querySelector(".ss-game__canvas canvas")).not.toBeNull();
  });

  test("?day and ?stadium choose the day and the ground", () => {
    setSearch("?day=5&stadium=cairo-international-stadium");
    mount();
    expect(screen.getByText(strings.home.day(5))).toBeInTheDocument();
    expect(
      screen.getByText(
        strings.home.stadium("Cairo International Stadium", "Cairo", "Egypt"),
      ),
    ).toBeInTheDocument();
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

  test("a locked patch puts up a notice for two seconds, and it is announced", () => {
    vi.useFakeTimers();
    mount();
    const scene = theScene();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("");

    act(() => scene.onLocked?.("top"));
    expect(status).toHaveTextContent(strings.home.locked);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    // A second press starts the two seconds again.
    act(() => scene.onLocked?.("bottom"));
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(status).toHaveTextContent(strings.home.locked);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(status).toHaveTextContent("");
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

  test("a new day at midnight UTC brings its stadium, at rest", () => {
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
      screen.getByText(
        strings.home.stadium("Santiago Bernabéu", "Madrid", "Spain"),
      ),
    ).toBeInTheDocument();
    expect(theScene()).not.toBe(before);
    expect(theScene().phase).toBe("idle");
    // The page listens to the new scene.
    act(() => theScene().onHover?.("home"));
    expect(card(/HOME/)).toHaveClass("is-lit");
  });
});
