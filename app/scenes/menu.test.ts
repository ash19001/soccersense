import { afterEach, describe, expect, it, vi } from "vitest";
import { Surface, TRANSPARENT, rgb } from "~/pixel";
import { ballShowPose, ballSlotCenter, type BallSlot } from "~/art/ball";
import { menuLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { logoSize } from "~/art/logo";
import { P } from "~/art/palette";
import { MenuBackdrop } from "~/art/stadium";
import { schemeForDay } from "~/art/stadium-club";
import type { Mode } from "~/game";
import {
  MenuScene,
  type LockedMode,
  type MenuLabels,
  type MenuPhase,
  type MenuSceneOptions,
} from "./menu";
import type { SoundCue } from "./scene";
import source from "./menu.ts?raw";

// None of these tests looks at what the backdrop paints: only at whether pixels are
// covered, change or match, and at what the scene tells the backdrop through its contract.

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
const FACT =
  "The penalty kick was the idea of William McCrum, a goalkeeper from County Armagh, and arrived in 1891.";

const DAY = lightingFor({ elevation: 45, morning: false });
const NIGHT = lightingFor({ elevation: -30, morning: false });

const SIZES: readonly (readonly [number, number])[] = [
  [130, 281],
  [120, 222],
  [160, 300],
  [480, 270],
];

/** Monitors: the reference, a taller one, a bigger one and a very wide one. */
const MONITORS: readonly (readonly [number, number])[] = [
  [480, 270],
  [480, 300],
  [640, 360],
  [688, 288],
];

const STEP = 1 / 60;

/** A colour nothing in the game is painted in. */
const FLAT = rgb(0xff00ff);

/** Swap the backdrop's picture for one flat colour, so that the ball can be found. */
function flatBackdrop(): void {
  vi.spyOn(MenuBackdrop.prototype, "draw").mockImplementation((s) => {
    s.clear(FLAT);
  });
}

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** The middle of the box, and half its width. */
  cx: number;
  cy: number;
  r: number;
}

/**
 * The box round everything drawn over a flat backdrop below the logo zone: in the
 * entrance and while idle, that is the ball.
 */
function ballBox(scene: MenuScene, w: number, h: number): Box | null {
  const s = draw(scene, w, h);
  const top = menuLayout(w, h).logo.h;
  let x0 = w;
  let x1 = -1;
  let y0 = h;
  let y1 = -1;
  for (let y = top; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (s.data[y * w + x] === FLAT) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return {
    x0,
    x1,
    y0,
    y1,
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
    r: (x1 - x0) / 2,
  };
}

/** The ordinary bob at a size, in pixels each way. */
function bobOf(w: number, h: number): number {
  return Math.max(1, Math.round(menuLayout(w, h).ballR * 0.04));
}

function make(
  w = 130,
  h = 281,
  opts: Partial<MenuSceneOptions> = {},
): MenuScene {
  const scene = new MenuScene({
    seed: 7,
    fact: FACT,
    labels: LABELS,
    intro: false,
    ...opts,
  });
  scene.resize(w, h);
  scene.setLighting(DAY);
  return scene;
}

function advance(scene: MenuScene, seconds: number): void {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) scene.update(STEP);
}

function draw(scene: MenuScene, w = 130, h = 281): Surface {
  const s = new Surface(w, h);
  scene.draw(s);
  return s;
}

function covered(s: Surface): boolean {
  return !s.data.includes(TRANSPARENT);
}

function allInk(s: Surface): boolean {
  return s.data.every((c) => c === P.ink);
}

function same(a: Surface, b: Surface): boolean {
  if (a.w !== b.w || a.h !== b.h) return false;
  for (let i = 0; i < a.data.length; i++) {
    if (a.data[i] !== b.data[i]) return false;
  }
  return true;
}

/** The middle of a patch on the ball at rest. */
function patch(slot: BallSlot, w = 130, h = 281): { x: number; y: number } {
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

/** No airship anywhere: the backdrop's own may be under any point a test picks. */
function noAirship(): void {
  vi.spyOn(MenuBackdrop.prototype, "airshipAt").mockReturnValue(false);
}

function click(scene: MenuScene, slot: BallSlot, touch = false): void {
  const p = patch(slot);
  scene.pointer({ type: "down", x: p.x, y: p.y, touch });
  scene.pointer({ type: "up", x: p.x, y: p.y, touch });
}

interface Log {
  kickoff: Mode[];
  choose: Mode[];
  hover: (Mode | null)[];
  locked: LockedMode[];
}

function listen(scene: MenuScene): Log {
  const log: Log = { kickoff: [], choose: [], hover: [], locked: [] };
  scene.onKickoff = (mode) => log.kickoff.push(mode);
  scene.onChoose = (mode) => log.choose.push(mode);
  scene.onHover = (mode) => log.hover.push(mode);
  scene.onLocked = (mode) => log.locked.push(mode);
  return log;
}

/** Step until the scene is "done". Returns the seconds it took (at most `limit`). */
function runToDone(scene: MenuScene, limit = 5): number {
  let t = 0;
  while (scene.phase !== "done" && t < limit) {
    scene.update(STEP);
    t += STEP;
  }
  return t;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MenuScene: the picture", () => {
  it.each(SIZES)("covers every pixel in every phase at %i x %i", (w, h) => {
    for (const light of [DAY, NIGHT]) {
      // the entrance
      const intro = make(w, h, { intro: true });
      intro.setLighting(light);
      expect(intro.phase).toBe("intro");
      for (let i = 0; i < 12; i++) {
        expect(covered(draw(intro, w, h))).toBe(true);
        advance(intro, 0.08);
      }
      expect(intro.phase).toBe("idle");
      expect(covered(draw(intro, w, h))).toBe(true);

      // both kick-offs, start to finish
      for (const mode of ["home", "away"] as const) {
        const scene = make(w, h);
        scene.setLighting(light);
        expect(scene.choose(mode)).toBe(true);
        for (let i = 0; i < 40 && scene.phase === "kickoff"; i++) {
          expect(covered(draw(scene, w, h))).toBe(true);
          advance(scene, 0.05);
        }
        expect(scene.phase).toBe("done");
        expect(allInk(draw(scene, w, h))).toBe(true);
      }
    }
  });

  it.each(MONITORS)(
    "covers every pixel on a monitor of %i x %i, idle included",
    (w, h) => {
      // idle, through two bobs and a deep breath
      const idle = make(w, h);
      for (let i = 0; i < 28; i++) {
        expect(covered(draw(idle, w, h))).toBe(true);
        advance(idle, 0.4);
      }
      const still = make(w, h);
      still.setReducedMotion(true);
      advance(still, 3);
      expect(covered(draw(still, w, h))).toBe(true);
      // the entrance, every frame of it
      const intro = make(w, h, { intro: true });
      while (intro.phase === "intro") {
        expect(covered(draw(intro, w, h))).toBe(true);
        intro.update(STEP);
      }
      // both kick-offs, chosen while the ball is up in a deep breath
      for (const mode of ["home", "away"] as const) {
        const scene = make(w, h);
        advance(scene, 8.9);
        scene.choose(mode);
        while (scene.phase === "kickoff") {
          expect(covered(draw(scene, w, h))).toBe(true);
          advance(scene, 0.05);
        }
        expect(allInk(draw(scene, w, h))).toBe(true);
      }
    },
  );

  it("draws the same pixels for the same calls", () => {
    const script = (scene: MenuScene): Surface[] => {
      const frames: Surface[] = [];
      const p = patch("right");
      advance(scene, 0.4);
      frames.push(draw(scene));
      scene.pointer({ type: "move", x: p.x, y: p.y });
      advance(scene, 1.3);
      frames.push(draw(scene));
      scene.pointer({ type: "down", x: p.x, y: p.y });
      frames.push(draw(scene));
      scene.pointer({ type: "up", x: p.x, y: p.y });
      for (let i = 0; i < 12; i++) {
        advance(scene, 0.1);
        frames.push(draw(scene));
      }
      return frames;
    };
    const a = script(make(130, 281, { intro: true }));
    const b = script(make(130, 281, { intro: true }));
    expect(a.length).toBe(b.length);
    a.forEach((frame, i) => expect(same(frame, b[i])).toBe(true));
    // and a frame does not depend on how often it was drawn
    const c = make();
    const d = make();
    advance(c, 2.2);
    advance(d, 2.2);
    draw(c);
    draw(c);
    expect(same(draw(c), draw(d))).toBe(true);
  });

  it("moves: the idle picture changes with time", () => {
    const scene = make();
    const a = draw(scene);
    advance(scene, 1.25);
    expect(same(a, draw(scene))).toBe(false);
  });

  it("shows a score on its patch", () => {
    const plain = make();
    const scored = make();
    scored.setScores({ home: 512 });
    expect(same(draw(plain), draw(scored))).toBe(false);
    // null takes it off again, and a missing mode is left alone
    scored.setScores({ away: 87 });
    scored.setScores({ home: null, away: null });
    expect(same(draw(plain), draw(scored))).toBe(true);
    // nonsense is no badge
    scored.setScores({ home: Number.NaN });
    expect(same(draw(plain), draw(scored))).toBe(true);
  });

  it("shows a hover set from the DOM exactly as the pointer's", () => {
    const plain = make();
    const dom = make();
    const pointer = make();
    dom.setHovered("home");
    const p = patch("left");
    pointer.pointer({ type: "move", x: p.x, y: p.y });
    expect(same(draw(plain), draw(dom))).toBe(false);
    expect(same(draw(dom), draw(pointer))).toBe(true);
    // the pointer wins while it is over a patch
    const q = patch("right");
    dom.pointer({ type: "move", x: q.x, y: q.y });
    const away = make();
    away.setHovered("away");
    expect(same(draw(dom), draw(away))).toBe(true);
    // and the DOM's hover is back when the pointer leaves
    dom.pointer({ type: "leave", x: 0, y: 0 });
    expect(same(draw(dom), draw(pointer))).toBe(true);
    dom.setHovered(null);
    expect(same(draw(dom), draw(plain))).toBe(true);
  });

  it("takes new labels, a new fact and a moon phase", () => {
    const scene = make();
    const before = draw(scene);
    scene.setLabels({ ...LABELS, home: "CASA", tagline: undefined });
    expect(same(before, draw(scene))).toBe(false);
    const labelled = draw(scene);
    scene.setFact("Goal nets arrived in 1889.");
    expect(same(labelled, draw(scene))).toBe(false);
    scene.setMoonPhase(0.25);
    scene.setMoonPhase(Number.NaN);
    expect(covered(draw(scene))).toBe(true);
  });

  it("tells HOME from AWAY in flight", () => {
    const home = make();
    const away = make();
    home.choose("home");
    away.choose("away");
    advance(home, 0.6);
    advance(away, 0.6);
    expect(same(draw(home), draw(away))).toBe(false);
  });
});

