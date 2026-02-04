# kingsword09.github.io

Static blog built with Astro + TypeScript. Package manager: Bun. Deployed to GitHub Pages.

## Requirements

- Bun

## Local dev

```bash
bun install
bun run dev
```

### Optional: GitHub token (About page contributions)

The `/about/` page reads GitHub data from `src/data/github.json`. Update it occasionally with:

```bash
bun run sync:github
```

Contributed repos (1k+ ★) and PR counts require GitHub GraphQL, so set `GITHUB_TOKEN` locally:

```bash
echo 'GITHUB_TOKEN=ghp_xxx' >> .env
```

If `bun install` hangs at `Resolving dependencies`, try temporarily disabling proxy env vars:

```bash
bun install --no-cache
```

## Scripts

- `bun run dev`: start local dev server
- `bun run build`: build static site into `dist/`
- `bun run preview`: preview `dist/`
- `bun run check`: typecheck Astro + TS

## Content

- Posts: `src/content/posts/*.md`
- Permalinks: `/YYYY/MM/DD/slug/` (kept compatible with the previous Jekyll site)

## Generated endpoints

- `/search.json`
- `/atom.xml`
- `/feed.json`
- `/llms.txt`
- `/llms-full.txt`
- `/sitemap.xml`
