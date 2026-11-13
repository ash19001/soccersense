// Today's leaderboard, per mode: who played and what they scored.
//
// MOCK DATA. There is no backend yet, so the field is invented: a deterministic crowd of a
// few hundred to a couple of thousand players a day, each with a light-hearted football
// handle and a total made of seven shots from the game's scoring (0, 10, 30, 60, 80 or 100
// points each). A backend replaces `leaderboardFor` behind the same signature; nothing that
// calls it needs to know.
//
// Pure: no clock, no storage, no unseeded randomness. The same day and mode always give
// the same table.

import type { Mode } from "~/game/types";
import { hash2, rng, type Rng } from "~/pixel";

export interface LeaderboardRow {
  /** Position, 1 is the best. Equal totals share a position ("1, 2, 2, 4"). */
  rank: number;
  /** The player's handle. Empty on the player's own row (the interface says YOU). */
  name: string;
  /** Points out of 700. */
  total: number;
  /** The player's own row. */
  you?: boolean;
}

export interface Leaderboard {
  /** Every player who played this mode today, best first. */
  rows: LeaderboardRow[];
  /** How many played: `rows.length`. */
  total: number;
  /** The player's position, or null if they have not played this mode today. */
  yourRank: number | null;
}

/** Seven shots of 100 points at most. */
export const LEADERBOARD_MAX = 700;
/** The fewest and most players the mock field has on a day, the player not counted. */
export const MOCK_FIELD = { min: 640, max: 1890 } as const;

/** What one shot can be worth: miss, tap in, toe poke, trivela, golazo, worldie. */
const SHOT_POINTS = [0, 10, 30, 60, 80, 100] as const;
/** How often each shot comes off for a weak player and for a strong one. */
const WEAK = [0.27, 0.27, 0.22, 0.14, 0.06, 0.04] as const;
const STRONG = [0.02, 0.05, 0.12, 0.24, 0.27, 0.3] as const;
const SHOTS = 7;

/*
 * Handles: a bit of football and a first name, usually starting with the same letter
 * ("NutmegNina", "Row Z Rita"). Nothing about real players, clubs or nations.
 */
const TERMS: readonly string[] = [
  "Backheel",
  "Bench",
  "Bicycle",
  "Bootroom",
  "Byline",
  "Chip",
  "Corner",
  "Crossbar",
  "Curler",
  "Dink",
  "Dribble",
  "Dugout",
  "Elastico",
  "Flick",
  "FiveASide",
  "FalseNine",
  "Golazo",
  "Goalline",
  "HalfTime",
  "HatTrick",
  "Header",
  "Jinky",
  "Keepy",
  "Kickoff",
  "Libero",
  "Lob",
  "Matchday",
  "Mazy",
  "Nutmeg",
  "NearPost",
  "Offside",
  "Overlap",
  "Panenka",
  "PubLeague",
  "Pitchside",
  "Rabona",
  "Rondo",
  "Row Z",
  "Screamer",
  "Shinpad",
  "Stepover",
  "Sunday",
  "Sweeper",
  "TopBins",
  "ToePoke",
  "Tifo",
  "Tunnel",
  "Volley",
  "Wingback",
  "Woodwork",
  "Worldie",
  "Zonal",
];

const NAMES: readonly string[] = [
  "Ade",
  "Bea",
  "Ben",
  "Bo",
  "Cal",
  "Cass",
  "Dee",
  "Dom",
  "Eli",
  "Esi",
  "Fran",
  "Finn",
  "Gabi",
  "Gus",
  "Hal",
  "Hana",
  "Ines",
  "Ivo",
  "Jas",
  "Jo",
  "Kai",
  "Kofi",
  "Lena",
  "Lou",
  "Max",
  "Mia",
  "Nina",
  "Ned",
  "Ola",
  "Omar",
  "Pip",
  "Priya",
  "Rita",
  "Ravi",
  "Sam",
  "Suki",
  "Tony",
  "Tess",
  "Uma",
  "Vic",
  "Wes",
  "Yas",
  "Zara",
  "Zeb",
];

/** No handle is longer than this, so it fits the leaderboard's name column. */
export const NAME_MAX = 10;

const TERMS_BY_INITIAL = new Map<string, string[]>();
for (const term of TERMS) {
  const initial = term.charAt(0);
  const list = TERMS_BY_INITIAL.get(initial) ?? [];
  list.push(term);
  TERMS_BY_INITIAL.set(initial, list);
}

