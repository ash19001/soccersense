// Generates app/lib/tz-coords.ts: a compact table from IANA time zone name to a rough
// [lat, lng], used to guess where the player is without asking for their location.
//
// Sources (public reference data from the IANA tz database):
//   zone.tab       one row per zone and country, with the coordinates of its principal place
//   zone1970.tab   fills in any zone that zone.tab does not list
//   backward       "Link <target> <alias>" rows: old names that browsers still report.
//                  A "#= <name>" comment on a row names the place the alias really means
//                  (the row itself points at a merged zone), so that name is tried first.
//   version        the tzdb release, recorded in the generated header
//
// Usage:
//   node tools/gen-tz-coords.mjs                 download from data.iana.org and write the table
//   node tools/gen-tz-coords.mjs --from <dir>    read the four files from a local directory
//   node tools/gen-tz-coords.mjs --out <file>    write somewhere else
//   node tools/gen-tz-coords.mjs --check         exit 1 if the table on disk is out of date
//
// The output is stable under prettier (the data sits in a template literal), so there is no
// need to format it afterwards.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCES = [
  "https://data.iana.org/time-zones/tzdb/",
  "https://raw.githubusercontent.com/eggert/tz/main/",
];
const DEFAULT_OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "app",
  "lib",
  "tz-coords.ts",
);

/**
 * Old names whose link target keeps the same clock but is nowhere near the place, which would
 * give the wrong day length. Hand-entered [lat, lng]; everything else comes from the tz files.
 */
const PLACES = {
  "Africa/Timbuktu": [16.8, -3.0], // linked to Abidjan
  "America/Coral_Harbour": [64.1, -83.2], // linked to Panama
  "Antarctica/South_Pole": [-90, 0], // linked to Auckland
  "Atlantic/Jan_Mayen": [70.9, -8.7], // linked to Berlin
};

/** Zone names are written into a template literal, so nothing outside this set gets in. */
const SAFE_NAME = /^[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+)*$/;

function parseArgs(argv) {
  const args = { from: null, out: DEFAULT_OUT, check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from") args.from = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--check") args.check = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (args.from === undefined || args.out === undefined) {
    throw new Error("--from and --out need a value");
  }
  return args;
}

