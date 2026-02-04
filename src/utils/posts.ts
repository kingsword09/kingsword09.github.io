import type { CollectionEntry } from "astro:content";
import { getYmdParts } from "./dates";
import { withBase } from "./urls";

export type PostEntry = CollectionEntry<"posts">;

export function getPostPath(post: PostEntry): string {
  const { year, month, day } = getYmdParts(post.data.pubDate);
  return `/${year}/${month}/${day}/${post.slug}/`;
}

export function getPostUrl(post: PostEntry): string {
  return withBase(getPostPath(post));
}

export function sortPostsDesc(posts: PostEntry[]): PostEntry[] {
  return [...posts].sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

