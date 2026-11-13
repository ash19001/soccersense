// SHARE's last step, the same wherever SHARE is pressed (the full-time card, ./controller.ts;
// a played mode's card on the home screen, ../share-today.ts): the picture and the text to
// the system share sheet where the browser takes files (mostly phones), else the picture
// downloaded and the text copied; and how that went.
//
// Browser only: the kit touches the page. Call it from a handler, never while rendering.

import type { ShareKit } from "./share-image";

/**
 * How SHARE ended. `shared` through the system share sheet; `saved` the picture downloaded
 * and the text copied; `downloaded` the picture only; `copied` the text only (no picture);
 * `failed` neither; `idle` the player closed the share sheet (nothing to say).
 */
export type ShareOutcome =
  "idle" | "shared" | "saved" | "downloaded" | "copied" | "failed";

/** What is shared: the text summary, the PNG (null if there is none) and its names. */
export interface ShareJob {
  text: string;
  blob: Blob | null;
  /** The picture's file name: "soccersense-day-12-home.png". */
  fileName: string;
  /** The share sheet's title. */
  title: string;
}

/** The share sheet was closed by the player (rather than refused by the browser). */
function isAbort(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

/** Downloads the picture (if there is one) and copies the text, then says how it went. */
function saveAndCopy(
  kit: ShareKit,
  copy: (text: string) => Promise<void>,
  job: ShareJob,
): Promise<ShareOutcome> {
  let downloaded = false;
  if (job.blob) {
    try {
      downloaded = kit.download(job.blob, job.fileName);
    } catch {
      downloaded = false;
    }
  }
  let copying: Promise<void>;
  try {
    copying = copy(job.text);
  } catch (error) {
    copying = Promise.reject(error);
  }
  return copying.then(
    () => (downloaded ? "saved" : "copied"),
    () => (downloaded ? "downloaded" : "failed"),
  );
}

/** Hands the picture and the text to the share sheet, or downloads and copies them. */
export function deliverShare(
  kit: ShareKit,
  copy: (text: string) => Promise<void>,
  job: ShareJob,
): Promise<ShareOutcome> {
  let file: File | null = null;
  if (job.blob) {
    try {
      file = new File([job.blob], job.fileName, { type: "image/png" });
    } catch {
      file = null;
    }
  }
  if (file && kit.canShareFiles([file])) {
    let sharing: Promise<void>;
    try {
      sharing = kit.shareFiles({
        files: [file],
        text: job.text,
        title: job.title,
      });
    } catch (error) {
      sharing = Promise.reject(error);
    }
    return sharing.then(
      (): ShareOutcome => "shared",
      (error: unknown) =>
        // The player closed the sheet: nothing to say. The sheet would not open (the
        // browser took the press as too long ago, say): download and copy instead.
        isAbort(error) ? "idle" : saveAndCopy(kit, copy, job),
    );
  }
  return saveAndCopy(kit, copy, job);
}
