#!/usr/bin/env node
// Browser screenshot of a running page. Uses the system Chrome (or Edge) through
// playwright-core, so nothing is downloaded.
//
//   node tools/shoot.mjs <url> <out.png> [--w 390] [--h 844] [--dpr 2] [--wait 400] [--full]
//
// Extras: --reduce (prefers-reduced-motion), --touch (mobile + touch emulation),
//         --eval "<js>" (run in the page before the shot, e.g. to focus or click something),
//         --clip x,y,w,h (only that rectangle, in CSS pixels; fractions are allowed, and at
//         a fractional ratio the clip is cut to the device pixel: 19.2 at 125% is 24),
//         --zoom <n> (enlarge the finished shot n times with hard edges, to look at device
//         pixels: a higher --dpr is not a zoom, because the page lays itself out for the ratio),
//         --colors (report how many different colours the shot has: 2 for a crisp clip),
//         --timeout <ms> (navigation timeout, default 30000),
//         --init "<js>" (run in the page before any of its own scripts, on every load:
//         put a saved game in localStorage, pin Math.random).
//
// Real input before the shot, done with the browser's own mouse and keyboard so the page
// sees trusted events. They run in the order given, after the --wait settle time, and any
// of them can be repeated:
//
//         --move x,y          move the mouse there (CSS pixels from the viewport's corner)
//         --click x,y         move there, press and release
//         --down x,y          move there and press; the button is still held in the shot
//         --up x,y            move there and release (after a --down: a press that slides)
//         --press Key[,Key]   press keys in turn: Tab, Enter, Shift+Tab, a
//         --sleep <ms>        wait that long before the next input
//         --resize WxH        change the viewport (a window being resized)
//         --run "<js>"        run in the page at this point (fake a hidden tab, read a value)
//         --after <ms>        wait after the input, before the shot (default 150)
//
//   node tools/shoot.mjs "http://localhost:5173/dev/stage" .snaps/stage.png --move 40,60 --down 300,700
//
// With --touch, --click is a tap and --down is a finger held on the screen (a --move after
// it drags that finger); a --move with no finger down is still the mouse.
//
// Many shots with one browser: put {name}, {w}, {h} or {dpr} in the url and the output path
// and list what to fill them with.
//
//   node tools/shoot.mjs "http://localhost:5173/dev/ui?only={name}" ".snaps/ui-{name}-{w}.png" \
//     --names ask-home,reveal-goal --sizes 390x844@2,320x568@2,1440x900@1
//
//         --names a,b,c       one shot per name
//         --sizes WxH[@dpr]   one shot per size (instead of --w --h --dpr)
//         --strict            exit with code 1 if any page reported a problem
//
// Device pixel ratios. A whole ratio (1, 2, 3) is emulated, as DevTools does. A fractional
// one (1.25, 1.5, 1.1: Windows display scaling, browser zoom) is given to the browser
// itself with --force-device-scale-factor, one browser per ratio, because that is how a
// real display reaches Chrome: only then is the page laid out in device pixels. An emulated
// fractional ratio is laid out in CSS pixels to a 64th, which no screen does, and nothing
// lands on whole device pixels in it. --emulate asks for that old way all the same.
//
// Console errors, page errors and failed requests are reported on stderr with the shot they
// belong to. That is how hydration warnings are caught.
// Exit code 0 and one absolute output path per line on stdout when the files were written.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright-core";

const USAGE =
  'usage: node tools/shoot.mjs <url> <out.png> [--w 390] [--h 844] [--dpr 2] [--wait 400] [--full] [--reduce] [--touch] [--eval "<js>"] [--clip x,y,w,h] [--zoom 8] [--colors] [--timeout 30000] [--names a,b] [--sizes 390x844@2,1536x864@1.25] [--emulate] [--strict] [--move x,y] [--click x,y] [--down x,y] [--up x,y] [--press Key,Key] [--sleep 300] [--resize 800x600] [--run "<js>"] [--after 150] [--init "<js>"]';

