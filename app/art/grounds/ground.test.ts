import { describe, expect, it } from "vitest";
import { careerLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { Surface, TRANSPARENT } from "~/pixel";
import {
  CROWD_MOODS,
  CareerGround,
  FINAL_NIGHT,
  GROUND_TIERS,
  type CrowdMood,
  type Tier,
} from "./index";

const DAY = lightingFor({ elevation: 35, morning: false });
const DUSK = lightingFor({ elevation: -2, morning: false });
const NIGHT = lightingFor({ elevation: -25, morning: false });
const LABELS = { boards: ["SOCCERSENSE", "PLAY DAILY"], banners: ["COME ON"] };

const SIZES: readonly (readonly [number, number])[] = [
  [480, 270],
  [640, 360],
  [688, 288],
  [130, 281],
  [120, 222],
  [160, 300],
];

function render(
  tier: Tier,
  opts: {
    w?: number;
    h?: number;
    mode?: "home" | "away";
    light?: ReturnType<typeof lightingFor>;
    t?: number;
    mood?: CrowdMood;
    moodT?: number;
    seed?: number;
    labels?: typeof LABELS;
    bulge?: { y: number; amount: number } | null;
  } = {},
): { s: Surface; ground: CareerGround } {
  const w = opts.w ?? 480;
  const h = opts.h ?? 270;
  const ground = new CareerGround({
    seed: opts.seed ?? 7,
    mode: opts.mode ?? "home",
    tier,
    labels: opts.labels ?? LABELS,
  });
  ground.resize(w, h);
  ground.setLighting(opts.light ?? DAY);
  if (opts.mood) ground.setMood(opts.mood, opts.moodT ?? 0);
  const s = new Surface(w, h);
  ground.drawBack(s, opts.t ?? 1);
  ground.drawFront(s, opts.t ?? 1, opts.bulge);
  return { s, ground };
}

function holes(s: Surface): number {
  let n = 0;
  for (let i = 0; i < s.data.length; i++) if (s.data[i] === TRANSPARENT) n++;
  return n;
}

function diff(a: Surface, b: Surface): number {
  let n = 0;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) n++;
  return n;
}

describe("CareerGround covers the canvas", () => {
  for (const [w, h] of SIZES) {
    it(`every tier, mode and light at ${w} x ${h}`, () => {
      for (const tier of GROUND_TIERS) {
        for (const mode of ["home", "away"] as const) {
          for (const light of [DAY, NIGHT]) {
            const { s } = render(tier, { w, h, mode, light });
            expect(holes(s), `tier ${tier} ${mode} ${light.phase}`).toBe(0);
          }
        }
      }
    });
  }

  it("every mood at every tier, at dusk too", () => {
    const s = new Surface(480, 270);
    for (const tier of GROUND_TIERS) {
      const ground = new CareerGround({
        seed: 3,
        mode: "away",
        tier,
        labels: LABELS,
      });
      ground.resize(480, 270);
      ground.setLighting(DUSK);
      for (const mood of CROWD_MOODS) {
        ground.setMood(mood, 0);
        for (const t of [0.2, 1.5, 4, 12]) {
          s.clear();
          ground.drawBack(s, t);
          ground.drawFront(s, t, { y: ground.goal.barY + 5, amount: 0.7 });
          expect(holes(s)).toBe(0);
        }
      }
    }
  });
});

