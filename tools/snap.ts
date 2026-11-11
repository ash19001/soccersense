/**
 * snap: render shots to PNG without a browser.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts --list
 *   ./node_modules/.bin/tsx tools/snap.ts ball/idle
 *   ./node_modules/.bin/tsx tools/snap.ts stadium/full --time night --w 480 --h 270 --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts career/home-t3 --strip 6 --dt 0.15
 *   ./node_modules/.bin/tsx tools/snap.ts "ball/*" --out .snaps/balls.png
 *   ./node_modules/.bin/tsx tools/snap.ts stadium/full --time all --size all
 *   ./node_modules/.bin/tsx tools/snap.ts stadium/full --crop 40,100,60,40 --scale 10
 *
 * It finds every app/**\/*.shots.ts, imports each and merges their `shots` maps. A shots
 * file that fails to import is reported and skipped, so one broken file never blocks
 * anyone else. Run with --help for every option.
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  Surface,
  TRANSPARENT,
  drawText,
  hex,
  type Color,
  type Shot,
  type ShotContext,
  type Sun,
} from "~/pixel";

import { contactSheet, encodePng, sideBySide } from "./png";

const USAGE = `Usage: tsx tools/snap.ts <id> [<id> ...] [options]
       tsx tools/snap.ts --list

An id is a shot name such as ball/idle. A * stands for anything (ball/*, */idle,
career/*-t3; quote it so the shell leaves it alone). Several ids render into one PNG
with a label under each.

Options
  --w <px> --h <px>   logical canvas size passed to the shot (default 130 x 281)
  --size <WxH|all>    the same in one go (--size 480x270). "all" renders the four
                      reference sizes: 130x281, 120x222, 160x300 and 480x270
  --scale <n>         PNG magnification (default 4)
  --crop <x,y,w,h>    keep only this rectangle of each frame (logical pixels), for a
                      close look at high --scale
  --t <seconds>       time passed to the shot (default 0)
  --strip <n>         render n frames left to right, 2 px apart
  --dt <seconds>      time between strip frames (default 0.1)
  --time <preset>     day (default) | golden | dusk | night | dawn, or "all" for one
                      render of each
  --sun <degrees>     sun elevation, overrides --time
  --morning           the sun is rising rather than setting
  --seed <n>          seed passed to the shot (default 1)
  --bg <hex>          backdrop behind transparent or odd-sized shots (default 0f1220);
                      "none" keeps transparency
  --out <file>        output path (default .snaps/<ids with / replaced by ->.png)
  --list              print every shot id, grouped by file
  --root <dir>        look for app/**/*.shots.ts under this folder instead of the
                      current one (for testing the tool itself)
  --help              this text