const VALUE_FLAGS = new Set([
  "w",
  "h",
  "dpr",
  "wait",
  "eval",
  "clip",
  "timeout",
  "names",
  "sizes",
  "after",
  "init",
  "zoom",
]);
// Input before the shot. Unlike the flags above these keep their order and can repeat.
const ACTION_FLAGS = new Set([
  "move",
  "click",
  "down",
  "up",
  "press",
  "sleep",
  "resize",
  "run",
]);
const BOOL_FLAGS = new Set([
  "full",
  "reduce",
  "touch",
  "strict",
  "help",
  "colors",
  "emulate",
]);

function fail(message) {
  console.error(`shoot: ${message}`);
  console.error(USAGE);
  process.exit(2);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  const actions = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (BOOL_FLAGS.has(name)) {
      flags[name] = true;
    } else if (VALUE_FLAGS.has(name)) {
      const value = eq === -1 ? argv[++i] : arg.slice(eq + 1);
      if (value === undefined) fail(`--${name} needs a value`);
      flags[name] = value;
    } else if (ACTION_FLAGS.has(name)) {
      const value = eq === -1 ? argv[++i] : arg.slice(eq + 1);
      if (value === undefined) fail(`--${name} needs a value`);
      actions.push(parseAction(name, value));
    } else {
      fail(`unknown option --${name}`);
    }
  }
  return { positional, flags, actions };
}

/** "--move 40,60" as { kind: "move", x: 40, y: 60 }; "--press Tab,Enter" as a list of keys. */
function parseAction(kind, value) {
  if (kind === "press") {
    const keys = String(value)
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);
    if (keys.length === 0) fail("--press needs at least one key");
    return { kind, keys };
  }
  if (kind === "run") return { kind, code: String(value) };
  if (kind === "sleep") {
    const ms = Number(value);
    if (!Number.isFinite(ms) || ms < 0 || ms > 60000) {
      fail("--sleep must be a number of milliseconds up to 60000");
    }
    return { kind, ms };
  }
  if (kind === "resize") {
    const match = /^(\d+)x(\d+)$/.exec(String(value).trim());
    if (!match) fail("--resize must be WxH in CSS pixels");
    return { kind, width: Number(match[1]), height: Number(match[2]) };
  }
  const parts = String(value).split(",").map(Number);
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n) || n < 0)) {
    fail(`--${kind} must be x,y in CSS pixels`);
  }
  return { kind, x: parts[0], y: parts[1] };
}

/**
 * Plays the input into the page. Everything goes through the browser's input pipeline
 * (Playwright's mouse, keyboard and touchscreen, and the same DevTools call for a held
 * finger), so the page gets trusted events with real coordinates.
 */
async function perform(page, actions, touch) {
  let finger = null; // a DevTools session while a finger is held down
  for (const action of actions) {
    if (action.kind === "press") {
      for (const key of action.keys) await page.keyboard.press(key);
    } else if (action.kind === "sleep") {
      await page.waitForTimeout(action.ms);
    } else if (action.kind === "resize") {
      await page.setViewportSize({
        width: action.width,
        height: action.height,
      });
    } else if (action.kind === "run") {
      await page.evaluate(action.code);
    } else if (action.kind === "move") {
      if (finger) {
        await finger.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: action.x, y: action.y }],
        });
      } else {
        await page.mouse.move(action.x, action.y);
      }
    } else if (action.kind === "click") {
      if (touch) {
        await page.touchscreen.tap(action.x, action.y);
      } else {
        await page.mouse.click(action.x, action.y);
      }
    } else if (action.kind === "up") {
      if (finger) {
        await finger.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: action.x, y: action.y }],
        });
        await finger.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      } else {
        await page.mouse.move(action.x, action.y);
        await page.mouse.up();
      }
    } else if (touch) {
      finger ??= await page.context().newCDPSession(page);
      await finger.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: action.x, y: action.y }],
      });
    } else {
      await page.mouse.move(action.x, action.y);
      await page.mouse.down();
    }
  }
}

