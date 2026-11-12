// The game's referee: one per game page. It holds the session (the rules in `~/game`),
// runs the clock, tells the career scene what to play, waits for it, saves the game as it
// goes and copies the share text. React only reads it (`subscribe` and `read`, for
// `useSyncExternalStore`) and calls its handlers.
//
// Browser only: it is made after mounting, and it reads the clock and sets timers.
//
// The flow (docs/GAME_DESIGN.md sections 3 to 6):
//   asking     the clock runs. An answer the judge does not know shakes the bar (the
//              clock runs on); one it knows, PASS, or the clock running out ends the turn.
//   resolving  the clock has stopped and the shot plays (`scene.playShot(grade)`).
//   reveal     the sheet. NEXT: if the total crossed a tier line, the promotion plays first
//              (`scene.promote(total)`, no clock meanwhile), then the next question.
//   done       full time: the card, `scene.showFullTime(total)`, the game saved for the menu.
//
// The scene answers by calling back. If it never does (no canvas, the tab hidden, the
// scene stopped by an error), the game moves on by itself after a while, so it can never
// be stuck; a late answer from the scene is then ignored.

import {
  MAX_TOTAL,
  type Mode,
  type Session,
  type StorageLike,
  type Today,
  buildShareText,
  careerFor,
  clockView,
  createSession,
  dayKeyFor,
  isLastQuestion,
  loadGame,
  progressFor,
  reduce,
  saveSession,
  shareInputFor,
  titleFor,
} from "~/game";
import { questionsFor } from "~/data";
import { strings } from "~/i18n";
import { CareerScene } from "~/scenes/career";
import {
  type LiveContext,
  clearLive,
  finishedSession,
  loadLive,
  saveLive,
} from "./progress";

/** How often the clock is looked at while a question is asked. */
export const TICK_MS = 100;
/** A shot that has not reported back after this long is taken as played. */
export const SHOT_PATIENCE_MS = 5000;
/** The same for a promotion. */
export const PROMOTION_PATIENCE_MS = 4000;
/** How long SHARE shows that it copied (or could not). */
export const SHARE_LABEL_MS = 2500;

export type ShareState = "idle" | "copied" | "failed";

/** What the page draws from. A new object whenever anything on screen should change. */
export interface GameView {
  session: Session;
  /** The time the clock was last read at (for the board's clock and PASS). */
  now: number;
  /** A promotion is playing: the sheet has gone and the next question waits. */
  promoting: boolean;
  /** How many answers the judge has turned down this game: the bar's shake. */
  rejections: number;
  share: ShareState;
  /** The last thing to read out that no component says itself (a promotion, full time). */
  announcement: string;
}

export interface GameOptions {
  mode: Session["mode"];
  today: Today;
  /** `Date.now`, unless a test says otherwise. */
  clock?: () => number;
  /** Omit for `localStorage`; null for none. */
  storage?: StorageLike | null;
  /** Show today's finished game again (a reload at full time) instead of a new one. */
  restoreFullTime?: boolean;
  /** The player's language, for miles or kilometres. Default "en-GB". */
  locale?: string;
  /** Copies the share text. Default: the browser's clipboard. */
  copy?: (text: string) => Promise<void>;
}

/** The tier's name, as the board and the card show it. */
export function tierName(total: number): string {
  return strings.play.tiers[careerFor(total).id];
}

/** The title a total earned in a mode, as the full-time card and the share text show it. */
export function titleName(mode: Mode, total: number): string {
  return mode === "home"
    ? strings.play.titles.home[titleFor("home", total)]
    : strings.play.titles.away[titleFor("away", total)];
}

function copyToClipboard(text: string): Promise<void> {
  const clipboard = globalThis.navigator?.clipboard;
  if (!clipboard?.writeText) {
    return Promise.reject(new Error("No clipboard here"));
  }
  return clipboard.writeText(text);
}

export class GameController {
  readonly scene: CareerScene;
  /** The player's language, for miles or kilometres. */
  readonly locale: string;
  private readonly clock: () => number;
  private readonly storage: StorageLike | null | undefined;
  private readonly copy: (text: string) => Promise<void>;
  private view: GameView;
  private readonly listeners = new Set<() => void>();
  private ticker: ReturnType<typeof setInterval> | null = null;
  private patience: ReturnType<typeof setTimeout> | null = null;
  private shareTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped whenever the game stops waiting for the scene: a late call back is ignored. */
  private waitToken = 0;
  private started = false;
  private disposed = false;

  constructor(options: GameOptions) {
    const { mode, today } = options;
    this.clock = options.clock ?? (() => Date.now());
    this.storage = options.storage;
    this.copy = options.copy ?? copyToClipboard;
    this.locale = options.locale ?? "en-GB";
    const context: LiveContext = {
      mode,
      dayNumber: today.dayNumber,
      stadium: today.stadium,
      questions: questionsFor(mode),
    };
    const now = this.clock();

    let session: Session | null = null;
    if (options.restoreFullTime) {
      const done = loadGame(today.dayKey, mode, this.storage);
      if (done) session = finishedSession(context, done.turns, now);
    }
    session ??= loadLive(context, this.storage);
    session ??= createSession({
      ...context,
      now,
      noTimer: today.noTimer,
    });

    this.scene = new CareerScene({
      seed: today.dayNumber,
      mode,
      labels: strings.play.canvas,
    });
    if (session.phase === "done") {
      this.scene.showFullTime(session.total);
    } else if (session.phase === "reveal") {
      // A promotion this turn earned has not been played yet: it plays on NEXT.
      this.scene.setTotal(progressFor(session).totalBefore);
    } else {
      this.scene.setTotal(session.total);
    }

    this.view = {
      session,
      now,
      promoting: false,
      rejections: 0,
      share: "idle",
      announcement: "",
    };
  }

