/**
 * A built page has its styles written into it (tools/inline-css.ts): a `<style>` the app
 * never rendered, and the stylesheet's link switched off. React renders the whole document
 * and has to take such a page over as it is: find its link (by `rel` and `href`, whatever
 * else the link carries), pass over the `<style>`, and render nothing again. If it ever
 * stopped doing so, every page would be drawn twice (React's error 418) and the stylesheet
 * fetched after all.
 */
import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { INLINED, inlineStyles } from "../tools/inline-css";

const HREF = "/assets/root-AbC123.css";

/** A document as the root route renders one: the stylesheet's link is the head's last. */
function Page({ words }: { words: string }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href={HREF} />
      </head>
      <body>
        <p>{words}</p>
      </body>
    </html>
  );
}

describe("a page with its styles written into it", () => {
  let root: Root | undefined;
  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  test("React takes it over as it is: the link stays, switched off, and nothing is rendered again", async () => {
    const built = renderToString(<Page words="kick-off" />);
    // the build writes the link exactly so (tools/inline-css.ts looks for this)
    expect(built).toContain(`<link rel="stylesheet" href="${HREF}"/>`);
    const html = inlineStyles(built, () => "body{margin:0}");

    // the page as the browser has it before the app starts
    document.open();
    document.write(`<!DOCTYPE html>${html}`);
    document.close();
    const link = document.querySelector('link[rel="stylesheet"]');
    const style = document.querySelector(`style[${INLINED}]`);
    const words = document.querySelector("p");
    expect(link).toHaveAttribute("disabled");
    expect(style?.nextElementSibling).toBe(link);

    const failed = vi.fn();
    // In development React also says, once, that the link has an attribute it did not
    // render; a production build compares no attributes and says nothing.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await act(async () => {
      root = hydrateRoot(document, <Page words="kick-off" />, {
        onRecoverableError: failed,
      });
    });

    // no failed take-over, so nothing was thrown away and rendered again
    expect(failed).not.toHaveBeenCalled();
    expect(document.querySelector("p")).toBe(words);
    // the one link, the same node, still switched off: nothing fetches the file
    expect(document.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(1);
    expect(document.querySelector('link[rel="stylesheet"]')).toBe(link);
    expect(link).toHaveAttribute("disabled");
    // and the styles are still where the build put them
    expect(document.querySelector(`style[${INLINED}]`)).toBe(style);
    expect(style?.textContent).toBe("body{margin:0}");

    // a later render leaves both alone
    await act(async () => {
      root?.render(<Page words="full time" />);
    });
    expect(document.querySelector("p")).toHaveTextContent("full time");
    expect(document.querySelector('link[rel="stylesheet"]')).toBe(link);
    expect(link).toHaveAttribute("disabled");
    expect(document.querySelector(`style[${INLINED}]`)).toBe(style);
  });
});
