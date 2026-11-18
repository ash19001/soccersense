// The terms of playing and of having an account. Linked from the sign-in card and the
// rules' small print. Words: `strings.terms`.

import { strings } from "~/i18n";
import type { Route } from "./+types/terms";
import { LegalPage } from "./legal-page";
import { pageMeta } from "./seo";

export const meta: Route.MetaFunction = () =>
  pageMeta({
    path: "/terms",
    title: `${strings.terms.title} · ${strings.siteName}`,
    description: strings.terms.description,
  });

export default function Terms() {
  return (
    <LegalPage
      heading={strings.terms.heading}
      sections={strings.terms.sections}
    />
  );
}
