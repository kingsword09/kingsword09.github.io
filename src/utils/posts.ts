import type { CollectionEntry } from "astro:content";
import { getYmdParts } from "./dates";
import { withBase } from "./urls";

export type PostEntry = CollectionEntry<"posts">;

const slugCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function getPostPath(post: PostEntry): string {
  const { year, month, day } = getYmdParts(post.data.pubDate);
  return `/${year}/${month}/${day}/${post.slug}/`;
}

export function getPostUrl(post: PostEntry): string {
  return withBase(getPostPath(post));
}

export function sortPostsDesc(posts: PostEntry[]): PostEntry[] {
  return [...posts].sort((a, b) => {
    const byDate = b.data.pubDate.getTime() - a.data.pubDate.getTime();
    if (byDate !== 0) return byDate;

    // Stable tie-break: newer-ish slugs first (e.g. "-2" before "-1")
    return slugCollator.compare(b.slug, a.slug);
  });
}
