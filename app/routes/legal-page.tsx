// The privacy notice and the terms (./privacy.tsx, ./terms.tsx): ordinary pages that scroll,
// in the game's colours and type (the product owner, 2026-11-17: "the privacy and terms
// should be full scrollable pages, not a black page and a popup appearance"). A bar along
// the top with the game's name and PLAY, the page's words in a column wide enough to read
// comfortably, and a foot with the small print and the two pages' links. Every word is in
// app/i18n (`strings.privacy`, `strings.terms`, `strings.pages`); the contact address, the
// regulator's site and Google's pages about its ads in them are links. The foot also has
// "Privacy and cookie settings", the way back to Google's consent message for the ads
// (app/ui/ad-consent.ts; the product owner, 2026-11-19: "do we need to add a cookie consent
// banner?": Google's own message is the banner, set up in AdSense).

import { Fragment, type ReactNode, useState } from "react";
import { Link, NavLink } from "react-router";

import { strings } from "~/i18n";
import {
  Button,
  PixelRoot,
  WideMarkScript,
  isWide,
  useArrivalFocus,
  usePixelRootScale,
  useWideMark,
} from "~/ui";
import { openAdChoices } from "~/ui/ad-consent";

export interface LegalSection {
  heading: string;
  paragraphs?: readonly string[];
  list?: readonly string[];
}

/** The things in the text that are links: the contact address, the regulator, Google's ads. */
const LINKS: readonly { text: string; href: string }[] = [
  { text: strings.pages.contact, href: `mailto:${strings.pages.contact}` },
  { text: "ico.org.uk", href: "https://ico.org.uk" },
  {
    text: "policies.google.com/technologies/partner-sites",
    href: "https://policies.google.com/technologies/partner-sites",
  },
  { text: "myadcenter.google.com", href: "https://myadcenter.google.com" },
];

/** A line of text with its links made links. */
function linked(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let rest = text;
  for (;;) {
    const next = LINKS.map((link) => ({ link, at: rest.indexOf(link.text) }))
      .filter((found) => found.at >= 0)
      .sort((a, b) => a.at - b.at)[0];
    if (!next) break;
    parts.push(rest.slice(0, next.at));
    parts.push(
      <a key={parts.length} className="ss-acct__link" href={next.link.href}>
        {next.link.text}
      </a>,
    );
    rest = rest.slice(next.at + next.link.text.length);
  }
  parts.push(rest);
  return parts.map((part, i) => <Fragment key={i}>{part}</Fragment>);
}

/** The two pages, as the foot links them. */
const PAGES = [
  { to: "/privacy", label: strings.legal.privacyLink },
  { to: "/terms", label: strings.legal.termsLink },
];

function Page({
  heading,
  sections,
}: {
  heading: string;
  sections: readonly LegalSection[];
}) {
  // On a monitor the type is in caption pixels, as the home screen's words are.
  const wide = isWide(usePixelRootScale());
  // On a monitor it is set that way from the first paint (`useWideMark`).
  const mark = useWideMark(wide);
  const headingRef = useArrivalFocus<HTMLHeadingElement>();
  const text = strings.pages;
  // Google's consent message could not be opened (not asked where the player is)
  const [noChoices, setNoChoices] = useState(false);
  return (
    <div
      ref={mark}
      className="ss-doc__page"
      data-wide={wide ? "" : undefined}
      suppressHydrationWarning
    >
      <WideMarkScript />
      <header className="ss-doc__bar">
        <Link to="/" className="ss-doc__brand" aria-label={text.home}>
          {strings.siteName}
        </Link>
        <Button variant="primary" to="/" className="ss-doc__play">
          {text.play}
        </Button>
      </header>
      <main className="ss-doc__main">
        <h1 ref={headingRef} tabIndex={-1} className="ss-doc__title">
          {heading}
        </h1>
        <p className="ss-doc__updated">{text.updated}</p>
        {sections.map((section) => (
          <section key={section.heading} className="ss-doc__part">
            <h2>{section.heading}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph}>{linked(paragraph)}</p>
            ))}
            {section.list && (
              <ul>
                {section.list.map((item) => (
                  <li key={item}>{linked(item)}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </main>
      <footer className="ss-doc__foot">
        <nav className="ss-doc__links" aria-label={text.nav}>
          {PAGES.map((page) => (
            <NavLink key={page.to} className="ss-acct__link" to={page.to}>
              {page.label}
            </NavLink>
          ))}
          <Link className="ss-acct__link" to="/">
            {text.back}
          </Link>
          <button
            type="button"
            className="ss-acct__link"
            onClick={() => setNoChoices(!openAdChoices())}
          >
            {text.adChoices}
          </button>
        </nav>
        {noChoices && <p role="status">{linked(text.adChoicesNone)}</p>}
        <p>{strings.legal.disclaimer}</p>
      </footer>
    </div>
  );
}

export function LegalPage(props: {
  heading: string;
  sections: readonly LegalSection[];
}) {
  return (
    <PixelRoot className="ss-doc">
      <Page {...props} />
    </PixelRoot>
  );
}
