// The fetch: after a goal or a miss that brings no promotion, the same ball is
// brought back to his feet; there is never a second ball, and a next shot asked for in the
// middle of it takes the ball from where it is.

import { describe, expect, test } from "vitest";

import { endFrontAt } from "~/art/grounds/end";
import { geoFor } from "~/art/grounds/paint";
import { careerLayout, type CareerLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import type { Grade } from "~/game";
import { Surface } from "~/pixel";
import { CareerScene } from "./career";
import { castSpots, endFrontX } from "./career-cast";

interface Ball {
  on: boolean;
  x: number;
  y: number;
}
interface FetchPlan {
  who: number;
  release: number;
  arrive: number;
  lift: number;
}
interface StoryView {
  st: number;
  flickAt: number;
  end: number;
  fetch: FetchPlan | null;
}
/** The scene's insides the tests look at. */
interface Inside {
  L: CareerLayout;
  balls: Ball[];
  story: StoryView | null;
}
const inside = (scene: CareerScene): Inside => scene as unknown as Inside;

const TOTALS = [0, 100, 200, 300, 400, 500, 600, 680];
const KINDS: [string, Grade][] = [
  ["worldie", "worldie"],
  ["golazo", "golazo"],
  ["trivela", "trivela"],
  ["toepoke", "toepoke"],
  ["tapin", "tapin"],
  ["skied", "miss"],
  ["wide", "miss"],
];
const STEP = 1 / 60;
const SLOW = 120_000;

function ready(tier: number, w: number, h: number): CareerScene {
  const scene = new CareerScene({ seed: 5, mode: "home", total: TOTALS[tier] });
  scene.resize(w, h);
  scene.setLighting(lightingFor({ elevation: 30, morning: false }));
  scene.update(0);
  for (let i = 0; i < 70; i++) scene.update(STEP);
  return scene;
}

/** A scene at `tier` with the kind's shot just asked for (a wide miss is the second). */
function start(kind: string, grade: Grade, tier: number, w = 480, h = 270) {
  const scene = ready(tier, w, h);
  if (kind === "wide") {
    scene.playShot("miss");
    for (let i = 0; i < 360; i++) scene.update(STEP);
  }
  scene.playShot(grade);
  return scene;
}

function ballsOn(scene: CareerScene): Ball[] {
  return inside(scene).balls.filter((b) => b.on);
}

describe("the fetch", () => {
  test(
    "after every goal and miss at tiers 0, 2, 4 and 6 the one ball is brought back to his feet",
    () => {
      const s = new Surface(480, 270);
      for (const tier of [0, 2, 4, 6]) {
        for (const [kind, grade] of KINDS) {
          const scene = start(kind, grade, tier);
          const story = inside(scene).story;
          expect(story?.fetch, `${kind} t${tier}`).toBeTruthy();
          if (!story?.fetch) continue;
          const { flickAt } = story;
          let last: Ball | null = null;
          let atFeet = false;
          for (let t = 0; t < story.end + 0.5; t += STEP) {
            scene.update(STEP);
            scene.draw(s);
            const on = ballsOn(scene);
            // one ball, always: never a new one, never the old one left lying
            expect(on.length, `${kind} t${tier} at ${t.toFixed(2)}`).toBe(1);
            const b = on[0];
            if (last) {
              // and it never jumps: it is carried, rolled or thrown there
              const jump = Math.hypot(b.x - last.x, b.y - last.y);
              expect(jump, `${kind} t${tier} at ${t.toFixed(2)}`).toBeLessThan(
                24,
              );
            }
            last = { on: true, x: b.x, y: b.y };
            const st = inside(scene).story?.st ?? Infinity;
            if (st > flickAt - 0.05 && st < flickAt) {
              const L = inside(scene).L;
              const { KICK_DX, KICK_DY } = castSpots();
              expect([b.x, b.y], `${kind} t${tier}`).toEqual([
                L.heroX + KICK_DX,
                L.groundY + KICK_DY,
              ]);
              atFeet = true;
            }
          }
          expect(atFeet, `${kind} t${tier}`).toBe(true);
          // juggling again, and nothing left lying
          expect(inside(scene).story).toBeNull();
          expect(ballsOn(scene).length).toBe(1);
        }
      }
    },
    SLOW,
  );

  test(
    "fits between questions: the ball is at his feet within 5 s of the shot",
    () => {
      for (const [w, h] of [
        [960, 540],
        [683, 384],
        [260, 563],
        [234, 507],
      ]) {
        for (let tier = 0; tier < 8; tier++) {
          for (const [kind, grade] of KINDS) {
            const scene = start(kind, grade, tier, w, h);
            const story = inside(scene).story;
            expect(story?.flickAt, `${kind} t${tier} ${w}`).toBeLessThan(5);
            expect(story?.flickAt).toBeGreaterThan(2.4);
          }
        }
      }
    },
    SLOW,
  );

  test(
    "a next shot asked for in the middle of a fetch takes that ball, from where it is",
    () => {
      const s = new Surface(480, 270);
      for (const tier of [0, 2, 4, 6]) {
        for (const [kind, grade] of KINDS) {
          for (const cut of [0.2, 1.5, 2.4, 2.6, 3.0, 3.6]) {
            const scene = start(kind, grade, tier);
            for (let t = 0; t < cut; t += STEP) scene.update(STEP);
            scene.draw(s);
            const before = ballsOn(scene);
            const done = { n: 0 };
            scene.playShot("golazo", () => done.n++);
            scene.update(STEP);
            scene.draw(s);
            const after = ballsOn(scene);
            expect(after.length, `${kind} t${tier} cut ${cut}`).toBe(1);
            if (before.length === 1) {
              const jump = Math.hypot(
                after[0].x - before[0].x,
                after[0].y - before[0].y,
              );
              // the same ball, moved on one frame: never one from somewhere else
              expect(jump, `${kind} t${tier} cut ${cut}`).toBeLessThan(40);
            }
            for (let t = 0; t < 6; t += STEP) {
              scene.update(STEP);
              scene.draw(s);
              expect(ballsOn(scene).length).toBe(1);
            }
            expect(done.n).toBe(1);
            expect(ballsOn(scene).length).toBe(1);
          }
        }
      }
    },
    SLOW,
  );

  test("a promotion ends the fetch: on the new ground the ball is at his feet", () => {
    const s = new Surface(480, 270);
    const scene = ready(3, 480, 270);
    scene.playShot("golazo");
    for (let t = 0; t < 2.6; t += STEP) scene.update(STEP);
    scene.promote(400);
    for (let t = 0; t < 1.6; t += STEP) {
      scene.update(STEP);
      scene.draw(s);
      expect(ballsOn(scene).length).toBeLessThanOrEqual(1);
    }
    expect(inside(scene).story).toBeNull();
    expect(ballsOn(scene).length).toBe(1);
  });

  test("the ball kid stands on the end stand's front line (end.ts) at every size", () => {
    const sizes = [
      [960, 540],
      [854, 480],
      [683, 384],
      [260, 563],
      [234, 507],
    ];
    for (const [w, h] of sizes) {
      const L = careerLayout(w, h);
      const g = geoFor(w, h);
      for (const row of [L.farTouchY, L.groundY, L.nearTouchY]) {
        const kid = Math.round(endFrontX(L, row));
        expect(Math.abs(kid - endFrontAt(g, row))).toBeLessThanOrEqual(1);
      }
    }
  });
});
