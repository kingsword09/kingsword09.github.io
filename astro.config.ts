import { defineConfig } from "astro/config";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { site } from "./src/config/site";

function normalizeBase(input?: string): string {
  if (!input) return "/";
  let base = input;
  if (!base.startsWith("/")) base = `/${base}`;
  if (!base.endsWith("/")) base = `${base}/`;
  return base;
}

const BASE = normalizeBase(process.env.PAGES_BASE_PATH);

export default defineConfig({
  site: site.url,
  base: BASE,
  build: {
    // Keep Jekyll-like "pretty" URLs: /path/ -> /path/index.html
    format: "directory",
  },
  markdown: {
    // Highlight code blocks at build time (no Prism runtime).
    syntaxHighlight: false,
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: "append",
          properties: { className: ["heading-anchor"] },
          content: { type: "text", value: "#" },
        },
      ],
      [
        rehypePrettyCode,
        {
          theme: {
            dark: "github-dark",
            light: "github-light",
          },
          keepBackground: true,
          onVisitLine(node: any) {
            if (!node.properties.className) node.properties.className = [];
            node.properties.className.push("code-line");
          },
          onVisitHighlightedLine(node: any) {
            if (!node.properties.className) node.properties.className = [];
            node.properties.className.push("code-line--highlighted");
          },
        },
      ],
    ],
  },
});
