import { describe, expect, it } from "vitest";
import { MenuBackdrop } from "~/art/stadium";
import {
  MATCH_PERIOD,
  PLAYERS,
  PLAY_COUNT,
  makeMatchState,
  matchAt,
  matchPlay,
  playAt,
  playsFor,
  type MatchState,
  type Side,
} from "~/art/stadium-match";
import { project, type View } from "~/art/stadium-view";

// The match on the pitch: plays from a kick-off to a goal, one after another in a seeded
// random order. The players run, never jump; they stand when they stand; the ball is at
// the feet of whoever has it; each play runs on into the next with no pop.

/** The view of the home picture at w x h, for the pixels the players are drawn on. */
function viewAt(w: number, h: number): View {
  const b = new MenuBackdrop({ seed: 1, sign: { header: "A", text: "B" } });
  b.resize(w, h);
  b.mascotSpot();
  return (b as unknown as { view: View }).view;
}

const FPS = 60;
const SIDES: readonly Side[] = [1, 0];

/** Every play on its own: (its label, the state at play time t). */
const PLAYS = SIDES.flatMap((side) =>
  playsFor(side).map((info, i) => ({
    label: info.name,
    info,
    at: (g: MatchState, t: number): MatchState => playAt(g, side, i, t),
  })),
);