async function download(name) {
  let lastError = null;
  for (const base of SOURCES) {
    try {
      const res = await fetch(base + name, {
        headers: { "user-agent": "tz-table-generator" },
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.text();
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Could not download ${name}: ${lastError}`);
}

async function load(name, from, optional = false) {
  try {
    return from
      ? await readFile(path.join(from, name), "utf8")
      : await download(name);
  } catch (err) {
    if (optional) return null;
    throw err;
  }
}

/** "+404251-0740023" (ISO 6709: +-DDMM[SS]+-DDDMM[SS]) to decimal degrees. */
function parseIso6709(text) {
  const m = /^([+-])(\d{2})(\d{2})(\d{2})?([+-])(\d{3})(\d{2})(\d{2})?$/.exec(
    text,
  );
  if (!m) return null;
  const deg = (sign, d, min, sec) =>
    (sign === "-" ? -1 : 1) *
    (Number(d) + Number(min) / 60 + Number(sec ?? 0) / 3600);
  const lat = deg(m[1], m[2], m[3], m[4]);
  const lng = deg(m[5], m[6], m[7], m[8]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lat, lng];
}

/** Rows of a zone table: country codes, coordinates, zone name, optional comment. */
function parseZoneTab(text, into) {
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const [, coords, name] = line.split("\t");
    if (!name || !SAFE_NAME.test(name) || into.has(name)) continue;
    const at = parseIso6709(coords ?? "");
    if (at) into.set(name, at);
  }
}

/**
 * "Link TARGET ALIAS #= MEANT" rows from the backward file, as alias to the names to try in
 * order: the place the alias really means (when the row says), then the link target.
 */
function parseLinks(text) {
  const links = new Map();
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.startsWith("Link")) continue;
    const [row, comment = ""] = raw.split("#");
    const [, target, alias] = row.trim().split(/\s+/);
    if (!target || !alias) continue;
    if (!SAFE_NAME.test(target) || !SAFE_NAME.test(alias)) continue;
    const meant = /^=\s*(\S+)/.exec(comment)?.[1];
    links.set(
      alias,
      meant && SAFE_NAME.test(meant) ? [meant, target] : [target],
    );
  }
  return links;
}

/** Tenths of a degree as an integer: 51.5 becomes 515, -0.1 becomes -1. */
function tenths(deg) {
  const n = Math.round(deg * 10);
  return n === 0 ? 0 : n;
}

function build(zoneTab, zone1970Tab, backward) {
  const zones = new Map();
  parseZoneTab(zoneTab, zones);
  parseZoneTab(zone1970Tab, zones);
  const zoneCount = zones.size;

  // Resolve every old name against the zone tables only, so the result does not depend on the
  // order of the rows. A name that leads nowhere (links to Etc/UTC and friends) is left out.
  const links = parseLinks(backward);
  const resolve = (name, hops = 0) => {
    if (zones.has(name)) return zones.get(name);
    if (hops > 8) return null;
    for (const next of links.get(name) ?? []) {
      const at = resolve(next, hops + 1);
      if (at) return at;
    }
    return null;
  };
  const aliases = new Map();
  for (const alias of links.keys()) {
    if (zones.has(alias)) continue; // a zone with coordinates of its own
    const at = PLACES[alias] ?? resolve(alias);
    if (at) aliases.set(alias, at);
  }
  for (const [alias, at] of aliases) zones.set(alias, at);
  const aliasCount = aliases.size;

  // Group by the first path component. Names with no slash ("GB", "Japan") go under "".
  const groups = new Map();
  for (const name of [...zones.keys()].sort()) {
    const cut = name.indexOf("/");
    const area = cut < 0 ? "" : name.slice(0, cut);
    const rest = cut < 0 ? name : name.slice(cut + 1);
    const [lat, lng] = zones.get(name);
    if (!groups.has(area)) groups.set(area, []);
    groups.get(area).push(`${rest} ${tenths(lat)} ${tenths(lng)}`);
  }
  const lines = [...groups.keys()]
    .sort()
    .map((area) => `${area}:${groups.get(area).join(",")}`);
  return { lines, zoneCount, aliasCount };
}

function render({ lines, zoneCount, aliasCount }, version) {
  return `// GENERATED by tools/gen-tz-coords.mjs. Do not edit by hand: run the tool again.
// Source: IANA tz database ${version} (zone.tab, zone1970.tab, backward). Public domain data.
// ${zoneCount} zones and ${aliasCount} old names, each with the rough position of its principal place.

import type { LatLng } from "~/game/types";

// One line per area: "Area:Place lat lng,Place lat lng". Angles are tenths of a degree,
// north and east positive. Names with no area ("GB", "Japan") sit on the line that starts ":".
const TABLE = \`
${lines.join("\n")}
\`;

let index: Map<string, readonly [number, number]> | null = null;

function buildIndex(): Map<string, readonly [number, number]> {
  const map = new Map<string, readonly [number, number]>();
  for (const line of TABLE.split("\\n")) {
    const cut = line.indexOf(":");
    if (cut < 0) continue;
    const area = line.slice(0, cut);
    for (const entry of line.slice(cut + 1).split(",")) {
      const [place, lat, lng] = entry.split(" ");
      if (!place) continue;
      const name = area ? \`\${area}/\${place}\` : place;
      map.set(name.toLowerCase(), [Number(lat) / 10, Number(lng) / 10]);
    }
  }
  return map;
}

/** How many names the table knows (zones plus old names). */
export const TIME_ZONE_COUNT = ${zoneCount + aliasCount};

/**
 * The rough position of an IANA time zone's principal place, to 0.1 of a degree, or null when
 * the name is not in the table ("UTC", "Etc/GMT-5", anything made up). Case is ignored.
 */
export function coordsForTimeZone(tz: string): LatLng | null {
  index ??= buildIndex();
  const at = index.get(tz.trim().toLowerCase());
  return at ? { lat: at[0], lng: at[1] } : null;
}
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [zoneTab, zone1970Tab, backward, versionText] = await Promise.all([
    load("zone.tab", args.from),
    load("zone1970.tab", args.from),
    load("backward", args.from),
    load("version", args.from, true),
  ]);
  const version = /^[0-9]{4}[a-z]+$/.test((versionText ?? "").trim())
    ? versionText.trim()
    : "(unknown release)";

  const table = build(zoneTab, zone1970Tab, backward);
  if (table.zoneCount < 300) {
    throw new Error(
      `Only ${table.zoneCount} zones parsed: the source files look wrong.`,
    );
  }
  const source = render(table, version);

  if (args.check) {
    const current = await readFile(args.out, "utf8").catch(() => "");
    if (current.replace(/\r\n/g, "\n") !== source) {
      console.error(`${args.out} is out of date. Run this tool to regenerate.`);
      process.exit(1);
    }
    console.log(`${args.out} is up to date.`);
    return;
  }

  await writeFile(args.out, source, "utf8");
  console.log(
    `Wrote ${args.out}: tzdb ${version}, ${table.zoneCount} zones, ` +
      `${table.aliasCount} old names, ${Buffer.byteLength(source)} bytes.`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
