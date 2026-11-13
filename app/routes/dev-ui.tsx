// The interface gallery at /dev/ui: every component of the kit in every state, over a
// stand-in backdrop. Add ?only=<name> to show one composition full-screen, exactly as the
// game would, so it can be screenshotted:
//
//   node tools/shoot.mjs "http://localhost:5173/dev/ui?only=ask-home" .snaps/ui-ask-home-390.png
//
// ?only=parts shows the loose parts alone. docs/API_UI.md lists the names and shows how to
// shoot all of them at every size in one go.
//
// All text here is sample content for looking at the skin. It is not game copy.

import { type ReactNode, useState, useSyncExternalStore } from "react";

import {
  AnswerBar,
  type AnswerBarLabels,
  Board,
  type BoardLabels,
  Button,
  type ButtonVariant,
  FullTimeCard,
  GameLayout,
  HowToPlay,
  HowToPlayCard,
  IconButton,
  type IconName,
  type LeagueEntry,
  type LeagueRow,
  LeagueTable,
  type LeagueTableLabels,
  LedNumber,
  MenuCaptions,
  ModeBadge,
  Panel,
  Pip,
  Pips,
  PixelRoot,
  RevealSheet,
  type RevealYours,
  TierBar,
  TimerStrip,
  UI_GRADES,
  type UiGrade,
  type UiMode,
} from "~/ui";
import "~/ui/dev-gallery.css";
import type { Route } from "./+types/dev-ui";
import { howToPlayContent } from "./how-to-play-card";

export const meta: Route.MetaFunction = () => [
  { title: "Interface gallery · soccersense" },
  { name: "robots", content: "noindex" },
];

// --- sample content -------------------------------------------------------------------------

const MODE_LABEL: Record<UiMode, string> = {
  home: "HOME",
  away: "AWAY",
  retro: "RETRO",
  nextgen: "NEXT-GEN",
};

const GRADE_LABEL: Record<UiGrade, string> = {
  worldie: "WORLDIE!",
  golazo: "GOLAZO",
  trivela: "TRIVELA",
  toepoke: "TOE POKE",
  tapin: "TAP IN",
  miss: "MISS",
  timeup: "TIME'S UP",
  skipped: "PASSED",
};

/** A shot's name in the table and on the full-time card. */
const SHOT_LABEL: Record<UiGrade, string> = {
  worldie: "WORLDIE",
  golazo: "GOLAZO",
  trivela: "TRIVELA",
  toepoke: "TOE POKE",
  tapin: "TAP IN",
  miss: "MISS",
  timeup: "",
  skipped: "",
};

/** A table row's shot: its grade, its name and its points. */
function shot(grade: UiGrade, points: number) {
  return { grade, shot: SHOT_LABEL[grade], points };
}

const ANSWER_LABELS: AnswerBarLabels = {
  input: "Your answer",
  shoot: "SHOOT",
  pass: "PASS",
};

const TABLE_LABELS: LeagueTableLabels = {
  caption: "The table",
  rank: "#",
  answer: "ANSWER",
  distance: "PICKED",
  shot: "SHOT",
  points: "PTS",
  you: "YOU",
  gap: "Rows left out",
};

const REJECTION = "Not on the teamsheet. Try another.";

function boardLabels(mode: UiMode, n: number, seconds: number): BoardLabels {
  return {
    mode: MODE_LABEL[mode],
    questionOf: `Question ${n} of 7`,
    points: "PTS",
    timeLeft: `${seconds} seconds left`,
    board: "Scoreboard",
  };
}

interface AskSample {
  mode: UiMode;
  stadium: string;
  n: number;
  results: Array<UiGrade | null>;
  total: number;
  tier: string;
  tierProgress: number;
  question: string;
  instruction: string;
  measure: string;
  seconds: number;
  placeholder: string;
  typed?: string;
  rejection?: string;
  canPass?: boolean;
}

const ASK_HOME: AskSample = {
  mode: "home",
  stadium: "ANFIELD",
  n: 3,
  results: ["golazo", "trivela", null, null, null, null, null],
  total: 140,
  tier: "SUNDAY LEAGUE",
  tierProgress: 0.69,
  question: "Name a club that has won the European Cup or Champions League",
  instruction: "Closest to ANFIELD wins.",
  measure: "Measured by the club's home ground.",
  seconds: 22,
  placeholder: "Type a club",
};

