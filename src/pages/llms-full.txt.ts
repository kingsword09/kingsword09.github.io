import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { absoluteUrl } from "../utils/absolute";
import { getPostPath, sortPostsDesc } from "../utils/posts";

export const GET: APIRoute = async () => {
  const posts = sortPostsDesc(await getCollection("posts"));

  const parts: string[] = [];
  for (const post of posts) {
    parts.push("--- START OF POST ---");
    parts.push(`URL: ${absoluteUrl(getPostPath(post))}`);
    parts.push(`Published At: ${post.data.pubDate.toISOString()}`);
    parts.push("");
    parts.push(`# ${post.data.title}`);
    parts.push("");
    parts.push(post.body.trim());
    parts.push("");
    parts.push("--- END OF POST ---");
  }

  parts.push("");

  return new Response(parts.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
};