describe("MenuScene: where the kick-offs go", () => {
  /** When the HOME ball is down and the AWAY ball is gone, in seconds from the choice. */
  const HOME_DOWN = 0.89;
  const AWAY_GONE = 0.97;
  /** The iris starts to close (at 1.13). */
  const IRIS = 1.14;

  /** The wordmark's box, laid out as docs/API_ART.md says the home screen is put together. */
  function logoBox(w: number, h: number) {
    const m = menuLayout(w, h);
    const size = logoSize({
      maxWidth: Math.min(w - 26, 132),
      maxHeight: m.logo.h,
      tagline: LABELS.tagline,
    });
    const top = Math.max(0, Math.floor((m.logo.h - size.h) / 2));
    return {
      x: m.cx - Math.ceil(size.w / 2),
      y: top,
      w: size.w + 1,
      h: size.h,
    };
  }

  /** The pixels that differ between two frames, as [x, y] pairs. */
  function diff(a: Surface, b: Surface): [number, number][] {
    const out: [number, number][] = [];
    for (let i = 0; i < a.data.length; i++) {
      if (a.data[i] !== b.data[i]) out.push([i % a.w, Math.floor(i / a.w)]);
    }
    return out;
  }

  /**
   * Everything a kick-off has put on screen `t` seconds after the choice, away from where
   * the ball hung: the ball in flight, its trail, the mark where it ended. Over a flat
   * backdrop, as [x, y] pairs.
   */
  function marks(mode: Mode, t: number, w: number, h: number) {
    const m = menuLayout(w, h);
    const kick = make(w, h);
    const calm = make(w, h);
    kick.choose(mode);
    advance(kick, t);
    advance(calm, t);
    expect(kick.phase).toBe("kickoff");
    const reach = m.ballR + 6;
    return diff(draw(kick, w, h), draw(calm, w, h)).filter(
      ([x, y]) => Math.hypot(x - m.cx, y - m.ballCy) > reach,
    );
  }

  function boxOf(points: [number, number][]) {
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }

  it.each([...SIZES, [158, 300], [195, 310], [720, 360]] as const)(
    "neither flight touches the wordmark at %i x %i",
    (w, h) => {
      // the roar is the backdrop's own picture: leave it out
      vi.spyOn(MenuBackdrop.prototype, "setRoar").mockImplementation(() => {});
      const box = logoBox(w, h);
      for (const mode of ["home", "away"] as const) {
        const kick = make(w, h);
        const calm = make(w, h);
        kick.choose(mode);
        // from the end of the strike's shake to just before the iris
        advance(kick, 0.4);
        advance(calm, 0.4);
        for (let t = 0.4; t < 1.1; t += STEP) {
          // (the thump of HOME's landing moves the whole picture for two frames)
          const thump =
            mode === "home" && t > HOME_DOWN - 0.02 && t < HOME_DOWN + 0.09;
          if (!thump) {
            const a = draw(kick, w, h);
            const b = draw(calm, w, h);
            const touched = diff(a, b).filter(
              ([x, y]) =>
                x >= box.x &&
                x < box.x + box.w &&
                y >= box.y &&
                y < box.y + box.h,
            );
            expect(touched).toEqual([]);
          }
          kick.update(STEP);
          calm.update(STEP);
        }
        expect(kick.phase).toBe("kickoff");
      }
    },
  );

  it.each([...SIZES, ...MONITORS.slice(1)] as const)(
    "HOME climbs over the stadium, hangs and drops onto the target at %i x %i",
    (w, h) => {
      flatBackdrop();
      const m = menuLayout(w, h);
      const tx = m.cx;
      const ty = m.spotY;
      const monitor = w >= 200;
      // The ball frame by frame, once the light of the strike is out. Its streak is under
      // it on the way up and over it on the way down: so its top, then its bottom.
      const tops: number[] = [];
      const bottoms: number[] = [];
      const widths: number[] = [];
      for (let t = 0.5; t < HOME_DOWN - 0.01; t += STEP) {
        const box = boxOf(marks("home", t, w, h));
        tops.push(box.y0);
        bottoms.push(box.y1);
        widths.push(box.x1 - box.x0);
        // straight up the middle
        expect(Math.abs(box.cx - tx)).toBeLessThanOrEqual(1.5);
      }
      const apex = Math.min(...tops);
      // it goes up over the far side of the stadium and never near the wordmark...
      expect(apex).toBeGreaterThan(m.logo.h);
      if (monitor) {
        expect(apex).toBeLessThanOrEqual(m.stand.y);
        expect(apex).toBeGreaterThan(m.horizonY - 0.1 * h);
      } else {
        // ...(on a phone the sign hangs there, so it stays low)...
        expect(apex).toBeLessThan(ty - 6);
        expect(apex).toBeGreaterThanOrEqual(m.stand.y);
      }
      // ...up to the apex (a pixel either way as it shrinks), where it hangs...
      const from = tops.indexOf(apex);
      for (let i = 1; i <= from; i++) {
        expect(tops[i]).toBeLessThanOrEqual(tops[i - 1] + 1);
      }
      const lowest = Math.min(...bottoms);
      const hung = bottoms.filter((y) => y <= lowest + 1).length;
      expect(hung).toBeGreaterThanOrEqual(5);
      // ...and down from it, faster and faster, for an eighth of a second or more
      const fall = bottoms.slice(bottoms.lastIndexOf(lowest));
      expect(fall.length).toBeGreaterThanOrEqual(8);
      for (let i = 1; i < fall.length; i++) {
        expect(fall[i]).toBeGreaterThanOrEqual(fall[i - 1] - 1);
      }
      const dropped = fall[fall.length - 1] - fall[0];
      expect(dropped).toBeGreaterThanOrEqual(monitor ? 20 : 4);
      const half = fall[fall.length >> 1] - fall[0];
      expect(half).toBeLessThanOrEqual(dropped / 2);
      // and it only ever gets smaller
      for (let i = 1; i < widths.length; i++) {
        expect(widths[i]).toBeLessThanOrEqual(widths[i - 1] + 1);
      }
      // down: a small ball lying on the target, with the mark of its landing round it
      // (after its thump, which moves the wordmark too, and after its one bounce)
      for (const t of [HOME_DOWN + 0.21, IRIS - 0.02]) {
        const landed = marks("home", t, w, h);
        const box = boxOf(landed);
        expect(Math.abs(box.cx - tx)).toBeLessThanOrEqual(1.5);
        expect(Math.abs(box.cy - ty)).toBeLessThanOrEqual(3);
        expect(box.x1 - box.x0).toBeLessThan(2 * m.ballR);
        expect(landed.some(([x, y]) => x === tx && y === ty)).toBe(true);
      }
      // the ball itself is 5 to 9 pixels across once the mark has faded
      const last = boxOf(
        marks("home", IRIS - 0.02, w, h).filter(
          ([x, y]) => Math.abs(x - tx) <= 5 && Math.abs(y - ty) <= 5,
        ),
      );
      expect(last.x1 - last.x0 + 1).toBeGreaterThanOrEqual(5);
      expect(last.x1 - last.x0 + 1).toBeLessThanOrEqual(9);
    },
  );

  it.each(MONITORS)(
    "AWAY leaves over the town and is gone in the sky at %i x %i",
    (w, h) => {
      flatBackdrop();
      const m = menuLayout(w, h);
      const bowlRight = m.stand.x + m.stand.w;
      // the twinkle it ends in: low in the sky, out to the right, clear of the stadium
      const twinkle = boxOf(marks("away", AWAY_GONE + 0.11, w, h));
      expect(twinkle.x1 - twinkle.x0).toBeLessThanOrEqual(12);
      expect(twinkle.y1 - twinkle.y0).toBeLessThanOrEqual(12);
      expect(twinkle.y0).toBeGreaterThan(m.logo.h);
      expect(twinkle.y1).toBeLessThan(m.horizonY);
      expect(twinkle.x0).toBeGreaterThan(bowlRight);
      expect(twinkle.x1).toBeLessThan(w - 1);
      // (not on the moon)
      expect(Math.abs(twinkle.cx - m.sky.moon.x)).toBeGreaterThan(16);
      // on the way there it is clear of the bowl within a fifth of a second...
      let top = Infinity;
      const sign = m.scoreboard;
      for (let t = 0.5; t < AWAY_GONE - 0.01; t += STEP) {
        const seen = marks("away", t, w, h);
        const box = boxOf(seen);
        expect(box.x0).toBeGreaterThan(bowlRight);
        // ...stays on the screen, under the wordmark's zone and off the sign...
        expect(box.x1).toBeLessThan(w);
        expect(box.y0).toBeGreaterThan(m.logo.h);
        expect(
          seen.some(
            ([x, y]) =>
              x >= sign.x &&
              x < sign.x + sign.w &&
              y >= sign.y &&
              y < sign.y + sign.h,
          ),
        ).toBe(false);
        // ...and only climbs
        expect(box.y0).toBeLessThanOrEqual(top + 1);
        top = box.y0;
      }
      // a ball when it sets out, a speck when it is last seen, where the twinkle then is
      const first = boxOf(marks("away", 0.5, w, h));
      expect(first.x1 - first.x0).toBeGreaterThan(20);
      const speck = boxOf(marks("away", AWAY_GONE - 0.02, w, h));
      expect(speck.x1 - speck.x0).toBeLessThanOrEqual(10);
      expect(Math.abs(speck.x0 - twinkle.cx)).toBeLessThanOrEqual(8);
      expect(Math.abs(speck.y0 - twinkle.cy)).toBeLessThanOrEqual(8);
      // the iris closes on that spot: the last ring of picture is round the twinkle
      const kick = make(w, h);
      kick.choose("away");
      advance(kick, 1.57);
      const frame = draw(kick, w, h);
      const open: [number, number][] = [];
      for (let i = 0; i < frame.data.length; i++) {
        if (frame.data[i] !== P.ink) open.push([i % w, Math.floor(i / w)]);
      }
      const ring = boxOf(open);
      expect(Math.abs(ring.cx - twinkle.cx)).toBeLessThanOrEqual(2);
      expect(Math.abs(ring.cy - twinkle.cy)).toBeLessThanOrEqual(2);
    },
  );

  it.each([
    [130, 281],
    [120, 222],
    [160, 300],
  ] as const)(
    "AWAY on a phone goes out to the right and ends beside the wordmark at %i x %i",
    (w, h) => {
      flatBackdrop();
      const m = menuLayout(w, h);
      const logo = logoBox(w, h);
      // the twinkle: in the sky of the logo zone, right of the wordmark
      const twinkle = boxOf(marks("away", AWAY_GONE + 0.11, w, h));
      expect(twinkle.y1).toBeLessThan(m.logo.h);
      expect(twinkle.x0).toBeGreaterThanOrEqual(logo.x + logo.w);
      expect(twinkle.x1).toBeLessThan(w);
      // The ball goes out by the right edge, low, and comes back in above the sign: it is
      // never seen over the sign, and for a while nothing of it is on screen at all.
      // (Left of the middle is the light of the strike: not the ball.)
      const sign = m.scoreboard;
      let wentOut = false;
      let cameBack = false;
      let lastOut: ReturnType<typeof boxOf> | null = null;
      for (let t = 0.3; t < AWAY_GONE - 0.01; t += STEP) {
        const seen = marks("away", t, w, h).filter(([x]) => x > m.cx);
        expect(
          seen.some(
            ([x, y]) =>
              x >= sign.x &&
              x < sign.x + sign.w &&
              y >= sign.y &&
              y < sign.y + sign.h,
          ),
        ).toBe(false);
        if (seen.length === 0) {
          wentOut = true;
          continue;
        }
        const box = boxOf(seen);
        if (!wentOut) {
          lastOut = box;
        } else {
          // back in: small, at the right, clear of the sign
          cameBack = true;
          expect(box.x1 - box.x0).toBeLessThanOrEqual(12);
          expect(box.x0).toBeGreaterThan(m.cx + m.ballR * 0.5);
          expect(box.x0).toBeGreaterThanOrEqual(sign.x + sign.w);
        }
      }
      expect(wentOut).toBe(true);
      // it went out over the edge, below the sign
      expect(lastOut?.x1).toBe(w - 1);
      expect(lastOut?.y0).toBeGreaterThan(sign.y + sign.h);
      // (at 160 wide the wordmark leaves so little sky that only the twinkle is seen)
      if (w < 150) expect(cameBack).toBe(true);
    },
  );

  it("each ball is in the air about two thirds of a second", () => {
    flatBackdrop();
    // HOME: a streak above the ball until it is down, none after
    const falling = boxOf(marks("home", HOME_DOWN - 0.03, 480, 270));
    expect(falling.y1 - falling.y0).toBeGreaterThan(12);
    const m = menuLayout(480, 270);
    expect(falling.y1).toBeLessThanOrEqual(m.spotY + 4);
    // AWAY: the ball until it is gone, then only the twinkle
    expect(marks("away", AWAY_GONE - 0.02, 480, 270).length).toBeGreaterThan(0);
    const first = boxOf(marks("away", AWAY_GONE + 0.01, 480, 270));
    expect(first.x1 - first.x0).toBeLessThanOrEqual(4);
    expect(first.y1 - first.y0).toBeLessThanOrEqual(4);
  });
});

describe("MenuScene: the fact on the airship", () => {
  /** The pixels in and round the sign's panel at rest. */
  function signPixels(s: Surface): number[] {
    const z = menuLayout(s.w, s.h).scoreboard;
    const out: number[] = [];
    for (let y = z.y - 3; y < z.y + z.h + 3; y++) {
      for (let x = z.x - 3; x < z.x + z.w + 3; x++) out.push(s.get(x, y));
    }
    return out;
  }

  it("draws the sign a backdrop given the fact and the header draws", () => {
    for (const [w, h] of [
      [480, 270],
      [130, 281],
    ] as const) {
      const scene = make(w, h);
      const b = new MenuBackdrop({
        seed: 7,
        sign: { header: LABELS.header, text: FACT },
      });
      // the scene dresses its backdrop in the day's colours (the airship's fins among them)
      b.setScheme(schemeForDay(7).id);
      b.resize(w, h);
      b.setLighting(DAY);
      const bs = new Surface(w, h);
      b.draw(bs, 0);
      expect(signPixels(draw(scene, w, h))).toEqual(signPixels(bs));
      // and another fact is another sign
      const other = make(w, h, { fact: "Goal nets arrived in 1889." });
      expect(signPixels(draw(other, w, h))).not.toEqual(signPixels(bs));
    }
  });

  it("hands the backdrop a new fact, and a new header from the labels", () => {
    const sign = vi.spyOn(MenuBackdrop.prototype, "setSign");
    const scene = make();
    scene.setFact("Goal nets arrived in 1889.");
    expect(sign).toHaveBeenLastCalledWith({
      header: LABELS.header,
      text: "Goal nets arrived in 1889.",
    });
    scene.setLabels({ ...LABELS, header: "FACT!" });
    expect(sign).toHaveBeenLastCalledWith({
      header: "FACT!",
      text: "Goal nets arrived in 1889.",
    });
    // the same again is nothing new
    const calls = sign.mock.calls.length;
    scene.setFact("Goal nets arrived in 1889.");
    scene.setLabels({ ...LABELS, header: "FACT!", home: "CASA" });
    expect(sign.mock.calls.length).toBe(calls);
  });

  it("keeps the fact through a pop and gives it to the next airship", () => {
    const sign = vi.spyOn(MenuBackdrop.prototype, "setSign");
    const scene = make(480, 270);
    const z = menuLayout(480, 270).scoreboard;
    // poke the top of the envelope until it bursts
    let popped = false;
    for (let i = 0; i < 12 && !popped; i++) {
      const at = { x: z.x + 12, y: z.y - 4 };
      const pop = vi.spyOn(MenuBackdrop.prototype, "pokeAirship");
      scene.pointer({ type: "move", ...at });
      scene.pointer({ type: "down", ...at });
      scene.pointer({ type: "up", ...at });
      popped = pop.mock.results.some((r) => r.value === "pop");
      pop.mockRestore();
      advance(scene, 0.15);
    }
    expect(popped).toBe(true);
    // the new airship is in its place 14.5 s after the pop, its fact back at the start
    advance(scene, 15);
    const back = draw(scene, 480, 270);
    expect(sign).not.toHaveBeenCalled();
    const b = new MenuBackdrop({
      seed: 7,
      sign: { header: LABELS.header, text: FACT },
    });
    b.resize(480, 270);
    b.setLighting(DAY);
    // the panel's lamp field shows the fact's first words, as on a fresh airship
    const s = new Surface(480, 270);
    b.draw(s, 0);
    const field = (q: Surface): number[] => {
      const out: number[] = [];
      for (let y = z.y + 2; y < z.y + z.h - 2; y++) {
        for (let x = z.x + 2; x < z.x + z.w - 2; x++) out.push(q.get(x, y));
      }
      return out;
    };
    // the drift moves the airship a pixel or two: find the offset that matches
    let found = false;
    for (let dy = -2; dy <= 2 && !found; dy++) {
      for (let dx = -3; dx <= 3 && !found; dx++) {
        const moved = new Surface(480, 270);
        moved.blit(back, -dx, -dy);
        found = field(moved).join() === field(s).join();
      }
    }
    expect(found).toBe(true);
  });
});

