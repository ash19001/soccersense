/**
 * The faces the kit's pages set their headings in (ui.css section 1, `--font-20`) that the
 * home screen itself never uses. A browser fetches a face the first time something on
 * screen is set in it, so without help the first page after the menu shows its heading
 * for a moment in a stand-in face (`ui-monospace`), and then swaps it.
 */
export const HEADING_FACES: readonly string[] = ['1em "Jersey 20"'];

/**
 * Fetch the heading faces now, ahead of the page that needs them. Browser only: call it
 * from an effect or a handler. Calling it again costs nothing (a face is fetched once).
 * Where there is no font loading API it does nothing, and it never throws.
 */
export function fetchHeadingFaces(): void {
  if (typeof document === "undefined") return;
  const fonts = (document as { fonts?: FontFaceSet }).fonts;
  if (!fonts || typeof fonts.load !== "function") return;
  for (const face of HEADING_FACES) {
    try {
      fonts.load(face).catch(() => undefined);
    } catch {
      // A browser that cannot parse the face: the page falls back as it always could.
    }
  }
}