describe("the match on the pitch", { timeout: 60_000 }, () => {
  it("has three plays, one of them an away goal, and each mirrored for the home side's kick-off", () => {
    expect(PLAY_COUNT).toBe(6);
    const away = playsFor(1);
    expect(away.map((p) => p.name)).toEqual(["long ball", "break", "header"]);
    expect(away.filter((p) => p.scorer === 1)).toHaveLength(1);
    // the mirror images: the other side scores
    playsFor(0).forEach((p, i) => {
      expect(p.name).toBe(`${away[i].name} (mirrored)`);
      expect(p.scorer).toBe(away[i].scorer === 0 ? 1 : 0);
      expect(p.goal).toBe(away[i].goal);
    });
  });

  it("plays them in a random order of the seed's, never one twice running, the side that let in the goal kicking off", () => {
    const seen = new Set<string>();
    const firsts = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      firsts.add(matchPlay(seed, 0).name);
      for (let k = 0; k < 30; k++) {
        const now = matchPlay(seed, k);
        seen.add(now.name);
        // the first is the away side's kick-off; then the side that conceded kicks off
        if (k === 0) expect(now.kickoff).toBe(1);
        else {
          const last = matchPlay(seed, k - 1);
          expect(now.kickoff).toBe(last.scorer === 0 ? 1 : 0);
        }
        // never the same play twice running, as written or mirrored
        if (k > 0) {
          const base = (name: string): string =>
            name.replace(" (mirrored)", "");
          expect(base(now.name)).not.toBe(base(matchPlay(seed, k - 1).name));
        }
        // the same seed, the same order
        expect(matchPlay(seed, k)).toEqual(now);
      }
    }
    expect(seen.size).toBe(6);
    expect(firsts.size).toBe(3);
    // not one order for every seed
    const order = (seed: number): string =>
      Array.from({ length: 8 }, (_, k) => matchPlay(seed, k).name).join();
    expect(new Set([1, 2, 3, 4, 5].map(order)).size).toBeGreaterThan(1);
  });

  it("moves every player at most a pixel a frame, in every play and from one into the next", () => {
    for (const [w, h] of [
      [960, 540],
      [1440, 720],
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
      // a run of plays long enough to have had all six, over their seams
      const seed = 0;
      const plays = new Set<string>();
      for (let k = 0; k < 10; k++) plays.add(matchPlay(seed, k).name);
      expect(plays.size, "the run has every play").toBe(6);
      for (let k = 0; k <= 10 * MATCH_PERIOD * FPS; k++) {
        const t = k / FPS;
        matchAt(g, t, seed);
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
  }, 120_000);

  it("runs no faster than a sprint", () => {
    const a = makeMatchState();
    const b = makeMatchState();
    for (const play of PLAYS) {
      for (let t = 0; t < MATCH_PERIOD - 1 / 30; t += 1 / 30) {
        play.at(a, t);
        play.at(b, t + 1 / 30);
        for (let i = 0; i < PLAYERS; i++) {
          const pace = Math.hypot(b.x[i] - a.x[i], b.v[i] - a.v[i]) * 30;
          expect(
            pace,
            `${play.label}: player ${i} at ${t.toFixed(2)}`,
          ).toBeLessThan(14);
        }
      }
    }
  });

  it("stands still when he is still, and runs (his feet in turn) when he moves", () => {
    const a = makeMatchState();
    const b = makeMatchState();
    for (const play of PLAYS) {
      let standing = 0;
      let running = 0;
      let slips = 0;
      let flips = 0;
      const last = new Int8Array(PLAYERS);
      for (let k = 0; k < MATCH_PERIOD * 30 - 1; k++) {
        const t = k / 30;
        play.at(a, t);
        play.at(b, t + 1 / 30);
        for (let i = 0; i < PLAYERS; i++) {
          const pace = Math.hypot(b.x[i] - a.x[i], b.v[i] - a.v[i]) * 30;
          if (a.stride[i] < 0) {
            standing++;
            if (pace > 3) slips++;
          } else {
            running++;
            expect(
              pace,
              `${play.label}: player ${i} at ${t.toFixed(2)}`,
            ).toBeGreaterThan(1);
            if (k > 0 && last[i] >= 0 && last[i] !== a.stride[i]) flips++;
          }
          last[i] = a.stride[i];
        }
      }
      // plenty of both, and a standing player all but never slides
      const all = standing + running;
      expect(standing, play.label).toBeGreaterThan(0.25 * all);
      expect(running, play.label).toBeGreaterThan(0.25 * all);
      expect(slips, play.label).toBeLessThan(0.01 * standing);
      // the feet change as he runs: not every frame, and not never
      expect(flips, play.label).toBeGreaterThan(running / 10);
      expect(flips, play.label).toBeLessThan(running / 2);
    }
  });

  it("keeps the ball at the feet of whoever has it", () => {
    const g = makeMatchState();
    // (player, from, to): who has the ball when, in each play kicked off by the away side
    const holders: Record<string, readonly [number, number, number][]> = {
      "long ball": [
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
      ],
      break: [
        [20, 0, 1],
        [17, 1.8, 3],
        [14, 4, 5],
        [15, 6, 7.6],
        [19, 8.5, 9.6],
        [5, 9.9, 11],
        [6, 11.8, 12.7],
        [10, 13.6, 15],
        [11, 15.7, 17.4],
        [21, 19, 19.8],
        [20, 20.6, 22],
        [16, 22.8, 23.4],
        [9, 30.3, 40],
      ],
      header: [
        [20, 0, 1],
        [21, 1.6, 2.5],
        [16, 3.3, 5.2],
        [4, 5.5, 6.5],
        [7, 7.3, 8.3],
        [3, 9.2, 10],
        [1, 11.4, 12.8],
        [5, 13.6, 14.4],
        [9, 15.3, 16.1],
        [6, 16.8, 17.6],
        [5, 18.6, 22],
        [20, 30, 40],
      ],
    };
    const mirrorOf = (p: number): number => (p < 11 ? p + 11 : p - 11);
    playsFor(1).forEach((info, i) => {
      for (const [p, t0, t1] of holders[info.name]) {
        for (let t = t0; t <= t1; t += 0.05) {
          // the play, and its mirror image (the other side's player in his part)
          for (const [side, who] of [
            [1, p],
            [0, mirrorOf(p)],
          ] as const) {
            playAt(g, side, i, t);
            expect(
              Math.hypot(g.ballX - g.x[who], g.ballV - g.v[who]),
              `${info.name} ${side}: ${who} at ${t.toFixed(2)}`,
            ).toBeLessThan(2);
          }
        }
      }
    });
  });

  it("keeps two players off one spot", () => {
    const g = makeMatchState();
    for (const play of PLAYS) {
      for (let t = 0; t < MATCH_PERIOD; t += 0.1) {
        play.at(g, t);
        for (let i = 0; i < PLAYERS; i++) {
          for (let j = i + 1; j < PLAYERS; j++) {
            const d = Math.hypot(
              (g.x[j] - g.x[i]) / 1.7,
              (g.v[j] - g.v[i]) / 3.6,
            );
            expect(
              d,
              `${play.label}: ${i} and ${j} at ${t.toFixed(1)}`,
            ).toBeGreaterThan(0.8);
          }
        }
      }
    }
  });

  it("puts the ball in the net at the goal, and cheers it as the scorer's", () => {
    const g = makeMatchState();
    for (const play of PLAYS) {
      const { goal, scorer } = play.info;
      play.at(g, goal + 1);
      // in the net the scorer attacks: the home side's at the east end
      expect(Math.sign(g.ballX), play.label).toBe(scorer === 0 ? 1 : -1);
      expect(Math.abs(g.ballX), play.label).toBeGreaterThan(66);
      expect(g.goalBy, play.label).toBe(scorer);
      expect(g.sinceGoal, play.label).toBeCloseTo(1, 5);
      // a home goal brings the house down; an away goal only their end
      expect(g.cheer, play.label).toBeCloseTo(scorer === 0 ? 1 : 0.7, 5);
      play.at(g, goal - 0.5);
      expect(g.goalBy, play.label).toBe(-1);
    }
  });

  it("is a pure function of the seed and the time, and runs each play into the next", () => {
    const a = makeMatchState();
    const b = makeMatchState();
    for (const t of [0, 3.3, 17, 26.5, 39.99, 141.2]) {
      matchAt(a, t, 5);
      matchAt(b, t, 5);
      for (let i = 0; i < PLAYERS; i++) {
        expect(b.x[i]).toBe(a.x[i]);
        expect(b.v[i]).toBe(a.v[i]);
        expect(b.stride[i]).toBe(a.stride[i]);
      }
      expect(b.ballX).toBe(a.ballX);
    }
    // the seams: the end of each play is the start of the next
    for (const seed of [0, 5, 9, 1234]) {
      for (let k = 1; k < 12; k++) {
        matchAt(a, k * MATCH_PERIOD - 1e-5, seed);
        matchAt(b, k * MATCH_PERIOD, seed);
        for (let i = 0; i < PLAYERS; i++) {
          expect(Math.abs(a.x[i] - b.x[i])).toBeLessThan(0.01);
          expect(Math.abs(a.v[i] - b.v[i])).toBeLessThan(0.01);
        }
        expect(Math.abs(a.ballX - b.ballX)).toBeLessThan(0.01);
        expect(Math.abs(a.ballV - b.ballV)).toBeLessThan(0.01);
      }
    }
    // nonsense time is the first kick-off
    matchAt(a, Number.NaN, 5);
    matchAt(b, 0, 5);
    expect(a.ballX).toBeCloseTo(b.ballX, 5);
  });
});