function number(flags, name, fallback, { min, max }) {
  if (flags[name] === undefined) return fallback;
  const n = Number(flags[name]);
  if (!Number.isFinite(n) || n < min || n > max) {
    fail(`--${name} must be a number between ${min} and ${max}`);
  }
  return n;
}

/** "390x844@2,320x568" as a list of viewports. A size without @dpr uses `dpr`. */
function parseSizes(text, dpr) {
  const sizes = String(text)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^(\d+)x(\d+)(?:@(\d+(?:\.\d+)?))?$/.exec(part);
      if (!match) fail(`--sizes: "${part}" is not WxH or WxH@dpr`);
      const size = {
        width: Number(match[1]),
        height: Number(match[2]),
        dpr: match[3] === undefined ? dpr : Number(match[3]),
      };
      if (
        size.width < 100 ||
        size.width > 8000 ||
        size.height < 100 ||
        size.height > 8000 ||
        size.dpr < 0.5 ||
        size.dpr > 4
      ) {
        fail(`--sizes: "${part}" is out of range`);
      }
      return size;
    });
  if (sizes.length === 0) fail("--sizes needs at least one size");
  return sizes;
}

async function launch(args = []) {
  const errors = [];
  for (const channel of ["chrome", "msedge"]) {
    try {
      return await chromium.launch({ channel, headless: true, args });
    } catch (error) {
      errors.push(
        `${channel}: ${String(error?.message ?? error).split("\n")[0]}`,
      );
    }
  }
  throw new Error(
    `could not start Chrome or Edge.\n  ${errors.join("\n  ")}\n  Install Google Chrome or Microsoft Edge.`,
  );
}

/**
 * Looks at a finished shot in a page of its own: cuts `crop` out of it (a rectangle in
 * device pixels), counts its colours, and enlarges it `zoom` times with hard edges (every
 * device pixel becomes a zoom x zoom block). Returns the image to write, as `mime`, and the
 * number of different colours.
 */