const ASK_AWAY: AskSample = {
  mode: "away",
  stadium: "ANFIELD",
  n: 5,
  results: ["worldie", "toepoke", "miss", "trivela", null, null, null],
  total: 190,
  tier: "NON-LEAGUE",
  tierProgress: 0.91,
  question: "Name a player who has scored a Premier League goal",
  instruction: "Furthest from ANFIELD wins.",
  measure: "Measured by where the player was born.",
  seconds: 17,
  placeholder: "Type a player",
  typed: "Chris Wood",
};

const ASK_REJECT: AskSample = {
  ...ASK_HOME,
  n: 2,
  results: ["golazo", null, null, null, null, null, null],
  total: 80,
  tier: "PARK KICKABOUT",
  tierProgress: 0.97,
  question: "Name a manager who has won the Premier League",
  measure: "Measured by where the manager was born.",
  seconds: 19,
  placeholder: "Type a manager",
  typed: "Fergusson",
  rejection: REJECTION,
};

const ASK_PASS: AskSample = {
  ...ASK_AWAY,
  seconds: 14,
  typed: "",
  canPass: true,
};

const ASK_REJECT_PASS: AskSample = {
  ...ASK_REJECT,
  seconds: 11,
  typed: "Hakan Çalhanoğlu",
  canPass: true,
};

const ASK_LAST5: AskSample = {
  ...ASK_HOME,
  seconds: 4,
  typed: "Nottingham Forest",
  canPass: true,
};

// The longest strings the layout has to survive.
const ASK_LONG: AskSample = {
  mode: "away",
  stadium: "ESTADIO SANTIAGO BERNABÉU",
  n: 7,
  results: [
    "worldie",
    "worldie",
    "worldie",
    "worldie",
    "worldie",
    "worldie",
    null,
  ],
  total: 600,
  tier: "WORLD CUP FINAL",
  tierProgress: 0.67,
  question:
    "Name a stadium that has hosted a European Cup or Champions League final",
  instruction: "Furthest from ESTADIO SANTIAGO BERNABÉU wins.",
  measure: "Measured by where the stadium is.",
  seconds: 30,
  placeholder: "Type a stadium",
  typed: "Trent Alexander-Arnold",
  rejection: REJECTION,
  canPass: true,
};

/**
 * The reveal's five rows, one for each shot that scores, with the best answer of each (the
 * first of its shot in the full table: the most picked in HOME, the least picked in AWAY, so
 * the worldie row is #1): HOME from the European Cup winners, AWAY from the World Cup's top
 * scorers.
 */
const HOME_ROWS: readonly LeagueRow[] = [
  {
    rank: 1,
    name: "Real Madrid",
    place: "Spain",
    distance: "24%",
    ...shot("worldie", 100),
  },
  {
    rank: 3,
    name: "Liverpool",
    place: "England",
    distance: "11%",
    ...shot("golazo", 80),
  },
  {
    rank: 7,
    name: "Manchester City",
    place: "England",
    distance: "4.2%",
    ...shot("trivela", 60),
  },
  {
    rank: 11,
    name: "Juventus",
    place: "Italy",
    distance: "3%",
    ...shot("toepoke", 30),
  },
  {
    rank: 15,
    name: "Celtic",
    place: "Scotland",
    distance: "1%",
    ...shot("tapin", 10),
  },
];

const AWAY_ROWS: readonly LeagueRow[] = [
  {
    rank: 1,
    name: "Dražan Jerković",
    place: "Croatia",
    distance: "0.2%",
    ...shot("worldie", 100),
  },
  {
    rank: 4,
    name: "Flórián Albert",
    place: "Hungary",
    distance: "0.5%",
    ...shot("golazo", 80),
  },
  {
    rank: 8,
    name: "Guillermo Stábile",
    place: "Argentina",
    distance: "0.9%",
    ...shot("trivela", 60),
  },
  {
    rank: 13,
    name: "Vavá",
    place: "Brazil",
    distance: "1.2%",
    ...shot("toepoke", 30),
  },
  {
    rank: 18,
    name: "Davor Šuker",
    place: "Croatia",
    distance: "2.4%",
    ...shot("tapin", 10),
  },
];

