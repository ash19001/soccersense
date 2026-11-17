/**
 * seo: write the files search engines and link previews fetch, into public/.
 *
 *   ./node_modules/.bin/tsx tools/seo.ts        (or: pnpm seo)
 *
 *   public/social-card.png   the link preview's picture, 1200 x 630, from its drawing
 *                            (app/scenes/social-card.ts)
 *   public/robots.txt        every page may be crawled; where the sitemap is
 *   public/sitemap.xml       every page a search engine should list (app/routes/seo.ts
 *                            `PAGES`), once the site's address is set (`SITE_URL`)
 *
 * Run it after changing the home screen's art (the picture is the home screen), the list of
 * pages or the site's address. `pnpm check` fails while any of the three is out of date:
 * app/scenes/social-card.test.ts and app/routes/seo.test.ts hold the files to their sources.
 */

import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SITE_URL, robotsTxt, sitemapXml, socialCardWords } from "~/routes/seo";
import { SOCIAL_CARD, drawSocialCard } from "~/scenes/social-card";

import { encodePng } from "./png";

function main(): void {
  const dir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "public",
  );

  const card = path.join(dir, "social-card.png");
  const png = encodePng(drawSocialCard(socialCardWords()), SOCIAL_CARD.scale);
  writeFileSync(card, png);
  console.log(
    `${card}  ${SOCIAL_CARD.w * SOCIAL_CARD.scale} x ${SOCIAL_CARD.h * SOCIAL_CARD.scale} px, ${png.length} bytes`,
  );

  const robots = path.join(dir, "robots.txt");
  writeFileSync(robots, robotsTxt());
  console.log(robots);

  const sitemap = path.join(dir, "sitemap.xml");
  const xml = sitemapXml();
  if (xml !== null) {
    writeFileSync(sitemap, xml);
    console.log(sitemap);
  } else {
    console.log(
      "No sitemap: the site's address is not set (SITE_URL in app/routes/seo.ts).",
    );
    if (existsSync(sitemap)) {
      console.log(`${sitemap} is out of date: delete it, or set the address.`);
    }
  }
  if (SITE_URL === "") {
    console.log(
      "Until it is, pages carry no canonical link and no preview picture.",
    );
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
