// SHARE on the home screen: a mode played today, shared as its full-time card shares it
// (./play/share-flow.ts): the same picture and the same text, from the game saved then.
//
// The system share sheet opens only straight after a press (the browser's rule), so the
// picture is made ahead, in quiet moments (`prepare`), as the full-time card does: by the
// time SHARE is pressed it is usually ready. Browser only: call it from effects and
// handlers.

import { questionsFor } from "~/data";
import {
  type Mode,
  type StorageLike,
  type Today,
  buildShareText,
  loadGame,
  shareCardFor,
  shareInputFor,
} from "~/game";
import { strings } from "~/i18n";
import { modeName, tierName, titleName } from "./play/names";
import { finishedSession } from "./play/progress";
import { type ShareOutcome, deliverShare } from "./play/share-flow";
import {
  type ShareKit,
  browserShareKit,
  shareCardPicture,
} from "./play/share-image";

/** One played game, ready to share: its text and names, and its picture once made. */
interface Prepared {
  text: string;
  fileName: string;
  title: string;
  /** The PNG being made, or null where no picture can be made here. */
  image: Promise<Blob | null> | null;
  ready: boolean;
  /** The PNG once made (null: none could be). */
  blob: Blob | null;
}

export interface TodayShare {
  /**
   * Start making the picture of today's game in `mode`, if it has been played (once per day
   * and mode). Resolves when it is made; null if there is no game to share.
   */
  prepare(today: Today, mode: Mode): Promise<void> | null;
  /**
   * Share it, waiting for the picture if it is still being made. Null if it has not been
   * played.
   */
  share(today: Today, mode: Mode): Promise<ShareOutcome> | null;
  /** Its picture is made (or none can be): SHARE needs no wait. */
  ready(today: Today, mode: Mode): boolean;
}

export interface TodayShareOptions {
  /** The browser's side of SHARE. Default: the real one. */
  kit?: ShareKit;
  /** Omit for `localStorage`; null for none. */
  storage?: StorageLike | null;
  /** `Date.now`, unless a test says otherwise. */
  clock?: () => number;
}

export function createTodayShare({
  kit = browserShareKit(),
  storage,
  clock = () => Date.now(),
}: TodayShareOptions = {}): TodayShare {
  const games = new Map<string, Prepared>();

  const prepared = (today: Today, mode: Mode): Prepared | null => {
    const key = `${today.dayKey}:${mode}`;
    const known = games.get(key);
    if (known) return known;
    const done = loadGame(today.dayKey, mode, storage);
    if (!done) return null;
    const session = finishedSession(
      {
        mode,
        dayNumber: today.dayNumber,
        stadium: today.stadium,
        questions: questionsFor(mode),
      },
      done.turns,
      clock(),
    );
    if (!session) return null;
    const tier = tierName(session.total);
    const title = titleName(mode, session.total);
    const words = strings.play.fullTime.image;
    const game: Prepared = {
      text: buildShareText(shareInputFor(session, tier, title, modeName(mode))),
      fileName: words.fileName(session.dayNumber, mode),
      title: words.title(session.dayNumber, modeName(mode)),
      image: null,
      ready: true,
      blob: null,
    };
    if (kit.canMakeImage()) {
      let made: Promise<Blob | null>;
      try {
        made = kit.makeImage(
          shareCardPicture(shareCardFor(session), title, tier),
        );
      } catch {
        made = Promise.resolve(null);
      }
      game.ready = false;
      game.image = made
        .catch(() => null)
        .then((blob) => {
          game.ready = true;
          game.blob = blob;
          return blob;
        });
    }
    games.set(key, game);
    return game;
  };

  return {
    prepare(today, mode) {
      const game = prepared(today, mode);
      if (!game) return null;
      return (game.image ?? Promise.resolve(null)).then(() => undefined);
    },
    share(today, mode) {
      const game = prepared(today, mode);
      if (!game) return null;
      const send = (blob: Blob | null) =>
        deliverShare(kit, kit.copy, {
          text: game.text,
          blob,
          fileName: game.fileName,
          title: game.title,
        });
      // Ready: at once, in the press itself, or the share sheet may not open.
      if (game.ready || !game.image) return send(game.blob);
      return game.image.then(send);
    },
    ready: (today, mode) => {
      const game = games.get(`${today.dayKey}:${mode}`);
      return game ? game.ready : false;
    },
  };
}