describe("MenuScene: the backdrop contract", () => {
  it("uses nothing of the backdrop but its contract", () => {
    // the code, without its comments
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/setCheer|horizonY|scoreboard/);
    // of menuLayout, four fields
    expect(code.match(/menuLayout\(/g)?.length).toBe(1);
    expect(code).toMatch(/const m = menuLayout\(/);
    const fields = [...code.matchAll(/\bm\.(\w+)/g)].map((m) => m[1]);
    expect(fields.length).toBeGreaterThan(0);
    for (const name of fields) {
      expect(["cx", "ballR", "ballCy", "logo"]).toContain(name);
    }
    const calls = [...code.matchAll(/backdrop\.(\w+)/g)].map((m) => m[1]);
    const allowed = [
      "resize",
      "setLighting",
      "setSign",
      "setMoonPhase",
      "target",
      "setRoar",
      "draw",
      "airshipAt",
      "pokeAirship",
      "mascotAt",
      "pokeMascot",
      "cuesBetween",
      "setScheme",
    ];
    expect(calls.length).toBeGreaterThan(0);
    for (const name of calls) expect(allowed).toContain(name);
  });

  it("dresses the stadium in the day's club colours", () => {
    const worn = vi.spyOn(MenuBackdrop.prototype, "setScheme");
    for (const day of [0, 1, 2, 3, 11, 12]) {
      worn.mockClear();
      make(130, 281, { seed: day });
      expect(worn).toHaveBeenCalledWith(schemeForDay(day).id);
    }
  });

  it("HOME: the ground erupts as the ball drops in, and reset calms it", () => {
    const roar = vi.spyOn(MenuBackdrop.prototype, "setRoar");
    const scene = make();
    advance(scene, 1);
    draw(scene);
    expect(roar.mock.calls.every(([amount]) => amount === 0)).toBe(true);
    scene.choose("home");
    const heard: number[] = [];
    while (scene.phase === "kickoff") {
      draw(scene);
      scene.update(STEP);
      // (a backdrop that has been told nothing is at 0)
      heard.push(roar.mock.calls.at(-1)?.[0] ?? 0);
    }
    // nothing while the ball is on its way, then a ramp up to 1 that holds
    expect(heard.slice(0, 30).every((a) => a === 0)).toBe(true);
    expect(Math.max(...heard)).toBe(1);
    expect(heard.at(-1)).toBe(1);
    const rising = heard.filter((a, i) => i > 0 && a !== heard[i - 1]);
    expect(rising.length).toBeGreaterThanOrEqual(3);
    expect(rising.every((a, i) => i === 0 || a > rising[i - 1])).toBe(true);
    scene.reset();
    expect(roar.mock.calls.at(-1)?.[0]).toBe(0);
    draw(scene);
    expect(roar.mock.calls.at(-1)?.[0]).toBe(0);
  });

  it("AWAY: no roar", () => {
    const roar = vi.spyOn(MenuBackdrop.prototype, "setRoar");
    const scene = make();
    scene.choose("away");
    while (scene.phase === "kickoff") {
      draw(scene);
      scene.update(STEP);
    }
    expect(roar.mock.calls.every(([amount]) => amount === 0)).toBe(true);
  });

  it("aims HOME wherever the backdrop says the ball comes down", () => {
    const flight = (x: number, y: number): Surface => {
      vi.spyOn(MenuBackdrop.prototype, "target").mockReturnValue({ x, y });
      const scene = make();
      scene.choose("home");
      advance(scene, 0.9);
      return draw(scene);
    };
    const a = flight(40, 90);
    const b = flight(95, 120);
    expect(covered(a)).toBe(true);
    expect(same(a, b)).toBe(false);
    // a target that makes no sense must not break the flight
    for (const [x, y] of [
      [Number.NaN, Number.NaN],
      [-500, -500],
      [9999, 9999],
      [65, 0],
      [65, 280],
    ]) {
      vi.spyOn(MenuBackdrop.prototype, "target").mockReturnValue({ x, y });
      const scene = make();
      scene.choose("home");
      while (scene.phase === "kickoff") {
        expect(covered(draw(scene))).toBe(true);
        advance(scene, 0.05);
      }
      expect(scene.phase).toBe("done");
    }
  });
});

describe("MenuScene: hover and press", () => {
  it("hovers HOME and AWAY under the pointer, and points at the locked patches", () => {
    noAirship();
    const scene = make();
    const log = listen(scene);
    expect(scene.cursor()).toBe("default");
    const home = patch("left");
    const away = patch("right");
    scene.pointer({ type: "move", x: home.x, y: home.y });
    expect(scene.cursor()).toBe("pointer");
    scene.pointer({ type: "move", x: home.x + 1, y: home.y });
    scene.pointer({ type: "move", x: away.x, y: away.y });
    expect(scene.cursor()).toBe("pointer");
    // a locked patch can be pressed, but hovers no mode
    for (const p of [patch("top"), patch("bottom")]) {
      scene.pointer({ type: "move", x: p.x, y: p.y });
      expect(scene.cursor()).toBe("pointer");
    }
    // the white of the ball: the ball can be turned
    scene.pointer({ type: "move", x: 65, y: 197 });
    expect(scene.cursor()).toBe("grab");
    scene.pointer({ type: "move", x: 3, y: 3 });
    expect(scene.cursor()).toBe("default");
    scene.pointer({ type: "move", x: home.x, y: home.y });
    scene.pointer({ type: "leave", x: 0, y: 0 });
    expect(scene.cursor()).toBe("default");
    // onHover fired on changes only
    expect(log.hover).toEqual(["home", "away", null, "home", null]);
    expect(log.kickoff).toEqual([]);
  });

  it("hovers during the entrance", () => {
    const scene = make(130, 281, { intro: true });
    const log = listen(scene);
    advance(scene, 0.7);
    expect(scene.phase).toBe("intro");
    const p = patch("left");
    // the ball is still settling: sweep the column until the patch is found
    let found = false;
    for (let y = p.y - 12; y <= p.y + 12 && !found; y++) {
      scene.pointer({ type: "move", x: p.x, y });
      found = scene.cursor() === "pointer";
    }
    expect(found).toBe(true);
    expect(log.hover).toEqual(["home"]);
  });

  it("press and release on a mode chooses it", () => {
    for (const [slot, mode] of [
      ["left", "home"],
      ["right", "away"],
    ] as const) {
      const scene = make();
      const log = listen(scene);
      const p = patch(slot);
      scene.pointer({ type: "move", x: p.x, y: p.y });
      const hovered = draw(scene);
      scene.pointer({ type: "down", x: p.x, y: p.y });
      expect(scene.phase).toBe("idle");
      expect(log.kickoff).toEqual([]);
      // the pressed state shows
      expect(same(hovered, draw(scene))).toBe(false);
      scene.pointer({ type: "up", x: p.x, y: p.y });
      expect(scene.phase).toBe("kickoff");
      expect(log.kickoff).toEqual([mode]);
      expect(log.choose).toEqual([]);
      expect(scene.cursor()).toBe("default");
      expect(log.hover).toEqual([mode, null]);
    }
  });

  it("release anywhere else, or leaving, cancels", () => {
    noAirship();
    const scene = make();
    const calm = make();
    const log = listen(scene);
    const home = patch("left");
    const away = patch("right");

    // pressed, and nudged off the patch by less than a drag: the press no longer shows
    let edge = home.x;
    for (; edge > 0; edge--) {
      scene.pointer({ type: "move", x: edge, y: home.y });
      if (scene.cursor() !== "pointer") break;
    }
    scene.pointer({ type: "down", x: edge + 1, y: home.y });
    expect(scene.cursor()).toBe("pointer");
    scene.pointer({ type: "move", x: edge - 1, y: home.y });
    expect(scene.cursor()).toBe("grab");
    expect(same(draw(calm), draw(scene))).toBe(true);
    scene.pointer({ type: "up", x: edge - 1, y: home.y });
    expect(scene.phase).toBe("idle");

    // dragged away (it turns the ball) and let go on the backdrop
    scene.pointer({ type: "down", x: home.x, y: home.y });
    scene.pointer({ type: "move", x: 5, y: 5 });
    expect(same(draw(calm), draw(scene))).toBe(false);
    scene.pointer({ type: "up", x: 5, y: 5 });
    expect(scene.phase).toBe("idle");

    // released on the other patch
    scene.pointer({ type: "down", x: home.x, y: home.y });
    scene.pointer({ type: "up", x: away.x, y: away.y });
    expect(scene.phase).toBe("idle");

    scene.pointer({ type: "down", x: home.x, y: home.y });
    scene.pointer({ type: "leave", x: 0, y: 0 });
    scene.pointer({ type: "up", x: home.x, y: home.y });
    expect(scene.phase).toBe("idle");

    // a release with no press before it
    scene.pointer({ type: "up", x: away.x, y: away.y });
    expect(scene.phase).toBe("idle");
    expect(log.kickoff).toEqual([]);
    expect(log.locked).toEqual([]);
    scene.pointer({ type: "leave", x: 0, y: 0 });
    // and the ball is back in its pose (after a rest, if it stopped on a locked patch)
    advance(scene, 6);
    advance(calm, 6);
    expect(same(draw(calm), draw(scene))).toBe(true);
  });

  it("a touch leaves no hover behind", () => {
    const scene = make();
    const log = listen(scene);
    const home = patch("left");
    scene.pointer({ type: "down", x: home.x, y: home.y, touch: true });
    scene.pointer({ type: "move", x: 4, y: 4, touch: true });
    scene.pointer({ type: "move", x: home.x, y: home.y, touch: true });
    scene.pointer({ type: "move", x: home.x, y: home.y - 60, touch: true });
    scene.pointer({ type: "up", x: home.x, y: home.y - 60, touch: true });
    expect(scene.phase).toBe("idle");
    expect(scene.cursor()).toBe("default");
    expect(log.hover.at(-1)).toBe(null);
    advance(scene, 6);
    const idle = make();
    advance(idle, 6);
    expect(same(draw(idle), draw(scene))).toBe(true);
    // and a tap chooses
    click(scene, "right", true);
    expect(log.kickoff).toEqual(["away"]);
    expect(log.hover.at(-1)).toBe(null);
  });

  it("a locked patch says no and never chooses", () => {
    for (const [slot, mode] of [
      ["top", "nextgen"],
      ["bottom", "retro"],
    ] as const) {
      const scene = make();
      const log = listen(scene);
      click(scene, slot);
      expect(log.locked).toEqual([mode]);
      expect(log.kickoff).toEqual([]);
      expect(scene.phase).toBe("idle");
      scene.pointer({ type: "leave", x: 0, y: 0 });
      // the shake is on screen, and over within half a second
      advance(scene, 0.1);
      const shaking = draw(scene);
      const calm = make();
      advance(calm, 0.1);
      expect(same(shaking, draw(calm))).toBe(false);
      advance(scene, 0.4);
      advance(calm, 0.4);
      expect(same(draw(scene), draw(calm))).toBe(true);
      advance(scene, 3);
      expect(log.choose).toEqual([]);
      expect(scene.phase).toBe("idle");
      // a mode can still be chosen during the shake
      click(scene, slot);
      expect(scene.choose("home")).toBe(true);
    }
  });
});

describe("MenuScene: the hover", () => {
  it.each([
    [480, 270],
    [640, 360],
    [130, 281],
    [120, 222],
  ] as const)(
    "the idle ball stays within its bob of (cx, ballCy) at %i x %i",
    (w, h) => {
      flatBackdrop();
      const m = menuLayout(w, h);
      const bob = bobOf(w, h);
      const scene = make(w, h);
      const ups: number[] = [];
      let last: number | null = null;
      for (let i = 0; i <= 30 * 60; i++) {
        if (i % 3 === 0) {
          const box = ballBox(scene, w, h);
          if (box === null) throw new Error("no ball");
          // it only ever goes up and down, and it is always the whole ball
          expect(box.cx).toBe(m.cx);
          expect(box.r).toBe(m.ballR);
          const up = m.ballCy - box.cy;
          expect(Number.isInteger(up)).toBe(true);
          // stepped: a pixel at a time
          if (last !== null) expect(Math.abs(up - last)).toBeLessThanOrEqual(1);
          last = up;
          ups.push(up);
        }
        scene.update(STEP);
      }
      // an ordinary breath is the bob each way
      const ordinary = ups.slice(0, 8 * 20);
      expect(Math.max(...ordinary)).toBe(bob);
      expect(Math.min(...ordinary)).toBe(-bob);
      // a deep one goes further up, never more than two and a half bobs, and no lower
      expect(Math.max(...ups)).toBeGreaterThan(bob);
      expect(Math.max(...ups)).toBeLessThanOrEqual(Math.ceil(bob * 2.5));
      expect(Math.min(...ups)).toBe(-bob);
      // a bob takes about four seconds: back at the top between 3 and 4.5 s later
      const top = ups.indexOf(bob);
      const fallen = ups.indexOf(-bob, top);
      const again = ups.indexOf(bob, fallen);
      expect((again - top) / 20).toBeGreaterThan(3);
      expect((again - top) / 20).toBeLessThan(4.5);
    },
  );

  it("does not move in step with the rock", () => {
    // the rock is back where it began every 5 s: the ball must not be
    flatBackdrop();
    const scene = make(480, 270);
    const m = menuLayout(480, 270);
    const seen = new Set<number>();
    for (let lap = 0; lap < 4; lap++) {
      advance(scene, 1);
      const box = ballBox(scene, 480, 270);
      seen.add(m.ballCy - (box?.cy ?? 0));
      advance(scene, 4);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("hangs still with reduced motion", () => {
    flatBackdrop();
    for (const [w, h] of [
      [480, 270],
      [130, 281],
    ] as const) {
      const m = menuLayout(w, h);
      const scene = make(w, h);
      scene.setReducedMotion(true);
      for (let i = 0; i < 120; i++) {
        const box = ballBox(scene, w, h);
        expect(box?.cx).toBe(m.cx);
        expect(box?.cy).toBe(m.ballCy);
        expect(box?.r).toBe(m.ballR);
        advance(scene, 0.25);
      }
      // turned on in the middle of a bob, it goes to its spot and stays
      const late = make(w, h);
      advance(late, 1);
      expect(ballBox(late, w, h)?.cy).not.toBe(m.ballCy);
      late.setReducedMotion(true);
      expect(ballBox(late, w, h)?.cy).toBe(m.ballCy);
      // and the entrance is not played
      const intro = make(w, h, { intro: true });
      intro.setReducedMotion(true);
      expect(intro.phase).toBe("idle");
      expect(ballBox(intro, w, h)?.cy).toBe(m.ballCy);
      expect(ballBox(intro, w, h)?.r).toBe(m.ballR);
    }
  });

  it("a press during the bob chooses the patch under the pointer", () => {
    const w = 480;
    const h = 270;
    /** The rows of column x on which the pointer hovers a mode. */
    const rows = (scene: MenuScene, x: number): number[] => {
      const out: number[] = [];
      for (let y = 0; y < h; y++) {
        scene.pointer({ type: "move", x, y });
        if (scene.cursor() === "pointer") out.push(y);
      }
      scene.pointer({ type: "leave", x: 0, y: 0 });
      return out;
    };
    const p = patch("left", w, h);
    // at rest, and at the top of a deep breath
    const low = make(w, h);
    const high = make(w, h);
    advance(high, 8.9);
    const a = rows(low, p.x);
    const b = rows(high, p.x);
    expect(a.length).toBeGreaterThan(10);
    expect(b.length).toBeGreaterThan(10);
    // the patch has gone up with the ball
    expect(b[0]).toBeLessThan(a[0]);
    expect(b[b.length - 1]).toBeLessThan(a[a.length - 1]);
    // its top row now is a press on HOME, and was not one before
    const top = b[0];
    const bottom = a[a.length - 1];
    const press = (scene: MenuScene, y: number): Mode[] => {
      const log = listen(scene);
      scene.pointer({ type: "move", x: p.x, y });
      scene.pointer({ type: "down", x: p.x, y });
      scene.pointer({ type: "up", x: p.x, y });
      return log.kickoff;
    };
    expect(press(low, top)).toEqual([]);
    expect(press(high, top)).toEqual(["home"]);
    // and where its bottom row was is no longer the patch
    const high2 = make(w, h);
    advance(high2, 8.9);
    expect(press(high2, bottom)).toEqual([]);
    expect(press(low, bottom)).toEqual(["home"]);
  });

  it("a pointer that keeps still keeps its patch while the ball breathes under it", () => {
    // On the patch's top row at the top of a deep breath. The ball then sinks seven
    // pixels: the highlight used to drop (and came back with the next breath, a flicker
    // every few seconds for a mouse at rest near a patch's edge), and a press was lost.
    const w = 480;
    const h = 270;
    const p = patch("left", w, h);
    /** A scene at the top of a deep breath, and the top row of HOME in the patch's column. */
    const high = (): { scene: MenuScene; log: Log; top: number } => {
      const scene = make(w, h);
      const log = listen(scene);
      advance(scene, 8.9);
      let top = -1;
      for (let y = 0; y < h && top < 0; y++) {
        scene.pointer({ type: "move", x: p.x, y });
        if (log.hover.at(-1) === "home") top = y;
      }
      expect(top).toBeGreaterThan(0);
      return { scene, log, top };
    };

    // resting: hovered for as long as it does not move, through whole breaths
    const rest = high();
    for (let i = 0; i < 40; i++) {
      advance(rest.scene, 0.5);
      expect(rest.scene.cursor()).toBe("pointer");
    }
    expect(rest.log.hover).toEqual(["home"]);
    // the hand trembles by less than a pixel: still resting
    rest.scene.pointer({ type: "move", x: p.x + 0.5, y: rest.top - 0.5 });
    expect(rest.scene.cursor()).toBe("pointer");
    // and what is lit is what a click chooses
    rest.scene.pointer({ type: "down", x: p.x + 0.5, y: rest.top - 0.5 });
    rest.scene.pointer({ type: "up", x: p.x + 0.5, y: rest.top - 0.5 });
    expect(rest.log.kickoff).toEqual(["home"]);

    // a press held while the ball sinks away is still a press
    const held = high();
    held.scene.pointer({ type: "down", x: p.x, y: held.top });
    advance(held.scene, 2);
    expect(held.scene.cursor()).toBe("pointer");
    held.scene.pointer({ type: "up", x: p.x, y: held.top });
    expect(held.log.kickoff).toEqual(["home"]);

    // but a pointer that moves is looked at afresh: off the patch, the hover goes
    const moved = high();
    advance(moved.scene, 2);
    moved.scene.pointer({ type: "move", x: p.x, y: moved.top - 2 });
    expect(moved.scene.cursor()).toBe("grab");
    expect(moved.log.hover).toEqual(["home", null]);
    // and going back to where it was does not bring it back: the ball is not there now
    moved.scene.pointer({ type: "move", x: p.x, y: moved.top });
    expect(moved.scene.cursor()).toBe("grab");
    moved.scene.pointer({ type: "down", x: p.x, y: moved.top });
    moved.scene.pointer({ type: "up", x: p.x, y: moved.top });
    expect(moved.log.kickoff).toEqual([]);
  });

  it.each(["home", "away"] as const)(
    "%s: a ball struck in mid-bob is struck where it hangs",
    (mode) => {
      flatBackdrop();
      const w = 480;
      const h = 270;
      const scene = make(w, h);
      // rising fast into a deep breath
      advance(scene, 8.4);
      const hung = ballBox(scene, w, h);
      if (hung === null) throw new Error("no ball");
      expect(hung.cy).toBeLessThan(menuLayout(w, h).ballCy);
      scene.choose(mode);
      // while the patch flashes the ball keeps still, though the bob would have moved it
      for (let i = 0; i < 13; i++) {
        const box = ballBox(scene, w, h);
        expect(box?.cy).toBe(hung.cy);
        expect(box?.cx).toBe(hung.cx);
        scene.update(STEP);
      }
      // and the flight begins there: its top edge, give or take the shake and the give
      scene.update(0.2901 - 13 * STEP);
      const off = ballBox(scene, w, h);
      expect(Math.abs((off?.y0 ?? 0) - hung.y0)).toBeLessThanOrEqual(2);
    },
  );
});

describe("MenuScene: the entrance", () => {
  it("arrives in mid-air and settles into the hover with no jump", () => {
    flatBackdrop();
    for (const [w, h] of [
      [480, 270],
      [130, 281],
    ] as const) {
      const m = menuLayout(w, h);
      const scene = make(w, h, { intro: true });
      const plain = make(w, h);
      // next to nothing at first: it comes out of the air
      expect(ballBox(scene, w, h)?.r ?? 0).toBeLessThan(m.ballR / 2);
      let t = 0;
      let last: Box | null = null;
      let lowest = 0;
      let highest: number = h;
      while (t < 1.6) {
        scene.update(STEP);
        plain.update(STEP);
        t += STEP;
        const box = ballBox(scene, w, h);
        if (box === null) throw new Error("no ball");
        // always about its own column, and never near the bottom of the screen
        expect(Math.abs(box.cx - m.cx)).toBeLessThanOrEqual(0.5);
        expect(box.y1).toBeLessThan(m.caption.y);
        if (t > 0.5) {
          // full size, and from here on a pixel at a time
          expect(box.r).toBe(m.ballR);
          if (last !== null && last.r === box.r) {
            expect(Math.abs(box.cy - last.cy)).toBeLessThanOrEqual(1);
          }
          lowest = Math.max(lowest, box.cy);
          highest = Math.min(highest, box.cy);
        } else if (last !== null && t > 0.25) {
          // swelling (the star it comes out of is gone by now): it never shrinks
          expect(box.r).toBeGreaterThanOrEqual(last.r);
          expect(box.r).toBeLessThanOrEqual(m.ballR);
        }
        if (scene.phase === "idle") {
          // the hover has it: the very picture of a scene that had no entrance
          expect(box.cy).toBe(ballBox(plain, w, h)?.cy);
        }
        last = box;
      }
      expect(scene.phase).toBe("idle");
      // it floated a little past the hover and sank onto it: no bounce off anything
      expect(highest).toBeLessThan(m.ballCy - bobOf(w, h));
      expect(lowest).toBeLessThanOrEqual(m.ballCy);
    }
  });

  it("plays for under a second, then idles", () => {
    const scene = make(130, 281, { intro: true });
    expect(scene.phase).toBe("intro");
    let t = 0;
    while (scene.phase === "intro" && t < 5) {
      scene.update(STEP);
      t += STEP;
    }
    expect(scene.phase).toBe("idle");
    expect(t).toBeGreaterThan(0.5);
    expect(t).toBeLessThanOrEqual(0.95);
    // it settles into exactly the picture of a scene that had no entrance
    const plain = make();
    advance(plain, t);
    expect(same(draw(scene), draw(plain))).toBe(true);
  });

  it("ignores presses until it ends", () => {
    const scene = make(130, 281, { intro: true });
    const log = listen(scene);
    advance(scene, 0.85);
    expect(scene.phase).toBe("intro");
    click(scene, "left");
    click(scene, "top");
    expect(scene.phase).toBe("intro");
    // a press that began in the entrance does not count after it either
    const p = patch("left");
    scene.pointer({ type: "down", x: p.x, y: p.y });
    advance(scene, 0.2);
    expect(scene.phase).toBe("idle");
    scene.pointer({ type: "up", x: p.x, y: p.y });
    expect(scene.phase).toBe("idle");
    expect(log.kickoff).toEqual([]);
    expect(log.locked).toEqual([]);
    click(scene, "left");
    expect(log.kickoff).toEqual(["home"]);
  });

  it("choose() during it is taken at once, and the ball is struck when it has settled", () => {
    // It used to cut the entrance: a ball a third of its size jumped to full size on its
    // spot to be kicked.
    flatBackdrop();
    for (const [w, h] of [
      [480, 270],
      [130, 281],
    ] as const) {
      const m = menuLayout(w, h);
      const scene = make(w, h, { intro: true });
      const log = listen(scene);
      advance(scene, 0.1);
      const small = ballBox(scene, w, h);
      expect(small?.r ?? 0).toBeLessThan(m.ballR);
      expect(scene.choose("away")).toBe(true);
      // the page is told now (the captions step aside), but the ball is still arriving
      expect(log.kickoff).toEqual(["away"]);
      expect(scene.phase).toBe("intro");
      // nothing else can be chosen meanwhile, by the DOM or by the pointer
      expect(scene.choose("home")).toBe(false);
      click(scene, "left");
      const p = patch("left", w, h);
      scene.pointer({ type: "move", x: p.x, y: p.y });
      expect(scene.cursor()).toBe("default");
      expect(log.hover).toEqual([]);
      // it goes on swelling: never a jump in size, never smaller
      let last = small?.r ?? 0;
      let t = 0.1;
      while (scene.phase === "intro" && t < 2) {
        scene.update(STEP);
        t += STEP;
        const box = ballBox(scene, w, h);
        if (scene.phase !== "intro" || box === null) break;
        if (t > 0.25) {
          expect(box.r).toBeGreaterThanOrEqual(last);
          expect(box.r - last).toBeLessThanOrEqual(m.ballR * 0.2);
        }
        last = box.r;
      }
      // struck when the entrance is over, full size, and only told once
      expect(last).toBe(m.ballR);
      expect(scene.phase).toBe("kickoff");
      expect(t).toBeGreaterThan(0.8);
      expect(t).toBeLessThan(0.95);
      expect(log.kickoff).toEqual(["away"]);
      expect(log.choose).toEqual([]);
      // from there it is the kick-off of a scene that was chosen at rest at that moment
      const plain = make(w, h);
      advance(plain, t);
      plain.choose("away");
      expect(same(draw(scene), draw(plain))).toBe(true);
      runToDone(scene);
      expect(log.choose).toEqual(["away"]);
    }
  });

  it("a queued choice shows on its patch, and survives reduced motion and reset", () => {
    const scene = make(130, 281, { intro: true });
    const twin = make(130, 281, { intro: true });
    const log = listen(scene);
    advance(scene, 0.6);
    advance(twin, 0.6);
    scene.choose("home");
    // the patch is held down while the ball settles
    expect(same(draw(scene), draw(twin))).toBe(false);
    // reduced motion ends the entrance: the choice is struck at once, as a cut
    scene.setReducedMotion(true);
    expect(scene.phase).toBe("kickoff");
    runToDone(scene);
    expect(log.kickoff).toEqual(["home"]);
    expect(log.choose).toEqual(["home"]);

    // reset() forgets a choice that was waiting
    const again = make(130, 281, { intro: true });
    const log2 = listen(again);
    advance(again, 0.3);
    again.choose("away");
    again.reset();
    advance(again, 3);
    expect(again.phase).toBe("idle");
    expect(log2.choose).toEqual([]);
    expect(again.choose("home")).toBe(true);
    expect(again.phase).toBe("kickoff");
  });

  it("is skipped by intro: false and by reset()", () => {
    expect(make().phase).toBe("idle");
    const scene = make(130, 281, { intro: true });
    advance(scene, 0.1);
    scene.reset();
    expect(scene.phase).toBe("idle");
    const plain = make();
    advance(plain, 0.1);
    expect(same(draw(scene), draw(plain))).toBe(true);
  });
});

describe("MenuScene: the kick-off", () => {
  it.each(["home", "away"] as const)(
    "%s: onKickoff at once, onChoose exactly once, about 1.8 s later",
    (mode) => {
      const scene = make();
      const log = listen(scene);
      const phases: MenuPhase[] = [];
      scene.onChoose = (m) => {
        log.choose.push(m);
        phases.push(scene.phase);
      };
      expect(scene.choose(mode)).toBe(true);
      expect(log.kickoff).toEqual([mode]);
      expect(log.choose).toEqual([]);
      expect(scene.phase).toBe("kickoff");
      const took = runToDone(scene);
      expect(took).toBeGreaterThanOrEqual(1.75);
      expect(took).toBeLessThanOrEqual(1.85);
      expect(log.choose).toEqual([mode]);
      expect(phases).toEqual(["done"]);
      // it stays done, in ink, and says nothing more
      advance(scene, 3);
      expect(scene.phase).toBe("done");
      expect(allInk(draw(scene))).toBe(true);
      expect(log.choose).toEqual([mode]);
      expect(log.kickoff).toEqual([mode]);
    },
  );

  it.each(["home", "away"] as const)(
    "%s: the iris closes smoothly, a little every frame",
    (mode) => {
      flatBackdrop();
      const w = 480;
      const h = 270;
      // the iris is what turns the flat picture to ink: count those pixels, against a
      // menu left alone, once the ball is down or gone
      const kick = make(w, h);
      const calm = make(w, h);
      kick.choose(mode);
      advance(kick, 1);
      advance(calm, 1);
      const inked: number[] = [];
      while (kick.phase === "kickoff") {
        const a = draw(kick, w, h).data;
        const b = draw(calm, w, h).data;
        let n = 0;
        for (let i = 0; i < a.length; i++) {
          if (a[i] === P.ink && b[i] === FLAT) n++;
        }
        inked.push(allInk(draw(kick, w, h)) ? -1 : n);
        kick.update(STEP);
        calm.update(STEP);
      }
      const first = inked.findIndex((n) => n > inked[0]);
      const shut = inked.indexOf(-1);
      expect(first).toBeGreaterThan(0);
      expect(shut).toBeGreaterThan(first);
      // from the first bite of the corners to ink: over half a second
      expect((shut - first) * STEP).toBeGreaterThanOrEqual(0.5);
      expect((shut - first) * STEP).toBeLessThanOrEqual(0.75);
      let still = 0;
      for (let i = first + 1; i < shut; i++) {
        // it never opens again, never takes a tenth of the screen in one frame...
        expect(inked[i]).toBeGreaterThanOrEqual(inked[i - 1]);
        expect(inked[i] - inked[i - 1]).toBeLessThan(w * h * 0.1);
        // ...and never stops: a frame or two as it turns on the ring, no more
        still = inked[i] === inked[i - 1] ? still + 1 : 0;
        expect(still).toBeLessThanOrEqual(2);
      }
      // and once it is ink it stays ink until it is done
      expect(inked.slice(shut).every((n) => n === -1)).toBe(true);
    },
  );

  it("ends on ink before it says so: no frame of the menu after the wipe", () => {
    const scene = make();
    scene.choose("home");
    let sawInk = false;
    while (scene.phase === "kickoff") {
      const ink = allInk(draw(scene));
      // once the screen is ink it stays ink
      if (sawInk) expect(ink).toBe(true);
      sawInk = sawInk || ink;
      scene.update(STEP);
    }
    expect(sawInk).toBe(true);
  });

  it("ignores input while it is busy", () => {
    const scene = make();
    const log = listen(scene);
    scene.choose("home");
    for (let i = 0; i < 200; i++) {
      expect(scene.choose("away")).toBe(false);
      expect(scene.choose("home")).toBe(false);
      click(scene, "right");
      click(scene, "top");
      const p = patch("right");
      scene.pointer({ type: "move", x: p.x, y: p.y });
      expect(scene.cursor()).toBe("default");
      scene.update(STEP);
    }
    expect(scene.phase).toBe("done");
    expect(scene.choose("away")).toBe(false);
    click(scene, "right");
    expect(log.kickoff).toEqual(["home"]);
    expect(log.choose).toEqual(["home"]);
    expect(log.hover).toEqual([]);
    expect(log.locked).toEqual([]);
  });

  it("is one jump for a huge dt", () => {
    const scene = make();
    const log = listen(scene);
    scene.choose("away");
    scene.update(1e9);
    expect(scene.phase).toBe("done");
    expect(log.choose).toEqual(["away"]);
    scene.update(1e9);
    expect(log.choose).toEqual(["away"]);
  });

  it("refuses a mode that is not one", () => {
    const scene = make();
    expect(scene.choose("friendly" as Mode)).toBe(false);
    expect(scene.phase).toBe("idle");
  });

  it("reset() returns to idle, and the next kick-off is a whole new one", () => {
    const scene = make();
    const log = listen(scene);
    scene.choose("home");
    runToDone(scene);
    scene.reset();
    expect(scene.phase).toBe("idle");
    expect(covered(draw(scene))).toBe(true);
    expect(allInk(draw(scene))).toBe(false);
    expect(scene.choose("away")).toBe(true);
    const took = runToDone(scene);
    expect(took).toBeGreaterThanOrEqual(1.2);
    expect(log.kickoff).toEqual(["home", "away"]);
    expect(log.choose).toEqual(["home", "away"]);
    // reset in the middle of a kick-off abandons it: no onChoose
    scene.reset();
    scene.choose("home");
    advance(scene, 0.6);
    scene.reset();
    advance(scene, 3);
    expect(scene.phase).toBe("idle");
    expect(log.choose).toEqual(["home", "away"]);
  });

  it("lets callbacks call back in", () => {
    const scene = make();
    const seen: string[] = [];
    scene.onKickoff = (mode) => {
      seen.push(`kickoff ${mode}`);
      scene.setHovered(null);
      expect(scene.choose("away")).toBe(false);
    };
    scene.onChoose = (mode) => {
      seen.push(`choose ${mode}`);
      scene.reset();
      scene.setHovered("away");
    };
    scene.onHover = (mode) => {
      seen.push(`hover ${mode}`);
      scene.setHovered(mode);
    };
    click(scene, "left");
    runToDone(scene, 3);
    expect(scene.phase).toBe("idle");
    expect(seen).toEqual([
      "hover home",
      "kickoff home",
      "hover null",
      "choose home",
    ]);
    advance(scene, 1);
    expect(covered(draw(scene))).toBe(true);
    // and again, straight from inside onChoose's reset
    seen.length = 0;
    scene.choose("away");
    runToDone(scene, 3);
    expect(seen).toEqual(["kickoff away", "choose away"]);
  });

  it("keeps going through a resize", () => {
    const scene = make();
    const log = listen(scene);
    scene.choose("home");
    advance(scene, 0.5);
    scene.resize(480, 270);
    expect(covered(draw(scene, 480, 270))).toBe(true);
    advance(scene, 0.4);
    scene.resize(120, 222);
    expect(covered(draw(scene, 120, 222))).toBe(true);
    // a surface of another size than the last resize is taken as it comes
    expect(covered(draw(scene, 160, 300))).toBe(true);
    runToDone(scene);
    expect(log.choose).toEqual(["home"]);
    // a resized kick-off is the same picture as one that began at that size
    const a = make();
    a.choose("away");
    advance(a, 0.6);
    a.resize(160, 300);
    const b = make(160, 300);
    b.choose("away");
    advance(b, 0.6);
    expect(same(draw(a, 160, 300), draw(b, 160, 300))).toBe(true);
  });
});

describe("MenuScene: reduced motion", () => {
  it("has no entrance", () => {
    const scene = make(130, 281, { intro: true });
    scene.setReducedMotion(true);
    expect(scene.phase).toBe("idle");
  });

  it("cuts the kick-off short: a lit patch, then ink", () => {
    const scene = make();
    scene.setReducedMotion(true);
    const log = listen(scene);
    const idle = draw(scene);
    expect(scene.choose("home")).toBe(true);
    expect(log.kickoff).toEqual(["home"]);
    // the patch is lit and holds still: no flash
    const lit = draw(scene);
    expect(same(idle, lit)).toBe(false);
    advance(scene, 0.1);
    expect(scene.phase).toBe("kickoff");
    const took = 0.1 + runToDone(scene);
    expect(took).toBeGreaterThanOrEqual(0.1);
    expect(took).toBeLessThanOrEqual(0.3);
    expect(log.choose).toEqual(["home"]);
    expect(allInk(draw(scene))).toBe(true);
  });

  it("never roars, shakes or flashes", () => {
    const roar = vi.spyOn(MenuBackdrop.prototype, "setRoar");
    // Two scenes at the same ambient time, one just chosen and one an eighth of a second
    // into the cut (where a flashing patch would have changed): the same picture.
    const early = make();
    const late = make();
    early.setReducedMotion(true);
    late.setReducedMotion(true);
    late.choose("home");
    advance(late, 0.13);
    advance(early, 0.13);
    early.choose("home");
    expect(late.phase).toBe("kickoff");
    expect(same(draw(early), draw(late))).toBe(true);
    runToDone(late);
    expect(roar.mock.calls.every(([amount]) => amount === 0)).toBe(true);
  });

  it("answers a locked patch without the shake", () => {
    const scene = make();
    scene.setReducedMotion(true);
    const log = listen(scene);
    const calm = make();
    calm.setReducedMotion(true);
    click(scene, "top", true);
    expect(log.locked).toEqual(["nextgen"]);
    advance(scene, 0.1);
    advance(calm, 0.1);
    expect(same(draw(scene), draw(calm))).toBe(true);
  });

  it("slows the ambient clock to a quarter", () => {
    // 2.75 s of reduced motion is 0.6875 s of the backdrop's time (both exact in binary)
    const seen = vi.spyOn(MenuBackdrop.prototype, "draw");
    const slow = make();
    slow.setReducedMotion(true);
    slow.update(2.75);
    const a = draw(slow);
    expect(seen.mock.calls.at(-1)?.[1]).toBe(0.6875);
    const full = make();
    full.update(2.75);
    const b = draw(full);
    expect(seen.mock.calls.at(-1)?.[1]).toBe(2.75);
    expect(same(a, b)).toBe(false);
    // the rock is slowed with it, not stopped: the ball still turns on its spot
    const start = make();
    start.setReducedMotion(true);
    seen.mockImplementation((s) => {
      s.clear(FLAT);
    });
    expect(same(draw(start), draw(slow))).toBe(false);
  });
});

describe("MenuScene: robust", () => {
  it("takes any dt", () => {
    for (const intro of [true, false]) {
      const scene = make(130, 281, { intro });
      const log = listen(scene);
      for (const dt of [
        0,
        -1,
        Number.NaN,
        Number.NEGATIVE_INFINITY,
        1e-9,
        0.5,
        Number.POSITIVE_INFINITY,
        1e12,
        0,
      ]) {
        scene.update(dt);
        expect(covered(draw(scene))).toBe(true);
      }
      expect(scene.phase).toBe("idle");
      scene.choose("home");
      for (const dt of [0, Number.NaN, -5, 0.3, 0, Number.NaN]) {
        scene.update(dt);
        expect(covered(draw(scene))).toBe(true);
      }
      expect(scene.phase).toBe("kickoff");
      scene.update(Number.POSITIVE_INFINITY);
      expect(scene.phase).toBe("done");
      expect(log.choose).toEqual(["home"]);
    }
  });

  it("takes any size", () => {
    for (const [w, h] of [
      [1, 1],
      [2, 3],
      [1, 400],
      [900, 1],
      [7, 9],
      [33, 20],
      [64, 64],
      [900, 400],
    ] as const) {
      for (const mode of ["home", "away"] as const) {
        const scene = make(w, h, { intro: true });
        for (let i = 0; i < 6; i++) {
          expect(covered(draw(scene, w, h))).toBe(true);
          scene.update(0.2);
        }
        scene.pointer({ type: "move", x: w / 2, y: h * 0.7 });
        scene.pointer({ type: "down", x: w / 2, y: h * 0.7 });
        scene.pointer({ type: "up", x: w / 2, y: h * 0.7 });
        scene.reset();
        expect(scene.choose(mode)).toBe(true);
        for (let i = 0; i < 13; i++) {
          expect(covered(draw(scene, w, h))).toBe(true);
          scene.update(0.15);
        }
        expect(scene.phase).toBe("done");
      }
    }
    // sizes that are not sizes
    const scene = make();
    for (const [w, h] of [
      [0, 0],
      [-5, 10],
      [Number.NaN, Number.NaN],
      [130.4, 280.6],
    ]) {
      scene.resize(w, h);
      scene.update(STEP);
    }
    expect(covered(draw(scene))).toBe(true);
  });

  it("takes pointer events at any moment, with any numbers", () => {
    const scene = make(130, 281, { intro: true });
    const log = listen(scene);
    const odd = [Number.NaN, -1e9, 1e9, Number.POSITIVE_INFINITY, 0.5, 64.6];
    const types = ["move", "down", "up", "leave"] as const;
    let n = 0;
    for (let round = 0; round < 3; round++) {
      for (const x of odd) {
        for (const y of odd) {
          const type = types[n++ % types.length];
          scene.pointer({ type, x, y, touch: n % 3 === 0 });
          scene.update(n % 5 === 0 ? 0.3 : 0);
          expect(scene.cursor()).toMatch(/default|pointer/);
        }
      }
      expect(covered(draw(scene))).toBe(true);
      if (round === 0) scene.choose("away");
      if (round === 1) scene.update(10);
    }
    expect(scene.phase).toBe("done");
    expect(log.choose).toEqual(["away"]);
    // an up before any frame, and a scene that was never resized
    const bare = new MenuScene({ seed: 1, fact: FACT, labels: LABELS });
    bare.pointer({ type: "up", x: 0, y: 0 });
    bare.pointer({ type: "down", x: 0, y: 0 });
    bare.update(0.1);
    expect(bare.cursor()).toBe("default");
    expect(covered(draw(bare, 40, 40))).toBe(true);
  });

  it("never gets stuck: every phase ends by itself or by reset", () => {
    const scene = make(130, 281, { intro: true });
    scene.update(0);
    scene.update(Number.NaN);
    expect(scene.phase).toBe("intro");
    scene.update(1);
    expect(scene.phase).toBe("idle");
    click(scene, "top");
    click(scene, "left");
    expect(scene.phase).toBe("kickoff");
    scene.setReducedMotion(true);
    scene.setReducedMotion(false);
    scene.update(2);
    expect(scene.phase).toBe("done");
    scene.reset();
    expect(scene.phase).toBe("idle");
    scene.setReducedMotion(true);
    scene.choose("away");
    scene.setReducedMotion(false);
    scene.update(0.2);
    expect(scene.phase).toBe("kickoff");
    scene.setReducedMotion(true);
    scene.update(0);
    scene.update(STEP);
    expect(scene.phase).toBe("done");
  });
});

describe("MenuScene: spinning the ball", () => {
  const W = 480;
  const H = 270;

  /**
   * Press at (x, y) and drag by (dx, dy) a frame for `frames` frames, with a frame's
   * update after each move. The pointer stays down. Returns where it is.
   */
  function drag(
    scene: MenuScene,
    x: number,
    y: number,
    dx: number,
    dy: number,
    frames: number,
    touch = false,
  ): { x: number; y: number } {
    scene.pointer({ type: "down", x, y, touch });
    for (let i = 1; i <= frames; i++) {
      scene.pointer({ type: "move", x: x + dx * i, y: y + dy * i, touch });
      scene.update(STEP);
    }
    return { x: x + dx * frames, y: y + dy * frames };
  }

  /**
   * With the mouse resting on HOME, step until HOME hovers again: the ball is back in its
   * pose. Returns the seconds that took, or Infinity.
   */
  function timeToRest(scene: MenuScene, limit = 8): number {
    const home = patch("left", W, H);
    scene.pointer({ type: "move", x: home.x, y: home.y });
    let t = 0;
    while (scene.cursor() !== "pointer") {
      if (t > limit) return Infinity;
      scene.update(STEP);
      t += STEP;
    }
    return t;
  }

  function tap(scene: MenuScene, slot: BallSlot): void {
    const p = patch(slot, W, H);
    scene.pointer({ type: "down", x: p.x, y: p.y });
    scene.pointer({ type: "up", x: p.x, y: p.y });
  }

  it("a drag turns the ball and never chooses, wherever it is let go", () => {
    flatBackdrop();
    noAirship();
    for (const [dx, dy] of [
      [4, 0],
      [0, 4],
      [3, -3],
    ] as const) {
      const scene = make(W, H);
      const calm = make(W, H);
      const log = listen(scene);
      const home = patch("left", W, H);
      const away = patch("right", W, H);
      scene.pointer({ type: "move", x: home.x, y: home.y });
      expect(scene.cursor()).toBe("pointer");
      drag(scene, home.x, home.y, dx, dy, 6);
      for (let i = 0; i < 6; i++) calm.update(STEP);
      expect(scene.cursor()).toBe("grabbing");
      // the ball turned under the hand
      expect(same(draw(calm, W, H), draw(scene, W, H))).toBe(false);
      // no hover while it is held
      expect(log.hover).toEqual(["home", null]);
      // let go on AWAY, then on HOME: nothing is chosen
      scene.pointer({ type: "move", x: away.x, y: away.y });
      scene.pointer({ type: "up", x: away.x, y: away.y });
      expect(scene.phase).toBe("idle");
      drag(scene, away.x, away.y, -dx, -dy, 6);
      scene.pointer({ type: "up", x: home.x, y: home.y });
      advance(scene, 1);
      expect(log.kickoff).toEqual([]);
      expect(log.locked).toEqual([]);
      expect(scene.phase).toBe("idle");
    }
  });

  it("a press that wobbles by a pixel or two is still a click", () => {
    noAirship();
    for (const [slot, mode] of [
      ["left", "home"],
      ["right", "away"],
    ] as const) {
      const scene = make(W, H);
      const log = listen(scene);
      const p = patch(slot, W, H);
      scene.pointer({ type: "down", x: p.x, y: p.y });
      scene.pointer({ type: "move", x: p.x + 2, y: p.y - 1 });
      scene.update(STEP);
      expect(scene.cursor()).toBe("pointer");
      scene.pointer({ type: "up", x: p.x + 2, y: p.y - 1 });
      expect(log.kickoff).toEqual([mode]);
    }
  });

  it("a flick keeps it spinning, and it is back in its pose within a few seconds", () => {
    flatBackdrop();
    noAirship();
    const scene = make(W, H);
    const log = listen(scene);
    const home = patch("left", W, H);
    const away = patch("right", W, H);
    let steps = 0;
    drag(scene, home.x, home.y, 10, 2, 6);
    steps += 6;
    scene.pointer({ type: "up", x: home.x + 60, y: home.y + 12 });
    // still spinning half a second later: nothing hovers, the ball can be grabbed
    for (let i = 0; i < 30; i++) scene.update(STEP);
    steps += 30;
    scene.pointer({ type: "move", x: away.x, y: away.y });
    expect(scene.cursor()).toBe("grab");
    const spinning = draw(scene, W, H);
    scene.update(STEP);
    steps += 1;
    expect(same(spinning, draw(scene, W, H))).toBe(false);
    // and home again in a few seconds
    const t = timeToRest(scene);
    steps += Math.round(t / STEP);
    expect(t).toBeGreaterThan(1.5);
    expect(t).toBeLessThan(4.5);
    // exactly in its pose: the same picture as a ball never touched, with HOME hovered
    const calm = make(W, H);
    for (let i = 0; i < steps; i++) calm.update(STEP);
    calm.pointer({ type: "move", x: home.x, y: home.y });
    expect(same(draw(calm, W, H), draw(scene, W, H))).toBe(true);
    // HOME on the left, AWAY on the right
    expect(log.hover.at(-1)).toBe("home");
    tap(scene, "right");
    expect(log.kickoff).toEqual(["away"]);
  });

  it("a ball let go with no speed eases straight home", () => {
    noAirship();
    const scene = make(W, H);
    const home = patch("left", W, H);
    const at = drag(scene, home.x, home.y, 6, 0, 8);
    // held still before letting go: the flick's speed is gone
    for (let i = 0; i < 20; i++) scene.update(STEP);
    scene.pointer({ type: "up", x: at.x, y: at.y });
    expect(timeToRest(scene)).toBeLessThan(1.6);
  });

  it("with reduced motion it turns under the hand but keeps no momentum", () => {
    flatBackdrop();
    noAirship();
    const flicked = (reduced: boolean): number => {
      const scene = make(W, H);
      scene.setReducedMotion(reduced);
      const calm = make(W, H);
      calm.setReducedMotion(reduced);
      const home = patch("left", W, H);
      drag(scene, home.x, home.y, 12, 2, 6);
      for (let i = 0; i < 6; i++) calm.update(STEP);
      // it turned
      expect(same(draw(calm, W, H), draw(scene, W, H))).toBe(false);
      scene.pointer({ type: "up", x: home.x + 72, y: home.y + 12 });
      return timeToRest(scene);
    };
    const still = flicked(true);
    const spun = flicked(false);
    expect(still).toBeLessThan(1.3);
    expect(spun).toBeGreaterThan(still + 1);
  });

  it("a press on a turning ball catches it, and never chooses", () => {
    noAirship();
    const scene = make(W, H);
    const log = listen(scene);
    const home = patch("left", W, H);
    drag(scene, home.x, home.y, 12, 0, 6);
    scene.pointer({ type: "up", x: home.x + 72, y: home.y });
    advance(scene, 0.2);
    // pressed and released where HOME lives
    scene.pointer({ type: "down", x: home.x, y: home.y });
    expect(scene.cursor()).toBe("grabbing");
    scene.pointer({ type: "up", x: home.x, y: home.y });
    expect(log.kickoff).toEqual([]);
    // caught: no speed left, so it is home quickly
    expect(timeToRest(scene)).toBeLessThan(1.6);
  });

  it("choose() mid-spin brings the ball round and kicks off, each callback once", () => {
    for (const reduced of [false, true]) {
      const scene = make(W, H);
      scene.setReducedMotion(reduced);
      const log = listen(scene);
      const home = patch("left", W, H);
      drag(scene, home.x, home.y, 12, 3, 6);
      scene.pointer({ type: "up", x: home.x + 72, y: home.y + 18 });
      advance(scene, 0.3);
      expect(scene.choose("away")).toBe(true);
      expect(log.kickoff).toEqual(["away"]);
      expect(scene.choose("home")).toBe(false);
      // pointer input waits
      tap(scene, "left");
      expect(scene.cursor()).toBe("default");
      if (reduced) {
        expect(scene.phase).toBe("kickoff");
      } else {
        expect(scene.phase).toBe("idle");
        advance(scene, 0.3);
        expect(scene.phase).toBe("kickoff");
      }
      runToDone(scene);
      expect(log.kickoff).toEqual(["away"]);
      expect(log.choose).toEqual(["away"]);
    }
  });

  it("choose() while the ball is held takes it from the hand", () => {
    const scene = make(W, H);
    const log = listen(scene);
    const home = patch("left", W, H);
    const at = drag(scene, home.x, home.y, 6, 0, 4);
    expect(scene.choose("home")).toBe(true);
    scene.pointer({ type: "move", x: at.x + 30, y: at.y });
    scene.pointer({ type: "up", x: at.x + 30, y: at.y });
    expect(scene.cursor()).toBe("default");
    runToDone(scene);
    expect(log.kickoff).toEqual(["home"]);
    expect(log.choose).toEqual(["home"]);
  });

  it("names its cursors: grab, grabbing, pointer and default", () => {
    noAirship();
    const scene = make(W, H);
    const m = menuLayout(W, H);
    const home = patch("left", W, H);
    scene.pointer({ type: "move", x: 2, y: H - 2 });
    expect(scene.cursor()).toBe("default");
    scene.pointer({ type: "move", x: m.cx, y: m.ballCy });
    expect(scene.cursor()).toBe("grab");
    scene.pointer({ type: "move", x: home.x, y: home.y });
    expect(scene.cursor()).toBe("pointer");
    drag(scene, home.x, home.y, 5, 0, 4);
    expect(scene.cursor()).toBe("grabbing");
    // even off the ball
    scene.pointer({ type: "move", x: 2, y: H - 2 });
    expect(scene.cursor()).toBe("grabbing");
    scene.pointer({ type: "up", x: 2, y: H - 2 });
    expect(scene.cursor()).toBe("default");
    // over a turning ball a patch is only more of the ball
    scene.pointer({ type: "move", x: home.x, y: home.y });
    expect(scene.cursor()).toBe("grab");
    // a ball still arriving cannot be grabbed
    const arriving = make(W, H, { intro: true });
    arriving.update(0);
    arriving.update(0.3);
    arriving.pointer({ type: "move", x: m.cx, y: m.ballCy });
    expect(arriving.cursor()).not.toMatch(/grab/);
    arriving.pointer({ type: "down", x: m.cx, y: m.ballCy });
    arriving.pointer({ type: "move", x: m.cx + 20, y: m.ballCy });
    expect(arriving.cursor()).not.toMatch(/grab/);
    // and nothing during a kick-off
    expect(scene.choose("home")).toBe(true);
    advance(scene, 0.5);
    scene.pointer({ type: "move", x: m.cx, y: m.ballCy });
    expect(scene.cursor()).toBe("default");
  });

  it("a drag that leaves the ball keeps turning it until it is let go", () => {
    flatBackdrop();
    noAirship();
    const scene = make(W, H);
    const m = menuLayout(W, H);
    drag(scene, m.cx, m.ballCy, 5, 0, Math.ceil((m.ballR + 20) / 5));
    const a = draw(scene, W, H);
    // well off the ball, still dragging
    scene.pointer({ type: "move", x: m.cx + m.ballR + 60, y: m.ballCy + 30 });
    expect(same(a, draw(scene, W, H))).toBe(false);
    expect(scene.cursor()).toBe("grabbing");
    // a pointer that goes lets go
    scene.pointer({ type: "leave", x: 0, y: 0 });
    expect(scene.cursor()).toBe("default");
    expect(timeToRest(scene)).toBeLessThan(5);
  });

  it("a touch drag turns the ball and leaves no hover behind", () => {
    noAirship();
    const scene = make(W, H);
    const log = listen(scene);
    const home = patch("left", W, H);
    const at = drag(scene, home.x, home.y, 5, 0, 6, true);
    scene.pointer({ type: "up", x: at.x, y: at.y, touch: true });
    scene.pointer({ type: "leave", x: at.x, y: at.y, touch: true });
    expect(log.kickoff).toEqual([]);
    expect(log.hover.at(-1)).toBe(null);
    expect(scene.cursor()).toBe("default");
  });

  it("is deterministic, and survives resize, reset and any numbers mid-spin", () => {
    const run = (): Surface => {
      const scene = make(W, H);
      const home = patch("left", W, H);
      drag(scene, home.x, home.y, 9, -4, 7);
      scene.pointer({ type: "up", x: home.x + 63, y: home.y - 28 });
      advance(scene, 0.4);
      return draw(scene, W, H);
    };
    expect(same(run(), run())).toBe(true);

    const scene = make(W, H);
    const home = patch("left", W, H);
    drag(scene, home.x, home.y, 9, -4, 3);
    scene.pointer({ type: "move", x: Number.NaN, y: Infinity });
    scene.update(STEP);
    scene.resize(130, 281);
    scene.update(Number.NaN);
    scene.update(STEP);
    expect(covered(draw(scene))).toBe(true);
    // a stalled tab puts it straight home
    scene.update(1e6);
    expect(scene.cursor()).toBe("default");
    const fresh = make();
    for (let i = 0; i < 5; i++) fresh.update(STEP);
    fresh.update(1e6);
    expect(same(draw(fresh), draw(scene))).toBe(true);
    scene.reset();
    expect(scene.phase).toBe("idle");
  });
});

describe("MenuScene: the locked patches", () => {
  const W = 480;
  const H = 270;

  /** Where `slot` is when the ball shows `shown`, before the hover moves it a pixel or two. */
  function shownAt(
    slot: BallSlot,
    shown: BallSlot,
  ): { x: number; y: number; facing: number } {
    const m = menuLayout(W, H);
    return ballSlotCenter(
      {
        cx: m.cx,
        cy: m.ballCy,
        r: m.ballR,
        ...ballShowPose(shown),
        hovered: null,
        pressed: null,
        chosen: null,
        t: 0,
      },
      slot,
    );
  }

  /**
   * Grab the ball at `from`, carry it slowly to `to`, hold it still and let go: no flick.
   * Steps 40 frames.
   */
  function carry(
    scene: MenuScene,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): void {
    scene.pointer({ type: "down", x: from.x, y: from.y });
    for (let i = 1; i <= 20; i++) {
      scene.pointer({
        type: "move",
        x: from.x + ((to.x - from.x) * i) / 20,
        y: from.y + ((to.y - from.y) * i) / 20,
      });
      scene.update(STEP);
    }
    for (let i = 0; i < 20; i++) scene.update(STEP);
    scene.pointer({ type: "up", x: to.x, y: to.y });
    scene.pointer({ type: "leave", x: 0, y: 0 });
  }

  /** Drag the ball sideways across its middle, from `from` to `to` of its radius. */
  function across(scene: MenuScene, from: number, to: number): void {
    const m = menuLayout(W, H);
    carry(
      scene,
      { x: m.cx + Math.round(m.ballR * from), y: m.ballCy + 6 },
      { x: m.cx + Math.round(m.ballR * to), y: m.ballCy + 6 },
    );
  }

  /**
   * Turn the ball by hand until `slot` faces the viewer, and let it go. Returns the frames
   * stepped.
   */
  function show(scene: MenuScene, slot: BallSlot): number {
    const m = menuLayout(W, H);
    const middle = { x: m.cx, y: m.ballCy };
    if (slot === "top" || slot === "bottom") {
      carry(scene, patch(slot, W, H), middle);
    } else if (slot === "rimLeft") {
      // about a quarter turn, to the right
      across(scene, -0.9, 0.6);
    } else if (slot === "rimRight") {
      across(scene, 0.9, -0.6);
    } else {
      // most of half a turn, dragged left to right across the ball, and a little more
      across(scene, -0.85, 0.85);
      across(scene, -0.4, 0.4);
      return 80;
    }
    return 40;
  }

  const CASES = [
    ["top", "top", "nextgen"],
    ["bottom", "bottom", "retro"],
    ["backRight", "backRight", "closest"],
    ["backLeft", "backRight", "furthest"],
    ["rimLeft", "rimLeft", "guesswho"],
    ["rimRight", "rimRight", "shootout"],
  ] as const;

  it("puts GUESS WHO and SHOOTOUT a quarter turn round, out past HOME and AWAY", () => {
    const m = menuLayout(W, H);
    const home = shownAt("left", "left");
    const away = shownAt("right", "right");
    const guess = shownAt("rimLeft", "left");
    const shoot = shownAt("rimRight", "left");
    expect(guess.x).toBeLessThan(home.x);
    expect(shoot.x).toBeGreaterThan(away.x);
    expect(guess.y).toBeLessThan(m.ballCy);
    expect(guess.facing).toBeLessThan(0.1);
    // shown, each faces the viewer straight on
    for (const slot of ["rimLeft", "rimRight"] as const) {
      const c = shownAt(slot, slot);
      expect(c.facing).toBeCloseTo(1, 6);
      expect(Math.abs(c.x - m.cx)).toBeLessThanOrEqual(1);
    }
  });

  it("a quarter turn by hand comes to rest on GUESS WHO or SHOOTOUT, and a click names it", () => {
    noAirship();
    for (const [slot, mode, from, to] of [
      ["rimLeft", "guesswho", -0.9, 0.6],
      ["rimRight", "shootout", 0.9, -0.6],
    ] as const) {
      const scene = make(W, H);
      const log = listen(scene);
      across(scene, from, to);
      log.hover.length = 0;
      advance(scene, 1.5);
      const at = shownAt(slot, slot);
      scene.pointer({ type: "move", x: at.x, y: at.y });
      expect(scene.cursor()).toBe("pointer");
      expect(log.hover.filter((m) => m !== null)).toEqual([]);
      scene.pointer({ type: "down", x: at.x, y: at.y });
      scene.pointer({ type: "up", x: at.x, y: at.y });
      expect(log.locked).toEqual([mode]);
      expect(log.kickoff).toEqual([]);
      runToDone(scene, 2);
      expect(log.choose).toEqual([]);
      expect(scene.phase).toBe("idle");
    }
  });

  it("puts CLOSEST where HOME was and FURTHEST where AWAY was, half a turn round", () => {
    const cx = menuLayout(W, H).cx;
    expect(shownAt("backRight", "backRight").x).toBeLessThan(cx - 15);
    expect(shownAt("backLeft", "backLeft").x).toBeGreaterThan(cx + 15);
  });

  it("a ball left showing a locked patch holds it about four seconds, then goes home", () => {
    flatBackdrop();
    noAirship();
    for (const [slot, shown] of CASES) {
      const scene = make(W, H);
      const calm = make(W, H);
      const log = listen(scene);
      const frames = show(scene, shown);
      for (let i = 0; i < frames; i++) calm.update(STEP);
      const at = shownAt(slot, shown);
      // at rest showing it: it can be pointed at, and hovers no mode
      advance(scene, 1);
      advance(calm, 1);
      scene.pointer({ type: "move", x: at.x, y: at.y });
      expect(scene.cursor()).toBe("pointer");
      scene.pointer({ type: "leave", x: 0, y: 0 });
      // still there nearly four seconds after it stopped
      advance(scene, 2.9);
      advance(calm, 2.9);
      scene.pointer({ type: "move", x: at.x, y: at.y });
      expect(scene.cursor()).toBe("pointer");
      scene.pointer({ type: "leave", x: 0, y: 0 });
      expect(same(draw(calm, W, H), draw(scene, W, H))).toBe(false);
      // and then home, exactly in its pose
      advance(scene, 3);
      advance(calm, 3);
      expect(same(draw(calm, W, H), draw(scene, W, H))).toBe(true);
      expect(log.hover.filter((m) => m !== null)).toEqual([]);
      expect(log.locked).toEqual([]);
    }
  });

  it("a press on a locked patch at rest names its mode, never chooses, and waits again", () => {
    noAirship();
    for (const [slot, shown, mode] of CASES) {
      const scene = make(W, H);
      const log = listen(scene);
      show(scene, shown);
      advance(scene, 3.5);
      const at = shownAt(slot, shown);
      scene.pointer({ type: "down", x: at.x, y: at.y });
      scene.pointer({ type: "up", x: at.x, y: at.y });
      expect(log.locked).toEqual([mode]);
      expect(log.kickoff).toEqual([]);
      expect(scene.phase).toBe("idle");
      scene.pointer({ type: "leave", x: 0, y: 0 });
      // the wait starts afresh: still showing it well past the first four seconds
      advance(scene, 3.5);
      scene.pointer({ type: "move", x: at.x, y: at.y });
      expect(scene.cursor()).toBe("pointer");
      scene.pointer({ type: "down", x: at.x, y: at.y });
      scene.pointer({ type: "up", x: at.x, y: at.y });
      expect(log.locked).toEqual([mode, mode]);
      expect(log.choose).toEqual([]);
    }
  });

  it("stays while the pointer rests on it, and goes home when it leaves", () => {
    noAirship();
    const scene = make(W, H);
    const log = listen(scene);
    show(scene, "top");
    const at = shownAt("top", "top");
    scene.pointer({ type: "move", x: at.x, y: at.y });
    advance(scene, 8);
    expect(scene.cursor()).toBe("pointer");
    scene.pointer({ type: "leave", x: 0, y: 0 });
    advance(scene, 6);
    // home: HOME is back on the left
    const home = patch("left", W, H);
    scene.pointer({ type: "move", x: home.x, y: home.y });
    expect(log.hover.at(-1)).toBe("home");
  });

  it("HOME and AWAY still choose from a pose that shows another patch", () => {
    noAirship();
    for (const [shown, slot, mode] of [
      ["top", "left", "home"],
      ["bottom", "right", "away"],
    ] as const) {
      const scene = make(W, H);
      const log = listen(scene);
      show(scene, shown);
      advance(scene, 1);
      const at = shownAt(slot, shown);
      scene.pointer({ type: "move", x: at.x, y: at.y });
      expect(log.hover.at(-1)).toBe(mode);
      scene.pointer({ type: "down", x: at.x, y: at.y });
      scene.pointer({ type: "up", x: at.x, y: at.y });
      expect(log.kickoff).toEqual([mode]);
      expect(log.locked).toEqual([]);
      runToDone(scene);
      expect(log.choose).toEqual([mode]);
    }
  });
});

describe("MenuScene: the airship", () => {
  const W = 480;
  const H = 270;

  it("hovers and takes clicks on the backdrop's clock, and never chooses", () => {
    const clocks: number[] = [];
    vi.spyOn(MenuBackdrop.prototype, "draw").mockImplementation((s, t) => {
      clocks.push(t);
      s.clear(FLAT);
    });
    const at = vi
      .spyOn(MenuBackdrop.prototype, "airshipAt")
      .mockImplementation((x, y) => x < 60 && y < 40);
    const poke = vi
      .spyOn(MenuBackdrop.prototype, "pokeAirship")
      .mockReturnValue("wobble");
    const scene = make(W, H);
    const log = listen(scene);
    advance(scene, 1.3);
    draw(scene, W, H);
    scene.pointer({ type: "move", x: 30, y: 20 });
    expect(scene.cursor()).toBe("pointer");
    expect(at).toHaveBeenLastCalledWith(30, 20, clocks.at(-1));
    // six quick clicks: six pokes, each on the clock the picture is drawn with
    for (let i = 0; i < 6; i++) {
      scene.pointer({ type: "down", x: 30, y: 20 });
      scene.pointer({ type: "up", x: 30, y: 20 });
      draw(scene, W, H);
      expect(poke).toHaveBeenLastCalledWith(clocks.at(-1));
      advance(scene, 0.1);
    }
    expect(poke).toHaveBeenCalledTimes(6);
    // a tap too
    scene.pointer({ type: "down", x: 20, y: 10, touch: true });
    scene.pointer({ type: "up", x: 20, y: 10, touch: true });
    expect(poke).toHaveBeenCalledTimes(7);
    // a press that drags, or that ends off the airship, is no click
    scene.pointer({ type: "down", x: 30, y: 20 });
    scene.pointer({ type: "move", x: 40, y: 30 });
    scene.pointer({ type: "up", x: 30, y: 20 });
    scene.pointer({ type: "down", x: 58, y: 20 });
    scene.pointer({ type: "up", x: 61, y: 20 });
    expect(poke).toHaveBeenCalledTimes(7);
    expect(log.kickoff).toEqual([]);
    expect(log.locked).toEqual([]);
    expect(log.hover).toEqual([]);
    expect(scene.phase).toBe("idle");
    // and the ball took none of it
    scene.pointer({ type: "leave", x: 0, y: 0 });
    const calm = make(W, H);
    advance(calm, 1.3 + 0.6);
    expect(same(draw(calm, W, H), draw(scene, W, H))).toBe(true);
  });

  it("never takes what is meant for the ball", () => {
    vi.spyOn(MenuBackdrop.prototype, "airshipAt").mockReturnValue(true);
    const poke = vi
      .spyOn(MenuBackdrop.prototype, "pokeAirship")
      .mockReturnValue("pop");
    const scene = make(W, H);
    const log = listen(scene);
    const m = menuLayout(W, H);
    scene.pointer({ type: "move", x: m.cx, y: m.ballCy });
    expect(scene.cursor()).toBe("grab");
    // pressed on the ball and let go off it: a drag, not a click on the airship
    scene.pointer({ type: "down", x: m.cx, y: m.ballCy });
    scene.pointer({ type: "up", x: m.cx + m.ballR + 20, y: m.ballCy });
    // (it may come to rest showing a locked patch, and hold it a while)
    advance(scene, 8);
    tap(scene, "left");
    expect(log.kickoff).toEqual(["home"]);
    expect(poke).not.toHaveBeenCalled();
    // and it is off the air during a kick-off
    scene.pointer({ type: "move", x: 5, y: 5 });
    expect(scene.cursor()).toBe("default");
  });

  function tap(scene: MenuScene, slot: BallSlot): void {
    const p = patch(slot, W, H);
    scene.pointer({ type: "down", x: p.x, y: p.y });
    scene.pointer({ type: "up", x: p.x, y: p.y });
  }
});

describe("MenuScene: sound", () => {
  const W = 480;
  const H = 270;

  /** Everything the scene asks to be heard, in order. */
  function hear(scene: MenuScene): SoundCue[] {
    const cues: SoundCue[] = [];
    scene.onSound = (cue) => cues.push(cue);
    return cues;
  }

  function of<K extends SoundCue["kind"]>(
    cues: readonly SoundCue[],
    kind: K,
  ): Extract<SoundCue, { kind: K }>[] {
    return cues.filter(
      (c): c is Extract<SoundCue, { kind: K }> => c.kind === kind,
    );
  }

  /** The cues with each run of wind counted once. */
  function story(cues: readonly SoundCue[]): string[] {
    const out: string[] = [];
    for (const c of cues) {
      if (c.kind === "wind" && out.at(-1) === "wind") continue;
      out.push(c.kind);
    }
    return out;
  }

  it("is silent as the pointer comes onto the ball and moves about on it", () => {
    noAirship();
    const scene = make(W, H);
    const cues = hear(scene);
    const m = menuLayout(W, H);
    const off = { x: m.cx + m.ballR + 30, y: m.ballCy };
    for (let n = 0; n < 4; n++) {
      scene.pointer({ type: "move", ...off });
      advance(scene, 0.3);
      scene.pointer({ type: "move", x: m.cx, y: m.ballCy });
      // moving about on it, over HOME and AWAY, the ball breathing under it
      for (let i = 0; i < 60; i++) {
        scene.pointer({
          type: "move",
          x: m.cx + ((i * 7) % 61) - 30,
          y: m.ballCy,
        });
        scene.update(STEP);
      }
    }
    scene.pointer({ type: "leave", x: 0, y: 0 });
    expect(cues).toEqual([]);
  });

  it("gives a soft kick on a press of the ball, a click or the start of a drag", () => {
    noAirship();
    const m = menuLayout(W, H);
    const soft = { kind: "kick", power: expect.closeTo(0.3, 1) as number };
    // a click off the patches
    const scene = make(W, H);
    const cues = hear(scene);
    const blank = { x: m.cx, y: m.ballCy + Math.round(m.ballR * 0.6) };
    scene.pointer({ type: "down", ...blank });
    expect(cues).toEqual([soft]);
    scene.pointer({ type: "up", ...blank });
    expect(cues).toEqual([soft]);
    // another a moment later: another
    advance(scene, 0.3);
    scene.pointer({ type: "down", ...blank });
    scene.pointer({ type: "up", ...blank });
    expect(of(cues, "kick").length).toBe(2);
    // a tap with a finger is one, not two
    const tapped = make(W, H);
    const taps = hear(tapped);
    tapped.pointer({ type: "down", ...blank, touch: true });
    tapped.pointer({ type: "up", ...blank, touch: true });
    expect(taps).toEqual([soft]);
    // the start of a drag: one, as it is pressed, then only wind
    const dragged = make(W, H);
    const drag = hear(dragged);
    const home = patch("left", W, H);
    dragged.pointer({ type: "down", x: home.x, y: home.y });
    for (let i = 1; i <= 6; i++) {
      dragged.pointer({ type: "move", x: home.x + 10 * i, y: home.y });
      dragged.update(STEP);
    }
    expect(story(drag)).toEqual(["kick", "wind"]);
    expect(of(drag, "kick")).toEqual([soft]);
    // a press off the ball, in the sky: nothing
    const sky = make(W, H);
    const none = hear(sky);
    sky.pointer({ type: "down", x: 5, y: 5 });
    sky.pointer({ type: "up", x: 5, y: 5 });
    expect(none).toEqual([]);
  });

  it("blows wind while the ball spins, as hard as it spins, and none at rest", () => {
    noAirship();
    const scene = make(W, H);
    const cues = hear(scene);
    advance(scene, 2);
    expect(cues).toEqual([]);
    const home = patch("left", W, H);
    scene.pointer({ type: "down", x: home.x, y: home.y });
    for (let i = 1; i <= 6; i++) {
      scene.pointer({ type: "move", x: home.x + 10 * i, y: home.y + 2 * i });
      scene.update(STEP);
    }
    scene.pointer({ type: "up", x: home.x + 60, y: home.y + 12 });
    scene.pointer({ type: "leave", x: 0, y: 0 });
    // every frame of the flick and the coast
    const at = cues.length;
    advance(scene, 0.5);
    expect(of(cues, "wind").length).toBeGreaterThanOrEqual(at + 29);
    const speeds = of(cues, "wind").map((c) => c.speed);
    const top = Math.max(...speeds);
    expect(top).toBeGreaterThan(0.5);
    expect(top).toBeLessThanOrEqual(1);
    expect(Math.min(...speeds)).toBeGreaterThan(0);
    // it dies away as the ball slows, and stops once it is home
    advance(scene, 6);
    const after = cues.length;
    expect(of(cues, "wind").at(-1)?.speed).toBeLessThan(0.2);
    advance(scene, 1);
    expect(cues.length).toBe(after);
    // the soft kick of the press that started the drag, and no other
    expect(of(cues, "kick")).toEqual([{ kind: "kick", power: 0.3 }]);
  });

  it("HOME: the strike, the wind of the flight and the landing, and no roar or horns", () => {
    noAirship();
    const scene = make(W, H);
    const cues = hear(scene);
    scene.choose("home");
    runToDone(scene);
    expect(story(cues)).toEqual(["kick", "wind", "land", "land", "transition"]);
    // the thump as it drops onto the spot, then a softer one for its small bounce
    expect(of(cues, "land")).toEqual([
      { kind: "land", power: 1 },
      { kind: "land", power: expect.closeTo(0.35, 2) as number },
    ]);
    expect(of(cues, "sparkle")).toEqual([]);
    expect(of(cues, "kick")).toEqual([{ kind: "kick", power: 1 }]);
    for (const c of of(cues, "wind")) {
      expect(c.speed).toBeGreaterThan(0);
      expect(c.speed).toBeLessThanOrEqual(1);
    }
    expect(of(cues, "wind").length).toBeGreaterThan(20);
  });

  it("AWAY: the strike and a wind that fades as the ball vanishes, and no roar", () => {
    noAirship();
    const scene = make(W, H);
    const cues = hear(scene);
    scene.choose("away");
    runToDone(scene);
    expect(story(cues)).toEqual([
      "kick",
      "wind",
      "sparkle",
      "wind",
      "transition",
      "wind",
    ]);
    expect(of(cues, "sparkle")).toEqual([{ kind: "sparkle" }]);
    expect(of(cues, "land")).toEqual([]);
    const winds = of(cues, "wind").map((c) => c.speed);
    for (let i = 1; i < winds.length; i++) {
      expect(winds[i]).toBeLessThanOrEqual(winds[i - 1]);
    }
    expect(winds[0]).toBeGreaterThan(0.6);
    expect(winds.at(-1)).toBeLessThan(0.05);
  });

  it("lands HOME's thumps on the landing and its bounce, and AWAY's sparkle on the twinkle", () => {
    noAirship();
    const when = (mode: "home" | "away", kind: SoundCue["kind"]): number[] => {
      const scene = make(W, H);
      const cues = hear(scene);
      scene.choose(mode);
      const times: number[] = [];
      let t = 0;
      while (scene.phase === "kickoff") {
        const before = cues.length;
        scene.update(STEP);
        t += STEP;
        for (const c of cues.slice(before)) if (c.kind === kind) times.push(t);
      }
      return times;
    };
    // HOME's ball is down 0.89 s after the choice and its bounce comes down 0.2 s later
    const [down, bounce] = when("home", "land");
    expect(down).toBeCloseTo(0.89, 1);
    expect(bounce - down).toBeCloseTo(0.2, 1);
    // AWAY's twinkle flares 1.07 s after the choice; the sparkle peaks 0.12 s after it
    // starts, so it starts a moment before the ball vanishes, and before the iris (1.13 s)
    const [sparkle] = when("away", "sparkle");
    expect(sparkle + 0.12).toBeCloseTo(1.07, 1);
    expect(sparkle).toBeLessThan(when("away", "transition")[0]);
  });

  it("sends the transition's sound once, closing, as the iris starts", () => {
    noAirship();
    for (const mode of ["home", "away"] as const) {
      const scene = make(W, H);
      const cues = hear(scene);
      scene.choose(mode);
      let t = 0;
      let when = -1;
      while (scene.phase === "kickoff") {
        const before = cues.length;
        scene.update(STEP);
        t += STEP;
        if (cues.slice(before).some((c) => c.kind === "transition")) when = t;
      }
      expect(of(cues, "transition"), mode).toEqual([
        { kind: "transition", opening: false },
      ]);
      // after the ball is down or gone, just as the picture starts to close
      expect(when, mode).toBeGreaterThan(1.05);
      expect(when, mode).toBeLessThan(1.2);
      advance(scene, 2);
      expect(of(cues, "transition").length, mode).toBe(1);
    }
    // once even when the whole kick-off goes by in one step
    const jump = make(W, H);
    const cues = hear(jump);
    jump.choose("home");
    jump.update(5);
    expect(of(cues, "transition")).toEqual([
      { kind: "transition", opening: false },
    ]);
    // and again for the next kick-off, after a reset
    jump.reset();
    jump.choose("away");
    runToDone(jump);
    expect(of(cues, "transition").length).toBe(2);
  });

  it("with reduced motion: the strike and the cut, and nothing more", () => {
    noAirship();
    for (const mode of ["home", "away"] as const) {
      const scene = make(W, H);
      scene.setReducedMotion(true);
      const cues = hear(scene);
      scene.choose(mode);
      runToDone(scene);
      expect(story(cues), mode).toEqual(["kick", "transition"]);
    }
  });

  it("the airship squeaks when poked and pops when it bursts", () => {
    vi.spyOn(MenuBackdrop.prototype, "airshipAt").mockImplementation(
      (x, y) => x < 60 && y < 40,
    );
    vi.spyOn(MenuBackdrop.prototype, "pokeAirship")
      .mockReturnValueOnce("wobble")
      .mockReturnValueOnce("wobble")
      .mockReturnValueOnce("pop")
      .mockReturnValue("none");
    const scene = make(W, H);
    const cues = hear(scene);
    for (let i = 0; i < 4; i++) {
      scene.pointer({ type: "move", x: 30, y: 20 });
      scene.pointer({ type: "down", x: 30, y: 20 });
      scene.pointer({ type: "up", x: 30, y: 20 });
      advance(scene, 0.1);
    }
    expect(story(cues)).toEqual(["squeak", "squeak", "pop"]);
  });

  it("is a town with a stadium in the distance, by day and by night", () => {
    const scene = make(W, H);
    expect(scene.ambience()).toEqual({
      venue: "town",
      crowd: expect.closeTo(0.3, 1) as number,
      night: false,
    });
    scene.setLighting(NIGHT);
    expect(scene.ambience().night).toBe(true);
  });

  it("never sends a horn, and only the picture's faint cheer and distant rockets, over minutes of play", () => {
    const tricks = vi.spyOn(MenuBackdrop.prototype, "pokeMascot");
    const scene = make(W, H);
    const cues = hear(scene);
    const m = menuLayout(W, H);
    // every frame stepped, a frame drawn now and then (the picture's clock is the drawn one)
    const play = (seconds: number) => {
      for (let i = 0; i < seconds * 60; i++) scene.update(STEP);
      draw(scene, W, H);
    };
    // the pointer on the ball and off it, now and then
    for (let i = 0; i < 6; i++) {
      scene.pointer({ type: "move", x: m.cx, y: m.ballCy });
      play(2);
      scene.pointer({ type: "move", x: 2, y: H - 2 });
      play(3);
    }
    // a spin by hand
    const home = patch("left", W, H);
    scene.pointer({ type: "down", x: home.x, y: home.y });
    for (let i = 1; i <= 6; i++) {
      scene.pointer({ type: "move", x: home.x + 10 * i, y: home.y + 2 * i });
      scene.update(STEP);
    }
    scene.pointer({ type: "up", x: home.x + 60, y: home.y + 12 });
    scene.pointer({ type: "leave", x: 0, y: 0 });
    play(8);
    // the airship poked until it pops, and left to come down and come back
    const backdrop = (scene as unknown as { backdrop: MenuBackdrop }).backdrop;
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let y = 0; y < H / 2; y += 2) {
      for (let x = 0; x < W / 2; x += 2) {
        if (backdrop.airshipAt(x, y, 0)) {
          sx += x;
          sy += y;
          n++;
        }
      }
    }
    expect(n).toBeGreaterThan(0);
    sx = Math.round(sx / n);
    sy = Math.round(sy / n);
    for (let i = 0; i < 12; i++) {
      scene.pointer({ type: "move", x: sx, y: sy });
      scene.pointer({ type: "down", x: sx, y: sy });
      scene.pointer({ type: "up", x: sx, y: sy });
      play(0.2);
    }
    scene.pointer({ type: "leave", x: 0, y: 0 });
    play(20);
    // every one of the mascot's tricks
    const spot = backdrop.mascotSpot();
    expect(spot).not.toBeNull();
    for (let i = 0; i < 5; i++) {
      scene.pointer({ type: "move", x: spot!.x, y: spot!.y - 4 });
      scene.pointer({ type: "down", x: spot!.x, y: spot!.y - 4 });
      scene.pointer({ type: "up", x: spot!.x, y: spot!.y - 4 });
      scene.pointer({ type: "leave", x: 0, y: 0 });
      play(5);
    }
    // a few minutes of the match and its fireworks, then a HOME kick-off
    play(150);
    scene.choose("home");
    runToDone(scene);
    const kinds = new Set(cues.map((c) => c.kind));
    expect(kinds.has("squeak")).toBe(true);
    expect(kinds.has("pop")).toBe(true);
    expect(kinds.has("kick")).toBe(true);
    expect(kinds.has("thud") || kinds.has("splash")).toBe(true);
    expect(tricks.mock.results.filter((r) => r.value === "trick").length).toBe(
      5,
    );
    expect(of(cues, "vuvuzela")).toEqual([]);
    // the match far off: a goal every 40 s of the picture's clock, a very small cheer each
    expect(of(cues, "cheer").length).toBeGreaterThanOrEqual(4);
    for (const c of of(cues, "cheer"))
      expect(c).toEqual({ kind: "cheer", size: 0.1 });
    expect(of(cues, "firework").length).toBeGreaterThan(0);
    for (const c of of(cues, "firework")) {
      expect(c).toEqual({ kind: "firework", distant: true });
    }
  });

  it("asks for nothing to be heard when nobody is listening", () => {
    noAirship();
    const scene = make(W, H);
    const m = menuLayout(W, H);
    scene.pointer({ type: "move", x: m.cx, y: m.ballCy });
    expect(() => {
      scene.choose("home");
      runToDone(scene);
    }).not.toThrow();
  });
});

describe("MenuScene: the picture's sounds", () => {
  const W = 480;
  const H = 270;

  it("forwards the picture's own cues once, over spans that meet, on the clock it is drawn with", () => {
    const spans: [number, number][] = [];
    const clocks: number[] = [];
    vi.spyOn(MenuBackdrop.prototype, "draw").mockImplementation((s, t) => {
      clocks.push(t);
      s.clear(FLAT);
    });
    vi.spyOn(MenuBackdrop.prototype, "cuesBetween").mockImplementation(
      (t0, t1) => {
        spans.push([t0, t1]);
        // a whistle on every whole second
        return Math.floor(t1) > Math.floor(t0) ? [{ kind: "whistle" }] : [];
      },
    );
    const scene = make(W, H);
    const cues: SoundCue[] = [];
    scene.onSound = (cue) => cues.push(cue);
    for (let i = 0; i < 3 * 60 + 3; i++) {
      scene.update(STEP);
      draw(scene, W, H);
    }
    expect(cues).toEqual([
      { kind: "whistle" },
      { kind: "whistle" },
      { kind: "whistle" },
    ]);
    // each span starts where the last ended, and ends on the clock the frame is drawn with
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i][0]).toBe(spans[i - 1][1]);
    }
    expect(spans.at(-1)?.[1]).toBe(clocks.at(-1));
    // not once the screen has gone to ink
    scene.choose("home");
    runToDone(scene);
    const heard = spans.length;
    advance(scene, 1);
    expect(spans.length).toBe(heard);
  });
});