describe("the goal", () => {
  it("has the brief's numbers for each kind", () => {
    const c = careerLayout(480, 270);
    const kinds = GROUND_TIERS.map((tier) => render(tier).ground.goal);
    expect(kinds[0]).toEqual({
      kind: "jumpers",
      lineX: c.goalX,
      barY: c.groundY - 15,
      depth: 0,
    });
    expect(kinds[1]).toEqual({
      kind: "small",
      lineX: c.goalX,
      barY: c.groundY - 17,
      depth: 8,
    });
    for (const tier of [2, 3, 4, 5, 6, 7]) {
      expect(kinds[tier]).toEqual({
        kind: "full",
        lineX: c.goalX,
        barY: c.groundY - 24,
        depth: 11,
      });
    }
  });

  it("follows the canvas size and the tier", () => {
    const ground = new CareerGround({ seed: 1, mode: "home", tier: 0 });
    ground.resize(130, 281);
    expect(ground.goal.lineX).toBe(109);
    expect(ground.goal.barY).toBe(146 - 15);
    ground.setTier(4);
    expect(ground.goal.kind).toBe("full");
    expect(ground.goal.barY).toBe(146 - 24);
    ground.resize(480, 270);
    expect(ground.goal.lineX).toBe(305);
  });

  it("bulges only when asked, near the ball's height", () => {
    const flat = render(4, { bulge: null }).s;
    const none = render(4, { bulge: { y: 120, amount: 0 } }).s;
    const full = render(4, { bulge: { y: 125, amount: 1 } }).s;
    expect(diff(flat, none)).toBe(0);
    expect(diff(flat, full)).toBeGreaterThan(0);
    const c = careerLayout(480, 270);
    for (let y = 0; y < 270; y++) {
      for (let x = 0; x < 480; x++) {
        if (flat.get(x, y) !== full.get(x, y)) {
          expect(Math.abs(y - 125)).toBeLessThanOrEqual(8);
          expect(x).toBeGreaterThan(c.goalX);
          expect(x).toBeLessThan(c.goalX + 20);
        }
      }
    }
  });

  it("lets a ball in the net show through the mesh", () => {
    const ground = new CareerGround({ seed: 1, mode: "home", tier: 4 });
    ground.resize(480, 270);
    ground.setLighting(DAY);
    const s = new Surface(480, 270);
    ground.drawBack(s, 0);
    const g = ground.goal;
    const bx = g.lineX + 5;
    const by = g.barY + 8;
    const ball = s.get(0, 0) === 1 ? 2 : 1;
    s.rect(bx, by, 3, 3, ball as never);
    ground.drawFront(s, 0);
    let seen = 0;
    for (let y = by; y < by + 3; y++) {
      for (let x = bx; x < bx + 3; x++)
        if ((s.get(x, y) as number) === ball) seen++;
    }
    expect(seen).toBeGreaterThanOrEqual(3);
    expect(seen).toBeLessThan(9);
  });
});

describe("light", () => {
  it("is night at tiers 6 and 7 whatever the sky, the player's own below", () => {
    for (const tier of GROUND_TIERS) {
      const { ground } = render(tier, { light: DAY });
      if (tier >= 6) {
        expect(ground.light).toBe(FINAL_NIGHT);
        expect(ground.light.phase).toBe("night");
        expect(ground.light.lightsOn).toBe(true);
      } else {
        expect(ground.light).toBe(DAY);
      }
    }
  });

  it("does not change the picture at tiers 6 and 7 when the player's sky changes", () => {
    const day = render(6, { light: DAY }).s;
    const night = render(6, { light: NIGHT }).s;
    expect(diff(day, night)).toBe(0);
  });

  it("floodlights tiers 2 to 5 at night: the pitch is far brighter than the park's", () => {
    const c = careerLayout(480, 270);
    const lum = (tier: Tier): number => {
      const { s } = render(tier, { light: NIGHT });
      const v = s.get(c.cx - 100, c.groundY + 20) as number;
      return ((v >>> 16) & 255) + ((v >>> 8) & 255) + (v & 255);
    };
    expect(lum(3)).toBeGreaterThan(lum(0) * 1.5);
  });
});

