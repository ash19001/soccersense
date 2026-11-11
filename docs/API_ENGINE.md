# Pixel engine reference (`~/pixel`)

The short guide for anyone drawing. Import everything from `~/pixel`. The source in
`app/pixel/` has fuller comments if you need an exact edge case.

Rules that hold everywhere: coordinates are rounded to whole pixels; drawing is clipped to the
surface and the clip rect; no call throws on odd input (zero or negative sizes, NaN, shapes
off-screen just draw nothing); drawing with `TRANSPARENT` is a no-op.

## Colour

```ts
type Color // opaque packed number. Never write a raw number: use rgb() or the palette.
TRANSPARENT
rgb(0xff8800): Color          hex("#ff8800"): Color        fromRgb(r, g, b): Color
toRgb(c): [r, g, b]           toHex(c): "#rrggbb"          luma(c): 0..1
mix(a, b, t): Color           // OKLab blend, t clamped
shade(c, amount): Color       // -1..1. Negative: darker and bluer. Positive: lighter and warmer.
                              // About 0.25 is one ramp step.
```

## Surface

```ts
const s = new Surface(w, h);          // transparent
s.w, s.h, s.data /* Uint32Array */    s.clone()
s.clear(c?)                            // whole surface, ignores the clip
s.px(x, y, c)      s.get(x, y)         // get() is TRANSPARENT outside
s.rect(x, y, w, h, c)                  // filled
s.frame(x, y, w, h, c)                 // 1 px outline, inside the bounds
s.erase(x, y, w, h)                    // back to transparent
s.hline(x, y, len, c)   s.vline(x, y, len, c)
s.line(x0, y0, x1, y1, c)              // includes both ends; mirrored lines are exact mirrors
s.disc(cx, cy, r, c, level = 1)        // filled circle; level < 1 dithers it
s.circle(cx, cy, r, c)                 // outline: exactly the edge pixels of disc()
s.ellipse(cx, cy, rx, ry, c, filled = false, level = 1)
s.poly(points, c, level = 1)           // filled, concave is fine, includes its edges
s.polyline(points, c, closed = false)
s.dither(x, y, w, h, c, level)         // paint c over what is there with coverage 0..1 (Bayer 4x4)
s.bands(x, y, w, h, colors, { stops?, dither? })  // vertical banded gradient, top to bottom
s.shadeRect(x, y, w, h, (x, y) => Color)          // per-pixel escape hatch
s.blit(src, dx, dy, { sx?, sy?, sw?, sh?, flipX?, flipY? })  // skips transparent pixels
s.copy(src, dx = 0, dy = 0)            // fast opaque copy of a cached layer
s.recolor(fn, x?, y?, w?, h?)          // fn runs once per distinct colour: layer.recolor(light.env)
s.outline(c, corners = false)          // 1 px outline round everything on this surface
s.mask(shape, dx = 0, dy = 0)          // keep only what is under shape's painted pixels
s.cut(shape, dx = 0, dy = 0)           // erase what is under shape's painted pixels
s.clip(x, y, w, h)   s.unclip()        // for whoever owns the surface
s.pushClip(x, y, w, h)   s.popClip()   // for painters: narrows the current clip, then restores it
bayer4(x, y): number                   // the dither threshold, for hand-rolled dithers
```

- **Circles**: a radius `r` is `round(2r) + 1` pixels across. Whole radius: odd size centred on
  the pixel. Radius ending in .5: even size. `r = 0` is 1 px, `0.5` is 2 x 2, `1` is a plus.
- **Glows and soft shadows**: stack dithered shapes.
  `disc(x, y, 12, c, 0.25); disc(x, y, 8, c, 0.5); disc(x, y, 4, c);`
  `ellipse(x, groundY, 6, 1.5, shadow, true, 0.5)` is a soft ground shadow.
  `poly(beam, c, 0.25)` is a floodlight beam.
- **bands**: `stops` are the boundaries as fractions (one fewer than the colours, default
  equal). `dither` is the number of dithered rows each side of a boundary (default 2, 0 for hard
  edges). A `TRANSPARENT` entry leaves existing pixels alone, which makes a glow that fades out.
- **Layers**: paint a static layer once into its own `Surface`, then `copy()` (opaque) or
  `blit()` (with holes) it each frame. Paint in daylight colours and call
  `layer.recolor(light.env)` or `layer.recolor(light.lit)` to grade the whole layer in one go.