describe("MenuScene: the mascot", () => {
  const W = 480;
  const H = 270;

  it("hovers and takes clicks on the backdrop's clock, and never does anything else", () => {
    noAirship();
    const clocks: number[] = [];
    vi.spyOn(MenuBackdrop.prototype, "draw").mockImplementation((s, t) => {
      clocks.push(t);
      s.clear(FLAT);
    });
    const at = vi
      .spyOn(MenuBackdrop.prototype, "mascotAt")
      .mockImplementation((x, y) => x >= 40 && x < 60 && y >= 200 && y < 230);
    const poke = vi
      .spyOn(MenuBackdrop.prototype, "pokeMascot")
      .mockReturnValue("trick");
    const scene = make(W, H);
    const log = listen(scene);
    const cues: SoundCue[] = [];
    scene.onSound = (cue) => cues.push(cue);
    advance(scene, 1.3);
    draw(scene, W, H);
    scene.pointer({ type: "move", x: 50, y: 215 });
    expect(scene.cursor()).toBe("pointer");
    expect(at).toHaveBeenLastCalledWith(50, 215, clocks.at(-1));
    // four clicks: four pokes, each on the clock the picture is drawn with
    for (let i = 0; i < 4; i++) {
      scene.pointer({ type: "down", x: 50, y: 215 });
      scene.pointer({ type: "up", x: 50, y: 215 });
      draw(scene, W, H);
      expect(poke).toHaveBeenLastCalledWith(clocks.at(-1));
      advance(scene, 0.4);
    }
    expect(poke).toHaveBeenCalledTimes(4);
    // a press that drags, or that ends off him, is no click
    scene.pointer({ type: "down", x: 50, y: 215 });
    scene.pointer({ type: "move", x: 58, y: 222 });
    scene.pointer({ type: "up", x: 50, y: 215 });
    scene.pointer({ type: "down", x: 58, y: 215 });
    scene.pointer({ type: "up", x: 61, y: 215 });
    expect(poke).toHaveBeenCalledTimes(4);
    // nothing else: no mode, no sound of the scene's own, the ball untouched
    expect(log.kickoff).toEqual([]);
    expect(log.locked).toEqual([]);
    expect(log.hover).toEqual([]);
    expect(cues).toEqual([]);
    scene.pointer({ type: "leave", x: 0, y: 0 });
    expect(scene.cursor()).toBe("default");
    const calm = make(W, H);
    advance(calm, 1.3 + 1.6);
    expect(same(draw(calm, W, H), draw(scene, W, H))).toBe(true);
  });

  it("is behind the ball: a press on the ball is never his", () => {
    noAirship();
    vi.spyOn(MenuBackdrop.prototype, "mascotAt").mockReturnValue(true);
    const poke = vi
      .spyOn(MenuBackdrop.prototype, "pokeMascot")
      .mockReturnValue("trick");
    const scene = make(W, H);
    const log = listen(scene);
    const p = patch("left", W, H);
    scene.pointer({ type: "down", x: p.x, y: p.y });
    scene.pointer({ type: "up", x: p.x, y: p.y });
    expect(log.kickoff).toEqual(["home"]);
    expect(poke).not.toHaveBeenCalled();
  });
});

