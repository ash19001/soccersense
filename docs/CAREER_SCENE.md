# soccersense: the career scene

The picture behind the questions. A footballer, a goal, and a ground that grows. Every answer
becomes a shot, and the running total moves him up eight tiers, from a kickabout in the park to
lifting the World Cup. Read `docs/GAME_DESIGN.md` sections 4 and 5 first: this document turns
them into a stage that artists and engineers can build to.

It is made of three kinds of art, each with its own owner:

| part       | where                  | what                                                                |
| ---------- | ---------------------- | ------------------------------------------------------------------- |
| the ground | `app/art/grounds`      | sky, backdrop, stands, crowd, pitch, the goal, everything not cast  |
| the people | `app/art/characters`   | the footballer, the keeper, the match ball, the trophy, small props |
| the scene  | `app/scenes/career.ts` | puts them together, runs the shots, the promotions and the ending   |

## 1. Camera and stage

- **Side on, from the near touchline at pitch level**, like a television gantry. He attacks
  from left to right. The goal is on the right.
- Positions come from `careerLayout(w, h)` in `~/art/layout` (see `docs/API_ART.md`). At the
  reference phone size, 130 x 281: feet row `groundY` 146, hero at x 39, keeper at x 103, goal
  line at x 109, far touchline at row 137, near touchline at row 180. On the reference monitor,
  480 x 270: feet row 140, hero at x 202, keeper at x 299, goal line at x 305, far touchline
  at row 131, near touchline at row 172.
- The stage is 130 px wide on a phone, centred. On a wider canvas it widens with the width
  (`2 * round(W * 0.2)`, 192 px at 480 x 270, at most 208), so the hero and the goal stand
  further apart on a monitor: `careerLayout().stageScale` is its width over 130. Everything
  the story needs happens inside it. Outside it, wide screens show more of the same ground:
  more houses, more stand, more pitch.
- There are three depth zones, and each tier dresses all three:
  1. **The far side** (above the far touchline): what grows with the tiers, then whatever is
     behind it, then the sky.
  2. **The pitch** (far touchline to near touchline, 43 rows on a phone): grass, lines, the
     goal, the cast.
  3. **The near side** (below the near touchline to the bottom): touchline furniture, seen from
     behind and close to the camera.

### What the player can see, and when

| moment                         | visible rows on a 130 x 281 phone         |
| ------------------------------ | ----------------------------------------- |
| a question is being asked      | 84 to 253 (board above, answer bar below) |
| the shot (no answer bar)       | 51 to 281                                 |
| the reveal sheet is up         | 51 to 152                                 |
| desktop, either side of the UI | everything, top to bottom, all the time   |

So: the hero, the keeper, the goal and the ball's flight live in rows 87 to 149 (the action
band), which is never covered. The shot plays on an open stage, so the upper stands, the roof
and the sky above row 84 are part of the payoff when the board shrinks. The near side is what
the player looks at while reading the question and typing: it should have small, calm life.
Nothing essential goes below row 152.

## 2. The cast

All people are drawn with the footballer sprite set (`~/art/characters`), side on, feet on the
ground point `(x, y)`. Positions are offsets from `(cx, groundY)`. A larger `y` is nearer the
camera and is drawn later. The `x` offsets are for the 130 px stage: multiply them by
`careerLayout().stageScale` and round (the hero, keeper and goal line are already in the
layout as `heroX`, `keeperX`, `goalX`; the keeper is always 6 px in front of the goal line).

| who         | x         | y             | faces | notes                        |
| ----------- | --------- | ------------- | ----- | ---------------------------- |
| hero        | `cx - 26` | `groundY`     | right | keepie-uppies while he waits |
| keeper      | `cx + 38` | `groundY`     | left  | in front of the goal line    |
| team-mate A | `cx - 52` | `groundY + 4` | right | near side, behind him        |
| team-mate B | `cx - 6`  | `groundY - 5` | right | far side, ahead of him       |
| opponent A  | `cx + 10` | `groundY + 5` | left  | near side                    |
| opponent B  | `cx + 24` | `groundY - 4` | left  | far side, edge of the box    |
| referee     | `cx - 40` | `groundY - 6` | right | from tier 2 up               |

- **The hero is one person at every tier**: the same skin and hair throughout. He is a child at
  tiers 0 and 1 (the youth sprite, 10 x 14) and an adult from tier 2 (12 x 18).
- Kits. Hero and team-mates: tier 0 park clothes (his top is already his colour), tiers 1 to 4
  the mode's kit (HOME warm red-orange, AWAY teal), tiers 5 to 7 the national kit (chalk with the
  mode colour as trim). Opponents: the rival kit. Keeper: the keeper kit, a colour nobody else
  wears. At tier 0 the keeper is just a mate in gloves that are too big.
- People are always graded with `light.lit`, so they read at any hour.
- The others are not statues: they breathe, turn to follow the ball, and react to the result
  (team-mates celebrate a goal, opponents slump; the reverse for a miss).

