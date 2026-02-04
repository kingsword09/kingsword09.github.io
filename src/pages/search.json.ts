import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { getPostUrl, sortPostsDesc } from "../utils/posts";

export const GET: APIRoute = async () => {
  const posts = sortPostsDesc(await getCollection("posts"));

  const items = posts.map((post) => ({
    title: post.data.title,
    description: post.data.description ?? "",
    category: "",
    tags: post.data.tags.join(", "),
    url: getPostUrl(post),
    date: post.data.pubDate.toISOString(),
  }));

  return new Response(JSON.stringify(items, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
};

