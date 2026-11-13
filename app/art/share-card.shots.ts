/**
 * The share image, as SHARE makes it, from the demo's own questions:
 *
 *   ./node_modules/.bin/tsx tools/snap.ts share/home --scale 3 --out .snaps/x.png
 *
 * `share/home` and `share/away` mix every shot with the longest answers and questions in
 * app/data; `share/retro` and `share/nextgen` the same in the era modes (each answer's
 * year beside it); `share/perfect` is a 700, `share/misses` a 0 (misses, passes and
 * time-ups); `share/sheet` all six side by side at one pixel each. Each returns its own size: give
 * `--scale 3` for the shared size (1080 x 1350).
 */

import { questionsFor } from "~/data";
import {
  type Grade,
  type Mode,
  type Question,
  type ShareCard,
  SHOT_POINTS,
  careerFor,
  isShot,
  rankingYear,
  ruleFor,
  titleFor,
} from "~/game";
import { strings } from "~/i18n";
import { Surface, type ShotMap } from "~/pixel";
import { shareCardPicture } from "~/routes/play/share-image";
import { P } from "./palette";
import { SHARE_CARD, paintShareCard } from "./share-card";

/** A row: the answer of that shot with the longest name (no answer for a pass or time-up). */
function row(question: Question, grade: Grade) {
  const named = isShot(grade)
    ? question.answers
        .filter((a) => a.shot === grade)
        .sort((a, b) => b.name.length - a.name.length)[0]
    : undefined;
  return {
    prompt: question.prompt,
    answer: named?.name ?? null,
    year: named ? rankingYear(named, ruleFor(question.mode)) : null,
    grade: named ? grade : isShot(grade) ? "skipped" : grade,
    points: named && isShot(grade) ? SHOT_POINTS[grade] : 0,
  } as const;
}

function card(mode: Mode, grades: readonly Grade[], day = 12): ShareCard {
  const questions = questionsFor(mode);
  const rows = questions.map((q, i) => row(q, grades[i] ?? "skipped"));
  const total = rows.reduce((sum, r) => sum + r.points, 0);
  return {
    dayNumber: day,
    mode,
    stadiumName: "Estádio do Maracanã",
    total,
    maxTotal: 700,
    rows: rows.map((r) => ({ ...r })),
  };
}

function paint(c: ShareCard): Surface {
  const titles: Readonly<Record<string, string>> = strings.play.titles[c.mode];
  const title = titles[titleFor(c.mode, c.total)] ?? "";
  const tier = strings.play.tiers[careerFor(c.total).id];
  return paintShareCard(shareCardPicture(c, title, tier));
}

const HOME: Grade[] = [
  "worldie",
  "golazo",
  "trivela",
  "toepoke",
  "tapin",
  "miss",
  "golazo",
];
const AWAY: Grade[] = [
  "golazo",
  "worldie",
  "skipped",
  "trivela",
  "timeup",
  "toepoke",
  "worldie",
];
/** RETRO's third row is the FA Cup's longest golazo, Wolverhampton Wanderers: its year goes up. */
const RETRO: Grade[] = [
  "worldie",
  "golazo",
  "golazo",
  "toepoke",
  "tapin",
  "miss",
  "trivela",
];
const PERFECT: Grade[] = Array<Grade>(7).fill("worldie");
const MISSES: Grade[] = [
  "miss",
  "skipped",
  "timeup",
  "miss",
  "timeup",
  "skipped",
  "miss",
];

export const shots: ShotMap = {
  "share/home": () => paint(card("home", HOME)),
  "share/away": () => paint(card("away", AWAY, 128)),
  "share/retro": () => paint(card("retro", RETRO, 5)),
  "share/nextgen": () => paint(card("nextgen", AWAY, 6)),
  "share/perfect": () => paint(card("home", PERFECT, 3)),
  "share/misses": () => paint(card("away", MISSES, 4)),
  "share/sheet": () => {
    const cards = [
      card("home", HOME),
      card("away", AWAY, 128),
      card("retro", RETRO, 5),
      card("nextgen", AWAY, 6),
      card("home", PERFECT, 3),
      card("away", MISSES, 4),
    ].map(paint);
    const gap = 8;
    const out = new Surface(
      (SHARE_CARD.w + gap) * cards.length + gap,
      SHARE_CARD.h + gap * 2,
    );
    out.clear(P.slate);
    cards.forEach((c, i) => out.copy(c, gap + i * (SHARE_CARD.w + gap), gap));
    return out;
  },
};
