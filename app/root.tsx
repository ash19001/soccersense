import { useSyncExternalStore } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

// The Jersey family, self-hosted: each index.css declares the latin and latin-ext faces
// with their unicode ranges, so latin-ext is only fetched for names that need it.
import "@fontsource/jersey-10/index.css";
import "@fontsource/jersey-15/index.css";
import "@fontsource/jersey-20/index.css";
import "@fontsource/jersey-25/index.css";
import jersey10Latin from "@fontsource/jersey-10/files/jersey-10-latin-400-normal.woff2?url";
import jersey15Latin from "@fontsource/jersey-15/files/jersey-15-latin-400-normal.woff2?url";

import { strings } from "~/i18n";
import { ClickBurst, Panel, PixelRoot } from "~/ui";
import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  // Body text and question text: the two faces every screen needs straight away.
  {
    rel: "preload",
    href: jersey10Latin,
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
  {
    rel: "preload",
    href: jersey15Latin,
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0f1220" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        {/* A burst of pixels at every press, on every page (nothing at build time). */}
        <ClickBurst />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

// False in the build-time HTML and while the browser is taking that HTML over, true after.
function subscribeToNothing(): () => void {
  return () => {};
}
const inBrowser = () => true;
const takingOver = () => false;

/** A plain page with its content in the middle, like the rules page. */
const PAGE = "ss-page flex flex-col items-center justify-center";

/**
 * What the build puts in `__spa-fallback.html`, the document a static host serves for any
 * address that is not one of the prerendered pages: an empty page in ink, with the
 * interface's units. Nothing more can be known at build time, because that one document
 * answers for every such address.
 *
 * `ErrorBoundary` below renders exactly this while the browser takes the document over.
 * That matters for an address that does not exist: the router knows at once that it is a
 * 404 and renders the error page straight away, and if that differed from the document's
 * HTML React would report a hydration error (it did: error 418 on every unknown address of
 * the built site). Keep the two in step.
 */
export function HydrateFallback() {
  return <PixelRoot className={PAGE} />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // The first render over a document's HTML shows only what that HTML has: see above.
  const live = useSyncExternalStore(subscribeToNothing, inBrowser, takingOver);

  let message = strings.errors.title;
  let details = strings.errors.unexpected;
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : strings.errors.title;
    details =
      error.status === 404
        ? strings.errors.notFound
        : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  // A PixelRoot, so the type is on whole device pixels at any display scaling, and the
  // game's own column and panel, like the rules page.
  return (
    <PixelRoot className={PAGE}>
      {live && (
        <main className="flex w-full max-w-[max(calc(var(--px)*135),calc(var(--fp)*405))] flex-col gap-[var(--u5)]">
          <Panel className="flex flex-col items-start gap-[var(--u3)]">
            <h1 className="ss-t20">{message}</h1>
            <p>{details}</p>
            {stack && (
              <pre className="w-full overflow-x-auto">
                <code>{stack}</code>
              </pre>
            )}
          </Panel>
          {/*
           * The way back is a plain link, not the router's: after an error the page is
           * loaded afresh. (The kit's button, as markup.)
           */}
          <a className="ss-btn ss-btn--primary ss-btn--full" href="/">
            <span className="ss-btn__label">{strings.play.back}</span>
          </a>
        </main>
      )}
    </PixelRoot>
  );
}
