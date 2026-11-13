import { describe, expect, it } from "vitest";
import { MenuBackdrop } from "~/art/stadium";
import {
  MATCH_PERIOD,
  PLAYERS,
  makeMatchState,
  matchAt,
} from "~/art/stadium-match";
import { project, type View } from "~/art/stadium-view";

// The match on the pitch: the players run, never jump; they stand when they stand; the
// ball is at the feet of whoever has it; the loop closes with no pop.

/** The view of the home picture at w x h, for the pixels the players are drawn on. */
function viewAt(w: number, h: number): View {
  const b = new MenuBackdrop({ seed: 1, sign: { header: "A", text: "B" } });
  b.resize(w, h);
  b.mascotSpot();
  return (b as unknown as { view: View }).view;
}

const FPS = 60;

describe("the match on the pitch", { timeout: 30_000 }, () => {
  it("moves every player at most a pixel a frame, all round the loop and over its seam", () => {
    for (const [w, h] of [
      [960, 540],
      [1280, 720],
      [1440, 720],
      [234, 507],
      [260, 562],
    ]) {
      const view = viewAt(w, h);
      const g = makeMatchState();
      const px = new Int32Array(PLAYERS);
      const py = new Int32Array(PLAYERS);
      let ballX = 0;
      let ballY = 0;
      let worst = { d: 0, at: "" };
      let worstBall = 0;
      for (let k = 0; k <= (MATCH_PERIOD + 2) * FPS; k++) {
        const t = k / FPS;
        matchAt(g, t);
        for (let i = 0; i < PLAYERS; i++) {
          const p = project(view, g.x[i], g.v[i]);
          const d = Math.max(Math.abs(p.x - px[i]), Math.abs(p.y - py[i]));
          if (k > 0 && d > worst.d) {
            worst = { d, at: `${w}x${h} player ${i} at ${t.toFixed(3)}` };
          }
          px[i] = p.x;
          py[i] = p.y;
        }
        // the ball flies faster, but never jumps either: a hard shot is 3 px a frame
        const b = project(view, g.ballX, g.ballV, g.ballH);
        if (k > 0) {
          worstBall = Math.max(worstBall, Math.hypot(b.x - ballX, b.y - ballY));
        }
        ballX = b.x;
        ballY = b.y;
      }
      expect(worst.d, worst.at).toBeLessThanOrEqual(1);
      expect(worstBall, `${w}x${h} ball`).toBeLessThanOrEqual(4);
    }
  }, 60_000);

  it("runs no faster than a sprint", () => {
    const a = makeMatchState();
    const b = makeMatchState();
    for (let t = 0; t < MATCH_PERIOD; t += 1 / 30) {
      matchAt(a, t);
      matchAt(b, t + 1 / 30);
      for (let i = 0; i < PLAYERS; i++) {
        const pace = Math.hypot(b.x[i] - a.x[i], b.v[i] - a.v[i]) * 30;
        expect(pace, `player ${i} at ${t.toFixed(2)}`).toBeLessThan(14);
      }
    }
  });

  it("stands still when he is still, and runs (his feet in turn) when he moves", () => {
    const a = makeMatchState();
    const b = makeMatchState();
    let standing = 0;
    let running = 0;
    let slips = 0;
    let flips = 0;
    const last = new Int8Array(PLAYERS);
    for (let k = 0; k < MATCH_PERIOD * 30; k++) {
      const t = k / 30;
      matchAt(a, t);
      matchAt(b, t + 1 / 30);
      for (let i = 0; i < PLAYERS; i++) {
        const pace = Math.hypot(b.x[i] - a.x[i], b.v[i] - a.v[i]) * 30;
        if (a.stride[i] < 0) {
          standing++;
          if (pace > 3) slips++;
        } else {
          running++;
          expect(pace, `player ${i} at ${t.toFixed(2)}`).toBeGreaterThan(1);
          if (k > 0 && last[i] >= 0 && last[i] !== a.stride[i]) flips++;
        }
        last[i] = a.stride[i];
      }
    }
    // plenty of both, and a standing player all but never slides
    expect(standing).toBeGreaterThan(0.25 * (standing + running));
    expect(running).toBeGreaterThan(0.25 * (standing + running));
    expect(slips).toBeLessThan(0.01 * standing);
    // the feet change as he runs: not every frame, and not never
    expect(flips).toBeGreaterThan(running / 10);
    expect(flips).toBeLessThan(running / 2);
  });

  it("keeps the ball at the feet of whoever has it", () => {
    const g = makeMatchState();
    // (player, from, to): who has the ball when
    const holders: readonly [number, number, number][] = [
      [20, 0, 1],
      [18, 1.7, 3],
      [5, 4, 5.6],
      [6, 6.3, 7.2],
      [9, 7.9, 8.6],
      [7, 9.3, 10.2],
      [8, 11.3, 13.6],
      [11, 14.95, 16.4],
      [12, 17.3, 18.8],
      [16, 19.6, 20.8],
      [3, 21.7, 22.8],
      [9, 24.4, 25.6],
      [20, 32, 40],
    ];
    for (const [p, t0, t1] of holders) {
      for (let t = t0; t <= t1; t += 0.05) {
        matchAt(g, t);
        expect(
          Math.hypot(g.ballX - g.x[p], g.ballV - g.v[p]),
          `${p} at ${t.toFixed(2)}`,
        ).toBeLessThan(2);
      }
    }
  });

  it("keeps two players off one spot", () => {
    const g = makeMatchState();
    for (let t = 0; t < MATCH_PERIOD; t += 0.1) {
      matchAt(g, t);
      for (let i = 0; i < PLAYERS; i++) {
        for (let j = i + 1; j < PLAYERS; j++) {
          const d = Math.hypot(
            (g.x[j] - g.x[i]) / 1.7,
            (g.v[j] - g.v[i]) / 3.6,
          );
          expect(d, `${i} and ${j} at ${t.toFixed(1)}`).toBeGreaterThan(0.8);
        }
      }
    }
  });

  it("is a pure function of the time, and loops", () => {
    const a = makeMatchState();
    const b = makeMatchState();
    for (const t of [0, 3.3, 17, 26.5, 39.99]) {
      matchAt(a, t);
      matchAt(b, t + MATCH_PERIOD * 3);
      for (let i = 0; i < PLAYERS; i++) {
        expect(b.x[i]).toBeCloseTo(a.x[i], 3);
        expect(b.v[i]).toBeCloseTo(a.v[i], 3);
        expect(b.stride[i]).toBe(a.stride[i]);
      }
      expect(b.ballX).toBeCloseTo(a.ballX, 3);
    }
    // the seam: the end of the loop is its start
    matchAt(a, MATCH_PERIOD - 1e-5);
    matchAt(b, 0);
    for (let i = 0; i < PLAYERS; i++) {
      expect(Math.abs(a.x[i] - b.x[i])).toBeLessThan(0.01);
      expect(Math.abs(a.v[i] - b.v[i])).toBeLessThan(0.01);
    }
    expect(Math.abs(a.ballX - b.ballX)).toBeLessThan(0.01);
    // nonsense time is the kick-off
    matchAt(a, Number.NaN);
    expect(a.ballX).toBeCloseTo(b.ballX, 5);
  });
});
