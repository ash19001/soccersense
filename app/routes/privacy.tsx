// The privacy notice: what the game keeps about a player, why, and for how long. Linked from
// the sign-in card and the rules' small print. Words: `strings.privacy`.

import { strings } from "~/i18n";
import type { Route } from "./+types/privacy";
import { LegalPage } from "./legal-page";
import { pageMeta } from "./seo";

export const meta: Route.MetaFunction = () =>
  pageMeta({
    path: "/privacy",
    title: `${strings.privacy.title} · ${strings.siteName}`,
    description: strings.privacy.description,
  });

export default function Privacy() {
  return (
    <LegalPage
      heading={strings.privacy.heading}
      sections={strings.privacy.sections}
    />
  );
}
