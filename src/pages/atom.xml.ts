import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { site } from "../config/site";
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
  const updated = posts[0]?.data.pubDate ?? new Date();

  const entries = posts
    .map((post) => {
      const url = absoluteUrl(getPostPath(post));
      const summary = post.data.summary ?? post.data.description ?? "";
      return [
        "  <entry>",
        `    <title>${escapeXml(post.data.title)}</title>`,
        `    <link href="${escapeXml(url)}" />`,
        `    <updated>${post.data.pubDate.toISOString()}</updated>`,
        `    <id>${escapeXml(url)}</id>`,
        `    <summary type="text">${escapeXml(summary)}</summary>`,
        "  </entry>",
      ].join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title>${escapeXml(site.title)}</title>`,
    `  <link href="${escapeXml(absoluteUrl("/atom.xml"))}" rel="self" />`,
    `  <link href="${escapeXml(absoluteUrl("/"))}" />`,
    `  <updated>${updated.toISOString()}</updated>`,
    `  <id>${escapeXml(site.url)}</id>`,
    "  <author>",
    `    <name>${escapeXml(site.author.name)}</name>`,
    `    <email>${escapeXml(site.author.email)}</email>`,
    "  </author>",
    entries,
    "</feed>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "content-type": "application/atom+xml; charset=utf-8",
    },
  });
};