## 3. The goal

The ground draws the goal, because its style belongs to the tier. The scene needs to know
where it is and to make the net move.

| kind      | tiers  | crossbar above the feet row | net depth to the right |
| --------- | ------ | --------------------------- | ---------------------- |
| `jumpers` | 0      | none (about 15 px counts)   | 0                      |
| `small`   | 1      | 17 px                       | 8 px                   |
| `full`    | 2 to 7 | 24 px                       | 11 px                  |

- It is seen in profile, turned a little towards the camera: the near post stands at about
  `(goalX + 1, groundY + 2)`, the far post at about `(goalX - 3, groundY - 3)`, the crossbar
  joins their tops, and the net falls away to the right down to the ground. The net is a sparse
  mesh: the ball inside it and the crowd behind it must show through.
- Tier 0 is two piles of jumpers where the posts would be. A goal is the ball going between
  them past the keeper. There is no net: the ball runs on towards the hedge.
- The goal has a back layer (drawn before the cast) and a front layer (the near post and the
  near side netting, drawn after the ball), so a ball in the net is inside it.
- When a shot goes in, the scene asks for a **bulge**: the net pushed out to the right at the
  ball's height for about 0.4 s.

## 4. One answer, one shot

From the moment an answer is accepted to the moment the reveal sheet may slide up: about 2.4
seconds. With reduced motion: the result pose and the ball's final place are shown at once.

1. **Set** (0.3 s). He stops juggling, the ball drops to his feet, he steps back.
2. **Strike** (frame of the kick animation where the boot meets the ball). A puff at his
   standing foot and a 1 px shake.
3. **Flight** (0.45 to 0.7 s). The 3 x 3 ball spins and its shadow runs along the grass.
4. **Outcome and reaction** (about 1 s). Then he gets a new ball and goes back to juggling.

| grade      | the ball                                                                                                | the keeper                  | him                                           | crowd   |
| ---------- | ------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------- | ------- |
| `worldie`  | a rocket with a gold trail into the top corner; gold burst, the net nearly leaves its frame, 2 px shake | frozen, then turns to look  | knee slide or arms wide, mobbed by team-mates | `roar`  |
| `topbins`  | curls up and dips under the bar into the top corner                                                     | full stretch, a pixel short | leaping celebration                           | `cheer` |
| `goal`     | low and hard along the grass into the bottom corner                                                     | down late                   | fist pump                                     | `cheer` |
| `ontarget` | chest height, straight at the keeper                                                                    | dives and holds it          | hands on head                                 | `ooh`   |
| `wide`     | skied over the bar, up into the far side (tier 0: over the hedge)                                       | watches it go               | head down                                     | `groan` |
| `timeup`   | never struck: it rolls a few pixels and stops; a whistle sign                                           | relaxes                     | hands on hips                                 | `hush`  |
| `skipped`  | side-footed back to team-mate A                                                                         | relaxes                     | shrug, back to idle                           | `idle`  |

The grade's name and the points are shown by the DOM reveal sheet, not painted in the scene.

At the stadium tiers (4 to 7), every goal (`worldie`, `topbins`, `goal`) also sets off a few
small fireworks over the stand, bigger for a worldie (the product owner asked for this on
2026-11-11). Tiers 6 and 7 are at night, where they show best.

## 5. Promotion

When the total crosses a tier line, he goes up: after the reveal, when the player presses the
next button, and before the next question appears (the clock does not run meanwhile).

- **HOME: the ground is built around him.** A wall of builders' dust sweeps across the far
  side, with a girder or two and a crane arm showing through it, the new stands are there when
  it clears, and they land with a thud (a 1 px shake) and a ripple of new crowd. About 1.5 s.
- **AWAY: he travels** (a later milestone: a coach, a ferry, a plane crossing the screen). Until
  then AWAY uses the same build.
- Crossing two tiers at once plays one transition straight to the higher tier.
- With reduced motion the ground simply changes.

## 6. The eight grounds (HOME: the hometown hero)

The same pitch in the same place throughout. Things that stay recognisable from tier to tier
are what make it one story: **his house** in the terrace behind the pitch, with a door in the
HOME colour and a lit upstairs window at night; the terrace's chimneys; a church spire. Each
tier hides a little more of the street behind what has been built. Anything painted as a word
on a board or banner comes from the labels the scene passes in, never hard-coded.