Exit code: 0 when everything rendered, 1 when an id was not found or a shot failed
(failed shots are drawn as a red ERROR tile and the PNG is still written), 2 for a
bad command line.`;

const TIME_PRESETS: Record<string, Sun> = {
  day: { elevation: 45, morning: false },
  golden: { elevation: 6, morning: false },
  dusk: { elevation: -3, morning: false },
  night: { elevation: -30, morning: false },
  dawn: { elevation: -3, morning: true },
};

/** The sizes every painter must hold at (art bible, section 9). */
const REFERENCE_SIZES: readonly (readonly [number, number])[] = [
  [130, 281],
  [120, 222],
  [160, 300],
  [480, 270],
];

const LABEL = hex("#9fb0cc");
const ERROR_INK = hex("#ff5a4d");
const STRIP_GAP = 2;
/** Contact sheets wrap so the PNG stays under about this many real pixels wide. */
const SHEET_PNG_WIDTH = 2400;
/** Refuse to write a PNG with more real pixels than this (a mistyped --scale). */
const MAX_PNG_PIXELS = 80_000_000;

class UsageError extends Error {}

interface Lit {
  /** Preset name, or "" for the single unnamed setting. */
  name: string;
  sun: Sun;
}

interface Args {
  ids: string[];
  sizes: (readonly [number, number])[];
  scale: number;
  crop: readonly [number, number, number, number] | undefined;
  t: number;
  strip: number;
  dt: number;
  times: Lit[];
  seed: number;
  bg: Color;
  out: string | undefined;
  root: string | undefined;
  list: boolean;
  help: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = {
    ids: [],
    sizes: [],
    scale: 4,
    crop: undefined,
    t: 0,
    strip: 1,
    dt: 0.1,
    times: [],
    seed: 1,
    bg: hex("#0f1220"),
    out: undefined,
    root: undefined,
    list: false,
    help: false,
  };
  let w = 130;
  let h = 281;
  let sunDegrees: number | undefined;
  let morning = false;

  const toNumber = (
    name: string,
    text: string,
    min: number,
    whole: boolean,
  ): number => {
    const n = text.trim() === "" ? NaN : Number(text);
    if (!Number.isFinite(n) || n < min || (whole && !Number.isInteger(n))) {
      throw new UsageError(
        `${name}: "${text}" is not ${whole ? "a whole number" : "a number"}` +
          (min > -Infinity ? ` of at least ${min}` : ""),
      );
    }
    return n;
  };

  const queue = [...argv];
  while (queue.length > 0) {
    const raw = queue.shift() as string;
    if (raw === "-h") {
      args.help = true;
      continue;
    }
    if (!raw.startsWith("--")) {
      args.ids.push(raw);
      continue;
    }
    const eq = raw.indexOf("=");
    const name = eq < 0 ? raw : raw.slice(0, eq);
    const inline = eq < 0 ? undefined : raw.slice(eq + 1);
    const value = (): string => {
      const v = inline ?? queue.shift();
      if (v === undefined) throw new UsageError(`${name} needs a value`);
      return v;
    };
    const flag = (): void => {
      if (inline !== undefined) {
        throw new UsageError(`${name} does not take a value`);
      }
    };
    const number = (min: number, whole: boolean): number =>
      toNumber(name, value(), min, whole);
    switch (name) {
      case "--w":
        w = number(1, true);
        break;
      case "--h":
        h = number(1, true);
        break;
      case "--size": {
        const text = value();
        if (text === "all") {
          args.sizes = [...REFERENCE_SIZES];
          break;
        }
        const parts = text.toLowerCase().split("x");
        if (parts.length !== 2) {
          throw new UsageError(
            `--size: "${text}" is not a size like 480x270, or "all"`,
          );
        }
        w = toNumber(name, parts[0], 1, true);
        h = toNumber(name, parts[1], 1, true);
        args.sizes = [];
        break;
      }
      case "--scale":
        args.scale = number(1, true);
        break;
      case "--crop": {
        const text = value();
        const parts = text.split(",");
        if (parts.length !== 4) {
          throw new UsageError(
            `--crop: "${text}" is not a rectangle like 40,100,60,40 (x,y,w,h)`,
          );
        }
        args.crop = [
          toNumber(name, parts[0], -Infinity, true),
          toNumber(name, parts[1], -Infinity, true),
          toNumber(name, parts[2], 1, true),
          toNumber(name, parts[3], 1, true),
        ];
        break;
      }
      case "--t":
        args.t = number(-Infinity, false);
        break;
      case "--strip":
        args.strip = number(1, true);
        break;
      case "--dt":
        args.dt = number(-Infinity, false);
        break;
      case "--seed":
        args.seed = number(-Infinity, false);
        break;
      case "--sun":
        sunDegrees = number(-90, false);
        if (sunDegrees > 90) {
          throw new UsageError(`--sun: ${sunDegrees} is above 90 degrees`);
        }
        break;
      case "--morning":
        flag();
        morning = true;
        break;
      case "--time": {
        const preset = value();
        if (preset === "all") {
          args.times = Object.entries(TIME_PRESETS).map(([key, sun]) => ({
            name: key,
            sun: { ...sun },
          }));
          break;
        }
        const sun = TIME_PRESETS[preset];
        if (sun === undefined) {
          throw new UsageError(
            `--time: "${preset}" is not one of ${Object.keys(TIME_PRESETS).join(", ")}, all`,
          );
        }
        args.times = [{ name: "", sun: { ...sun } }];
        break;
      }
      case "--bg": {
        const text = value();
        if (text === "none" || text === "transparent") {
          args.bg = TRANSPARENT;
        } else {
          try {
            args.bg = hex(text);
          } catch {
            throw new UsageError(`--bg: "${text}" is not a hex colour`);
          }
        }
        break;
      }
      case "--out":
        args.out = value();
        break;
      case "--root":
        args.root = value();
        break;
      case "--list":
        flag();
        args.list = true;
        break;
      case "--help":
        flag();
        args.help = true;
        break;
      default:
        throw new UsageError(`Unknown option ${name}`);
    }
  }
  if (args.sizes.length === 0) args.sizes = [[w, h]];
  if (args.times.length === 0) {
    args.times = [{ name: "", sun: { ...TIME_PRESETS.day } }];
  }
  if (sunDegrees !== undefined) {
    // An explicit sun replaces every preset.
    args.times = [{ name: "", sun: { elevation: sunDegrees, morning } }];
  } else if (morning) {
    for (const lit of args.times) lit.sun.morning = true;
  }
  return args;
}

// ---------------------------------------------------------------------------
// Finding shots
// ---------------------------------------------------------------------------

interface Entry {
  id: string;
  file: string; // relative to the repository root, with forward slashes
  shot: Shot;
}

interface Registry {
  entries: Map<string, Entry>;
  files: string[];
  /** Ids defined in more than one file, with every file that defines them. */
  duplicates: Map<string, string[]>;
  /** Files that could not be imported, with the reason. */
  broken: { file: string; reason: string }[];
}

function findShotFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (item.name === "node_modules" || item.name.startsWith(".")) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) findShotFiles(full, out);
    else if (item.name.endsWith(".shots.ts")) out.push(full);
  }
  return out;
}

/** An error as text: the message, plus the stack frames that are in this project. */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const lines = (error.stack ?? error.message).split("\n");
  const kept = lines.filter(
    (line) =>
      !/^\s+at /.test(line) ||
      !(line.includes("node_modules") || line.includes("node:")),
  );
  return kept.slice(0, 14).join("\n");
}

async function loadShots(root: string): Promise<Registry> {
  const registry: Registry = {
    entries: new Map(),
    files: [],
    duplicates: new Map(),
    broken: [],
  };
  const files = findShotFiles(path.join(root, "app")).sort();
  const loaded = await Promise.allSettled(
    files.map((file) => import(pathToFileURL(file).href) as Promise<unknown>),
  );
  files.forEach((abs, i) => {
    const file = path.relative(root, abs).split(path.sep).join("/");
    const result = loaded[i];
    if (result.status === "rejected") {
      registry.broken.push({ file, reason: describe(result.reason) });
      return;
    }
    const shots = (result.value as { shots?: unknown }).shots;
    if (typeof shots !== "object" || shots === null) {
      registry.broken.push({
        file,
        reason: "it does not export a `shots` object",
      });
      return;
    }
    registry.files.push(file);
    for (const [id, shot] of Object.entries(shots)) {
      if (typeof shot !== "function") {
        registry.broken.push({
          file,
          reason: `its entry "${id}" is not a function (the file's other shots were loaded)`,
        });
        continue;
      }
      const first = registry.entries.get(id);
      if (first !== undefined) {
        const list = registry.duplicates.get(id) ?? [first.file];
        list.push(file);
        registry.duplicates.set(id, list);
        continue; // the first definition wins
      }
      registry.entries.set(id, { id, file, shot: shot as Shot });
    }
  });
  return registry;
}

