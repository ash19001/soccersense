// SHARE with a picture: the words for the share image, and the browser's side of sharing
// it. The picture is painted by `paintShareCard` (~/art/share-card) from what the game says
// (`shareCardFor` in ~/game) and the interface text. The controller decides what SHARE does
// (./controller.ts); this does the browser's part of each step, so tests can swap it.
//
// Browser only past `shareCardPicture`: every function of `browserShareKit()` touches the
// page, and is called from an event handler or a timer, never during render.

import {
  SHARE_CARD,
  paintShareCard,
  scaleSurface,
  type ShareCardPicture,
} from "~/art/share-card";
import { type Grade, type ShareCard, isPerfect, isShot } from "~/game";
import { strings } from "~/i18n";

/** The tag's word for a row: the shot's name, or PASSED or TIME'S UP. */
function tagFor(grade: Grade): string {
  if (isShot(grade)) return strings.play.shots[grade];
  return grade === "timeup"
    ? strings.play.yours.timeup
    : strings.play.yours.skipped;
}

/**
 * Everything the share image says, worded: the card's content from the game, `title` the
 * title the total earned and `tier` the career tier, as the full-time card shows them.
 */
export function shareCardPicture(
  card: ShareCard,
  title: string,
  tier: string,
): ShareCardPicture {
  const words = strings.play.fullTime;
  return {
    mode: card.mode,
    modeLabel: strings.home.modes[card.mode].label,
    dayLabel: strings.home.day(card.dayNumber),
    stadium: card.stadiumName,
    lines: card.rows.map((row) => ({
      prompt: words.image.prompt(row.prompt),
      answer: row.answer,
      ...(row.year !== null && row.answer !== null
        ? { year: String(row.year) }
        : {}),
      grade: row.grade,
      points: row.points,
      tag: tagFor(row.grade),
    })),
    noAnswer: words.image.noAnswer,
    total: card.total,
    maxTotal: card.maxTotal,
    title,
    tier,
    ...(isPerfect(card.total) ? { perfect: words.perfect } : {}),
    site: strings.siteName,
    seed: card.dayNumber,
  };
}

/** What sharing needs from the browser. `browserShareKit()` is the real one. */
export interface ShareKit {
  /** Whether a picture can be made here at all (a canvas that encodes PNG). Synchronous. */
  canMakeImage(): boolean;
  /** Makes the PNG, a step at a time between frames; null if the browser could not. */
  makeImage(picture: ShareCardPicture): Promise<Blob | null>;
  /**
   * Whether to open the system share sheet with these files: a touch-first screen whose
   * browser takes them (`navigator.canShare`).
   */
  canShareFiles(files: File[]): boolean;
  /** Opens the system share sheet. Rejects with an `AbortError` when the player backs out. */
  shareFiles(data: ShareData): Promise<void>;
  /** Saves the file as a download. False if the browser would not. */
  download(blob: Blob, name: string): boolean;
  /** Copies the text summary. */
  copy(text: string): Promise<void>;
}

/** Waits for a quiet moment: an idle callback where there is one, else the next frame. */
function quietMoment(): Promise<void> {
  return new Promise((resolve) => {
    const idle = globalThis.requestIdleCallback;
    if (typeof idle === "function") {
      idle(() => resolve(), { timeout: 250 });
    } else if (typeof globalThis.requestAnimationFrame === "function") {
      globalThis.requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 16);
    }
  });
}

export function copyToClipboard(text: string): Promise<void> {
  const clipboard = globalThis.navigator?.clipboard;
  if (!clipboard?.writeText) {
    return Promise.reject(new Error("No clipboard here"));
  }
  return clipboard.writeText(text);
}

let imageSupport: boolean | null = null;

/** The browser's share kit: a canvas for the PNG, the share sheet, a download, the clipboard. */
export function browserShareKit(): ShareKit {
  return {
    canMakeImage() {
      if (imageSupport !== null) return imageSupport;
      try {
        const canvas = document.createElement("canvas");
        imageSupport =
          typeof canvas.toBlob === "function" &&
          typeof ImageData !== "undefined" &&
          canvas.getContext("2d") !== null;
      } catch {
        imageSupport = false;
      }
      return imageSupport;
    },

    async makeImage(picture) {
      try {
        // Three short steps, each in a quiet moment, so no frame waits on them: the paint
        // (a few ms), the enlargement (one pass over 1.5 million pixels), and the PNG,
        // which the browser encodes off the main thread.
        await quietMoment();
        const card = paintShareCard(picture);
        await quietMoment();
        const big = scaleSurface(card, SHARE_CARD.scale);
        const canvas = document.createElement("canvas");
        canvas.width = big.w;
        canvas.height = big.h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.putImageData(new ImageData(big.bytes, big.w, big.h), 0, 0);
        return await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((blob) => resolve(blob), "image/png");
        });
      } catch {
        return null;
      }
    },

    canShareFiles(files) {
      try {
        // A phone or a tablet: a touch screen first. Desktop browsers that can share
        // files too (Chrome and Edge on Windows, Safari on a Mac) get the download and
        // the copy, which is what a PC is for; their share dialogs reach few apps.
        if (!globalThis.matchMedia?.("(pointer: coarse)").matches) return false;
        const nav = globalThis.navigator;
        return (
          typeof nav?.share === "function" &&
          typeof nav.canShare === "function" &&
          nav.canShare({ files })
        );
      } catch {
        return false;
      }
    },

    shareFiles(data) {
      return globalThis.navigator.share(data);
    },

    download(blob, name) {
      try {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.rel = "noopener";
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        link.remove();
        // Long enough for the browser to have started the download.
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        return true;
      } catch {
        return false;
      }
    },

    copy: copyToClipboard,
  };
}
