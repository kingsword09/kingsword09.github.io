type GitHubAuth = {
  token?: string;
};

export type GitHubUser = {
  login: string;
  name: string | null;
  html_url: string;
  avatar_url: string;
  bio: string | null;
  blog: string | null;
  company: string | null;
  location: string | null;
  twitter_username: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
};

export type GitHubRepo = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  fork: boolean;
  archived: boolean;
  stargazers_count: number;
  language: string | null;
  pushed_at: string;
};

export type GitHubContributedRepo = GitHubRepo & {
  pr_count: number;
};

type GitHubUserResponse = GitHubUser;
type GitHubRepoResponse = GitHubRepo;

function getGitHubToken(): string | undefined {
  return (
    process.env.GITHUB_TOKEN ??
    process.env.GH_TOKEN ??
    process.env.GITHUB_API_TOKEN ??
    undefined
  );
}

function getGitHubHeaders(auth?: GitHubAuth): HeadersInit {
  const token = auth?.token ?? getGitHubToken();
  const headers: HeadersInit = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "kingsword09.github.io",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

async function fetchGitHubJson<T>(url: string, auth?: GitHubAuth): Promise<T> {
  const res = await fetch(url, { headers: getGitHubHeaders(auth) });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} for ${url}`);
  }
  return (await res.json()) as T;
}

type GitHubGraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

async function fetchGitHubGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
  auth?: GitHubAuth
): Promise<T> {
  const token = auth?.token ?? getGitHubToken();
  if (!token) throw new Error("GitHub GraphQL requires a token");

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      ...getGitHubHeaders({ token }),
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`GitHub GraphQL ${res.status}`);
  }

  const json = (await res.json()) as GitHubGraphQLResponse<T>;
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  if (!json.data) throw new Error("GitHub GraphQL empty data");
  return json.data;
}

const userCache = new Map<string, Promise<GitHubUser | null>>();
const repoCache = new Map<string, Promise<GitHubRepo[]>>();
const pinnedRepoCache = new Map<string, Promise<GitHubRepo[]>>();
const contributedRepoCache = new Map<string, Promise<GitHubContributedRepo[]>>();

function chunkArray<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) return [Array.from(items)];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function escapeGraphQLString(input: string): string {
  return input.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

async function getGitHubPullRequestCountsByRepo(
  username: string,
  fullNames: readonly string[],
  token: string
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const batchSize = 24;

  for (const batch of chunkArray(fullNames, batchSize)) {
    const fields = batch
      .map((fullName, i) => {
        const q = `repo:${fullName} is:pr is:merged author:${username}`;
        return `r${i}: search(query: "${escapeGraphQLString(q)}", type: ISSUE, first: 1) { issueCount }`;
      })
      .join("\n");

    const query = `
      query {
        ${fields}
      }
    `;

    type Resp = Record<string, { issueCount: number }>;
    const data = await fetchGitHubGraphQL<Resp>(query, {}, { token });
    for (let i = 0; i < batch.length; i++) {
      counts.set(batch[i], data[`r${i}`]?.issueCount ?? 0);
    }
  }

  return counts;
}

export async function getGitHubUser(
  username: string,
  auth?: GitHubAuth
): Promise<GitHubUser | null> {
  const key = `${username}::${auth?.token ?? ""}`;
  if (!userCache.has(key)) {
    userCache.set(
      key,
      fetchGitHubJson<GitHubUserResponse>(
        `https://api.github.com/users/${username}`,
        auth
      )
        .then(
          (u): GitHubUser => ({
            login: u.login,
            name: u.name ?? null,
            html_url: u.html_url,
            avatar_url: u.avatar_url,
            bio: u.bio ?? null,
            blog: u.blog ?? null,
            company: u.company ?? null,
            location: u.location ?? null,
            twitter_username: u.twitter_username ?? null,
            public_repos: u.public_repos,
            followers: u.followers,
            following: u.following,
            created_at: u.created_at,
          })
        )
        .catch(() => null)
    );
  }
  return (await userCache.get(key)) ?? null;
}

export async function getGitHubRepos(
  username: string,
  opts?: { limit?: number; auth?: GitHubAuth }
): Promise<GitHubRepo[]> {
  const limit = opts?.limit ?? 6;
  const auth = opts?.auth;
  const key = `${username}::${limit}::${auth?.token ?? ""}`;
  if (!repoCache.has(key)) {
    repoCache.set(
      key,
      fetchGitHubJson<GitHubRepoResponse[]>(
        `https://api.github.com/users/${username}/repos?per_page=100&sort=pushed&direction=desc`,
        auth
      )
        .then((repos) =>
          repos
            .filter((r) => !r.fork && !r.archived)
            .slice(0, limit)
            .map(
              (r): GitHubRepo => ({
                name: r.name,
                full_name: r.full_name,
                html_url: r.html_url,
                description: r.description ?? null,
                fork: r.fork,
                archived: r.archived,
                stargazers_count: r.stargazers_count,
                language: r.language ?? null,
                pushed_at: r.pushed_at,
              })
            )
        )
        .catch(() => [])
    );
  }
  return (await repoCache.get(key)) ?? [];
}

