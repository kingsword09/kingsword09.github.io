import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const posts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    summary: z.string().optional(),
    tags: z.array(z.string()).default([]),
    minute: z.number().optional(),
    pubDate: z.coerce.date(),
  }),
});

export const collections = { posts };