// ---------------------------------------------------------------------------
// Choosing ids
// ---------------------------------------------------------------------------

/** Ids matching `wanted`, where * stands for any run of characters. */
function matching(wanted: string, ids: readonly string[]): string[] {
  if (!wanted.includes("*")) return ids.filter((id) => id === wanted);
  const pattern = new RegExp(
    "^" +
      wanted
        .split("*")
        .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*") +
      "$",
  );
  return ids.filter((id) => pattern.test(id));
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/** The ids most like `query`: shared words first, then the fewest edits. */
function closest(query: string, ids: readonly string[], limit = 5): string[] {
  const q = query.replace(/\*/g, "").toLowerCase();
  const parts = q.split(/[/\-_.]+/).filter((p) => p.length > 1);
  const ranked = ids
    .map((id) => {
      const low = id.toLowerCase();
      const edits = editDistance(q, low);
      let score = edits;
      if (q !== "" && (low.includes(q) || q.includes(low))) score -= 100;
      for (const part of parts) if (low.includes(part)) score -= 10;
      return { id, score, edits };
    })
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
  // Prefer real near-misses; if there are none, still offer the nearest few.
  const allowed = Math.max(2, Math.ceil(q.length * 0.4));
  const near = ranked.filter((x) => x.score < 0 || x.edits <= allowed);
  return (near.length > 0 ? near.slice(0, limit) : ranked.slice(0, 3)).map(
    (x) => x.id,
  );
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function isSurface(value: unknown): value is Surface {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Partial<Surface>;
  return (
    typeof s.w === "number" &&
    typeof s.h === "number" &&
    s.data instanceof Uint32Array &&
    s.data.length === s.w * s.h
  );
}

/** A red box that stands in for a shot that threw, so the rest of a sheet still renders. */
function errorTile(): Surface {
  const s = new Surface(35, 13);
  s.frame(0, 0, s.w, s.h, ERROR_INK);
  drawText(s, "ERROR", 3, 3, ERROR_INK);
  return s;
}

function onBackdrop(s: Surface, bg: Color): Surface {
  if (bg === TRANSPARENT) return s;
  const out = new Surface(s.w, s.h);
  out.clear(bg);
  out.blit(s, 0, 0);
  return out;
}

function cropped(
  s: Surface,
  rect: readonly [number, number, number, number],
): Surface {
  const out = new Surface(rect[2], rect[3]);
  out.copy(s, -rect[0], -rect[1]);
  return out;
}

async function main(): Promise<number> {
  const cwd = process.cwd();
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(`snap: ${error.message}\nRun with --help for the options.`);
    return 2;
  }
  if (args.help || (args.ids.length === 0 && !args.list)) {
    console.log(USAGE);
    return args.help ? 0 : 2;
  }

  const root = path.resolve(cwd, args.root ?? ".");
  const registry = await loadShots(root);
  const allIds = [...registry.entries.keys()].sort();
  let failed = false;

  const reportBroken = (full: boolean): void => {
    for (const { file, reason } of registry.broken) {
      console.error(
        full
          ? `snap: problem in ${file}: ${reason}\n`
          : `snap: note: problem in ${file} (${reason.split("\n")[0]}). --list shows more.`,
      );
    }
  };
  const reportDuplicate = (id: string): void => {
    const files = registry.duplicates.get(id) ?? [];
    console.error(
      `snap: duplicate shot id "${id}" in ${files.join(" and ")}. ` +
        `Using the one in ${files[0]}; rename the other.`,
    );
  };

  if (args.list) {
    reportBroken(true);
    for (const file of registry.files) {
      console.log(file);
      for (const id of allIds) {
        if (registry.entries.get(id)?.file === file) console.log(`  ${id}`);
      }
    }
    if (registry.files.length === 0) console.log("No shots found under app/.");
    for (const id of registry.duplicates.keys()) {
      reportDuplicate(id);
      failed = true;
    }
    if (args.ids.length === 0) return failed ? 1 : 0;
  }

  // Expand patterns and check every id before rendering anything.
  const chosen: Entry[] = [];
  const missing: string[] = [];
  for (const wanted of args.ids) {
    const matches = matching(wanted, allIds);
    if (matches.length === 0) missing.push(wanted);
    for (const id of matches) {
      const entry = registry.entries.get(id) as Entry;
      if (!chosen.includes(entry)) chosen.push(entry);
    }
  }
  if (missing.length > 0) {
    // The shot may live in a file that failed to load, so say everything.
    if (!args.list) reportBroken(true);
    for (const wanted of missing) {
      const near = closest(wanted, allIds);
      console.error(
        `snap: no shot matches "${wanted}".` +
          (near.length > 0
            ? ` Did you mean:\n${near.map((id) => `  ${id}`).join("\n")}`
            : " No shots were found at all."),
      );
    }
    if (registry.broken.length > 0) {
      console.error(
        `snap: ${registry.broken.length} shots file(s) failed to load (see above); ` +
          "the shot may be in one of them.",
      );
    }
    return 1;
  }
  // Other people's broken files are not this run's problem: one line each.
  if (!args.list) reportBroken(false);
  for (const entry of chosen) {
    if (registry.duplicates.has(entry.id)) {
      reportDuplicate(entry.id);
      failed = true;
    }
  }

  const tiles: Surface[] = [];
  const labels: string[] = [];
  // With --time all, each shot and size gets a row of its own.
  const rowStarts: number[] = [];
  for (const entry of chosen) {
    for (const [w, h] of args.sizes) {
      if (args.times.length > 1) rowStarts.push(tiles.length);
      for (const lit of args.times) {
        const frames: Surface[] = [];
        for (let i = 0; i < args.strip; i++) {
          const ctx: ShotContext = {
            w,
            h,
            t: args.t + i * args.dt,
            seed: args.seed,
            sun: { ...lit.sun },
          };
          try {
            // Shots are synchronous, but awaiting costs nothing and forgives an async one.
            const result: unknown = await (entry.shot(ctx) as unknown);
            if (!isSurface(result)) {
              throw new Error("the shot did not return a Surface");
            }
            frames.push(args.crop ? cropped(result, args.crop) : result);
          } catch (error) {
            console.error(
              `snap: shot "${entry.id}" (${entry.file}) failed at ` +
                `${w}x${h}, t=${ctx.t}, sun=${ctx.sun.elevation}: ${describe(error)}\n`,
            );
            failed = true;
            frames.push(errorTile());
          }
        }
        tiles.push(
          frames.length === 1
            ? frames[0]
            : sideBySide(frames, { gap: STRIP_GAP, bg: args.bg }),
        );
        labels.push(
          entry.id +
            (args.times.length > 1 ? ` ${lit.name}` : "") +
            (args.sizes.length > 1 ? ` ${w}x${h}` : ""),
        );
      }
    }
  }

  let image: Surface;
  if (tiles.length === 1) {
    image = onBackdrop(tiles[0], args.bg);
  } else {
    image = contactSheet(tiles, labels, {
      bg: args.bg,
      labelColor: LABEL,
      // Strips stack one per row; single frames flow left to right and wrap.
      maxWidth: args.strip > 1 ? 0 : Math.ceil(SHEET_PNG_WIDTH / args.scale),
      rowStarts,
    });
  }

  const realPixels = image.w * args.scale * image.h * args.scale;
  if (realPixels > MAX_PNG_PIXELS) {
    console.error(
      `snap: the PNG would be ${image.w * args.scale} x ${image.h * args.scale} px. ` +
        "Lower --scale, or use --crop to look at one part.",
    );
    return 2;
  }

  const defaultName =
    args.ids
      .map((id) => id.replace(/\*/g, "all").replace(/[^A-Za-z0-9._-]+/g, "-"))
      .join("+")
      .slice(0, 120) + ".png";
  const out = path.resolve(cwd, args.out ?? path.join(".snaps", defaultName));
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, encodePng(image, args.scale));
  console.log(
    `${out}  ${image.w * args.scale} x ${image.h * args.scale} px` +
      ` (${image.w} x ${image.h} at scale ${args.scale})`,
  );
  return failed ? 1 : 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(describe(error));
    process.exitCode = 1;
  },
);
