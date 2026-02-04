import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { site } from "../src/config/site";
import {
  getGitHubContributedRepos,
  getGitHubRepos,
  getGitHubUser,
} from "../src/utils/github";

type GitHubCache = {
  generatedAt: string;
  user: Awaited<ReturnType<typeof getGitHubUser>>;
  recent: Awaited<ReturnType<typeof getGitHubRepos>>;
  contributed: Awaited<ReturnType<typeof getGitHubContributedRepos>>;
  contributedMinStars: number;
};

function asInt(input: string | undefined, fallback: number): number {
  const n = Number.parseInt(input ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function main() {
  const username = site.author.github;
  if (!username) {
    throw new Error("Missing site.author.github in src/config/site.ts");
  }

  const contributedMinStars = asInt(process.env.CONTRIBUTED_MIN_STARS, 1000);
  const recentLimit = asInt(process.env.RECENT_LIMIT, 8);
  const recentDisplayLimit = asInt(process.env.RECENT_DISPLAY_LIMIT, 6);
  const contributedLimit = asInt(process.env.CONTRIBUTED_LIMIT, 100);

  const outFile = path.join(process.cwd(), "src", "data", "github.json");

  const [user, recentRaw, contributedRaw] = await Promise.all([
    getGitHubUser(username),
    getGitHubRepos(username, { limit: recentLimit }),
    getGitHubContributedRepos(username, {
      limit: contributedLimit,
      minStars: contributedMinStars,
    }),
  ]);

  const recent = recentRaw.slice(0, recentDisplayLimit);

  const displayedNames = new Set<string>(recent.map((r) => r.full_name));
  const contributed = contributedRaw
    .filter((r) => !displayedNames.has(r.full_name))
    .filter((r) => r.pr_count > 0);
  contributed.sort(
    (a, b) =>
      b.pr_count - a.pr_count ||
      b.stargazers_count - a.stargazers_count ||
      a.full_name.localeCompare(b.full_name)
  );

  const payload: GitHubCache = {
    generatedAt: new Date().toISOString(),
    user,
    recent,
    contributed,
    contributedMinStars,
  };

  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, JSON.stringify(payload, null, 2) + "\n", "utf8");

  console.log(`[sync-github] wrote ${path.relative(process.cwd(), outFile)}`);
  console.log(
    `[sync-github] user=${user?.login ?? "null"} recent=${recent.length} contributed=${contributed.length} (>=${contributedMinStars}★, merged PRs only)`
  );

  if (contributed.length === 0) {
    console.log(
      `[sync-github] contributed is empty: set GITHUB_TOKEN in .env to fetch contributed repos`
    );
  }
}

main().catch((err) => {
  console.error("[sync-github] failed:", err);
  process.exitCode = 1;
});
