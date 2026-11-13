/**
 * RETRO's people (.snaps/era-art/THEME.md): the early days of the game laid over every frame
 * of the cast's art, never a second copy of it.
 *
 * `retroFrames` works on the fill art (figure.ts's legend, before `figure()` outlines it),
 * frame by frame, and only rewrites cells inside the figure (the cap's peak is the one cell
 * it may add), so every move and shot keeps its timing and every spot stays put:
 * - long baggy shorts to the knee: the bare thigh between the shorts and the socks is shorts;
 * - thick socks with a turned-over band (the sock's trim, its own colour: letters 4 and 9)
 *   and high leather boots (the sock's last cell above the boot is boot);
 * - long sleeves to a buttoned cuff: the bare arm is sleeve but for the hand, the old short
 *   sleeve's trim goes, a cuff of trim where the sleeve ends;
 * - a laced collar: a short placket of trim shade under the collar;
 * - stripes where the kit has them (letters 2 and 3 on the shirt's every other pair of
 *   columns: the shirt's own colours for a plain kit);
 * - a moustache over the mouth (letter 1: the hair's colour, or the skin's for a clean
 *   shave) on the men;
 * - slicked hair: the curls' highlight gone, a line of shine across the crown;
 * - the keeper: a flat cap (letters A and B) with its peak over the brow, and a polo neck.
 *
 * Which way is up is read from the frame (from the head to the shirt), so the bicycle kick
 * and the dives get the same look as the upright frames.
 *
 * The kits' colours for RETRO are `retroKit` (kit.ts calls it for `era: "retro"`).
 */

import { shade, type Color } from "~/pixel";
import { P } from "../palette";
import type { Kit, KitBase } from "./kit";

// ---------------------------------------------------------------------------
// The letters
// ---------------------------------------------------------------------------

/** RETRO's era letters (figure.ts `LEGEND`) and their slot in `kit.eraColors`. */
export const RETRO = {
  moustache: "1",
  stripe: "2",
  stripeShade: "3",
  band: "4",
  bandShade: "9",
  cap: "A",
  capShade: "C",
  /** The youth cap's peak over skin: the keeper's cap shade, everyone else's skin. */
  peak: "D",
} as const;

const SKIN = new Set(["s", "S", "l", "m"]);
const HAIR = new Set(["h", "H"]);
const SOCK = new Set(["o", "O"]);
const SHIRT = new Set(["t", "T", "U", "r", "R"]);
const LIT_SKIN = new Set(["s", "l"]);

type Grid = string[][];

function at(g: Grid, x: number, y: number): string {
  return g[y]?.[x] ?? ".";
}

const N4: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function touches(g: Grid, x: number, y: number, set: Set<string>): boolean {
  for (const [dx, dy] of N4) if (set.has(at(g, x + dx, y + dy))) return true;
  return false;
}

/** A 4-connected group of skin cells. */
interface Comp {
  cells: [number, number][];
  kind: "head" | "leg" | "arm" | "none";
  /** Split off a head by `splitArms`: an arm or nothing, never a head. */
  strand?: boolean;
}

function skinComps(g: Grid): Comp[] {
  const h = g.length;
  const w = g[0]?.length ?? 0;
  const seen = new Uint8Array(w * h);
  const out: Comp[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (seen[y * w + x] === 1 || !SKIN.has(g[y][x])) continue;
      const cells: [number, number][] = [];
      const stack: [number, number][] = [[x, y]];
      seen[y * w + x] = 1;
      while (stack.length > 0) {
        const c = stack.pop();
        if (c === undefined) break;
        cells.push(c);
        for (const [dx, dy] of N4) {
          const nx = c[0] + dx;
          const ny = c[1] + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (seen[ny * w + nx] === 1 || !SKIN.has(g[ny][nx])) continue;
          seen[ny * w + nx] = 1;
          stack.push([nx, ny]);
        }
      }
      out.push({ cells, kind: "none" });
    }
  }
  return out;
}