| tier | far side                                                                                               | pitch and goal                                                            | near side                                                     | people watching                   | light at night                |
| ---- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------- | ----------------------------- |
| 0    | a hedge and park railings; behind them the terrace of houses, trees, a street lamp                     | scruffy grass, a worn goalmouth, daisies, no lines; jumpers for goalposts | a path, a bench, bikes dropped on the grass, a dog            | a couple of mates                 | the street lamp's pool        |
| 1    | the same street; a rope on stakes, a wooden changing hut, a corner flag                                | wobbly painted lines, mud; a small wonky goal with a sagging net          | the rope, kit bags, substitutes in big coats, a flask         | a dozen parents                   | the lamp and the hut's window |
| 2    | one small covered stand, a tea hut, a fence with painted boards; roofs and chimneys above them         | proper lines, a full goal                                                 | a rail with boards, two small dugouts                         | about fifty                       | four thin floodlight poles    |
| 3    | a proper main stand the width of the stage, a terrace, a small scoreboard; his house in a gap          | a good pitch, faint stripes                                               | painted boards, real dugouts, two photographers               | a few thousand                    | corner pylons                 |
| 4    | a packed two-tier stand with a box strip, a roof and a camera gantry; the spire in a corner gap        | perfect stripes                                                           | LED boards, photographers, ball kids, heads of the near crowd | tens of thousands, in his colours | roof floodlights              |
| 5    | the same stadium dressed for an international: flags, banners, scarves held up                         | the same                                                                  | the same, in national colours                                 | the same, flags everywhere        | the same                      |
| 6    | the World Cup final: **always night**, camera flashes across the stands, giant flags passed over heads | the same                                                                  | the trophy on a plinth by the touchline                       | full, flashing                    | full, with sweeping beams     |
| 7    | the same, with fireworks over the roof and ticker tape                                                 | a podium near the centre                                                  | everyone on the pitch                                         | delirious                         | the same                      |

- Tiers 6 and 7 are always lit as night, whatever the player's own sky is. Every other tier
  uses the player's sky.
- Tiers 0 and 1 have no floodlights. At night the grass is dark and blue (`light.env`) with a
  warm pool of lamp light over the middle of the stage, so the game is still readable.
- From tier 2 the pitch and stands are floodlit at night (`light.lit`).
- Tier 7 is only ever the ending: he lifts the trophy on the podium, team-mates jump around
  him, the crowd is a party.
- A dog chases the ball in the park at tier 0. It would be lovely if the same dog turned up
  somewhere at every tier.

### AWAY: the journeyman (a later milestone)

The build-out of stands, pitch and near side is shared. AWAY changes what is behind and above
it at each tier (a wet night up the road, a harbour, a Mediterranean dusk, an alpine ground in
snow, desert heat, a final on another continent), the weather, and the crowd's colours: hostile,
in the rival colour, with one small pocket of travelling fans in teal. Until those backdrops
exist, AWAY shows the HOME street with AWAY kits and crowd colours.

## 7. The contracts

```ts
// ~/art/grounds
type Tier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type CrowdMood = "idle" | "hush" | "ooh" | "groan" | "cheer" | "roar" | "party";
interface GroundGoal {
  kind: "jumpers" | "small" | "full";
  lineX: number; // the goal line at the feet row
  barY: number; // the underside of the crossbar (for jumpers: the height that counts)
  depth: number; // how far the net runs to the right of the line
}
interface NetBulge {
  y: number;
  amount: number;
} // amount 0 to 1

class CareerGround {
  constructor(opts: {
    seed: number;
    mode: Mode;
    tier: Tier;
    labels?: GroundLabels;
  });
  resize(w: number, h: number): void;
  setLighting(light: Lighting): void; // the ground applies the always-night rule itself
  setMode(mode: Mode): void;
  setTier(tier: Tier): void;
  setMood(mood: CrowdMood, t: number): void; // the crowd and extras react from scene time t
  readonly goal: GroundGoal;
  readonly light: Lighting; // the light actually in use (night at tiers 6 and 7)
  readonly podium: GroundPodium | null; // tier 7: { x, top, w }, his feet on (x, top)
  drawBack(s: Surface, t: number): void; // covers every pixel: sky to near side, goal back layer
  drawFront(s: Surface, t: number, bulge?: NetBulge | null): void; // goal front layer, anything in front of the cast
}
```

```ts
// ~/art/characters
drawPlayer(s, anim, frame, x, y, kit, { flipX?, youth? });
ballSpot(anim, frame, { flipX?, youth? }); // where the ball is while he touches it
makeKit(base, look?);  litKit(kit, light);
// plus the keeper's own animations, the match ball, the trophy and small effects
```

```ts
// ~/scenes/career
class CareerScene implements Scene {
  constructor(opts: {
    seed: number;
    mode: Mode;
    total?: number;
    labels?: GroundLabels;
  });
  setTotal(total: number): void; // sets the tier at once (restoring a saved game)
  playShot(grade: Grade, onDone?: () => void): void; // section 4
  promote(total: number, onDone?: () => void): void; // section 5; a no-op if the tier is unchanged
  showFullTime(total: number): void; // the final tableau for the tier reached
  readonly busy: boolean;
}
```

Budget: the whole scene (ground, cast, effects) under 4 ms a frame at 480 x 270 once warm.
Static parts of a ground are painted once per size, light, tier and mode into cached layers.
