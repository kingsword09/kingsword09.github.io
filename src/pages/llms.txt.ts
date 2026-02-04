import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { site } from "../config/site";
import { absoluteUrl } from "../utils/absolute";
import { getPostPath, sortPostsDesc } from "../utils/posts";

export const GET: APIRoute = async () => {
  const posts = sortPostsDesc(await getCollection("posts"));

  const allTags = new Set<string>();
  for (const post of posts) {
    for (const tag of post.data.tags) allTags.add(tag);
  }

  const tags = Array.from(allTags).sort((a, b) => a.localeCompare(b));

  const lines: string[] = [];
  lines.push(`# ${site.title}`);
  lines.push("");
  lines.push(`> ${site.description}`);
  lines.push("");
  lines.push("## Blog");
  lines.push("");

  for (const post of posts) {
    const url = absoluteUrl(getPostPath(post));
    const summary = post.data.summary ?? post.data.description ?? "";
    lines.push(`- [${post.data.title}](${url}): ${summary}`);
  }

  lines.push("");
  lines.push("## Reference");
  lines.push("");
  lines.push(`- [aboutme](${site.aboutme}): ${site.author.name}`);
  for (const tag of tags) {
    lines.push(`- [${tag}](${absoluteUrl(`/tag/${tag}/`)}): ${tag}`);
  }
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
};