/** The five rows with the player's answer in its own shot's row (or in none of them). */
function withYou(
  rows: readonly LeagueRow[],
  you: LeagueRow | null,
): LeagueEntry[] {
  return rows.map((row) =>
    you && row.grade === you.grade ? { ...you, you: true } : row,
  );
}

/** The player's answer above the table, when it did not score. */
function yoursLine(
  name: string | null,
  tag: string,
  picked?: string,
): RevealYours {
  return {
    you: "YOU",
    name: name ?? "NO ANSWER",
    picked,
    shot: tag,
    points: 0,
    spoken: name
      ? `Your answer: ${name}, picked by ${picked}. ${tag}, 0 points.`
      : `No answer: ${tag}, 0 points.`,
  };
}

const AWAY_REVEAL_ASK: AskSample = {
  ...ASK_AWAY,
  question: "Name a men's World Cup top scorer (Golden Boot winner)",
};

interface RevealSample {
  mode: UiMode;
  grade: UiGrade;
  points?: string;
  sentence: string;
  rows: LeagueEntry[];
  yours?: RevealYours;
  next: string;
  ask: AskSample;
  total: number;
  tier: string;
  tierProgress: number;
}

const REVEALS: Record<UiGrade, RevealSample> = {
  worldie: {
    mode: "away",
    grade: "worldie",
    points: "+100",
    sentence:
      "Dražan Jerković: only 0.2% of players went for that one. Nobody saw it coming. Worldie!",
    rows: withYou(AWAY_ROWS, {
      rank: 1,
      name: "Dražan Jerković",
      place: "Croatia",
      distance: "0.2%",
      ...shot("worldie", 100),
    }),
    next: "NEXT QUESTION",
    ask: AWAY_REVEAL_ASK,
    total: 362,
    tier: "TOP FLIGHT",
    tierProgress: 0.02,
  },
  golazo: {
    mode: "home",
    grade: "golazo",
    points: "+80",
    sentence:
      "Bayern Munich: about 8% of players said the same. Near the top of the crowd's list.",
    rows: withYou(HOME_ROWS, {
      rank: 5,
      name: "Bayern Munich",
      place: "Germany",
      distance: "8%",
      ...shot("golazo", 80),
    }),
    next: "NEXT QUESTION",
    ask: ASK_HOME,
    total: 247,
    tier: "NON-LEAGUE",
    tierProgress: 0.74,
  },
  trivela: {
    mode: "home",
    grade: "trivela",
    points: "+60",
    sentence:
      "Inter Milan: about 3.2% of players said the same. A good crowd pick.",
    rows: withYou(HOME_ROWS, {
      rank: 9,
      name: "Inter Milan",
      place: "Italy",
      distance: "3.2%",
      ...shot("trivela", 60),
    }),
    next: "NEXT QUESTION",
    ask: ASK_HOME,
    total: 213,
    tier: "NON-LEAGUE",
    tierProgress: 0.37,
  },
  toepoke: {
    mode: "home",
    grade: "toepoke",
    points: "+30",
    sentence:
      "Nottingham Forest: only 1.5% of players said the same. Some of the crowd were with you.",
    rows: withYou(HOME_ROWS, {
      rank: 14,
      name: "Nottingham Forest",
      place: "England",
      distance: "1.5%",
      ...shot("toepoke", 30),
    }),
    next: "NEXT QUESTION",
    ask: ASK_HOME,
    total: 207,
    tier: "NON-LEAGUE",
    tierProgress: 0.3,
  },
  tapin: {
    mode: "away",
    grade: "tapin",
    points: "+10",
    sentence:
      "Just Fontaine: about 2.6% of players went for that one. Plenty got there first.",
    rows: withYou(AWAY_ROWS, {
      rank: 19,
      name: "Just Fontaine",
      place: "Morocco",
      distance: "2.6%",
      ...shot("tapin", 10),
    }),
    next: "NEXT QUESTION",
    ask: AWAY_REVEAL_ASK,
    total: 200,
    tier: "NON-LEAGUE",
    tierProgress: 0.22,
  },
  miss: {
    mode: "away",
    grade: "miss",
    sentence:
      "Ronaldo: about 12% of players said the same. Right answer, but busy round here!",
    rows: withYou(AWAY_ROWS, null),
    yours: yoursLine("Ronaldo", "MISS", "12%"),
    next: "FULL TIME",
    ask: { ...AWAY_REVEAL_ASK, n: 7 },
    total: 262,
    tier: "NON-LEAGUE",
    tierProgress: 0.91,
  },
  timeup: {
    mode: "home",
    grade: "timeup",
    sentence:
      "The whistle went. The crowd's favourite was Real Madrid: about 24% of players said it.",
    rows: withYou(HOME_ROWS, null),
    yours: yoursLine(null, "TIME'S UP"),
    next: "NEXT QUESTION",
    ask: ASK_HOME,
    total: 152,
    tier: "SUNDAY LEAGUE",
    tierProgress: 0.69,
  },
  skipped: {
    mode: "away",
    grade: "skipped",
    sentence:
      "Passed. The deepest cut was Dražan Jerković: only 0.2% of players said it.",
    rows: withYou(AWAY_ROWS, null),
    yours: yoursLine(null, "PASSED"),
    next: "NEXT QUESTION",
    ask: AWAY_REVEAL_ASK,
    total: 262,
    tier: "NON-LEAGUE",
    tierProgress: 0.91,
  },
};

