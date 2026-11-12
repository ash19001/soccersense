// The pages round the home screen (the two mode pages, the rules, the error page), and how
// the keyboard's focus travels between them and the home screen.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { strings } from "~/i18n";
import { ErrorBoundary, HydrateFallback } from "~/root";
import { MenuScene } from "~/scenes";
import { resetArrivalFocus } from "~/ui/useArrivalFocus";
import Home from "./home";
import HowToPlay, { meta as rulesMeta } from "./how-to-play";
import Play, { meta as playMeta } from "./play";

/** The pages read the address bar themselves (the debug overrides). */
function setAddress(path: string): void {
  window.history.replaceState(null, "", path);
}

function site(at: string, strict = false) {
  setAddress(at);
  const Stub = createRoutesStub([
    { path: "/", Component: Home },
    { path: "/play/home", Component: Play },
    { path: "/play/away", Component: Play },
    { path: "/how-to-play", Component: HowToPlay },
  ]);
  const page = <Stub initialEntries={[at]} />;
  return render(strict ? <StrictMode>{page}</StrictMode> : page);
}

/** What `isRouteErrorResponse` recognises: the router's own "no such page". */
const NOT_FOUND = {
  status: 404,
  statusText: "Not Found",
  internal: true,
  data: "",
};

type BoundaryProps = Parameters<typeof ErrorBoundary>[0];
const boundaryProps = (error: unknown) => ({ error }) as BoundaryProps;

beforeEach(() => {
  resetArrivalFocus();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setAddress("/");
});

describe("the mode pages", () => {
  test("each address is its own mode: the game, in the game's skin", () => {
    site("/play/away?day=1");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: strings.play.heading.away,
      }),
    ).toHaveClass("ss-sr");
    expect(
      screen.getByText(strings.play.stadium("Anfield", "Liverpool", "England")),
    ).toBeInTheDocument();
    expect(document.querySelector(".ss-root.ss-game")).not.toBeNull();
    expect(document.querySelector(".ss-board")).toHaveAttribute(
      "data-mode",
      "away",
    );
    expect(
      screen.getByText(strings.play.board.instruction.away),
    ).toBeInTheDocument();
  });

  test("render at build time with no browser to read, and have real titles", () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("localStorage", undefined);
    let html: string;
    try {
      html = renderToString(
        <MemoryRouter initialEntries={["/play/home"]}>
          <Play />
        </MemoryRouter>,
      );
    } finally {
      vi.unstubAllGlobals();
    }
    expect(html).toContain(strings.play.heading.home);
    expect(html).not.toContain("Anfield");

    const tags =
      playMeta({ location: { pathname: "/play/away" } } as Parameters<
        typeof playMeta
      >[0]) ?? [];
    expect(tags).toContainEqual({ title: strings.play.title.away });
  });
});

describe("the rules page", () => {
  test("old links still work: the pop-up's card on a page of the game, and the way back", () => {
    site("/how-to-play?time=23:00");
    // Sized from the device's own pixels, like every other screen.
    const root = document.querySelector(".ss-root.ss-page");
    expect(root).not.toBeNull();
    expect((root as HTMLElement).style.getPropertyValue("--px")).not.toBe("");
    const heading = screen.getByRole("heading", {
      level: 1,
      name: strings.howToPlay.heading,
    });
    // The same card as the pop-up on the home screen, its heading the page's.
    expect(heading).toHaveClass("ss-help__title");
    expect(heading.className).not.toMatch(/\btext-/);
    expect(heading.closest(".ss-help")).not.toBeNull();
    expect(document.querySelector("dialog")).toBeNull();
    expect(screen.getByText(strings.howToPlay.intro)).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual([
      strings.howToPlay.shots.heading,
      strings.howToPlay.career.heading,
    ]);
    expect(document.querySelectorAll(".ss-help__shot")).toHaveLength(6);
    expect(
      screen.getByRole("link", { name: strings.play.back }),
    ).toHaveAttribute("href", "/?time=23:00");
  });

  test("renders at build time with no browser to read", () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    let html: string;
    try {
      html = renderToString(
        <MemoryRouter initialEntries={["/how-to-play"]}>
          <HowToPlay />
        </MemoryRouter>,
      );
    } finally {
      vi.unstubAllGlobals();
    }
    // The whole of the rules is in the prerendered page: no script needed to read them.
    expect(html).toContain(strings.howToPlay.heading);
    expect(html).toContain(strings.howToPlay.intro);
    expect(html).toContain(strings.howToPlay.career.heading);
    expect(html).toContain(strings.play.shots.toepoke);
    expect(html).toContain('href="/"');
    const tags = rulesMeta({} as Parameters<typeof rulesMeta>[0]) ?? [];
    expect(tags).toContainEqual({
      title: `${strings.howToPlay.title} · ${strings.siteName}`,
    });
  });
});