  // --- for useSyncExternalStore -------------------------------------------------------

  subscribe = (onChange: () => void): (() => void) => {
    this.listeners.add(onChange);
    return () => this.listeners.delete(onChange);
  };

  read = (): GameView => this.view;

  private set(change: Partial<GameView>): void {
    this.view = { ...this.view, ...change };
    for (const listener of this.listeners) listener();
  }

  // --- life ---------------------------------------------------------------------------

  /** Start the clock (or carry on a saved game's). Safe to call more than once. */
  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    const { session } = this.view;
    if (session.phase === "asking") {
      saveLive(session, this.storage);
      this.startClock();
      this.tick();
    }
  }

  /** Stop every timer and stop listening to the scene. The page is going. */
  dispose(): void {
    this.disposed = true;
    this.waitToken++;
    this.stopClock();
    this.clearPatience();
    if (this.shareTimer !== null) clearTimeout(this.shareTimer);
    this.shareTimer = null;
    this.listeners.clear();
  }

  // --- the player's moves -------------------------------------------------------------

  submit = (input: string): void => {
    const { session } = this.view;
    const next = reduce(session, { type: "submit", input, now: this.clock() });
    if (next === session) return;
    if (next.phase === "resolving") {
      this.shoot(next);
    } else {
      this.set({
        session: next,
        now: this.clock(),
        rejections: this.view.rejections + 1,
      });
    }
  };

  pass = (): void => {
    const { session } = this.view;
    const next = reduce(session, { type: "pass", now: this.clock() });
    if (next !== session && next.phase === "resolving") this.shoot(next);
  };

  /** NEXT QUESTION or FULL TIME on the reveal sheet. */
  next = (): void => {
    const { session, promoting } = this.view;
    if (session.phase !== "reveal" || promoting || this.disposed) return;

    if (isLastQuestion(session)) {
      const done = reduce(session, { type: "next", now: this.clock() });
      saveSession(done, this.storage);
      clearLive(dayKeyFor(done.dayNumber), done.mode, this.storage);
      this.scene.showFullTime(done.total);
      this.set({
        session: done,
        announcement: strings.play.fullTime.spoken(
          done.total,
          MAX_TOTAL,
          titleName(done.mode, done.total),
          tierName(done.total),
        ),
      });
      return;
    }

    const progress = progressFor(session);
    if (progress.promotions.length === 0) {
      this.advance();
      return;
    }
    const token = ++this.waitToken;
    this.set({
      promoting: true,
      announcement: strings.play.promoted(tierName(session.total)),
    });
    this.patience = setTimeout(
      () => this.promoted(token),
      PROMOTION_PATIENCE_MS,
    );
    this.scene.promote(session.total, () => this.promoted(token));
  };

  share = (): void => {
    const { session } = this.view;
    if (session.phase !== "done") return;
    const text = buildShareText(
      shareInputFor(
        session,
        tierName(session.total),
        titleName(session.mode, session.total),
      ),
    );
    const settle = (state: ShareState) => {
      if (this.disposed) return;
      if (this.shareTimer !== null) clearTimeout(this.shareTimer);
      this.set({
        share: state,
        announcement:
          state === "copied"
            ? strings.play.fullTime.copiedSpoken
            : strings.play.fullTime.notCopiedSpoken,
      });
      this.shareTimer = setTimeout(() => {
        this.shareTimer = null;
        this.set({ share: "idle" });
      }, SHARE_LABEL_MS);
    };
    let copying: Promise<void>;
    try {
      copying = this.copy(text);
    } catch (error) {
      copying = Promise.reject(error);
    }
    copying.then(
      () => settle("copied"),
      () => settle("failed"),
    );
  };

  // --- the flow -----------------------------------------------------------------------

  /** An answer, a pass or the clock has ended the turn: the shot plays. */
  private shoot(session: Session): void {
    this.stopClock();
    saveLive(session, this.storage);
    const token = ++this.waitToken;
    this.set({ session, now: this.clock() });
    const grade = session.turns[session.index].grade;
    this.patience = setTimeout(() => this.resolved(token), SHOT_PATIENCE_MS);
    this.scene.playShot(grade, () => this.resolved(token));
  }

  private resolved(token: number): void {
    if (token !== this.waitToken || this.disposed) return;
    this.waitToken++;
    this.clearPatience();
    const session = reduce(this.view.session, { type: "resolved" });
    saveLive(session, this.storage);
    this.set({ session });
  }

  private promoted(token: number): void {
    if (token !== this.waitToken || this.disposed) return;
    this.waitToken++;
    this.clearPatience();
    this.advance();
  }

  /** On to the next question, with a fresh clock from now. */
  private advance(): void {
    const now = this.clock();
    const session = reduce(this.view.session, { type: "next", now });
    saveLive(session, this.storage);
    this.set({ session, now, promoting: false });
    this.startClock();
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = this.clock();
    const { session } = this.view;
    const next = reduce(session, { type: "tick", now });
    if (next !== session) {
      this.shoot(next);
      return;
    }
    // Only tell the page when something it shows has changed.
    const before = clockView(session, this.view.now);
    const after = clockView(session, now);
    if (
      before.secondsLeft !== after.secondsLeft ||
      before.canPass !== after.canPass
    ) {
      this.set({ now });
    }
  };

  private startClock(): void {
    this.stopClock();
    if (this.disposed || this.view.session.phase !== "asking") return;
    this.ticker = setInterval(this.tick, TICK_MS);
  }

  private stopClock(): void {
    if (this.ticker !== null) clearInterval(this.ticker);
    this.ticker = null;
  }

  private clearPatience(): void {
    if (this.patience !== null) clearTimeout(this.patience);
    this.patience = null;
  }
}
