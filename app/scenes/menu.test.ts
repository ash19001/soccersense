import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Surface, TRANSPARENT, mix, rgb } from "~/pixel";
import { ballShowPose, ballSlotCenter, type BallSlot } from "~/art/ball";
import { menuLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { logoSize } from "~/art/logo";
import { P } from "~/art/palette";
import { MenuBackdrop } from "~/art/stadium";
import type { Mode } from "~/game";
import { GOLD_SHOW_LAUNCHES, GOLD_SHOW_LEN } from "~/art/gold-show";
import { HOME_PAGE } from "~/audio/mix";
import {
  GOLD_SPIN,
  LOCKED_MODES,
  MODE_SLOTS,
  MenuScene,
  type MenuLabels,
} from "./menu";
import type { SoundCue } from "./scene";

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

  it("floats the hovering ball on its own, finer than the picture's pixels, for a host that can show it", () => {
    for (const [w, h] of SIZES) {
      const m = menuLayout(w, h);
      // what of the ball's disc is in the picture itself (the backdrop is FLAT here)
      const inPicture = (s: Surface): number => {
        let n = 0;
        const r = m.ballR - 3;
        for (let y = m.ballCy - r; y <= m.ballCy + r; y++) {
          for (let x = m.cx - r; x <= m.cx + r; x++) {
            if ((x - m.cx) ** 2 + (y - m.ballCy) ** 2 > (r - 4) ** 2) continue;
            if (s.data[y * w + x] !== FLAT) n++;
          }
        }
        return n;
      };
      // a host that cannot: the ball is in the picture, and nothing floats
      const plain = make(w, h);
      plain.update(STEP);
      expect(inPicture(draw(plain, w, h)), `${w}`).toBeGreaterThan(100);
      expect(plain.floating(), `${w}`).toEqual([]);

      const scene = make(w, h);
      scene.setFloating(true);
      const ys: number[] = [];
      for (let i = 0; i < 4 * 60; i++) {
        scene.update(STEP);
        const s = draw(scene, w, h);
        const floating = scene.floating();
        // the ball, on top (the airship is the backdrop's, which is not drawn here)
        const f = floating[floating.length - 1];
        if (!f) throw new Error("not floating");
        if (i === 0) {
          // the ball is on the sprite, centred, and not in the picture
          expect(inPicture(s), `${w}`).toBe(0);
          const mid = (f.surface.w - 1) >> 1;
          expect(f.surface.get(mid, mid), `${w}`).not.toBe(TRANSPARENT);
          expect(f.x + mid, `${w}`).toBe(m.cx);
        }
        ys.push(f.y);
      }
      // a whole bob, in more places than whole pixels, never more than a fifth of a pixel
      // a frame
      expect(
        ys.some((y) => !Number.isInteger(y)),
        `${w}`,
      ).toBe(true);
      for (let i = 1; i < ys.length; i++) {
        expect(Math.abs(ys[i] - ys[i - 1]), `${w}`).toBeLessThan(0.2);
      }
      // the kick-off: the ball is back in the picture, where its effects are drawn over it
      scene.choose("home");
      scene.update(STEP);
      expect(inPicture(draw(scene, w, h)), `${w}`).toBeGreaterThan(100);
      expect(scene.floating(), `${w}`).toEqual([]);
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

describe("the golden ball", () => {
  const GOLDEN = { header: "GOLDEN BALL!", text: "YOU FOUND IT" };
  const [W, H] = SIZES[0];

  beforeEach(() => {
    // only the ball's own sounds, and no town to paint for the mascot
    vi.spyOn(MenuBackdrop.prototype, "cuesBetween").mockReturnValue([]);
    vi.spyOn(MenuBackdrop.prototype, "pokeMascot").mockReturnValue("trick");
  });

  /** A hand on the ball: it keeps it spinning (a drag back and forth), or holds it still. */
  function hand(scene: MenuScene) {
    const m = menuLayout(W, H);
    const reach = m.ballR * 0.8;
    const step = m.ballR / 20;
    const y = m.ballCy + 6;
    let i = 0;
    scene.pointer({ type: "down", x: m.cx - reach, y });
    return {
      spin(seconds: number): void {
        for (let n = Math.round(seconds / STEP); n > 0; n--) {
          i++;
          const u = ((i * step) / (4 * reach)) % 1;
          const x = m.cx + reach * (u < 0.5 ? 4 * u - 1 : 3 - 4 * u);
          scene.pointer({ type: "move", x, y });
          scene.update(STEP);
        }
      },
      hold(seconds: number): void {
        for (let n = Math.round(seconds / STEP); n > 0; n--) scene.update(STEP);
      },
    };
  }

  /** Pixels of colour `c` in the ring just outside the ball's rim (its glow's place). */
  function round(scene: MenuScene, c: number): number {
    const m = menuLayout(W, H);
    const s = draw(scene, W, H);
    let n = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - m.cx, y - m.ballCy);
        if (d > m.ballR + 3 && d < m.ballR * 1.25 && s.get(x, y) === c) n++;
      }
    }
    return n;
  }

  /** Pixels of gold leather on the ball (inside its rim: the glow round it is gold too). */
  function leather(scene: MenuScene): number {
    const m = menuLayout(W, H);
    const s = draw(scene, W, H);
    const gold = DAY.lit(P.gold);
    let n = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - m.cx, y - m.ballCy);
        if (d < m.ballR - 4 && s.get(x, y) === gold) n++;
      }
    }
    return n;
  }

  it("turns to gold when the hand keeps it spinning for GOLD_SPIN seconds, and not before", () => {
    const scene = make(W, H);
    const cues: SoundCue[] = [];
    scene.onSound = (cue) => {
      // (the wind and the shimmer come every frame: the shimmer has its own test below)
      if (cue.kind !== "wind" && cue.kind !== "shimmer") cues.push(cue);
    };
    let found = 0;
    scene.onGolden = () => found++;
    expect(leather(scene)).toBe(0);
    const h = hand(scene);
    h.spin(GOLD_SPIN - 2);
    expect(scene.isGolden).toBe(false);
    expect(scene.spinCharge).toBeGreaterThan(0.85);
    expect(found).toBe(0);
    expect(cues.some((cue) => cue.kind === "sparkle")).toBe(false);

    h.spin(3);
    expect(scene.isGolden).toBe(true);
    expect(found).toBe(1);
    // what was spun is spent: the next gold is another GOLD_SPIN away
    expect(scene.spinCharge).toBeLessThan(0.1);
    // its own chime, once, and never AWAY's twinkle
    expect(cues.filter((cue) => cue.kind === "sparkle")).toEqual([
      { kind: "sparkle", golden: true },
    ]);
    expect(cues).toContainEqual({ kind: "cheer", size: HOME_PAGE.goldenCheer });
    expect(MenuBackdrop.prototype.pokeMascot).toHaveBeenCalledTimes(1);

    // the show: every rocket is heard once, far off, and the ground roars meanwhile
    const roar = vi.spyOn(MenuBackdrop.prototype, "setRoar");
    h.hold(1);
    draw(scene, W, H);
    expect(roar).toHaveBeenLastCalledWith(1);
    h.hold(GOLD_SHOW_LEN + 4);
    draw(scene, W, H);
    expect(roar).toHaveBeenLastCalledWith(0);
    expect(cues.filter((cue) => cue.kind === "firework")).toEqual(
      GOLD_SHOW_LAUNCHES.map(() => ({ kind: "firework", distant: true })),
    );
    // and it stays gold
    expect(scene.isGolden).toBe(true);
    expect(leather(scene)).toBeGreaterThan(1000);
    expect(found).toBe(1);
  });

  it("counts a short pause between flicks, and runs down after a long one", () => {
    const scene = make(W, H);
    const h = hand(scene);
    h.spin(10);
    const spun = scene.spinCharge;
    expect(spun).toBeGreaterThan(0.3);
    expect(spun).toBeLessThan(0.34);
    // held still for a second: nothing is lost, and nothing gained yet
    h.hold(1);
    expect(scene.spinCharge).toBeGreaterThanOrEqual(spun);
    expect(scene.spinCharge).toBeLessThan(spun + 0.01);
    // turning again: the pause was part of the spinning
    h.spin(0.5);
    expect(scene.spinCharge).toBeGreaterThan(spun + 1.3 / GOLD_SPIN);
    // left alone: after the grace it runs down four times as fast as it built
    h.hold(1.5 + 1);
    expect(scene.spinCharge).toBeGreaterThan(0.15);
    expect(scene.spinCharge).toBeLessThan(spun);
    h.hold(3);
    expect(scene.spinCharge).toBe(0);
    expect(scene.isGolden).toBe(false);
  });

  it("shows how near it is: a glow of gold round the ball, then the ball flickering gold", () => {
    const scene = make(W, H);
    const h = hand(scene);
    expect(round(scene, P.gold)).toBe(0);
    h.spin(GOLD_SPIN * 0.2);
    expect(round(scene, P.gold)).toBe(0);
    h.spin(GOLD_SPIN * 0.2);
    const thin = round(scene, P.gold);
    expect(thin).toBeGreaterThan(100);
    h.spin(GOLD_SPIN * 0.4);
    expect(round(scene, P.gold)).toBeGreaterThan(thin * 1.25);
    // the last of it: gold on some frames, white on others
    h.spin(GOLD_SPIN * 0.1);
    expect(scene.isGolden).toBe(false);
    const frames = new Set<boolean>();
    for (let i = 0; i < 12; i++) {
      h.spin(STEP);
      frames.add(leather(scene) > 1000);
    }
    expect(frames).toEqual(new Set([true, false]));
    // every frame of it covers the canvas
    expect(draw(scene, W, H).data.includes(TRANSPARENT)).toBe(false);
  });

  it("says so on the airship's sign for a while, then the page's messages again", () => {
    const said = vi.spyOn(MenuBackdrop.prototype, "setMessages");
    const scene = new MenuScene({
      seed: 7,
      fact: "A fact.",
      labels: { ...LABELS, golden: GOLDEN },
      intro: false,
    });
    scene.resize(W, H);
    scene.setLighting(DAY);
    const day = [{ header: "HOME TODAY", text: "360 PTS" }];
    scene.setSignMessages(day);
    expect(said).toHaveBeenLastCalledWith(day);
    const h = hand(scene);
    h.spin(GOLD_SPIN + 1);
    expect(scene.isGolden).toBe(true);
    expect(said).toHaveBeenLastCalledWith([GOLDEN]);
    // the page's messages meanwhile wait their turn
    const later = [{ header: "AWAY TODAY", text: "87 PTS" }];
    scene.setSignMessages(later);
    expect(said).toHaveBeenLastCalledWith([GOLDEN]);
    h.hold(12);
    expect(said).toHaveBeenLastCalledWith(later);
  });

  it("with reduced motion it turns to gold with its chime and cheer: no roar, no rockets", () => {
    const roar = vi.spyOn(MenuBackdrop.prototype, "setRoar");
    const scene = make(W, H);
    scene.setReducedMotion(true);
    const cues: SoundCue[] = [];
    scene.onSound = (cue) => cues.push(cue);
    const h = hand(scene);
    h.spin(GOLD_SPIN + 1);
    expect(scene.isGolden).toBe(true);
    for (let i = 0; i < 8; i++) {
      h.hold(1);
      draw(scene, W, H);
    }
    expect(roar.mock.calls.every(([amount]) => amount === 0)).toBe(true);
    expect(cues.some((cue) => cue.kind === "firework")).toBe(false);
    expect(cues).toContainEqual({ kind: "sparkle", golden: true });
    expect(cues).toContainEqual({ kind: "cheer", size: HOME_PAGE.goldenCheer });
    expect(MenuBackdrop.prototype.pokeMascot).not.toHaveBeenCalled();
    expect(leather(scene)).toBeGreaterThan(1000);
  });

  it("is gold at once when the page says so, with nothing said, and can be taken off", () => {
    const scene = make(W, H);
    const cues: SoundCue[] = [];
    scene.onSound = (cue) => cues.push(cue);
    let found = 0;
    scene.onGolden = () => found++;
    scene.setGolden(true);
    scene.update(STEP);
    expect(scene.isGolden).toBe(true);
    expect(leather(scene)).toBeGreaterThan(1000);
    expect(found).toBe(0);
    // nothing but its quiet shimmer
    expect(cues).toEqual([{ kind: "shimmer", level: HOME_PAGE.goldenShimmer }]);
    // it kicks off as any ball does
    const kicked: Mode[] = [];
    scene.onKickoff = (mode) => kicked.push(mode);
    expect(scene.choose("home")).toBe(true);
    expect(kicked).toEqual(["home"]);
    const plain = make(W, H);
    plain.setGolden(true);
    plain.setGolden(false);
    expect(plain.isGolden).toBe(false);
    expect(leather(plain)).toBe(0);
  });

  it("is heard: a shimmer that comes in with the glow, the ball's own chime, and a quiet shimmer kept", () => {
    const scene = make(W, H);
    // the shimmer's level in the last step (-1: none was sent), and every chime
    const heard = { level: -1 };
    const chimes: SoundCue[] = [];
    scene.onSound = (cue) => {
      if (cue.kind === "shimmer") heard.level = cue.level;
      if (cue.kind === "sparkle") chimes.push(cue);
    };
    const after = (run: () => void): number => {
      run();
      heard.level = -1;
      // one more step: what is sent now
      scene.update(STEP);
      return heard.level;
    };
    const h = hand(scene);
    // nothing before the glow
    expect(after(() => h.spin(GOLD_SPIN * 0.2))).toBe(-1);
    // then it comes in with it, and grows
    const early = after(() => h.spin(GOLD_SPIN * 0.2));
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(HOME_PAGE.goldenShimmerBuild * 0.35);
    const late = after(() => h.spin(GOLD_SPIN * 0.5));
    expect(late).toBeGreaterThan(early * 2);
    expect(late).toBeLessThan(HOME_PAGE.goldenShimmerBuild);
    expect(chimes).toEqual([]);

    // the ball turns: its chime, and the shimmer at its most
    const turned = after(() => {
      while (!scene.isGolden) h.spin(STEP);
    });
    expect(chimes).toEqual([{ kind: "sparkle", golden: true }]);
    expect(turned).toBeGreaterThan(HOME_PAGE.goldenShimmerBuild * 0.95);
    expect(turned).toBeLessThanOrEqual(HOME_PAGE.goldenShimmerBuild);

    // the celebration over: the quiet shimmer a golden ball keeps, for good
    expect(after(() => h.hold(10))).toBe(HOME_PAGE.goldenShimmer);
    expect(after(() => h.hold(60))).toBe(HOME_PAGE.goldenShimmer);
    expect(HOME_PAGE.goldenShimmer).toBeLessThan(
      HOME_PAGE.goldenShimmerBuild / 2,
    );

    // a struck ball takes it with it
    expect(scene.choose("home")).toBe(true);
    expect(after(() => h.hold(0.6))).toBe(-1);
    expect(scene.phase).toBe("kickoff");
  });

  it("does not charge while the ball is still, nor in a stalled tab's long step", () => {
    const scene = make(W, H);
    for (let i = 0; i < 600; i++) scene.update(STEP);
    expect(scene.spinCharge).toBe(0);
    const h = hand(scene);
    h.spin(2);
    const spun = scene.spinCharge;
    scene.update(120);
    expect(scene.spinCharge).toBeLessThanOrEqual(spun);
    expect(scene.isGolden).toBe(false);
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
