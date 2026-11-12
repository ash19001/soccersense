# Sound sources

The original recordings the game's sounds are cut from, kept untouched. This folder is not
served and not in the build: the game plays the processed files in `public/sounds/`, which
`node tools/sounds.mjs` makes from these (the cuts, filters and fades are written down there;
see "The recordings in use" in `docs/AUDIO.md`).

| file                    | what it is                                                                                               | becomes                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `ball_sound.mp3`        | a ball bouncing, ten times over 14 s, each with a small second bounce                                    | `touch-1.mp3`, `touch-2.mp3`, `touch-3.mp3`, `land.mp3` |
| `button_click.mp3`      | a button click (48 ms)                                                                                   | `click.mp3`                                             |
| `clapping.mp3`          | a few people clapping in a room, about ten claps a second, 13.8 s (24 kHz stereo, a low rumble under it) | `claps.mp3`                                             |
| `firework_pop.mp3`      | a firework's pop and its crackle (1.4 s)                                                                 | `firework.mp3`, `firework-far.mp3`                      |
| `football_hits_net.mp3` | a ball kicked into a net: the kick, the net taking it, the ball dropping                                 | `net.mp3`                                               |
| `kick_ball.mp3`         | a ball being kicked, with wind on the microphone (0.8 s)                                                 | `kick.mp3`                                              |
| `star_sparkle.mp3`      | a magical sparkle: two chimes and a long ringing tail (4.1 s, silent after 1.5 s)                        | `sparkle.mp3`                                           |
| `vuvuzela.mp3`          | one vuvuzela (233 Hz, a B flat) blowing five toots in a room (5.2 s)                                     | `vuvuzela.mp3`, `vuvuzela-crowd.mp3`                    |

Supplied by the product owner on 2026-11-12 (the first five in the morning; `clapping.mp3`,
`star_sparkle.mp3` and `vuvuzela.mp3` later that day, put straight into `public/sounds/` and
moved here: a file there plays as it is). Their original source and licence are to be
recorded in `public/sounds/CREDITS.md`.