export async function getGitHubPinnedRepos(
  username: string,
  opts?: { limit?: number; auth?: GitHubAuth }
): Promise<GitHubRepo[]> {
  const limit = opts?.limit ?? 6;
  const auth = opts?.auth;
  const token = auth?.token ?? getGitHubToken();
  if (!token) return [];

  const key = `${username}::${limit}::${token}`;
  if (!pinnedRepoCache.has(key)) {
    type Resp = {
      user: {
        pinnedItems: {
          nodes: Array<{
            name: string;
            nameWithOwner: string;
            url: string;
            description: string | null;
            isFork: boolean;
            isArchived: boolean;
            stargazerCount: number;
            pushedAt: string;
            primaryLanguage: { name: string } | null;
          } | null>;
        };
      } | null;
    };

    const query = `
      query($login: String!, $first: Int!) {
        user(login: $login) {
          pinnedItems(first: $first, types: [REPOSITORY]) {
            nodes {
              ... on Repository {
                name
                nameWithOwner
                url
                description
                isFork
                isArchived
                stargazerCount
                pushedAt
                primaryLanguage { name }
              }
            }
          }
        }
      }
    `;

    pinnedRepoCache.set(
      key,
      fetchGitHubGraphQL<Resp>(query, { login: username, first: limit }, { token })
        .then((data) => {
          const nodes = data.user?.pinnedItems.nodes ?? [];
          return nodes
            .filter((n): n is NonNullable<(typeof nodes)[number]> => Boolean(n))
            .filter((r) => !r.isFork && !r.isArchived)
            .map(
              (r): GitHubRepo => ({
                name: r.name,
                full_name: r.nameWithOwner,
                html_url: r.url,
                description: r.description,
                fork: r.isFork,
                archived: r.isArchived,
                stargazers_count: r.stargazerCount,
                language: r.primaryLanguage?.name ?? null,
                pushed_at: r.pushedAt,
              })
            );
        })
        .catch(() => [])
    );
  }

  return (await pinnedRepoCache.get(key)) ?? [];
}

export async function getGitHubContributedRepos(
  username: string,
  opts?: { limit?: number; minStars?: number; auth?: GitHubAuth }
): Promise<GitHubContributedRepo[]> {
  const limit = opts?.limit ?? 50;
  const minStars = opts?.minStars ?? 1000;
  const auth = opts?.auth;
  const token = auth?.token ?? getGitHubToken();
  if (!token) return [];

  const key = `${username}::${limit}::${minStars}::${token}`;
  if (!contributedRepoCache.has(key)) {
    contributedRepoCache.set(
      key,
      (async () => {
        type Resp = {
          user: {
            repositoriesContributedTo: {
              nodes: Array<{
                name: string;
                nameWithOwner: string;
                url: string;
                description: string | null;
                isFork: boolean;
                isArchived: boolean;
                stargazerCount: number;
                pushedAt: string;
                primaryLanguage: { name: string } | null;
              } | null>;
            };
          } | null;
        };

        const query = `
          query($login: String!, $first: Int!) {
            user(login: $login) {
              repositoriesContributedTo(
                first: $first
                includeUserRepositories: false
                contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, PULL_REQUEST_REVIEW]
                orderBy: { field: STARGAZERS, direction: DESC }
              ) {
                nodes {
                  name
                  nameWithOwner
                  url
                  description
                  isFork
                  isArchived
                  stargazerCount
                  pushedAt
                  primaryLanguage { name }
                }
              }
            }
          }
        `;

        const fallbackQuery = `
          query($login: String!, $first: Int!) {
            user(login: $login) {
              repositoriesContributedTo(
                first: $first
                includeUserRepositories: false
              ) {
                nodes {
                  name
                  nameWithOwner
                  url
                  description
                  isFork
                  isArchived
                  stargazerCount
                  pushedAt
                  primaryLanguage { name }
                }
              }
            }
          }
        `;

        const data = await fetchGitHubGraphQL<Resp>(
          query,
          { login: username, first: limit },
          { token }
        ).catch(() =>
          fetchGitHubGraphQL<Resp>(fallbackQuery, { login: username, first: limit }, { token })
        );

        const nodes = data.user?.repositoriesContributedTo.nodes ?? [];
        const repos = nodes
          .filter((n): n is NonNullable<(typeof nodes)[number]> => Boolean(n))
          .filter((r) => !r.isFork && !r.isArchived)
          .filter((r) => r.stargazerCount >= minStars)
          .map(
            (r): GitHubRepo => ({
              name: r.name,
              full_name: r.nameWithOwner,
              html_url: r.url,
              description: r.description,
              fork: r.isFork,
              archived: r.isArchived,
              stargazers_count: r.stargazerCount,
              language: r.primaryLanguage?.name ?? null,
              pushed_at: r.pushedAt,
            })
          );

        if (repos.length === 0) return [];
        const prCounts = await getGitHubPullRequestCountsByRepo(
          username,
          repos.map((r) => r.full_name),
          token
        ).catch(() => new Map<string, number>());

        return repos.map((repo) => ({
          ...repo,
          pr_count: prCounts.get(repo.full_name) ?? 0,
        }));
      })().catch(() => [])
    );
  }

  return (await contributedRepoCache.get(key)) ?? [];
}