// --- stand-in backdrop ----------------------------------------------------------------------

function Backdrop({ kind }: { kind: "game" | "menu" }) {
  return (
    <div className="dev-backdrop" data-kind={kind} aria-hidden="true">
      <div className="dev-backdrop__sky" />
      <div className="dev-backdrop__stand" />
      <div className="dev-backdrop__grass" />
      {kind === "menu" && <div className="dev-backdrop__ball" />}
    </div>
  );
}

// --- compositions ---------------------------------------------------------------------------

function AskScreen({
  sample,
  contained,
}: {
  sample: AskSample;
  contained: boolean;
}) {
  const [value, setValue] = useState(sample.typed ?? "");
  const [rejections, setRejections] = useState(sample.rejection ? 1 : 0);
  return (
    <GameLayout
      contained={contained}
      canvas={<Backdrop kind="game" />}
      top={
        <Board
          mode={sample.mode}
          questionNumber={sample.n}
          questionCount={7}
          results={sample.results}
          total={sample.total}
          tierName={sample.tier}
          tierProgress={sample.tierProgress}
          question={sample.question}
          instruction={sample.instruction}
          measureLine={sample.measure}
          secondsLeft={sample.seconds}
          secondsTotal={30}
          labels={boardLabels(sample.mode, sample.n, sample.seconds)}
        />
      }
      bottom={
        <AnswerBar
          mode={sample.mode}
          value={value}
          onChange={setValue}
          onSubmit={() => setRejections((n) => n + 1)}
          onPass={() => setValue("")}
          canPass={sample.canPass}
          rejection={rejections > 0 ? REJECTION : null}
          shakeKey={rejections}
          placeholder={sample.placeholder}
          labels={ANSWER_LABELS}
        />
      }
    />
  );
}

function RevealScreen({
  sample,
  contained,
}: {
  sample: RevealSample;
  contained: boolean;
}) {
  const ask = sample.ask;
  const results = ask.results.slice();
  results[ask.n - 1] = sample.grade;
  return (
    <GameLayout
      contained={contained}
      canvas={<Backdrop kind="game" />}
      top={
        <Board
          compact
          mode={sample.mode}
          questionNumber={ask.n}
          questionCount={7}
          results={results}
          total={sample.total}
          tierName={sample.tier}
          tierProgress={sample.tierProgress}
          question={ask.question}
          instruction={ask.instruction}
          measureLine={ask.measure}
          secondsLeft={0}
          secondsTotal={30}
          labels={boardLabels(sample.mode, ask.n, 0)}
        />
      }
      bottom={
        <RevealSheet
          grade={sample.grade}
          mode={sample.mode}
          gradeLabel={GRADE_LABEL[sample.grade]}
          pointsLabel={sample.points}
          sentence={sample.sentence}
          rows={sample.rows}
          tableLabels={TABLE_LABELS}
          yours={sample.yours}
          nextLabel={sample.next}
          onNext={() => {}}
          focusNext={!contained}
        />
      }
    />
  );
}