describe("the same inputs give the same pixels", () => {
  it("for two grounds built apart", () => {
    for (const tier of GROUND_TIERS) {
      const a = render(tier, { t: 3.3, mood: "cheer", moodT: 2 }).s;
      const b = render(tier, { t: 3.3, mood: "cheer", moodT: 2 }).s;
      expect(diff(a, b)).toBe(0);
    }
  });

  it("for one ground drawn again after other frames", () => {
    const { ground, s } = render(5, { t: 2 });
    const again = new Surface(480, 270);
    for (let t = 0; t < 3; t += 0.37) ground.drawBack(again, t);
    ground.drawBack(again, 2);
    ground.drawFront(again, 2);
    expect(diff(s, again)).toBe(0);
  });

  it("and a different seed gives a different crowd", () => {
    expect(
      diff(render(4, { seed: 1 }).s, render(4, { seed: 2 }).s),
    ).toBeGreaterThan(500);
  });
});

describe("the crowd", () => {
  it("reacts from the time the mood was set, not before", () => {
    const before = render(4, { t: 5, mood: "cheer", moodT: 9 }).s;
    const idle = render(4, { t: 5 }).s;
    expect(diff(before, idle)).toBe(0);
    const after = render(4, { t: 9.5, mood: "cheer", moodT: 9 }).s;
    const idleLater = render(4, { t: 9.5 }).s;
    expect(diff(after, idleLater)).toBeGreaterThan(300);
  });

  it("is still when hushed", () => {
    const a = render(4, { t: 3, mood: "hush", moodT: 1 }).s;
    const b = render(4, { t: 3.5, mood: "hush", moodT: 1 }).s;
    const c = careerLayout(480, 270);
    // nothing moves in the stand rows (only the LED boards crawl below them)
    let moved = 0;
    for (let y = c.farTouchY - 70; y < c.farTouchY - 8; y++) {
      for (let x = 0; x < 480; x++) if (a.get(x, y) !== b.get(x, y)) moved++;
    }
    expect(moved).toBeLessThan(40);
  });

  it("wears other colours away from home", () => {
    expect(
      diff(render(4, { mode: "home" }).s, render(4, { mode: "away" }).s),
    ).toBeGreaterThan(2000);
  });

  it("paints the words it is given", () => {
    expect(
      diff(render(2).s, render(2, { labels: { boards: [], banners: [] } }).s),
    ).toBeGreaterThan(50);
  });
});

describe("odd input", () => {
  it("never throws at odd sizes and times", () => {
    const sizes: readonly (readonly [number, number])[] = [
      [1, 1],
      [2, 3],
      [7, 500],
      [900, 40],
      [400, 250],
      [720, 360],
    ];
    for (const [w, h] of sizes) {
      for (const tier of [0, 1, 3, 4, 7] as const) {
        for (const t of [Number.NaN, -5, 0, 1e7]) {
          const ground = new CareerGround({
            seed: Number.NaN,
            mode: "away",
            tier,
          });
          ground.resize(w, h);
          ground.setLighting(NIGHT);
          ground.setMood("party", Number.NaN);
          const s = new Surface(w, h);
          expect(() => {
            ground.drawBack(s, t);
            ground.drawFront(s, t, { y: Number.NaN, amount: 5 });
          }).not.toThrow();
        }
      }
    }
  });

  it("follows the surface it is given, even without resize", () => {
    const ground = new CareerGround({ seed: 1, mode: "home", tier: 3 });
    const s = new Surface(200, 150);
    ground.drawBack(s, 0);
    expect(holes(s)).toBe(0);
    expect(ground.goal.lineX).toBe(careerLayout(200, 150).goalX);
  });

  it("clamps a tier out of range", () => {
    const ground = new CareerGround({ seed: 1, mode: "home", tier: 9 as Tier });
    expect(ground.goal.kind).toBe("full");
    ground.setTier(-3 as Tier);
    expect(ground.goal.kind).toBe("jumpers");
  });

  it("puts the podium under the hero at tier 7 only", () => {
    const c = careerLayout(480, 270);
    expect(render(6).ground.podium).toBeNull();
    const pd = render(7).ground.podium;
    expect(pd).not.toBeNull();
    expect(pd?.x).toBe(c.heroX);
    expect(pd?.top).toBeLessThan(c.groundY);
    expect(pd?.top).toBeGreaterThanOrEqual(c.actionTop + 18);
  });
});
