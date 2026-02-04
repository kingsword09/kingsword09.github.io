import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { site } from "../config/site";
import { absoluteUrl } from "../utils/absolute";
import { getPostPath, sortPostsDesc } from "../utils/posts";

export const GET: APIRoute = async () => {
  const posts = sortPostsDesc(await getCollection("posts")).slice(0, 36);

  const feed = {
    version: "https://jsonfeed.org/version/1",
    title: site.title,
    home_page_url: absoluteUrl("/"),
    feed_url: absoluteUrl("/feed.json"),
    description: site.description,
    icon: absoluteUrl("/favicon.png"),
    author: {
      name: site.author.name,
      url: site.aboutme,
      avatar: site.author.avatarUrl,
    },
    items: posts.map((post) => {
      const url = absoluteUrl(getPostPath(post));
      return {
        id: url,
        title: post.data.title,
        summary: post.data.summary ?? post.data.description ?? "",
        url,
        tags: post.data.tags,
        date_published: post.data.pubDate.toISOString(),
        date_modified: post.data.pubDate.toISOString(),
      };
    }),
  };

  return new Response(JSON.stringify(feed, null, 2), {
    headers: {
      "content-type": "application/feed+json; charset=utf-8",
    },
  });
};
