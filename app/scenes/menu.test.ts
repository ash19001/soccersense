import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Surface, TRANSPARENT, mix, rgb } from "~/pixel";
import { ballShowPose, ballSlotCenter, type BallSlot } from "~/art/ball";
import { menuLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { logoSize } from "~/art/logo";
import { P } from "~/art/palette";
import { MenuBackdrop } from "~/art/stadium";
import type { Mode } from "~/game";
import { LOCKED_MODES, MODE_SLOTS, MenuScene, type MenuLabels } from "./menu";

// The menu scene: only whether pixels are covered and where the scene says things are (the
// backdrop is swapped for one flat colour), the press's feel, and the wordmark's sizes.

const LABELS: MenuLabels = {
  home: "HOME",
  away: "AWAY",
  nextgen: "NEXT-GEN",
  retro: "RETRO",
  closest: "CLOSEST",
  furthest: "FURTHEST",
  guesswho: "GUESS WHO",
  shootout: "SHOOTOUT",
  header: "DID YOU KNOW?",
  tagline: "DAILY FOOTBALL TRIVIA",
};
const DAY = lightingFor({ elevation: 45, morning: false });
const NIGHT = lightingFor({ elevation: -30, morning: false });
const FLAT = rgb(0xff00ff);
const STEP = 1 / 60;

/** Canvases: the reference monitor, 1366 x 768, a 390 x 844 phone at 3 and at 2. */
const SIZES: readonly (readonly [number, number])[] = [
  [960, 540],
  [683, 384],
  [234, 507],
  [260, 562],
];

beforeEach(() => {
  vi.spyOn(MenuBackdrop.prototype, "draw").mockImplementation((s) => {
    s.clear(FLAT);
  });
  vi.spyOn(MenuBackdrop.prototype, "airshipAt").mockReturnValue(false);
  vi.spyOn(MenuBackdrop.prototype, "mascotAt").mockReturnValue(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function make(w: number, h: number): MenuScene {
  const scene = new MenuScene({
    seed: 7,
    fact: "A fact.",
    labels: LABELS,
    intro: false,
  });
  scene.resize(w, h);
  scene.setLighting(DAY);
  return scene;
}

function patch(slot: BallSlot, w: number, h: number): { x: number; y: number } {
  const m = menuLayout(w, h);
  return ballSlotCenter(
    {
      cx: m.cx,
      cy: m.ballCy,
      r: m.ballR,
      yaw: 0,
      pitch: 0,
      hovered: null,
      pressed: null,
      chosen: null,
      t: 0,
    },
    slot,
  );
}

function draw(scene: MenuScene, w: number, h: number): Surface {
  const s = new Surface(w, h);
  scene.draw(s);
  return s;
}

describe("the menu", () => {
  it("a press that wobbles by four pixels is still a click", () => {
    const [W, H] = SIZES[0];
    for (const [slot, mode] of [
      ["left", "home"],
      ["right", "away"],
    ] as const) {
      const scene = make(W, H);
      const kicked: Mode[] = [];
      scene.onKickoff = (m) => kicked.push(m);
      const p = patch(slot, W, H);
      scene.pointer({ type: "down", x: p.x, y: p.y });
      scene.pointer({ type: "move", x: p.x + 4, y: p.y - 2 });
      scene.update(STEP);
      expect(scene.cursor()).toBe("pointer");
      scene.pointer({ type: "up", x: p.x + 4, y: p.y - 2 });
      expect(kicked).toEqual([mode]);
    }
  });

  it("each open patch is its mode: hovered, pressed and kicked off", () => {
    const [W, H] = SIZES[0];
    for (const [slot, mode] of [
      ["left", "home"],
      ["right", "away"],
      ["top", "nextgen"],
      ["bottom", "retro"],
    ] as const) {
      const scene = make(W, H);
      const hovers: (Mode | null)[] = [];
      const kicked: Mode[] = [];
      const chosen: Mode[] = [];
      const locked: string[] = [];
      scene.onHover = (m) => hovers.push(m);
      scene.onKickoff = (m) => kicked.push(m);
      scene.onChoose = (m) => chosen.push(m);
      scene.onLocked = (m) => locked.push(m);
      const p = patch(slot, W, H);
      scene.pointer({ type: "move", x: p.x, y: p.y });
      expect(hovers).toEqual([mode]);
      expect(scene.cursor()).toBe("pointer");
      scene.pointer({ type: "down", x: p.x, y: p.y });
      scene.pointer({ type: "up", x: p.x, y: p.y });
      expect(kicked).toEqual([mode]);
      expect(hovers.at(-1)).toBeNull();
      for (let i = 0; i < 180 && scene.phase !== "done"; i++) {
        scene.update(STEP);
      }
      expect(chosen).toEqual([mode]);
      expect(locked).toEqual([]);
    }
  });

  it("a mode played today is played once a day: its patch asks for the review, never a kick-off", () => {
    const [W, H] = SIZES[0];
    for (const [slot, mode] of [
      ["left", "home"],
      ["right", "away"],
      ["top", "nextgen"],
      ["bottom", "retro"],
    ] as const) {
      const scene = make(W, H);
      scene.setScores({ [mode]: 412 });
      const kicked: Mode[] = [];
      const reviewed: Mode[] = [];
      scene.onKickoff = (m) => kicked.push(m);
      scene.onReview = (m) => reviewed.push(m);
      const p = patch(slot, W, H);
      scene.pointer({ type: "move", x: p.x, y: p.y });
      scene.pointer({ type: "down", x: p.x, y: p.y });
      scene.pointer({ type: "up", x: p.x, y: p.y });
      expect(reviewed).toEqual([mode]);
      expect(kicked).toEqual([]);
      // Nor from the DOM.
      expect(scene.choose(mode)).toBe(false);
      for (let i = 0; i < 60; i++) scene.update(STEP);
      expect(scene.phase).not.toBe("kickoff");
      expect(kicked).toEqual([]);
      // Its score taken off (a new day): it kicks off again.
      scene.setScores({ [mode]: null });
      expect(scene.choose(mode)).toBe(true);
      expect(kicked).toEqual([mode]);
    }
  });

  it("the locked patches stay locked: shown by a quarter turn, a press says no", () => {
    const [W, H] = SIZES[0];
    const m = menuLayout(W, H);
    const scene = make(W, H);
    const kicked: Mode[] = [];
    const locked: string[] = [];
    scene.onKickoff = (k) => kicked.push(k);
    scene.onLocked = (k) => locked.push(k);
    // a quarter turn to the right brings GUESS WHO round to the front, and it rests there
    const y = m.ballCy + 6;
    const from = m.cx - Math.round(m.ballR * 0.9);
    const to = m.cx + Math.round(m.ballR * 0.6);
    scene.pointer({ type: "down", x: from, y });
    for (let i = 1; i <= 20; i++) {
      scene.pointer({ type: "move", x: from + ((to - from) * i) / 20, y });
      scene.update(STEP);
    }
    for (let i = 0; i < 20; i++) scene.update(STEP);
    scene.pointer({ type: "up", x: to, y });
    scene.pointer({ type: "leave", x: 0, y: 0 });
    for (let i = 0; i < 60; i++) scene.update(STEP);
    const at = ballSlotCenter(
      {
        cx: m.cx,
        cy: m.ballCy,
        r: m.ballR,
        ...ballShowPose("rimLeft"),
        hovered: null,
        pressed: null,
        chosen: null,
        t: 0,
      },
      "rimLeft",
    );
    scene.pointer({ type: "down", x: at.x, y: at.y });
    scene.pointer({ type: "up", x: at.x, y: at.y });
    expect(locked).toEqual(["guesswho"]);
    expect(kicked).toEqual([]);
    expect(LOCKED_MODES).toEqual([
      "closest",
      "furthest",
      "guesswho",
      "shootout",
    ]);
    // and none of them is on the top or the bottom patch any more
    for (const mode of LOCKED_MODES) {
      expect(["top", "bottom", "left", "right"]).not.toContain(
        MODE_SLOTS[mode],
      );
    }
  });

  it("RETRO and NEXT-GEN kick off with their own sounds, once each", () => {
    const [W, H] = SIZES[0];
    const heard = (mode: Mode): string[] => {
      const scene = make(W, H);
      const cues: string[] = [];
      scene.onSound = (cue) => {
        if (cue.kind !== "wind") cues.push(cue.kind);
      };
      scene.choose(mode);
      for (let i = 0; i < 180 && scene.phase !== "done"; i++) {
        scene.update(STEP);
      }
      return cues;
    };
    // neither is struck. NEXT-GEN: time turns on with a whoosh, and the ball of the future
    // powers on with a twinkle
    expect(heard("nextgen")).toEqual(["sweep", "sparkle", "transition"]);
    // RETRO: time turns back with a whoosh, the old ball is finished with a twinkle and
    // settles with a soft thump
    expect(heard("retro")).toEqual(["sweep", "sparkle", "land", "transition"]);
  });

  it("NEXT-GEN turns the ball into the ball of the future where it hangs, the world goes neon and the iris closes on it", () => {
    // the future ball's black chrome (its five bands) and its lit seams' core (raw)
    const chrome = new Set(
      [
        mix(P.slate, P.steel, 0.25),
        mix(P.slate, P.nextgenDark, 0.2),
        mix(P.night, P.nextgenDark, 0.14),
        mix(P.night, P.ink, 0.45),
        mix(P.ink, P.nextgenDark, 0.06),
      ].map((c): number => DAY.lit(c)),
    );
    const white = DAY.lit(P.chalk);
    for (const [w, h] of SIZES) {
      const m = menuLayout(w, h);
      const scene = make(w, h);
      scene.choose("nextgen");
      const look = (s: Surface) => {
        let future = 0;
        let seam = 0;
        let menu = 0;
        const r = m.ballR - 2;
        for (let y = m.ballCy - r; y <= m.ballCy + r; y++) {
          for (let x = m.cx - r; x <= m.cx + r; x++) {
            if ((x - m.cx) ** 2 + (y - m.ballCy) ** 2 > (r - 8) ** 2) continue;
            const c = s.data[y * w + x];
            if (chrome.has(c)) future++;
            if (c === P.nextgenLight) seam++;
            if (c === white) menu++;
          }
        }
        return { future, seam, menu, flat: s.data[2 * w + 2] === FLAT };
      };
      let t = 0;
      const until = (at: number): Surface => {
        while (t < at - 1e-9) {
          scene.update(STEP);
          t += STEP;
        }
        return draw(scene, w, h);
      };
      // struck? no: the ball is still the menu ball, where it hangs, as its patch flashes
      const first = look(until(0.15));
      expect(first.menu, `${w}`).toBeGreaterThan(50);
      expect(first.future, `${w}`).toBe(0);
      // spinning down: the ball of the future, its seams dim, the world as it was
      const spinning = look(until(0.22 + 0.4));
      expect(spinning.menu, `${w}`).toBe(0);
      expect(spinning.future, `${w}`).toBeGreaterThan(20);
      expect(spinning.seam, `${w}`).toBe(0);
      expect(spinning.flat, `${w}`).toBe(true);
      // stopped and powered on, the world neon
      const done = look(until(1.05));
      expect(done.menu, `${w}`).toBe(0);
      expect(done.future, `${w}`).toBeGreaterThan(20);
      expect(done.seam, `${w}`).toBeGreaterThan(10);
      expect(done.flat, `${w}`).toBe(false);
      // the iris closes on the ball: what it leaves is round the ball's spot (a little
      // above it: the light ball lifts)
      const s = until(1.65);
      let n = 0;
      let sx = 0;
      let sy = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (s.data[y * w + x] === P.ink) continue;
          n++;
          sx += x;
          sy += y;
        }
      }
      expect(n, `${w}`).toBeGreaterThan(0);
      expect(Math.abs(sx / n - m.cx), `${w}`).toBeLessThan(3);
      expect(Math.abs(sy / n - m.ballCy), `${w}`).toBeLessThan(m.ballR * 0.12);
    }
  });

  it("RETRO turns the ball into an old leather one where it hangs, the world goes sepia and the iris closes on it", () => {
    const wood = DAY.lit(P.wood);
    const modern = [DAY.lit(P.chalk), DAY.lit(P.steelHi)];
    for (const [w, h] of SIZES) {
      const m = menuLayout(w, h);
      const scene = make(w, h);
      scene.choose("retro");
      // what is inside the ball's disc, and whether the world is still the flat backdrop
      const look = (s: Surface) => {
        let leather = 0;
        let white = 0;
        const r = m.ballR - 2;
        for (let y = m.ballCy - r; y <= m.ballCy + r; y++) {
          for (let x = m.cx - r; x <= m.cx + r; x++) {
            if ((x - m.cx) ** 2 + (y - m.ballCy) ** 2 > (r - 4) ** 2) continue;
            const c = s.data[y * w + x];
            if (c === wood) leather++;
            if (modern.includes(c as (typeof modern)[number])) white++;
          }
        }
        return { leather, white, flat: s.data[2 * w + 2] === FLAT };
      };
      let t = 0;
      const until = (at: number): Surface => {
        while (t < at - 1e-9) {
          scene.update(STEP);
          t += STEP;
        }
        return draw(scene, w, h);
      };
      // struck? no: the ball is still the menu ball, where it hangs, as its patch flashes
      const first = look(until(0.15));
      expect(first.white, `${w}`).toBeGreaterThan(50);
      expect(first.leather, `${w}`).toBe(0);
      // half way up the ball: both
      const half = look(until(0.22 + 0.25));
      expect(half.leather, `${w}`).toBeGreaterThan(20);
      expect(half.white, `${w}`).toBeGreaterThan(20);
      expect(half.flat, `${w}`).toBe(true);
      // finished: all leather, and the world an old photograph
      const done = look(until(1.05));
      expect(done.white, `${w}`).toBe(0);
      expect(done.leather, `${w}`).toBeGreaterThan(50);
      expect(done.flat, `${w}`).toBe(false);
      // the iris closes on the old ball: what it leaves is round the ball's spot
      const s = until(1.65);
      let n = 0;
      let sx = 0;
      let sy = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (s.data[y * w + x] === P.ink) continue;
          n++;
          sx += x;
          sy += y;
        }
      }
      expect(n, `${w}`).toBeGreaterThan(0);
      expect(Math.abs(sx / n - m.cx), `${w}`).toBeLessThan(3);
      expect(Math.abs(sy / n - m.ballCy), `${w}`).toBeLessThan(m.ballR * 0.1);
    }
  });

  it("a press that moves more than 6 pixels is a drag", () => {
    const [W, H] = SIZES[0];
    const scene = make(W, H);
    const kicked: Mode[] = [];
    scene.onKickoff = (m) => kicked.push(m);
    const p = patch("left", W, H);
    scene.pointer({ type: "down", x: p.x, y: p.y });
    scene.pointer({ type: "move", x: p.x + 7, y: p.y });
    scene.update(STEP);
    expect(scene.cursor()).toBe("grabbing");
    scene.pointer({ type: "up", x: p.x + 7, y: p.y });
    expect(kicked).toEqual([]);
  });

  it("runs every kick-off to the end on every canvas, day and night, covering it every frame", () => {
    for (const [w, h] of SIZES) {
      for (const mode of ["home", "away", "nextgen", "retro"] as const) {
        for (const light of [DAY, NIGHT]) {
          const scene = make(w, h);
          scene.setLighting(light);
          let chosen = 0;
          scene.onChoose = () => chosen++;
          expect(scene.choose(mode)).toBe(true);
          for (let t = 0; t < 3 && scene.phase !== "done"; t += STEP * 3) {
            scene.update(STEP * 3);
            const s = draw(scene, w, h);
            expect(s.data.includes(TRANSPARENT)).toBe(false);
          }
          expect(scene.phase).toBe("done");
          expect(chosen).toBe(1);
        }
      }
    }
    // 32 kick-offs, NEXT-GEN's and RETRO's re-toning the whole picture every frame: about
    // 2.6 s alone, more with every test file running at once
  }, 30_000);

  it("draws the entrance, the spin and its wind without leaving the canvas bare", () => {
    for (const [w, h] of SIZES) {
      const scene = new MenuScene({ seed: 3, fact: "A fact.", labels: LABELS });
      scene.resize(w, h);
      scene.setLighting(NIGHT);
      for (let i = 0; i < 70; i++) {
        scene.update(STEP);
        expect(draw(scene, w, h).data.includes(TRANSPARENT)).toBe(false);
      }
      const p = patch("left", w, h);
      scene.pointer({ type: "down", x: p.x, y: p.y });
      for (let i = 1; i <= 6; i++) {
        scene.pointer({ type: "move", x: p.x + i * 20, y: p.y + i * 4 });
        scene.update(STEP);
      }
      scene.pointer({ type: "up", x: p.x + 120, y: p.y + 24 });
      for (let i = 0; i < 20; i++) {
        scene.update(STEP);
        expect(draw(scene, w, h).data.includes(TRANSPARENT)).toBe(false);
      }
    }
  });

  it("sizes the wordmark stacked or on one line, with and without its tagline", () => {
    const tagline = "DAILY FOOTBALL TRIVIA";
    expect(logoSize({ maxWidth: 208 })).toEqual({
      w: 148,
      h: 62,
      stacked: true,
    });
    expect(logoSize({ maxWidth: 400 })).toEqual({
      w: 264,
      h: 34,
      stacked: false,
    });
    expect(logoSize({ maxWidth: 208, tagline })).toEqual({
      w: 166,
      h: 76,
      stacked: true,
    });
    expect(logoSize({ maxWidth: 400, tagline })).toEqual({
      w: 264,
      h: 48,
      stacked: false,
    });
  });
});

describe("the plane with the fact", () => {
  it("flies until the page turns it off, and stays off for a new fact", () => {
    const banner = vi.spyOn(MenuBackdrop.prototype, "setBanner");
    const scene = make(240, 444);
    expect(banner).toHaveBeenLastCalledWith(expect.stringContaining("A FACT."));
    scene.setPlane(false);
    expect(banner).toHaveBeenLastCalledWith("");
    scene.setFact("Another fact.");
    expect(banner).toHaveBeenLastCalledWith("");
    scene.setPlane(true);
    expect(banner).toHaveBeenLastCalledWith(
      expect.stringContaining("ANOTHER FACT."),
    );
  });
});
