// The privacy notice and the terms (/privacy, /terms), and the links to them.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { strings } from "~/i18n";
import { resetArrivalFocus } from "~/ui/useArrivalFocus";
import { howToPlayContent } from "./how-to-play-card";
import Privacy from "./privacy";
import Terms from "./terms";
import { HowToPlayCard } from "~/ui";

function page(path: "/privacy" | "/terms") {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <h1>the menu</h1> },
    { path: "/privacy", Component: Privacy },
    { path: "/terms", Component: Terms },
  ]);
  render(<Stub initialEntries={[path]} />);
}

beforeEach(() => resetArrivalFocus());

describe.each([
  ["/privacy", strings.privacy] as const,
  ["/terms", strings.terms] as const,
])("%s", (path, words) => {
  test("is a page of its own: the game's name and PLAY along the top, its heading, the date, every part, and a foot", () => {
    page(path);
    // not a card standing on a dark page: the page itself
    expect(document.querySelector(".ss-help, .ss-popup")).toBeNull();
    expect(document.querySelector(".ss-doc__page")).not.toBeNull();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: strings.pages.home }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("link", { name: strings.pages.play }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("heading", { level: 1, name: words.heading }),
    ).toBeInTheDocument();
    expect(screen.getByText(strings.pages.updated)).toBeInTheDocument();
    for (const section of words.sections) {
      expect(
        screen.getByRole("heading", { level: 2, name: section.heading }),
      ).toBeInTheDocument();
    }
    // the foot: both pages (this one marked as where you are), and the way back
    const foot = screen.getByRole("navigation", { name: strings.pages.nav });
    expect(
      within(foot).getByRole("link", { name: strings.pages.back }),
    ).toHaveAttribute("href", "/");
    expect(
      within(foot).getByRole("link", { name: strings.legal.privacyLink }),
    ).toHaveAttribute("href", "/privacy");
    expect(
      within(foot).getByRole("link", { name: strings.legal.termsLink }),
    ).toHaveAttribute("href", "/terms");
    expect(within(foot).getByRole("link", { current: "page" })).toHaveAttribute(
      "href",
      path,
    );
  });

  test("the contact address is a link to write to", () => {
    page(path);
    for (const link of screen.getAllByRole("link", {
      name: strings.pages.contact,
    })) {
      expect(link).toHaveAttribute("href", `mailto:${strings.pages.contact}`);
    }
  });

  test("is whole in the page built ahead of time", () => {
    const Stub = createRoutesStub([
      { path, Component: path === "/privacy" ? Privacy : Terms },
    ]);
    const html = renderToString(<Stub initialEntries={[path]} />);
    for (const section of words.sections) {
      expect(html).toContain(section.heading);
    }
  });
});

test("the privacy notice names who handles the data, and the regulator", () => {
  page("/privacy");
  const text = document.body.textContent ?? "";
  for (const name of ["Cloudflare", "Resend", "Google", "Turnstile"]) {
    expect(text).toContain(name);
  }
  expect(screen.getByRole("link", { name: "ico.org.uk" })).toHaveAttribute(
    "href",
    "https://ico.org.uk",
  );
});

test("the rules' small print links both", () => {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <HowToPlayCard {...howToPlayContent()} />,
    },
  ]);
  render(<Stub initialEntries={["/"]} />);
  const small = document.querySelector(".ss-legal") as HTMLElement;
  expect(
    within(small).getByRole("link", { name: strings.legal.privacyLink }),
  ).toHaveAttribute("href", "/privacy");
  expect(
    within(small).getByRole("link", { name: strings.legal.termsLink }),
  ).toHaveAttribute("href", "/terms");
});

// the product owner, 2026-11-19: "yes update the privacy. also do we need to add a cookie
// consent banner?" (Google's own consent message is the banner; the site links back to it)
describe("the ads, in the privacy notice and at the foot", () => {
  afterEach(() => {
    delete (window as unknown as { googlefc?: unknown }).googlefc;
  });

  test("the notice says the game shows Google's ads, with its cookies and the consent asked", () => {
    page("/privacy");
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/no ads|don't .*show ads|no advertising/i);
    expect(
      screen.getByRole("heading", { level: 2, name: "Ads" }),
    ).toBeInTheDocument();
    expect(text).toContain("Google AdSense");
    expect(text).toMatch(/asks for your consent/);
    expect(
      screen.getByRole("link", {
        name: "policies.google.com/technologies/partner-sites",
      }),
    ).toHaveAttribute(
      "href",
      "https://policies.google.com/technologies/partner-sites",
    );
    expect(
      screen.getByRole("link", { name: "myadcenter.google.com" }),
    ).toHaveAttribute("href", "https://myadcenter.google.com");
  });

  test.each(["/privacy", "/terms"] as const)(
    "%s: Privacy and cookie settings reopens Google's consent message",
    (path) => {
      const shown = vi.fn();
      const queue: unknown[] = [];
      (window as unknown as { googlefc: unknown }).googlefc = {
        callbackQueue: queue,
        showRevocationMessage: shown,
      };
      page(path);
      const foot = screen.getByRole("navigation", { name: strings.pages.nav });
      fireEvent.click(
        within(foot).getByRole("button", { name: strings.pages.adChoices }),
      );
      // the one call Google supports: the function, through its queue
      expect(queue).toEqual([shown]);
      expect(screen.queryByRole("status")).toBeNull();
    },
  );

  test("where Google's message is not on the page, it says so, and where to go instead", () => {
    page("/privacy");
    fireEvent.click(
      screen.getByRole("button", { name: strings.pages.adChoices }),
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/There's nothing to set here/);
    expect(
      within(status).getByRole("link", { name: "myadcenter.google.com" }),
    ).toHaveAttribute("href", "https://myadcenter.google.com");
  });
});