/** A trim cell that is a sock's band (it touches the sock), not a collar or a cuff. */
function isBand(g: Grid, x: number, y: number): boolean {
  const c = at(g, x, y);
  return (c === "r" || c === "R") && touches(g, x, y, SOCK);
}

/** A face: a skin cell is solid if all its 8 neighbours are face (hair does not count). */
const HEAD_MASS = new Set(["s", "S", "l", "m", "k"]);

const N8: readonly (readonly [number, number])[] = [
  ...N4,
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/**
 * An arm raised beside the head (the celebration, the lift, the slide) touches the hair or
 * runs into the face, so it would be taken for part of the head and left bare. Split it
 * off: the face is the solid part of the group (skin cells whose 8 neighbours are all head)
 * and the cells next to it; an arm is a strand 2 cells wide, never solid. A group with no
 * solid cell (an arm against the hair) is all strand.
 */
function splitArms(g: Grid, comps: Comp[]): Comp[] {
  const out: Comp[] = [];
  for (const comp of comps) {
    const touchesHair = comp.cells.some(([x, y]) => touches(g, x, y, HAIR));
    if (!touchesHair || comp.cells.length < 8) {
      out.push(comp);
      continue;
    }
    const key = (x: number, y: number): string => `${x},${y}`;
    const solid = new Set<string>();
    for (const [x, y] of comp.cells) {
      if (N8.every(([dx, dy]) => HEAD_MASS.has(at(g, x + dx, y + dy)))) {
        solid.add(key(x, y));
      }
    }
    const face: [number, number][] = [];
    const rest = new Set<string>();
    for (const [x, y] of comp.cells) {
      const near =
        solid.has(key(x, y)) ||
        N8.some(([dx, dy]) => solid.has(key(x + dx, y + dy)));
      if (near) face.push([x, y]);
      else rest.add(key(x, y));
    }
    if (face.length > 0) out.push({ cells: face, kind: "none" });
    // the strands left over, each its own group
    const cells = comp.cells.filter(([x, y]) => rest.has(key(x, y)));
    const seen = new Set<string>();
    for (const c of cells) {
      if (seen.has(key(c[0], c[1]))) continue;
      const part: [number, number][] = [];
      const stack: [number, number][] = [c];
      seen.add(key(c[0], c[1]));
      while (stack.length > 0) {
        const q = stack.pop();
        if (q === undefined) break;
        part.push(q);
        for (const [dx, dy] of N4) {
          const k = key(q[0] + dx, q[1] + dy);
          if (!rest.has(k) || seen.has(k)) continue;
          seen.add(k);
          stack.push([q[0] + dx, q[1] + dy]);
        }
      }
      out.push({ cells: part, kind: "none", strand: true });
    }
  }
  return out;
}

function classify(g: Grid, comps: Comp[]): void {
  for (const comp of comps) {
    if (comp.strand === true) {
      // a strand split off a head: an arm if it reaches the shirt, else it stays skin
      const shirt = comp.cells.some(([x, y]) => touches(g, x, y, SHIRT));
      if (shirt) comp.kind = "arm";
      continue;
    }
    let hair = 0;
    let sock = false;
    let shirt = false;
    for (const [x, y] of comp.cells) {
      for (const [dx, dy] of N4) {
        const c = at(g, x + dx, y + dy);
        if (HAIR.has(c)) hair++;
        if (SOCK.has(c) || isBand(g, x + dx, y + dy)) sock = true;
        else if (SHIRT.has(c)) shirt = true;
      }
    }
    if (hair > 0 && comp.cells.length >= 8) comp.kind = "head";
    else if (sock) comp.kind = "leg";
    else if (shirt) comp.kind = "arm";
  }
}

/** Which way is down in this frame, axis-aligned: from the head to the shirt. */
function downOf(g: Grid, head: Comp | undefined): [number, number] {
  if (head === undefined) return [0, 1];
  let hx = 0;
  let hy = 0;
  for (const [x, y] of head.cells) {
    hx += x;
    hy += y;
  }
  hx /= head.cells.length;
  hy /= head.cells.length;
  let sx = 0;
  let sy = 0;
  let n = 0;
  g.forEach((row, y) =>
    row.forEach((c, x) => {
      if (c === "t" || c === "T" || c === "U") {
        sx += x;
        sy += y;
        n++;
      }
    }),
  );
  if (n === 0) return [0, 1];
  const dx = sx / n - hx;
  const dy = sy / n - hy;
  if (Math.abs(dy) >= Math.abs(dx)) return [0, dy >= 0 ? 1 : -1];
  return [dx >= 0 ? 1 : -1, 0];
}

// ---------------------------------------------------------------------------
// The layers
// ---------------------------------------------------------------------------

/** Socks: the band turned over in its own colour; the boot laced up over the ankle. */
function socksAndBoots(g: Grid): void {
  const out = g.map((r) => r.slice());
  g.forEach((row, y) =>
    row.forEach((c, x) => {
      if (isBand(g, x, y)) out[y][x] = c === "r" ? RETRO.band : RETRO.bandShade;
      else if (SOCK.has(c) && touches(g, x, y, new Set(["b", "B"]))) {
        out[y][x] = at(g, x + 1, y) === "." ? "B" : "b";
      }
    }),
  );
  for (let y = 0; y < g.length; y++) g[y] = out[y];
}

/**
 * The bare thigh becomes the long shorts, shaded as the leg was (the far leg and the
 * leg's shaded edge in the shorts' shade), so the baggy cloth reads down to the knee.
 */
function longShorts(g: Grid, leg: Comp): void {
  for (const [x, y] of leg.cells) {
    g[y][x] = LIT_SKIN.has(g[y][x]) ? "p" : "q";
  }
}

/** The bare arm becomes a long sleeve with a cuff; the hand stays. */
function longSleeve(g: Grid, arm: Comp, w: number): void {
  const dist = new Map<number, number>();
  const queue: [number, number][] = [];
  const inArm = new Set(arm.cells.map(([x, y]) => y * w + x));
  for (const [x, y] of arm.cells) {
    if (touches(g, x, y, SHIRT)) {
      dist.set(y * w + x, 0);
      queue.push([x, y]);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    const d = dist.get(y * w + x) ?? 0;
    for (const [dx, dy] of N4) {
      const k = (y + dy) * w + (x + dx);
      if (!inArm.has(k) || dist.has(k)) continue;
      dist.set(k, d + 1);
      queue.push([x + dx, y + dy]);
    }
  }
  let max = 0;
  for (const d of dist.values()) max = Math.max(max, d);
  if (max < 2) return;
  // an arm all in shade (the far arm) gets no cuff: a lone cuff cell there reads as a dot
  const near = arm.cells.some(([x, y]) => LIT_SKIN.has(g[y][x]));
  // the old short sleeve's trim, where it met the arm, is sleeve now
  for (const [x, y] of arm.cells) {
    for (const [dx, dy] of N4) {
      const c = at(g, x + dx, y + dy);
      if ((c === "r" || c === "R") && !isBand(g, x + dx, y + dy)) {
        g[y + dy][x + dx] = c === "r" ? "t" : "T";
      }
    }
  }
  for (const [x, y] of arm.cells) {
    const d = dist.get(y * w + x);
    if (d === undefined || d > max - 2) continue;
    const lit = LIT_SKIN.has(g[y][x]);
    if (d === max - 2 && near) g[y][x] = lit ? "r" : "R";
    else g[y][x] = lit ? "t" : "T";
  }
}

/** The laced collar: a placket of trim shade under the collar's middle. */
function lacedCollar(g: Grid, head: Comp, down: [number, number]): void {
  // the collar: trim cells against the neck
  const collar: [number, number][] = [];
  for (const [x, y] of head.cells) {
    for (const [dx, dy] of N4) {
      const c = at(g, x + dx, y + dy);
      if (c === "r" || c === "R") collar.push([x + dx, y + dy]);
    }
  }
  if (collar.length === 0 || down[1] !== 1) return;
  collar.sort((a, b) => a[0] - b[0]);
  const [mx, my] = collar[collar.length >> 1];
  for (let k = 1; k <= 2; k++) {
    const c = at(g, mx, my + k);
    if (c === "t" || c === "U" || c === "T") g[my + k][mx] = "R";
  }
}

/** Stripes on the shirt: every other pair of columns (the kit says what colour). */
function stripes(g: Grid): void {
  g.forEach((row, y) =>
    row.forEach((c, x) => {
      if ((x >> 1) % 2 !== 0) return;
      if (c === "t") g[y][x] = RETRO.stripe;
      else if (c === "T") g[y][x] = RETRO.stripeShade;
    }),
  );
}

/** The mouth: the face's dark cells furthest down, not by the hair. */
function mouthOf(
  g: Grid,
  head: Comp,
  down: [number, number],
): [number, number][] {
  let best = -Infinity;
  const cand: [number, number, number][] = [];
  for (const [x, y] of head.cells) {
    if (g[y][x] !== "m" || touches(g, x, y, HAIR)) continue;
    const p = x * down[0] + y * down[1];
    cand.push([x, y, p]);
    best = Math.max(best, p);
  }
  return cand.filter((c) => c[2] === best).map(([x, y]) => [x, y]);
}

/** A moustache over the mouth: the row above it, a cell wider each side. */
function moustache(g: Grid, head: Comp, down: [number, number]): void {
  const mouth = mouthOf(g, head, down);
  if (mouth.length === 0) return;
  const [dx, dy] = down;
  const px = dy !== 0 ? 1 : 0;
  const py = dx !== 0 ? 1 : 0;
  const inHead = new Set(head.cells.map(([x, y]) => `${x},${y}`));
  const put = (x: number, y: number): void => {
    if (!inHead.has(`${x},${y}`)) return;
    const c = g[y][x];
    if (c === "s" || c === "l" || c === "S") g[y][x] = RETRO.moustache;
  };
  for (const [x, y] of mouth) {
    const ux = x - dx;
    const uy = y - dy;
    put(ux, uy);
    put(ux + px, uy + py);
    put(ux - px, uy - py);
  }
  // a handlebar: its ends curl down either side of the mouth, so it holds on dark skin
  let lo = mouth[0];
  let hi = mouth[0];
  for (const m of mouth) {
    if (m[0] * px + m[1] * py < lo[0] * px + lo[1] * py) lo = m;
    if (m[0] * px + m[1] * py > hi[0] * px + hi[1] * py) hi = m;
  }
  put(lo[0] - px, lo[1] - py);
  put(hi[0] + px, hi[1] + py);
}

/**
 * Short back and sides, slicked: the curls' highlight gone; upright, the mop is cut in at
 * the back below the brow (a cell, two from the mouth down) and a short gleam of hair oil
 * sits on the crown, towards the front.
 */
function slicked(g: Grid, head: Comp, down: [number, number]): void {
  for (const row of g) {
    for (let x = 0; x < row.length; x++) if (row[x] === "H") row[x] = "h";
  }
  if (down[0] !== 0 || down[1] !== 1) return;
  const eye = eyeOf(g, head);
  if (eye === null) return;
  const ey = eye[1];
  for (let y = ey - 1; y < g.length; y++) {
    const row = g[y];
    let x = 0;
    while (x < row.length && (row[x] === "." || row[x] === ",")) x++;
    if (!HAIR.has(row[x] ?? ".")) continue;
    const cut = y >= ey + 2 ? 2 : 1;
    for (let k = 0; k < cut; k++) {
      // keep a cell of hair against the face
      if (HAIR.has(row[x + k + 1] ?? ".")) row[x + k] = ".";
    }
  }
  // the gleam: the crown's top row of hair, its front few cells
  let top = -1;
  for (let y = 0; y < ey && top < 0; y++)
    if (g[y].some((c) => c === "h")) top = y;
  if (top < 0) return;
  const row = g[top + 1] ?? g[top];
  let x1 = -1;
  for (let x = 0; x < row.length; x++) if (row[x] === "h") x1 = x;
  for (let x = x1 - 3; x >= 0 && x > x1 - 6; x--)
    if (row[x] === "h") row[x] = "H";
}

/** The eye: an ink cell inside the face. */
function eyeOf(g: Grid, head: Comp): [number, number] | null {
  const inHead = new Set(head.cells.map(([x, y]) => `${x},${y}`));
  let best: [number, number] | null = null;
  for (const [x, y] of head.cells) {
    for (const [dx, dy] of N4) {
      const ex = x + dx;
      const ey = y + dy;
      if (at(g, ex, ey) !== "k") continue;
      let n = 0;
      for (const [ax, ay] of N4) if (inHead.has(`${ex + ax},${ey + ay}`)) n++;
      if (n >= 2 && best === null) best = [ex, ey];
    }
  }
  return best;
}

/** The keeper's flat cap: over the crown to the brow, its peak out over the eyes. */
function flatCap(g: Grid, head: Comp, down: [number, number]): void {
  const eye = eyeOf(g, head);
  // everything of the head from the crown to just above the brow
  const [dx, dy] = down;
  let top = Infinity;
  for (const [x, y] of head.cells) top = Math.min(top, x * dx + y * dy);
  g.forEach((row, y) =>
    row.forEach((c, x) => {
      if (HAIR.has(c)) top = Math.min(top, x * dx + y * dy);
    }),
  );
  const eyeP = eye === null ? top + 6 : eye[0] * dx + eye[1] * dy;
  const capTo = eyeP - 3;
  g.forEach((row, y) =>
    row.forEach((c, x) => {
      const p = x * dx + y * dy;
      if (p > capTo) return;
      if (HAIR.has(c) || SKIN.has(c)) g[y][x] = RETRO.cap;
    }),
  );
  // the peak: the row above the brow, from the hair out over the face and one cell past it
  if (eye === null || dy !== 1) return;
  const y = eye[1] - 2;
  const row = g[y];
  if (row === undefined) return;
  let last = -1;
  for (let x = 0; x < row.length; x++) {
    if (row[x] !== "." && row[x] !== "," && row[x] !== "k") last = x;
  }
  for (let x = eye[0] - 2; x <= last; x++) {
    if (SKIN.has(row[x]) || HAIR.has(row[x]) || row[x] === RETRO.cap) {
      row[x] = RETRO.capShade;
    }
  }
  if (last >= 0 && last + 2 < row.length && at(g, last + 1, y) === ".") {
    row[last + 1] = RETRO.capShade;
  }
}

/**
 * A flat cap on the youth frames, which every child shares: the crown's hair is cap (A)
 * and a row two above the brow its peak (C over hair, D over skin). Only the keeper's kit
 * colours these as a cap (`retroKit`); every other kit gives A and C its hair and D its
 * skin, so the other children look as they did. Upright frames only (a cap with no peak
 * cannot be told from hair when he is upside down). The lit neck over the collar is D too:
 * the keeper's roll neck, in his cap's band colour (bare neck on everyone else).
 */
function youthCap(g: Grid, head: Comp, down: [number, number]): void {
  if (down[0] !== 0 || down[1] !== 1) return;
  const eye = eyeOf(g, head);
  if (eye === null) return;
  for (const [x, y] of head.cells) {
    if (g[y][x] === "s" && y > eye[1] + 1 && touches(g, x, y, SHIRT)) {
      g[y][x] = RETRO.peak;
    }
  }
  const peak = eye[1] - 3;
  for (let y = 0; y <= peak && y < g.length; y++) {
    const row = g[y];
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (y < peak) {
        if (HAIR.has(c)) row[x] = RETRO.cap;
      } else if (HAIR.has(c)) row[x] = RETRO.capShade;
      else if (c === "s" || c === "l") row[x] = RETRO.peak;
    }
  }
}

/** The polo neck: the neck where it meets the jumper is jumper, rolled up a row. */
function poloNeck(g: Grid, head: Comp, down: [number, number]): void {
  const [dx, dy] = down;
  const neck: [number, number][] = [];
  for (const [x, y] of head.cells) {
    if (touches(g, x, y, SHIRT) && SKIN.has(g[y][x])) neck.push([x, y]);
  }
  for (const [x, y] of neck) {
    g[y][x] = LIT_SKIN.has(g[y][x]) ? "t" : "T";
    const ux = x - dx;
    const uy = y - dy;
    const c = at(g, ux, uy);
    if (SKIN.has(c) && !touches(g, ux, uy, new Set(["k"]))) {
      g[uy][ux] = LIT_SKIN.has(c) ? "t" : "T";
    }
  }
}

/**
 * RETRO's layer over a set of frames (rows per frame, fill art): returns new frames of the
 * same size. `who` says whose they are; the keeper's fetch frames are the ones not "kid".
 */
export function retroFrames(
  who: string,
  anim: string,
  frames: readonly (readonly string[])[],
): string[][] {
  const youth = who === "youth" || (who === "fetch" && anim.startsWith("kid"));
  const keeper =
    who === "keeper" || (who === "fetch" && anim.startsWith("keeper"));
  return frames.map((rows) => {
    const g: Grid = rows.map((r) => Array.from(r));
    const w = g[0]?.length ?? 0;
    const comps = splitArms(g, skinComps(g));
    classify(g, comps);
    const head = comps
      .filter((c) => c.kind === "head")
      .sort((a, b) => b.cells.length - a.cells.length)[0];
    const down = downOf(g, head);
    // the face first, while the skin is still skin
    if (head !== undefined) {
      if (!youth) moustache(g, head, down);
      if (keeper) {
        poloNeck(g, head, down);
        flatCap(g, head, down);
      } else {
        lacedCollar(g, head, down);
        slicked(g, head, down);
        if (youth) youthCap(g, head, down);
      }
    }
    for (const c of comps) {
      if (c.kind === "arm" && !keeper) longSleeve(g, c, w);
    }
    for (const c of comps) if (c.kind === "leg") longShorts(g, c);
    socksAndBoots(g);
    if (!keeper) stripes(g);
    return g.map((r) => r.join(""));
  });
}

// ---------------------------------------------------------------------------
// The kits
// ---------------------------------------------------------------------------

/** Park clothes of the day: wool jumpers in earthy colours (shirt, shade). */
const RETRO_TOPS: readonly [Color, Color][] = [
  [P.brick, P.brickDark],
  [P.steel, P.slate],
  [P.wood, P.woodDark],
  [P.mist, P.steel],
  [P.concrete, P.concreteDark],
  [P.brickLight, P.brick],
];
const RETRO_SHORTS: readonly Color[] = [P.slate, P.woodDark, P.night, P.steel];

interface RetroLook {
  shirt: Color;
  shirtShade: Color;
  trim: Color;
  shorts: Color;
  socks: Color;
  boots: Color;
  gloves?: Color;
  stripe?: Color;
  stripeShade?: Color;
  band?: Color;
  cap?: Color;
  capShade?: Color;
}

/**
 * A kit in RETRO: today's kit (`kit`, its skin and hair) dressed for the early days. The
 * team in old gold with laced chalk collars and cuffs, long dark knickerbockers, old gold
 * socks with navy turnovers; the nation in brick red and navy; the rivals in purple and white
 * stripes; the keeper in a cream polo-neck jumper and a tweed flat cap; the referee in a
 * dark blazer and trousers; the park's children in wool jumpers. Boots of brown leather.
 * The men of looks 1 and 2 (the hero among them) and the referee wear moustaches.
 */
export function retroKit(
  base: KitBase,
  kit: Kit,
  look: number,
  variant: number,
): Kit {
  const boots = P.wood;
  let r: RetroLook;
  switch (base) {
    case "home":
    case "away":
      // the deep end of the old gold (goldDark, shaded to retroDark), so he stands out
      // from the cream and gold of the painted boards and the crowd behind him; dark
      // knickerbockers to the knee (white shorts melt into a cream board when his legs
      // go up in the bicycle kick, and the dark cloth shows their length at a glance)
      // over old gold socks with a navy turnover
      r = {
        shirt: P.goldDark,
        shirtShade: P.retroDark,
        trim: P.chalk,
        shorts: P.night,
        socks: P.goldDark,
        boots,
        band: P.night,
      };
      break;
    case "national-home":
    case "national-away":
      // not the keeper's cream: the nation in brick red, dark knickerbockers as the
      // club's (they hold over the cream boards), brick socks with chalk turnovers
      r = {
        shirt: P.brick,
        shirtShade: P.brickDark,
        trim: P.chalk,
        shorts: P.night,
        socks: P.brick,
        boots,
        band: P.chalk,
      };
      break;
    case "casual-home":
    case "casual-away":
      // the lad in the park: his gold jumper, dark knickerbockers to the knee and light
      // wool socks, so the long shorts and the high boots read at a glance
      r = {
        shirt: P.goldDark,
        shirtShade: P.retroDark,
        trim: P.chalk,
        shorts: P.night,
        socks: P.mist,
        boots,
        band: P.steel,
      };
      break;
    case "casual": {
      const [shirt, shirtShade] = RETRO_TOPS[variant % RETRO_TOPS.length];
      r = {
        shirt,
        shirtShade,
        trim: shade(shirtShade, -0.2),
        shorts: RETRO_SHORTS[variant % RETRO_SHORTS.length],
        socks: variant % 2 === 0 ? P.slate : P.steel,
        boots,
        band: P.mist,
      };
      break;
    }
    case "rival":
      r = {
        shirt: P.duskMid,
        shirtShade: P.duskTop,
        trim: P.chalk,
        shorts: P.night,
        socks: P.duskMid,
        boots,
        stripe: P.chalk,
        stripeShade: P.mist,
        band: P.chalk,
      };
      break;
    case "keeper":
      // cream and green, worn by nobody else: a cream jumper with a green roll neck and
      // cuffs, a green tweed cap, brown leather gloves (the child's roll neck is the cap's
      // band colour, letter D: see `youthCap`)
      r = {
        shirt: P.chalk,
        shirtShade: P.mist,
        trim: P.grassDeep,
        shorts: P.night,
        socks: P.slate,
        boots,
        gloves: P.wood,
        band: P.grassDeep,
        cap: P.grassDark,
        capShade: P.grassDeep,
      };
      break;
    case "referee":
      r = {
        shirt: P.night,
        shirtShade: shade(P.night, -0.28),
        trim: P.chalk,
        shorts: P.slate,
        socks: P.slate,
        boots: P.ink,
        band: P.slate,
      };
      break;
  }
  const moustache =
    base === "referee" || (base !== "keeper" && look !== 0)
      ? kit.hair
      : kit.skin;
  const band = r.band ?? r.trim;
  // A and C are the keeper's cap (adult and youth frames); on everyone else the youth
  // frames' cap letters are his own hair (A, C) and skin (D): see `youthCap`
  const cap = r.cap ?? kit.hair;
  const capShade = r.capShade ?? kit.hair;
  const peak = r.cap === undefined ? kit.skin : capShade;
  return {
    ...kit,
    shirt: r.shirt,
    shirtShade: r.shirtShade,
    trim: r.trim,
    shorts: r.shorts,
    socks: r.socks,
    boots: r.boots,
    gloves: r.gloves ?? kit.gloves,
    era: "retro",
    eraColors: [
      moustache,
      r.stripe ?? r.shirt,
      r.stripeShade ?? r.shirtShade,
      band,
      shade(band, -0.28),
      cap,
      capShade,
      peak,
    ],
  };
}

/** The ball kid in RETRO: a lad in a grey wool jumper and a cap-less side parting. */
export function retroBallKidKit(kit: Kit): Kit {
  const look = retroKit("casual", kit, 0, 1);
  return { ...look, shirt: P.steel, shirtShade: P.slate, trim: P.chalk };
}