describe("MenuScene: the wind round the spinning ball", () => {
  const W = 480;
  const H = 270;
  type Windy = { compose(): void; drawWind(s: Surface): void };

  /** The streaks alone, on a clear surface: where each pixel of them is. */
  function streaks(scene: MenuScene): [number, number][] {
    const s = new Surface(W, H);
    s.clear(TRANSPARENT);
    const w = scene as unknown as Windy;
    w.compose();
    w.drawWind(s);
    const out: [number, number][] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (s.data[y * W + x] !== TRANSPARENT) out.push([x, y]);
      }
    }
    return out;
  }

  function flick(scene: MenuScene): void {
    const home = patch("left", W, H);
    scene.pointer({ type: "down", x: home.x, y: home.y });
    for (let i = 1; i <= 6; i++) {
      scene.pointer({ type: "move", x: home.x + 10 * i, y: home.y + 2 * i });
      scene.update(STEP);
    }
    scene.pointer({ type: "up", x: home.x + 60, y: home.y + 12 });
    scene.pointer({ type: "leave", x: 0, y: 0 });
  }

  it("blows round the ball as it spins, less as it slows, and none at rest", () => {
    noAirship();
    const scene = make(W, H);
    advance(scene, 1);
    expect(streaks(scene)).toEqual([]);
    flick(scene);
    const m = menuLayout(W, H);
    const counts: number[] = [];
    for (let i = 0; i < 6; i++) {
      const px = streaks(scene);
      counts.push(px.length);
      const ball = (scene as unknown as { ball: { cx: number; cy: number } })
        .ball;
      for (const [x, y] of px) {
        // just outside the ball, never on it (its words) nor up in the logo's sky
        const d = Math.hypot(x - ball.cx, y - ball.cy);
        expect(d).toBeGreaterThan(m.ballR + 1);
        expect(d).toBeLessThan(m.ballR * 1.3 + 4);
        expect(y).toBeGreaterThanOrEqual(m.logo.h);
      }
      advance(scene, 0.15);
    }
    expect(counts[0]).toBeGreaterThan(60);
    expect(counts[5]).toBeLessThan(counts[0]);
    advance(scene, 8);
    expect(streaks(scene)).toEqual([]);
  });

  it("is none with reduced motion, and the same every time", () => {
    noAirship();
    const calm = make(W, H);
    calm.setReducedMotion(true);
    flick(calm);
    expect(streaks(calm)).toEqual([]);
    const a = make(W, H);
    const b = make(W, H);
    flick(a);
    flick(b);
    advance(a, 0.2);
    advance(b, 0.2);
    expect(streaks(a)).toEqual(streaks(b));
  });
});
