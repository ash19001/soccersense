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

Every answer is one of six shots (`docs/GAME_DESIGN.md` section 4), each with its own move
(`~/art/characters`: `bicycle` for the worldie, `finesse` for the golazo, `trivela`, `toepoke`,
`tapin`, and `kick` for the miss); time up and a pass strike nothing. (`power` and `chip` are
spare moves now.)

1. **Set** (0 to 0.3 s). He stops juggling, the ball drops to his feet, he steps back. (The
   worldie, the toe poke and the tap in have their own build-up instead: see the table.)
2. **Strike**: the frame of his move where the boot meets the ball (`STRIKE_FRAME`), at 0.5 s
   for the golazo, the trivela and the miss. A puff at his standing foot and a 1 px shake for
   the hard ones.
3. **Flight** (0.27 to 0.62 s by shot). The 3 x 3 ball spins and its shadow runs along the
   grass.
4. **Outcome and reaction**, the crowd's mood as the ball gets there. The reveal may come up at
   2.4 s; the reaction plays on to 3.0 s, then everyone heads back (he runs back from wherever
   his celebration took him), a new ball is thrown on, and he juggles again.

| shot (id)            | build-up and the ball (times from the answer)                                                                                                                                                                                                                                                                                  | the keeper                                                                                                     | him; the others                                                                                      | crowd   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------- |
| WORLDIE (`worldie`)  | the showpiece: he hooks it out to team-mate A (to 0.4), who lofts a cross straight back to his chest (0.85); his back to the goal, he chests it up, leaps and scissors it overhead (strike 1.25). Flat and a little downhill into the top corner with a gold trail (1.55); a gold burst, the net bulges its most, a 2 px shake | `ready`, frozen to the spot, then `beaten`                                                                     | lands on his back and sits up (1.55), springs up to celebrate (1.75); A and B run over and mob him   | `roar`  |
| GOLAZO (`golazo`)    | the curler: inside of the foot, its shadow bending out towards the camera and back in, the ball rising into the far top corner round the keeper's dive (strike 0.5, line 1.12)                                                                                                                                                 | the leap at full stretch, his gloves a pixel short, then `beaten`                                              | the point, then a run to the near corner and a knee slide (1.22 to 2.0); B runs over to him; A jumps | `cheer` |
| TRIVELA (`trivela`)  | struck with the outside of the boot (strike 0.5): it rises quickly, flattens and dips late, bending away from the keeper into the corner, its shadow swinging away from the camera and back (line 0.94)                                                                                                                        | `sprawl` a beat late: he dives where it was heading and it bends past his leading glove; a puff where he lands | a cool one: the flick of the follow-through held, then arms open; he stands and lets B come to him   | `cheer` |
| TOE POKE (`toepoke`) | scrappy: a heavy touch at the set runs away from him, he chases it as the keeper rushes out (16 px), stretches and toe-pokes it (strike 0.85, a puff of turf at his toe); scuffed along the grass past the gloves, a pixel's bobble now and then (line 1.12)                                                                   | rushing out, `stranded`, then `smother` a beat late with the ball squeezing past, `beaten` on the ground       | the stumble carries him on a pixel or two, then a fist pump                                          | `cheer` |
| TAP IN (`tapin`)     | set up close: he dribbles in (0.3 to 0.95) round the keeper on the near side and walks it in at walking pace past a keeper already on the ground (prod 1.075, line 1.63); a small bulge                                                                                                                                        | rushes out (14 px) and goes down at his feet (`smother` without the ball), beaten on the ground                | a modest goal: he points to whoever set him up; team-mates one jump                                  | `cheer` |
| MISS (`miss`)        | by turns, skied over the bar into the far side (tier 0: over the hedge), and dragged wide along the grass outside the near post, where it is left lying                                                                                                                                                                        | `ready`: he watches it go                                                                                      | hands on his head (`lift` 0), then `dejected`; team-mates slump, opponents celebrate                 | `groan` |
| TIME UP (`timeup`)   | never struck: it rolls a few pixels and stops; a whistle sign over the referee                                                                                                                                                                                                                                                 | relaxes                                                                                                        | hands on hips                                                                                        | `hush`  |
| PASSED (`skipped`)   | side-footed back to team-mate A, who knocks it back after                                                                                                                                                                                                                                                                      | relaxes                                                                                                        | shrug, back to idle                                                                                  | `idle`  |

Opponents slump after every goal. The child keeper of tiers 0 and 1 has no dives: he runs out
for the toe poke and the tap in, holds his arms out, and is `dejected` after a goal. The
shot's name and the points are shown by the DOM reveal sheet, not painted in the scene.

At the stadium tiers (4 to 7), every goal also sets off small fireworks over the stand, more
and bigger for the better shots: a tap in 2, a toe poke 3, a trivela 4, a golazo 5, a worldie
7, the biggest and highest (the product owner asked for this on 2026-11-11). Tiers 6 and 7 are
at night, where they show best.

A goal's ball stays in the net (by the hedge at tier 0), and a miss dragged wide stays where it
stopped, until the ground changes. A shot asked for while the last one's reaction is still
playing does not cut: everyone runs from where they are to where the new shot needs them (0.3
s), and he gets a new ball thrown on.

**Sound** (through `onSound`, `docs/API_SCENES.md`): a soft touch at the set and on each of the
tap in's dribbles, a kick at every strike with the power of the shot (a tap in 0.2, a toe poke
0.35, a golazo 0.75, a trivela 0.85, a worldie 1; the worldie's hook and cross 0.2 and 0.35, a
pass 0.15 and the ball knocked back 0.15), the wind while a hard shot is in the air, the shot's
`score` sting as it goes in or misses, a cheer sized by the shot (a tap in 0.2 up to a worldie
1; the engine sizes it to the ground), a groan for a skied miss and an ooh for one dragged
wide, the referee's whistle at time up, a faint far `firework` for each firework, one
vuvuzela 0.35 s after a worldie at the stadium tiers and never otherwise. While the player
types, the juggle is very quiet: every other touch, at level 0.15. As the page opens, the
`transition` (opening) as the iris starts and the referee's whistle as it is fully open; at
full time the long whistle, then the crowd. The bed (`ambience()`) is the park at tiers 0 and
1, a ground at 2 and 3, a stadium from 4, the crowd growing with the tier, night from the
light, and the tier itself.

## 5. Promotion

When the total crosses a tier line, he goes up: after the reveal, when the player presses the
next button, and before the next question appears (the clock does not run meanwhile).

- **HOME: the ball at the back of the net.** A wall of smoke sweeps across the far side and
  the pitch (0 to 0.5 s), with a big cloud in the middle of the screen. A hole opens in the
  cloud (0.24 to 0.34) onto a close-up of the back of a goal's net, the ground out of focus
  behind it, and the ball is driven in at us out of the goal (0.27 to 0.36): the net takes it
  in a pocket, the mesh stretched over its front and gathered round it in shadow, the diamonds
  around it pulled long and narrow towards it, the net giving and springing back while the
  ball still turns. A 1 px jolt as it hits. The smoke rolls back over it (0.72 to 0.86), the
  new ground goes in under cover (0.7), and the smoke clears in clumps (0.85 to 1.35) onto the
  new ground with a ripple of new crowd (1.12). About 1.5 s. (It was a crane and girders in
  builders' dust, then a goal with a ball spinning in it; the product owner asked for this
  close-up on 2026-11-12, after a photograph of a ball at the back of the net.)
- **AWAY: he travels** (a later milestone: a coach, a ferry, a plane crossing the screen). Until
  then AWAY uses the same.
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