function FullTimeScreen({
  contained,
  perfect = false,
}: {
  contained: boolean;
  perfect?: boolean;
}) {
  const [shared, setShared] = useState(false);
  return (
    <GameLayout
      contained={contained}
      canvas={<Backdrop kind="game" />}
      bottom={
        <FullTimeCard
          mode="home"
          heading="FULL TIME"
          total={perfect ? 700 : 478}
          maxTotal={700}
          totalSpoken={perfect ? "700 out of 700" : "478 out of 700"}
          careerTitle={perfect ? "WORLD CUP WINNER" : "INTERNATIONAL"}
          earnedTitle={perfect ? "THE HIVE MIND" : "SEASON TICKET HOLDER"}
          earnedTitleSpoken="Your title"
          perfectLine={perfect ? "PERFECT GAME" : undefined}
          results={(perfect
            ? [
                { grade: "worldie", points: 100, answer: "Liverpool" },
                { grade: "worldie", points: 100, answer: "Kenny Dalglish" },
                {
                  grade: "worldie",
                  points: 100,
                  answer: "Trent Alexander-Arnold",
                },
                { grade: "worldie", points: 100, answer: "Anfield" },
                { grade: "worldie", points: 100, answer: "Steven Gerrard" },
                { grade: "worldie", points: 100, answer: "Everton" },
                { grade: "worldie", points: 100, answer: "England" },
              ]
            : [
                { grade: "golazo", points: 80, answer: "Manchester United" },
                { grade: "trivela", points: 60, answer: "Hakan Çalhanoğlu" },
                {
                  grade: "worldie",
                  points: 100,
                  answer: "Trent Alexander-Arnold",
                },
                { grade: "timeup", points: 0, answer: "Time's up" },
                {
                  grade: "toepoke",
                  points: 30,
                  answer: "Olympique de Marseille",
                },
                { grade: "tapin", points: 10, answer: "Steaua București" },
                { grade: "golazo", points: 80, answer: "Sir Alex Ferguson" },
                // 80 + 60 + 100 + 0 + 30 + 10 + 80 = 360; the sample total is only for looks.
              ]
          ).map((result) => ({
            ...result,
            grade: result.grade as UiGrade,
            label: SHOT_LABEL[result.grade as UiGrade] || undefined,
          }))}
          shareLabel={shared ? "COPIED!" : "SHARE"}
          onShare={() => setShared(true)}
          otherLabel="AWAY"
          otherMode="away"
          onPlayOther={() => {}}
          menuLabel="MENU"
          onMenu={() => {}}
        />
      }
    />
  );
}

function MenuScreen({
  contained,
  played = false,
  notice = false,
}: {
  contained: boolean;
  played?: boolean;
  /** A locked patch was pressed and the pointer is over AWAY: the notice, and a lit card. */
  notice?: boolean;
}) {
  return (
    <GameLayout
      contained={contained}
      canvas={<Backdrop kind="menu" />}
      bottom={
        <MenuCaptions
          modes={[
            {
              mode: "home",
              label: "HOME",
              line: "Closest to the stadium wins",
              score: played ? 478 : null,
              scoreSpoken: "Played today: 478 points",
            },
            {
              mode: "away",
              label: "AWAY",
              line: "Furthest from it wins",
            },
          ]}
          onSelect={() => {}}
          lit={notice ? "away" : null}
          notice={notice ? "More modes are on their way to the ground." : null}
          howToPlay={{ label: "How to play", to: "/how-to-play" }}
          dayLabel="DAY 12"
        />
      }
    />
  );
}

/**
 * How to play, with the game's own words. Full-screen it is the pop-up over the menu
 * captions (close it and the "?" opens it again); in the overview's frames, where a modal
 * dialog would take over the whole gallery, it is the card alone.
 */
function HelpScreen({ contained }: { contained: boolean }) {
  const [open, setOpen] = useState(true);
  const [card] = useState(howToPlayContent);
  if (contained) {
    return (
      <GameLayout contained canvas={<Backdrop kind="menu" />}>
        <HowToPlayCard {...card} />
      </GameLayout>
    );
  }
  return (
    <GameLayout
      canvas={<Backdrop kind="menu" />}
      bottom={
        <MenuCaptions
          modes={[
            {
              mode: "home",
              label: "HOME",
              line: "The most common answer wins",
            },
            {
              mode: "away",
              label: "AWAY",
              line: "The most uncommon answer wins",
            },
          ]}
          onSelect={() => {}}
          howToPlay={{
            label: "How to play",
            onClick: () => setOpen(true),
            open,
          }}
          dayLabel="DAY 12"
        />
      }
    >
      <HowToPlay {...card} open={open} onClose={() => setOpen(false)} />
    </GameLayout>
  );
}

