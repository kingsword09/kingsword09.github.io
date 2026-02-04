import { readFileSync } from "node:fs";
import path from "node:path";

function normalizeSiteUrl(input: string): string {
  const v = input.trim();
  if (!v) throw new Error("Empty site url");
  if (v.startsWith("http://") || v.startsWith("https://")) return v.replace(/\/+$/, "");
  return `https://${v.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function getSiteUrl(): string {
  const fromEnv = process.env.SITE_URL;
  if (fromEnv) return normalizeSiteUrl(fromEnv);

  try {
    const cnamePath = path.join(process.cwd(), "public", "CNAME");
    const cname = readFileSync(cnamePath, "utf8").trim();
    if (cname) return normalizeSiteUrl(cname);
  } catch {}

  return "http://localhost:4321";
}

export const site = {
  title: "kingsword09",
  greetings: "Hello there! 👋",
  aboutme: "https://github.com/kingsword09",
  description: "Kingsword09's Personal Blog",
  lang: "zh-CN",
  timezone: "Asia/Hong_Kong",

  // Production site URL (used for canonical URLs, feeds, sitemap, etc.)
  url: getSiteUrl(),

  // GitHub repo (optional, used in footer)
  repo: "https://github.com/kingsword09/kingsword09.github.io",

  // Theme default (script may override via localStorage / prefers-color-scheme)
  defaultTheme: "dark" as const,

  // Analytics
  gaMeasurementId: "G-FCFRN1JJF7",

  // Font settings (Google Fonts querystring)
  googleWebFonts:
    "family=JetBrains+Mono:wght@100;200;300;400;500;600;700;800",

  // Comments
  commentsEnabled: true,
  disqusIdentifier: "" as string | "",

  // Chat widget (Chrome Prompt API)
  chatEnabled: true,
  chromeOriginTrialToken:
    "AxrdRhGha6dNDghmUqJpOG5KduqZq0dFrp5yRcutglbiG+n5YsflRI/QqyBqH+YHw7eXfEO/rJFdX603YoC50A4AAACOeyJvcmlnaW4iOiJodHRwczovL2Jsb2cua2luZ3N3b3JkLnRlY2g6NDQzIiwiZmVhdHVyZSI6IkFJUHJvbXB0QVBJTXVsdGltb2RhbElucHV0IiwiZXhwaXJ5IjoxNzc0MzEwNDAwLCJpc1N1YmRvbWFpbiI6dHJ1ZSwiaXNUaGlyZFBhcnR5Ijp0cnVlfQ==",

  author: {
    name: "kingsword09",
    bio: "personal blog",
    username: "kingsword09",
    github: "kingsword09",
    twitter: "kingsword09",
    email: "kingsword09@gmail.com",
    avatarUrl: "https://github.com/kingsword09.png",
  },
} as const;