- **Outlined shapes**: build the shape on its own surface with a 1 px margin, then
  `layer.outline(ink)`.

## Text

```ts
FONT_5x7   // A-Z a-z 0-9 punctuation. Capitals 7 px tall, lineHeight 10. Proportional.
FONT_3x5   // capitals, digits, basic punctuation. 5 px tall, lineHeight 7. Lower case draws as capitals.
drawText(s, text, x, y, c, opts?): number   // returns the width; y is the top of the capitals
measureText(text, opts?): number
wrapText(text, maxWidth, opts?): string[]
foldText(text, font?): string               // the text as the font will draw it
// opts: { font?, align?: "left" | "center" | "right", shadow?: Color, outline?: Color,
//         scale?: integer, spacing?: number, tabular?: boolean, dots?: boolean }
```

- Accents fold to plain letters (Maracanã draws as Maracana). Unknown characters draw as a box.
- `tabular` gives digits one width so a changing number does not jiggle.
- `dots` (with `scale` 2 or more) draws each font pixel one pixel smaller than the scale: a
  dot-matrix look. Unlit lamps behind it: `s.dither(x, y, w, h, dim, 0.25)` on even `x`, `y`.
  Keep the unlit colour very dark, or the lit text will not read.
- `FONT_3x5` with a shadow looks muddy: use it plain or outlined.

## Sprites

```ts
const BALL = sprite(
  `
.ww.
wwkw
wkww
.ww.
`,
  "wk",
);                                   // frames are separated by a blank line; '.' is transparent
drawSprite(s, BALL, frame, x, y, [white, ink], { flipX?, flipY?, anchor?, scale? });
spriteColors(sp, { w: white, k: ink }): Color[]   // build colours by legend letter; do it once, not per frame
frameCount(sp): number
```

- A fully transparent row must be written with dots (an empty line starts a new frame). All
  frames must be the same size.
- `anchor: "bottom-center"`: `(x, y)` is the ground pixel under the sprite, so the bottom row is
  drawn at `y - 1` and the left edge at `x - floor(w / 2)`. Draw at `(x, groundY)` to stand it up.
- `frame` wraps, so pass a running counter. A `TRANSPARENT` colour leaves that part out. One
  colour for every entry draws a flat silhouette (a shadow, a hit flash).

## Random, easing, time

```ts
const r = rng(seed);  r()  r.int(a, b)  r.range(a, b)  r.pick(list)  r.chance(p)
hash2(x, y, seed = 0): 0..1          // stable per cell: crowd colours, stars, grass tufts
clamp, lerp, invLerp, remap, smoothstep, easeInCubic, easeOutCubic, easeInOutCubic, easeOutBack
arc(t)                               // 0 -> 1 -> 0 parabola: y - Math.round(arc(t) * 12) is a 12 px jump
pingPong(t), stepped(t, steps), wave(t, period) /* -1..1 */, frameAt(t, fps, count)
```

Never call `Math.random()` or read the clock in a painter. Everything is a function of `t` and
a seed.

## Shots and the snap tool

```ts
// any app/**/*.shots.ts
import type { ShotMap } from "~/pixel";
export const shots: ShotMap = {
  "ball/menu": (ctx) => {
    /* ctx: { w, h, t, seed, sun: { elevation, morning } } */ return surface;
  },
};
```

```sh
./node_modules/.bin/tsx tools/snap.ts --list
./node_modules/.bin/tsx tools/snap.ts ball/menu --out .snaps/ball-menu.png
./node_modules/.bin/tsx tools/snap.ts "ball/*" --time night            # several shots, labelled
./node_modules/.bin/tsx tools/snap.ts stadium/full --time all          # day, golden, dusk, night, dawn
./node_modules/.bin/tsx tools/snap.ts stadium/full --size all          # the four reference sizes
./node_modules/.bin/tsx tools/snap.ts player/run --strip 8 --dt 0.1    # animation frames
./node_modules/.bin/tsx tools/snap.ts player/sheet --scale 10 --crop 0,0,64,40
```

Options: `--w --h` or `--size WxH|all` (default 130 x 281), `--scale` (default 4), `--crop
x,y,w,h`, `--t`, `--strip N --dt S`, `--time day|golden|dusk|night|dawn|all`, `--sun <deg>
[--morning]`, `--seed`, `--bg <hex|none>`, `--out`. Then open the PNG with the Read tool.