interface Composition {
  name: string;
  title: string;
  render: (contained: boolean) => ReactNode;
}

const COMPOSITIONS: readonly Composition[] = [
  {
    name: "ask-home",
    title: "Asking, HOME",
    render: (c) => <AskScreen sample={ASK_HOME} contained={c} />,
  },
  {
    name: "ask-away",
    title: "Asking, AWAY",
    render: (c) => <AskScreen sample={ASK_AWAY} contained={c} />,
  },
  {
    name: "ask-reject",
    title: "Rejected answer",
    render: (c) => <AskScreen sample={ASK_REJECT} contained={c} />,
  },
  {
    name: "ask-pass",
    title: "PASS available",
    render: (c) => <AskScreen sample={ASK_PASS} contained={c} />,
  },
  {
    name: "ask-reject-pass",
    title: "Rejected, PASS available",
    render: (c) => <AskScreen sample={ASK_REJECT_PASS} contained={c} />,
  },
  {
    name: "ask-last5",
    title: "Last five seconds",
    render: (c) => <AskScreen sample={ASK_LAST5} contained={c} />,
  },
  {
    name: "ask-long",
    title: "Longest strings",
    render: (c) => <AskScreen sample={ASK_LONG} contained={c} />,
  },
  ...UI_GRADES.map((grade): Composition => ({
    name: `reveal-${grade}`,
    title: `Reveal: ${GRADE_LABEL[grade]}`,
    render: (c) => <RevealScreen sample={REVEALS[grade]} contained={c} />,
  })),
  {
    name: "fulltime",
    title: "Full time",
    render: (c) => <FullTimeScreen contained={c} />,
  },
  {
    name: "fulltime-perfect",
    title: "Full time, perfect game",
    render: (c) => <FullTimeScreen contained={c} perfect />,
  },
  {
    name: "menu",
    title: "Menu captions",
    render: (c) => <MenuScreen contained={c} />,
  },
  {
    name: "menu-played",
    title: "Menu captions, HOME played",
    render: (c) => <MenuScreen contained={c} played />,
  },
  {
    name: "menu-notice",
    title: "Menu captions, a notice up and AWAY lit",
    render: (c) => <MenuScreen contained={c} notice />,
  },
  {
    name: "help",
    title: "How to play, over the menu",
    render: (c) => <HelpScreen contained={c} />,
  },
];

// --- the parts on their own -----------------------------------------------------------------

const VARIANTS: readonly ButtonVariant[] = [
  "primary",
  "mode",
  "secondary",
  "ghost",
];
const ICON_NAMES: readonly IconName[] = ["question", "back", "share", "close"];

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="dev-block">
      <h3 className="dev-block__title">{title}</h3>
      <div className="dev-block__body">{children}</div>
    </section>
  );
}

