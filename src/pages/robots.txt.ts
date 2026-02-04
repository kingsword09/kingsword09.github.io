import type { APIRoute } from "astro";
import { absoluteUrl } from "../utils/absolute";

export const GET: APIRoute = async () => {
  const body = `User-agent: *\nSitemap: ${absoluteUrl("/sitemap.xml")}\n`;
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
};