function handle(r: Rng, numbered = false): string {
  const name = r.pick(NAMES);
  const join = (term: string) =>
    term.includes(" ") ? `${term} ${name}` : `${term}${name}`;
  const fits = (term: string) => join(term).length <= NAME_MAX;
  // Mostly alliterative; now and then any term at all.
  const matching = (TERMS_BY_INITIAL.get(name.charAt(0)) ?? []).filter(fits);
  const base = join(
    matching.length > 0 && r.chance(0.7)
      ? r.pick(matching)
      : r.pick(TERMS.filter(fits)),
  );
  // A good many add a number, as people do when the handle they wanted was taken.
  if (numbered || r.chance(0.3)) {
    const number = String(r.int(2, 99));
    if (base.length + number.length <= NAME_MAX) return `${base}${number}`;
  }
  return base;
}

/** A total for one player of the given skill (0 to 1): the sum of seven shots. */
function totalFor(r: Rng, skill: number): number {
  let total = 0;
  for (let shot = 0; shot < SHOTS; shot++) {
    let roll = r();
    let points = SHOT_POINTS[SHOT_POINTS.length - 1] ?? 0;
    for (let i = 0; i < SHOT_POINTS.length; i++) {
      const weak = WEAK[i] ?? 0;
      const strong = STRONG[i] ?? 0;
      const chance = weak + (strong - weak) * skill;
      if (roll < chance) {
        points = SHOT_POINTS[i] ?? 0;
        break;
      }
      roll -= chance;
    }
    total += points;
  }
  return total;
}

/**
 * Each mode's own number in the hashes, so every mode has its own field (HOME's and AWAY's
 * as they always were).
 */
const MODE_SALT: Readonly<Record<Mode, number>> = {
  home: 1,
  away: 2,
  retro: 3,
  nextgen: 4,
};

function saltOf(mode: Mode): number {
  return Object.hasOwn(MODE_SALT, mode) ? MODE_SALT[mode] : 1;
}

function seedFor(day: number, mode: Mode): number {
  return Math.floor(hash2(day, saltOf(mode), 0x1eade5) * 2 ** 32);
}

/** How many played the mode on the day, the player not counted. */
export function fieldSize(day: number, mode: Mode): number {
  const h = hash2(day, 10 + saltOf(mode), 0xf1e1d);
  return MOCK_FIELD.min + Math.floor(h * (MOCK_FIELD.max - MOCK_FIELD.min + 1));
}

/** The invented field for a day and a mode, best first (cached: it is asked for often). */
const cache = new Map<string, readonly { name: string; total: number }[]>();

function fieldFor(
  day: number,
  mode: Mode,
): readonly { name: string; total: number }[] {
  const key = `${day}/${mode}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = rng(seedFor(day, mode));
  const count = fieldSize(day, mode);
  const used = new Set<string>();
  const players: { name: string; total: number }[] = [];
  for (let i = 0; i < count; i++) {
    // Handles are unique on the day: a clash picks again, then picks one with a number.
    let name = handle(r);
    for (let tries = 0; used.has(name) && tries < 40; tries++) {
      name = handle(r, tries >= 8);
    }
    if (used.has(name)) name = `Player${i}`;
    used.add(name);
    // Most players are middling, a few are very good.
    const skill = Math.min(1, r() ** 1.15 * 1.02);
    players.push({ name, total: totalFor(r, skill) });
  }
  players.sort((a, b) => b.total - a.total);
  if (cache.size > 16) cache.clear();
  cache.set(key, players);
  return players;
}

/**
 * Today's table for one mode. `day` is the day number (`dayNumber` in `~/game`). `you` is
 * the player's own total if they have played the mode today: they are placed at their
 * rank (first among any equal totals) and counted in `total`.
 */
export function leaderboardFor(
  day: number,
  mode: Mode,
  you: number | null = null,
): Leaderboard {
  const field = fieldFor(day, mode);
  const mine =
    you === null || !Number.isFinite(you)
      ? null
      : Math.max(0, Math.min(LEADERBOARD_MAX, Math.round(you)));
  const rows: LeaderboardRow[] = [];
  let yourRank: number | null = null;
  let rank = 0;
  let previous = Number.NaN;
  const place = (row: Omit<LeaderboardRow, "rank">) => {
    const position = rows.length + 1;
    if (row.total !== previous) rank = position;
    previous = row.total;
    rows.push({ rank, ...row });
  };
  for (const player of field) {
    if (mine !== null && yourRank === null && mine >= player.total) {
      place({ name: "", total: mine, you: true });
      yourRank = rank;
    }
    place({ name: player.name, total: player.total });
  }
  if (mine !== null && yourRank === null) {
    place({ name: "", total: mine, you: true });
    yourRank = rank;
  }
  return { rows, total: rows.length, yourRank };
}
