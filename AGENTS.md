# AGENTS.md

This repo is a static blog built with Astro + TypeScript. Package manager: Bun. Deployed to GitHub Pages.

## Quick commands

- Install deps: `bun install`
- Dev server: `bun run dev`
- Typecheck: `bun run check`
- Build: `bun run build`
- Preview build: `bun run preview`
- Refresh GitHub cache for `/about/`: `bun run sync:github`

## Writing a new post

Posts live in `src/content/posts/*.md` (Astro content collection).

1. Create a new file: `src/content/posts/<slug>.md`
   - `<slug>` becomes the URL slug (do **not** rename after publishing, or the URL will change).
2. Add frontmatter (schema is in `src/content/config.ts`):

```yaml
---
title: "Your title"
description: "Optional short description"
summary: "Optional longer summary"
tags:
  - coding
minute: 5
pubDate: "2026-02-04"
---
```

Notes:
- `title` and `pubDate` are required.
- `pubDate` should be `YYYY-MM-DD` (it is parsed as a date).
- `tags` is an array of strings. Prefer lowercase + kebab-case (e.g. `react-native`, `tauri2`).

3. Write content in Markdown (GFM is enabled, so tables/task lists are supported).
4. Preview locally:
   - Run `bun run dev`
   - The permalink format is `/YYYY/MM/DD/<slug>/` (date comes from `pubDate`).
5. Before pushing, run `bun run check` and `bun run build`.

## Publishing

Deployment is handled by GitHub Actions on push to `main` (see `.github/workflows/deploy.yml`).

Typical flow:
- Commit your new/edited post(s)
- Push to `main` (or open a PR, then merge)

If you still see a `pages-build-deployment` workflow running Jekyll, go to GitHub repo Settings → Pages → Source and switch to **GitHub Actions**.

## Site URL (custom domain)

The site URL is used to generate canonical URLs, feeds, and sitemap entries.

Resolution order:
1. `SITE_URL` env var (optional override)
2. `public/CNAME` (recommended single source of truth)
3. Fallback: `http://localhost:4321`

## Adding / using tags

No tag registry exists. Just add new tag strings to a post’s `tags` frontmatter.

- Tags index: `/tag/`
- Tag page: `/tag/<tag>/` (generated automatically for all tags found in posts)

## Updating GitHub data for `/about/` (optional)

The About page reads cached GitHub data from `src/data/github.json`.

- Refresh cache: `bun run sync:github`
- Pinned repos, contributed repos, and PR counts require GitHub GraphQL, so set a local `GITHUB_TOKEN` in `.env`.

Token tips (fine-grained PAT, read-only):
- Account permissions: `Profile` → Read
- Repository permissions: `Metadata` → Read, `Issues` → Read, `Pull requests` → Read
