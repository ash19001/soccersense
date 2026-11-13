import { describe, expect, test } from "vitest";
import { lightingFor } from "~/art/lighting";
import type { Grade, Mode } from "~/game";
import { Surface, TRANSPARENT } from "~/pixel";
import { CareerScene } from "./career";
import type { Pose } from "./career-cast";

/** A total inside each tier. */
const TOTALS = [0, 100, 200, 300, 400, 500, 600, 680];

function ready(mode: Mode, total: number, night = false): CareerScene {
  const scene = new CareerScene({ seed: 7, mode, total });
  scene.resize(240, 300);
  scene.setLighting(
    lightingFor({ elevation: night ? -30 : 35, morning: false }),
  );
  scene.update(0);
  return scene;
}

function run(scene: CareerScene, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) scene.update(1 / 60);
}

function poses(scene: CareerScene): string {
  const list = (scene as unknown as { poses: Pose[] }).poses;
  return list
    .map((p) =>
      p.on
        ? `${p.x},${p.y},${p.anim},${p.kanim},${p.fetch ?? "-"},${Math.floor(p.frame)},${p.flip}`
        : "off",
    )
    .join(" ");
}

function frame(scene: CareerScene): Surface {
  const s = new Surface(240, 300);
  scene.draw(s);
  return s;
}

describe("RETRO's cast in the career scene", () => {
  test.each(TOTALS.map((t, tier) => [tier, t] as const))(
    "tier %i: RETRO draws, covers the canvas, and its cast stands, moves and shoots as HOME's",
    (_tier, total) => {
      for (const night of [false, true]) {
        const home = ready("home", total, night);
        const retro = ready("retro", total, night);
        run(home, 1.2);
        run(retro, 1.2);
        expect(poses(retro)).toBe(poses(home));
        const a = frame(home);
        const b = frame(retro);
        expect(b.data.includes(TRANSPARENT)).toBe(false);
        // the look is RETRO's own
        expect(
          Buffer.compare(
            Buffer.from(a.data.buffer),
            Buffer.from(b.data.buffer),
          ),
        ).not.toBe(0);
        const grade: Grade = total < 300 ? "golazo" : "worldie";
        home.playShot(grade);
        retro.playShot(grade);
        for (const t of [0.6, 1.4, 3.5]) {
          run(home, t === 0.6 ? 0.6 : t === 1.4 ? 0.8 : 2.1);
          run(retro, t === 0.6 ? 0.6 : t === 1.4 ? 0.8 : 2.1);
          expect(poses(retro), `t ${t}`).toBe(poses(home));
          // both drawn alike: a frame drawn is part of the scene's own clock
          frame(home);
          expect(frame(retro).data.includes(TRANSPARENT)).toBe(false);
        }
      }
    },
  );

  test("full time with the trophy lift: RETRO's places are HOME's", () => {
    const home = ready("home", 600);
    const retro = ready("retro", 600);
    run(home, 1);
    run(retro, 1);
    home.showFullTime(680);
    retro.showFullTime(680);
    run(home, 1.2);
    run(retro, 1.2);
    expect(poses(retro)).toBe(poses(home));
    frame(home);
    expect(frame(retro).data.includes(TRANSPARENT)).toBe(false);
  });

  test("AWAY's cast is not touched by the era (today's look)", () => {
    const a = ready("away", 400);
    const b = ready("away", 400);
    run(a, 1);
    run(b, 1);
    expect(Array.from(frame(b).data)).toEqual(Array.from(frame(a).data));
  });
});
