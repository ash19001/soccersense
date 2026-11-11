import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, test } from "vitest";

import { resetArrivalFocus, useArrivalFocus } from "./useArrivalFocus";

function Page({ name }: { name: string }) {
  const heading = useArrivalFocus<HTMLHeadingElement>();
  return (
    <main>
      <h1 ref={heading} tabIndex={-1}>
        {name}
      </h1>
      <button type="button">a control</button>
    </main>
  );
}

beforeEach(() => {
  resetArrivalFocus();
});

describe("useArrivalFocus", () => {
  test("the page the browser loaded is left alone", () => {
    render(<Page name="first" />);
    expect(document.activeElement).toBe(document.body);
  });

  test("a page arrived at from another one gives its heading the focus", () => {
    const first = render(<Page name="first" />);
    first.unmount();
    const second = render(<Page name="second" />);
    expect(second.getByRole("heading", { name: "second" })).toHaveFocus();
    second.unmount();
    const third = render(<Page name="third" />);
    expect(third.getByRole("heading", { name: "third" })).toHaveFocus();
  });

  test("strict mode's second run of the effect does not turn a page load into an arrival", () => {
    render(
      <StrictMode>
        <Page name="first" />
      </StrictMode>,
    );
    expect(document.activeElement).toBe(document.body);
  });

  test("a re-render does not take the focus back from where the player moved it", () => {
    render(<Page name="first" />).unmount();
    const page = render(<Page name="second" />);
    const control = page.getByRole("button");
    control.focus();
    page.rerender(<Page name="second, again" />);
    expect(control).toHaveFocus();
  });

  test("renders at build time with no browser", () => {
    expect(renderToString(<Page name="built" />)).toContain(
      '<h1 tabindex="-1">built</h1>',
    );
  });
});
