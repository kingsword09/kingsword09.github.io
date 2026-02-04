import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { absoluteUrl } from "../utils/absolute";
import { getPostPath, sortPostsDesc } from "../utils/posts";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export const GET: APIRoute = async () => {
  const posts = sortPostsDesc(await getCollection("posts"));
  const latest = posts[0]?.data.pubDate;

  const tags = new Set<string>();
  for (const post of posts) for (const tag of post.data.tags) tags.add(tag);

  const entries: Array<{ loc: string; lastmod?: string }> = [];

  entries.push({ loc: absoluteUrl("/"), lastmod: latest?.toISOString() });
  entries.push({ loc: absoluteUrl("/about/") });
  entries.push({ loc: absoluteUrl("/tag/") });

  for (const tag of Array.from(tags).sort((a, b) => a.localeCompare(b))) {
    entries.push({ loc: absoluteUrl(`/tag/${tag}/`) });
  }

  for (const post of posts) {
    entries.push({
      loc: absoluteUrl(getPostPath(post)),
      lastmod: post.data.pubDate.toISOString(),
    });
  }

  // Useful machine-readable endpoints
  entries.push({ loc: absoluteUrl("/atom.xml") });
  entries.push({ loc: absoluteUrl("/feed.json") });
  entries.push({ loc: absoluteUrl("/search.json") });
  entries.push({ loc: absoluteUrl("/llms.txt") });
  entries.push({ loc: absoluteUrl("/llms-full.txt") });

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries
      .map((e) => {
        const parts = ["  <url>", `    <loc>${escapeXml(e.loc)}</loc>`];
        if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`);
        parts.push("  </url>");
        return parts.join("\n");
      })
      .join("\n") +
    "\n</urlset>\n";

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
    },
  });
};