describe("the error page", () => {
  test("an address that does not exist says so, in a PixelRoot", () => {
    render(<ErrorBoundary {...boundaryProps(NOT_FOUND)} />);
    expect(screen.getByRole("heading", { level: 1, name: "404" })).toHaveClass(
      "ss-t20",
    );
    expect(screen.getByText(strings.errors.notFound)).toBeInTheDocument();
    expect(document.querySelector(".ss-root.ss-page main")).not.toBeNull();
    // The way back loads the page afresh: a plain link, in the kit's button.
    const back = screen.getByRole("link", { name: strings.play.back });
    expect(back).toHaveAttribute("href", "/");
    expect(back).toHaveClass("ss-btn", "ss-btn--primary");
  });

  test("anything else is the game's own apology", () => {
    vi.stubEnv("DEV", false);
    try {
      render(<ErrorBoundary {...boundaryProps(new Error("secret detail"))} />);
    } finally {
      vi.unstubAllEnvs();
    }
    expect(
      screen.getByRole("heading", { level: 1, name: strings.errors.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(strings.errors.unexpected)).toBeInTheDocument();
    expect(screen.queryByText(/secret detail/)).toBeNull();
  });

  test("over the build's fallback document it first renders exactly what that document has", () => {
    // `__spa-fallback.html` is the root layout round HydrateFallback. For an address that
    // does not exist the browser takes it over with the error page: the two must match,
    // or React reports a hydration error on every unknown address.
    const fallback = renderToString(<HydrateFallback />);
    const taking = renderToString(
      <ErrorBoundary {...boundaryProps(NOT_FOUND)} />,
    );
    expect(taking).toBe(fallback);
    expect(fallback).toContain('class="ss-root ss-page ');
    expect(fallback).not.toContain("404");
  });
});

describe("focus, from page to page", () => {
  const made = () => vi.spyOn(MenuScene.prototype, "setScores");

  /** Run the scene as the canvas host would. There is no canvas in the tests. */
  function run(scene: MenuScene, seconds: number): void {
    act(() => {
      for (let t = 0; t < seconds; t += 1 / 60) scene.update(1 / 60);
    });
  }

  test("the page the browser loaded leaves the focus where the browser put it", () => {
    // (The game page then puts it in its answer field: see play.test.tsx.)
    site("/how-to-play", true);
    expect(document.activeElement).toBe(document.body);
  });

  test("the kick-off ends on the mode page: its heading, then the answer field", async () => {
    const scenes = made();
    site("/?day=1");
    expect(document.activeElement).toBe(document.body);

    const away = screen.getByRole("button", { name: /AWAY/ });
    act(() => away.focus());
    fireEvent.click(away);
    // Chosen while the ball is still arriving: the entrance ends first, then the kick-off.
    run(scenes.mock.contexts.at(-1) as MenuScene, 3);

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: strings.play.heading.away,
    });
    expect(heading).toHaveAttribute("tabindex", "-1");
    // The heading took the focus on arrival; the game then puts it in the answer field,
    // which is the next thing after the heading for a screen reader too.
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: strings.play.answer.input }),
    );
  });

  test("the rules pop up over the menu and close back to the ? button", () => {
    site("/?day=1");
    const help = screen.getByRole("button", { name: strings.howToPlay.title });
    act(() => help.focus());
    fireEvent.click(help);
    const dialog = screen.getByRole("dialog", {
      name: strings.howToPlay.heading,
    });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    fireEvent.click(
      screen.getByRole("button", { name: strings.howToPlay.close }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(help).toHaveFocus();
    // Still the home page.
    expect(
      screen.getByRole("heading", { level: 1, name: strings.siteName }),
    ).toBeInTheDocument();
  });

  test("the old rules page and back", async () => {
    site("/how-to-play?day=1");
    const back = screen.getByRole("link", { name: strings.play.back });
    expect(back).toHaveAttribute("href", "/?day=1");
    fireEvent.click(back);
    expect(
      await screen.findByRole("heading", { level: 1, name: strings.siteName }),
    ).toHaveFocus();
  });
});
