import { defineCollection, z } from "astro:content";

const posts = defineCollection({
  type: "content",
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

