// The player's name and account in the top right corner of the home screen
// (AccountCorner, 2026-11-17): a plate on a monitor, one button on a phone.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { strings } from "~/i18n";

import { AccountCorner, type AccountCornerProps } from "./AccountCorner";
import { WideContext } from "./GameLayout";

const words = strings.account.menu;

function corner(wide: boolean, over: Partial<AccountCornerProps> = {}) {
  const props: AccountCornerProps = {
    name: "soccerfan12",
    nameSpoken: words.nameSpoken("soccerfan12"),
    onName: vi.fn(),
    action: words.signIn,
    actionSpoken: words.signInSpoken,
    onAction: vi.fn(),
    phoneLabel: words.phone("soccerfan12"),
    ...over,
  };
  const nameRef = createRef<HTMLButtonElement>();
  const actionRef = createRef<HTMLButtonElement>();
  const view = render(
    <WideContext value={wide}>
      <AccountCorner {...props} nameRef={nameRef} actionRef={actionRef} />
    </WideContext>,
  );
  return {
    props,
    nameRef,
    actionRef,
    rerender: (more: Partial<AccountCornerProps>) =>
      view.rerender(
        <WideContext value={wide}>
          <AccountCorner
            {...props}
            {...more}
            nameRef={nameRef}
            actionRef={actionRef}
          />
        </WideContext>,
      ),
  };
}

describe("on a monitor", () => {
  test("the name and SIGN IN side by side on one plate in the corner", () => {
    const { props, nameRef, actionRef } = corner(true);
    const name = screen.getByRole("button", {
      name: words.nameSpoken("soccerfan12"),
    });
    const action = screen.getByRole("button", { name: words.signInSpoken });
    // what is seen: the name (and a pencil), SIGN IN
    expect(name).toHaveTextContent("soccerfan12");
    expect(name.querySelector("svg")).not.toBeNull();
    expect(action).toHaveTextContent(words.signIn);
    expect(name.nextElementSibling).toBe(action);
    expect(name.closest(".ss-corner")).toBe(action.closest(".ss-corner"));
    // each opens a dialog, and gives the focus back to itself
    expect(name).toHaveAttribute("aria-haspopup", "dialog");
    expect(action).toHaveAttribute("aria-haspopup", "dialog");
    expect(nameRef.current).toBe(name);
    expect(actionRef.current).toBe(action);
    fireEvent.click(name);
    expect(props.onName).toHaveBeenCalledTimes(1);
    fireEvent.click(action);
    expect(props.onAction).toHaveBeenCalledTimes(1);
    // no phone button
    expect(
      screen.queryByRole("button", { name: words.phone("soccerfan12") }),
    ).toBeNull();
  });

  test("signed in, it says ACCOUNT, and says which card is up", () => {
    corner(true, {
      action: words.open,
      actionSpoken: words.openSpoken,
      open: true,
    });
    const action = screen.getByRole("button", { name: words.openSpoken });
    expect(action).toHaveTextContent(words.open);
    expect(action).toHaveAttribute("aria-expanded", "true");
  });
});

describe("on a phone", () => {
  test("one button in the corner: the account's card, which has the name", () => {
    const { props, actionRef } = corner(false);
    const button = screen.getByRole("button", {
      name: words.phone("soccerfan12"),
    });
    expect(button).toHaveClass("ss-acct-btn");
    expect(button).toHaveAttribute("title", words.phone("soccerfan12"));
    expect(button.closest(".ss-corner")).not.toBeNull();
    expect(actionRef.current).toBe(button);
    fireEvent.click(button);
    expect(props.onAction).toHaveBeenCalledTimes(1);
    // no plate
    expect(document.querySelector(".ss-corner__name")).toBeNull();
  });
});

test("at the kick-off it goes, and nothing in it can be reached", () => {
  const { rerender } = corner(true);
  const root = document.querySelector(".ss-corner") as HTMLElement;
  expect(root).not.toHaveClass("is-stowed");
  act(() => rerender({ stowed: true }));
  expect(root).toHaveClass("is-stowed");
  expect(root).toHaveAttribute("inert");
});

test("the captions no longer hold it", () => {
  expect(document.querySelector(".ss-menu__acct")).toBeNull();
});

test("at build time a monitor's plate is not assumed", () => {
  const html = renderToString(
    <AccountCorner
      name="soccerfan12"
      nameSpoken="Change your name, soccerfan12"
      onName={() => {}}
      action="SIGN IN"
      actionSpoken="Sign in"
      onAction={() => {}}
      phoneLabel="Your name and account: soccerfan12"
    />,
  );
  expect(html).toContain("ss-corner");
});