async function develop(browser, png, { zoom, count, crop, mime }) {
  const context = await browser.newContext({
    viewport: { width: 200, height: 200 },
    deviceScaleFactor: 1,
  });
  try {
    const page = await context.newPage();
    const result = await page.evaluate(
      async ({ base64, zoom, count, crop, mime }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        // The part to keep, inside the picture.
        const x = crop ? Math.min(crop.x, image.naturalWidth - 1) : 0;
        const y = crop ? Math.min(crop.y, image.naturalHeight - 1) : 0;
        const w = crop
          ? Math.min(crop.width, image.naturalWidth - x)
          : image.naturalWidth;
        const h = crop
          ? Math.min(crop.height, image.naturalHeight - y)
          : image.naturalHeight;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
        let colours = 0;
        if (count) {
          const data = new Uint32Array(
            ctx.getImageData(0, 0, w, h).data.buffer,
          );
          colours = new Set(data).size;
        }
        let out = null;
        if (zoom > 1) {
          const big = document.createElement("canvas");
          big.width = w * zoom;
          big.height = h * zoom;
          const to = big.getContext("2d");
          to.imageSmoothingEnabled = false;
          to.drawImage(canvas, 0, 0, big.width, big.height);
          out = big.toDataURL(mime, 0.92).split(",")[1];
        } else if (crop || mime !== "image/png") {
          out = canvas.toDataURL(mime, 0.92).split(",")[1];
        }
        return { colours, out, w, h };
      },
      { base64: png.toString("base64"), zoom, count, crop, mime },
    );
    return {
      image: result.out === null ? png : Buffer.from(result.out, "base64"),
      colours: result.colours,
      width: result.w,
      height: result.h,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const { positional, flags, actions } = parseArgs(process.argv.slice(2));
  if (flags.help) {
    console.log(USAGE);
    return;
  }
  const [url, out] = positional;
  if (!url || !out || positional.length > 2)
    fail("expected <url> and <out.png>");
  if (!/^(https?|file|data|about):/.test(url)) {
    fail(`"${url}" is not a full URL (http://localhost:5173/...)`);
  }
  if (!/\.(png|jpe?g)$/i.test(out))
    fail("the output file must end in .png or .jpg");

  const width = Math.round(number(flags, "w", 390, { min: 100, max: 8000 }));
  const height = Math.round(number(flags, "h", 844, { min: 100, max: 8000 }));
  const dpr = number(flags, "dpr", 2, { min: 0.5, max: 4 });
  const wait = number(flags, "wait", 400, { min: 0, max: 60000 });
  const timeout = number(flags, "timeout", 30000, { min: 1000, max: 300000 });
  const after = number(flags, "after", 150, { min: 0, max: 60000 });
  const zoom = Math.round(number(flags, "zoom", 1, { min: 1, max: 32 }));
  if (flags.after !== undefined && actions.length === 0) {
    fail("--after only applies with an input (--move, --click, --press ...)");
  }

  let clip;
  if (flags.clip !== undefined) {
    const parts = String(flags.clip).split(",").map(Number);
    if (
      parts.length !== 4 ||
      parts.some((n) => !Number.isFinite(n) || n < 0) ||
      parts[2] === 0 ||
      parts[3] === 0
    ) {
      fail("--clip must be x,y,w,h in CSS pixels");
    }
    if (flags.full) fail("--clip and --full cannot be used together");
    clip = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
  }

  // The list of shots: every name at every size.
  let names = [null];
  if (flags.names !== undefined) {
    names = String(flags.names)
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    if (names.length === 0) fail("--names needs at least one name");
  }
  const sizes =
    flags.sizes === undefined
      ? [{ width, height, dpr }]
      : parseSizes(flags.sizes, dpr);

  const shots = [];
  for (const size of sizes) {
    for (const name of names) {
      const fill = (text) =>
        text
          .replaceAll("{name}", name ?? "")
          .replaceAll("{w}", String(size.width))
          .replaceAll("{h}", String(size.height))
          .replaceAll("{dpr}", String(size.dpr));
      shots.push({
        ...size,
        url: fill(url),
        outPath: path.resolve(fill(out)),
        label: [name, `${size.width}x${size.height}@${size.dpr}`]
          .filter(Boolean)
          .join(" "),
      });
    }
  }
  if (new Set(shots.map((shot) => shot.outPath)).size !== shots.length) {
    fail(
      "several shots would write the same file: put {name} and {w} in the output path",
    );
  }
  const many = shots.length > 1;

  let problems = 0;
  // The browsers: one that emulates (whole ratios, and the page that develops shots), and
  // one at a time started at a fractional ratio.
  let plain = null;
  let forced = null;
  let forcedRatio = 0;
  const browserFor = async (ratio) => {
    if (Number.isInteger(ratio) || flags.emulate) {
      return (plain ??= await launch());
    }
    if (forcedRatio !== ratio) {
      await forced?.close();
      forced = await launch([`--force-device-scale-factor=${ratio}`]);
      forcedRatio = ratio;
    }
    return forced;
  };
  try {
    // One context per size: the viewport and the pixel ratio belong to the context.
    let context = null;
    let contextKey = "";
    for (const shot of shots) {
      const report = (text) => {
        problems++;
        console.error(
          many ? `shoot: [${shot.label}] ${text}` : `shoot: ${text}`,
        );
      };
      const key = `${shot.width}x${shot.height}@${shot.dpr}`;
      if (!context || key !== contextKey) {
        await context?.close();
        context = null;
        const browser = await browserFor(shot.dpr);
        context = await browser.newContext({
          viewport: { width: shot.width, height: shot.height },
          deviceScaleFactor: shot.dpr,
          isMobile: Boolean(flags.touch),
          hasTouch: Boolean(flags.touch),
          reducedMotion: flags.reduce ? "reduce" : "no-preference",
        });
        contextKey = key;
      }
      const page = await context.newPage();
      if (typeof flags.init === "string") {
        await page.addInitScript(flags.init);
      }
      page.on("pageerror", (error) => {
        report(`page error: ${error.message}`);
      });
      page.on("console", (message) => {
        if (message.type() === "error") {
          report(`console error: ${message.text()}`);
        }
      });
      page.on("requestfailed", (request) => {
        const reason = request.failure()?.errorText ?? "failed";
        if (reason !== "net::ERR_ABORTED") {
          report(`request failed: ${request.url()} (${reason})`);
        }
      });

      const response = await page.goto(shot.url, {
        waitUntil: "load",
        timeout,
      });
      if (response && !response.ok()) {
        report(`warning: ${shot.url} answered HTTP ${response.status()}`);
      }
      // Let lazy chunks and styles settle, but never hang on a page that keeps a socket busy.
      await page
        .waitForLoadState("networkidle", { timeout: Math.min(timeout, 5000) })
        .catch(() => {});
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      if (typeof flags.eval === "string") {
        await page.evaluate(flags.eval);
      }
      if (wait > 0) await page.waitForTimeout(wait);
      if (actions.length > 0) {
        await perform(page, actions, Boolean(flags.touch));
        if (after > 0) await page.waitForTimeout(after);
      }
      await mkdir(path.dirname(shot.outPath), { recursive: true });
      // The browser rounds a clip to whole CSS pixels, which at a fractional ratio is not
      // whole device pixels. There the whole viewport is taken and the clip is cut out of
      // it afterwards, to the device pixel.
      const cut = clip && !Number.isInteger(shot.dpr);
      if (zoom > 1 || flags.colors || cut) {
        // Taken into memory as a PNG (lossless), looked at, then written.
        const png = await page.screenshot({
          fullPage: Boolean(flags.full),
          clip: cut ? undefined : clip,
          type: "png",
          animations: "allow",
        });
        const crop = cut
          ? {
              x: Math.round(clip.x * shot.dpr),
              y: Math.round(clip.y * shot.dpr),
              width: Math.max(1, Math.round(clip.width * shot.dpr)),
              height: Math.max(1, Math.round(clip.height * shot.dpr)),
            }
          : null;
        const side = crop
          ? Math.max(crop.width, crop.height)
          : Math.max(png.readUInt32BE(16), png.readUInt32BE(20));
        if (side * zoom > 16000) {
          fail(
            `--zoom ${zoom} of a ${side} px shot is too large: add a --clip`,
          );
        }
        const developed = await develop((plain ??= await launch()), png, {
          zoom,
          count: Boolean(flags.colors),
          crop,
          mime: /\.png$/i.test(shot.outPath) ? "image/png" : "image/jpeg",
        });
        await writeFile(shot.outPath, developed.image);
        if (flags.colors) {
          console.error(
            `shoot: ${many ? `[${shot.label}] ` : ""}${developed.colours} ${developed.colours === 1 ? "colour" : "colours"} in ${developed.width} x ${developed.height} device pixels`,
          );
        }
      } else {
        await page.screenshot({
          path: shot.outPath,
          fullPage: Boolean(flags.full),
          clip,
          type: /\.png$/i.test(shot.outPath) ? "png" : "jpeg",
          animations: "allow",
        });
      }
      await page.close();
      console.log(shot.outPath);
    }
    await context?.close();
  } finally {
    await plain?.close();
    await forced?.close();
  }
  if (many) {
    console.error(
      `shoot: ${shots.length} shots, ${problems} ${problems === 1 ? "problem" : "problems"} reported`,
    );
  }
  if (flags.strict && problems > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`shoot: ${error?.message ?? error}`);
  process.exit(1);
});
