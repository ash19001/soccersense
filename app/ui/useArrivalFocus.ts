import { type RefObject, useEffect, useRef } from "react";

/**
 * False until the first page of this document has been shown. The browser puts focus (and
 * a screen reader its cursor) at the top of a document it loads, and that is left alone.
 */
let loaded = false;

/**
 * Focus for a page that was arrived at without a page load.
 *
 * The router swaps pages inside one document. A browser that loads a page starts the
 * keyboard and a screen reader at its top; a page swapped in by the router gets nothing: the
 * focus stays on a control that is gone (so on `body`), and a screen reader says nothing at
 * all. Give the returned ref to the page's main heading, with `tabIndex={-1}`: when the
 * page is arrived at from another page of the site the heading takes the focus, a screen
 * reader reads it, and the next Tab goes to the first control after it. The page the browser
 * loaded is left alone.
 *
 *   const heading = useArrivalFocus<HTMLHeadingElement>();
 *   <h1 ref={heading} tabIndex={-1}>...</h1>
 *
 * Call it once per page, in the page's own component. It does not scroll: the router and
 * the browser look after that.
 */
export function useArrivalFocus<
  T extends HTMLElement = HTMLElement,
>(): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  /** Whether this page was arrived at: decided once, the first time its effect runs. */
  const arrived = useRef<boolean | null>(null);
  useEffect(() => {
    // Strict mode runs the effect twice: the answer is the first one's.
    if (arrived.current === null) {
      arrived.current = loaded;
      loaded = true;
    }
    if (arrived.current) ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}

/** For tests: forget that any page has been shown, as after a page load. */
export function resetArrivalFocus(): void {
  loaded = false;
}