function Parts() {
  return (
    <div className="dev-parts">
      <Block title="Type">
        <p className="ss-t25">Jersey 25: +100 620/700</p>
        <p className="ss-t20">Jersey 20: FULL TIME, TOP BINS</p>
        <p className="ss-t15">
          Jersey 15: Name a club that has won the European Cup
        </p>
        <p className="ss-t10">
          Jersey 10: Hakan Çalhanoğlu was born in Mannheim, 540 miles from
          Anfield.
        </p>
      </Block>

      <Block title="Buttons: rest, pressed, focus, disabled">
        {VARIANTS.map((variant) => (
          <div key={variant} className="dev-row">
            <Button variant={variant} mode="home">
              {variant === "mode" ? "SHOOT" : variant.toUpperCase()}
            </Button>
            <Button variant={variant} mode="home" forceState="pressed">
              PRESSED
            </Button>
            <Button variant={variant} mode="home" forceState="focus">
              FOCUS
            </Button>
            <Button variant={variant} mode="home" disabled>
              OFF
            </Button>
          </div>
        ))}
        <div className="dev-row">
          <Button variant="mode" mode="away">
            SHOOT
          </Button>
          <Button variant="mode" mode="away" forceState="pressed">
            PRESSED
          </Button>
          <Button variant="mode" mode="away" forceState="focus">
            FOCUS
          </Button>
        </div>
        <Button variant="mode" mode="home" full>
          NEXT QUESTION
        </Button>
        <Button variant="primary" full>
          SHARE
        </Button>
      </Block>

      <Block title="Icon buttons and badges">
        <div className="dev-row">
          {ICON_NAMES.map((icon) => (
            <IconButton key={icon} icon={icon} label={icon} />
          ))}
          <IconButton icon="question" label="pressed" forceState="pressed" />
          <IconButton icon="close" label="focus" forceState="focus" />
          <IconButton icon="share" label="off" disabled />
        </div>
        <div className="dev-row">
          <IconButton icon="share" label="share" variant="primary" />
          <IconButton icon="back" label="back" variant="mode" mode="home" />
          <IconButton icon="back" label="back" variant="mode" mode="away" />
          <IconButton icon="close" label="close" variant="ghost" />
        </div>
        <div className="dev-row">
          <ModeBadge mode="home" label="HOME" />
          <ModeBadge mode="away" label="AWAY" />
        </div>
      </Block>

      <Block title="Panels">
        <Panel>
          <p>Bolted frame. The board and the answer bar are made of this.</p>
        </Panel>
        <Panel variant="plain">
          <p>Plain plate, for small captions.</p>
        </Panel>
      </Block>

      <Block title="LED numbers">
        <div className="dev-row">
          <LedNumber value={347} digits={3} />
          <LedNumber value={7} digits={3} />
          <LedNumber value={700} tone="gold" />
          <LedNumber value={4} digits={2} tone="red" />
          <LedNumber value="+87" tone="green" />
          <LedNumber value="0123456789" tone="chalk" />
        </div>
        <div className="dev-row">
          <LedNumber value="478/700" size="lg" />
        </div>
        <div className="dev-row">
          <LedNumber value="700/700" size="lg" tone="gold" />
        </div>
        <div className="dev-row">
          <LedNumber value={22} digits={2} bare label="" />
          <LedNumber value={4} digits={2} tone="red" bare label="" />
          <LedNumber value="+-:/" tone="chalk" />
        </div>
      </Block>

      <Block title="Result lamps">
        <div className="dev-row">
          {UI_GRADES.map((grade) => (
            <Pip key={grade} grade={grade} />
          ))}
          <Pip grade={null} state="current" />
          <Pip grade={null} />
        </div>
        <div className="dev-row">
          <Pips
            results={["worldie", "golazo", "trivela", null, null, null, null]}
            current={3}
            label="Question 4 of 7"
          />
        </div>
        <div className="dev-row">
          <Pips
            results={[
              "toepoke",
              "tapin",
              "miss",
              "timeup",
              "skipped",
              "golazo",
              "worldie",
            ]}
            label="All answered"
          />
        </div>
      </Block>

      <Block title="Career tier">
        <TierBar name="PARK KICKABOUT" progress={0} />
        <TierBar name="SUNDAY LEAGUE" progress={0.03} />
        <TierBar name="LOWER LEAGUES" progress={0.5} />
        <TierBar name="WORLD CUP WINNER" progress={1} />
      </Block>

      <Block title="Clock">
        <TimerStrip secondsLeft={30} secondsTotal={30} />
        <TimerStrip secondsLeft={17} secondsTotal={30} />
        <TimerStrip secondsLeft={5} secondsTotal={30} />
        <TimerStrip secondsLeft={1} secondsTotal={30} />
        <TimerStrip secondsLeft={0} secondsTotal={30} />
        <TimerStrip secondsLeft={31} secondsTotal={45} hideSeconds />
      </Block>

      <Block title="Answer bar: empty, rejected, judging">
        <div className="dev-answer">
          <AnswerBar
            mode="home"
            value=""
            onChange={() => {}}
            onSubmit={() => {}}
            placeholder="Type a manager"
            labels={ANSWER_LABELS}
          />
        </div>
        <div className="dev-answer dev-answer--tall">
          <AnswerBar
            mode="away"
            value="Fergusson"
            onChange={() => {}}
            onSubmit={() => {}}
            onPass={() => {}}
            canPass
            rejection={REJECTION}
            shakeKey={0}
            labels={ANSWER_LABELS}
          />
        </div>
        <div className="dev-answer">
          <AnswerBar
            mode="home"
            value="Sir Alex Ferguson"
            onChange={() => {}}
            onSubmit={() => {}}
            busy
            labels={ANSWER_LABELS}
          />
        </div>
      </Block>

      <Block title="Menu captions: as buttons, as plain captions">
        <MenuCaptions
          modes={[
            {
              mode: "home",
              label: "HOME",
              line: "Closest to the stadium wins",
            },
            { mode: "away", label: "AWAY", line: "Furthest from it wins" },
          ]}
          onSelect={() => {}}
          howToPlay={{ label: "How to play", to: "/how-to-play" }}
          dayLabel="DAY 1"
        />
        <MenuCaptions
          modes={[
            {
              mode: "home",
              label: "HOME",
              line: "Closest to the stadium wins",
              score: 478,
              scoreSpoken: "Played today: 478 points",
            },
            {
              mode: "away",
              label: "AWAY",
              line: "Furthest from it wins",
              score: 700,
              scoreSpoken: "Played today: 700 points",
            },
          ]}
          howToPlay={{ label: "How to play", onClick: () => {} }}
          dayLabel="DAY 365"
        />
      </Block>

      <Block title="Menu captions: a notice, and AWAY lit from the ball">
        <div className="dev-answer--tall">
          <MenuCaptions
            modes={[
              {
                mode: "home",
                label: "HOME",
                line: "Closest to the stadium wins",
              },
              { mode: "away", label: "AWAY", line: "Furthest from it wins" },
            ]}
            onSelect={() => {}}
            lit="away"
            notice="More modes are on their way."
            howToPlay={{ label: "How to play", to: "/how-to-play" }}
            dayLabel="DAY 1"
          />
        </div>
      </Block>

      <Block title="League table">
        <div className="dev-table" data-mode="home">
          <LeagueTable
            rows={withYou(HOME_ROWS, HOME_ROWS[2])}
            labels={TABLE_LABELS}
            followYou={false}
          />
        </div>
        <div className="dev-table" data-mode="away">
          <LeagueTable
            rows={withYou(AWAY_ROWS, AWAY_ROWS[0])}
            labels={TABLE_LABELS}
            followYou={false}
          />
        </div>
      </Block>
    </div>
  );
}

