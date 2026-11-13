import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Surface, TRANSPARENT, rgb } from "~/pixel";
import { ballShowPose, ballSlotCenter, type BallSlot } from "~/art/ball";
import { menuLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { logoSize } from "~/art/logo";
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
    // NEXT-GEN goes out in a flare, with AWAY's sparkle
    expect(heard("nextgen")).toEqual(["kick", "sparkle", "transition"]);
    // RETRO bounces on the road and comes to a stop with a touch
    expect(heard("retro")).toEqual(["kick", "land", "touch", "transition"]);
  });

  it("RETRO's ball ends left of the middle on the road, NEXT-GEN's high in the sky", () => {
    for (const [w, h] of SIZES) {
      for (const mode of ["retro", "nextgen"] as const) {
        const scene = make(w, h);
        scene.choose(mode);
        const end = { x: 0, y: 0 };
        // where the iris closes is where the ball went: read it from the ink
        for (let i = 0; i < 180 && scene.phase !== "done"; i++) {
          scene.update(STEP);
          const s = draw(scene, w, h);
          let n = 0;
          let sx = 0;
          let sy = 0;
          for (let y = 0; y < h; y += 2) {
            for (let x = 0; x < w; x += 2) {
              if (s.data[y * w + x] !== FLAT) continue;
              n++;
              sx += x;
              sy += y;
            }
          }
          if (n > 0 && i > 60) {
            end.x = sx / n;
            end.y = sy / n;
          }
        }
        const m = menuLayout(w, h);
        if (mode === "retro") {
          expect(end.x, `${w}`).toBeLessThan(m.cx);
          expect(end.y, `${w}`).toBeGreaterThan(m.ballCy);
        } else {
          expect(end.y, `${w}`).toBeLessThan(m.logo.h + m.ballR);
        }
      }
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
  });

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
