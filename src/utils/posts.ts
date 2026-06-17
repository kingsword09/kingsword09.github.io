import type { CollectionEntry } from "astro:content";
import { getYmdParts } from "./dates";
import { withBase } from "./urls";

export type PostEntry = CollectionEntry<"posts">;

const slugCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/**
 * Get the slug from a post entry (id without extension)
 */
export function getPostSlug(post: PostEntry): string {
  return post.id.replace(/\.(md|mdx)$/, "");
}

export function getPostPath(post: PostEntry): string {
  const { year, month, day } = getYmdParts(post.data.pubDate);
  return `/${year}/${month}/${day}/${getPostSlug(post)}/`;
}

export function getPostUrl(post: PostEntry): string {
  return withBase(getPostPath(post));
}

export function sortPostsDesc(posts: PostEntry[]): PostEntry[] {
  return [...posts].sort((a, b) => {
    const byDate = b.data.pubDate.getTime() - a.data.pubDate.getTime();
    if (byDate !== 0) return byDate;

    // Stable tie-break: newer-ish slugs first (e.g. "-2" before "-1")
    return slugCollator.compare(getPostSlug(b), getPostSlug(a));
  });
}