// --- the page -------------------------------------------------------------------------------

function subscribeToNothing(): () => void {
  return () => {};
}

function readSearch(): string {
  return window.location.search;
}

function serverSearch(): null {
  return null;
}

export default function DevUi() {
  // The query string is only known in the browser. `null` is the build-time render.
  const search = useSyncExternalStore(
    subscribeToNothing,
    readSearch,
    serverSearch,
  );
  const params = new URLSearchParams(search ?? "");
  if (search === null) return <div className="dev-blank" />;

  const only = params.get("only");
  if (only === "parts") {
    return (
      <PixelRoot className="dev-gallery">
        <Parts />
      </PixelRoot>
    );
  }
  const single = COMPOSITIONS.find((c) => c.name === only);
  if (single) return <>{single.render(false)}</>;

  return (
    <PixelRoot className="dev-gallery">
      <header className="dev-header">
        <h1 className="ss-t20">Interface gallery</h1>
        <p>
          Every part of the kit over a stand-in backdrop. Open one full-screen
          with <code>?only=name</code>.
        </p>
        <nav className="dev-nav" aria-label="Compositions">
          {COMPOSITIONS.map((c) => (
            <a key={c.name} href={`?only=${c.name}`}>
              {c.name}
            </a>
          ))}
          <a href="?only=parts">parts</a>
        </nav>
        {only && (
          <p className="dev-warning">No composition is called {only}.</p>
        )}
      </header>
      <h2 className="dev-heading ss-t15">Screens</h2>
      <div className="dev-frames">
        {COMPOSITIONS.map((c) => (
          <figure key={c.name} className="dev-frame">
            <figcaption>
              <a href={`?only=${c.name}`}>{c.name}</a> {c.title}
            </figcaption>
            <div className="dev-frame__screen">{c.render(true)}</div>
          </figure>
        ))}
      </div>
      <h2 className="dev-heading ss-t15">Parts</h2>
      <Parts />
    </PixelRoot>
  );
}
