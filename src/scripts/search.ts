type SearchIndexItem = {
  title: string;
  description?: string;
  tags?: string[] | string;
  url: string;
  date?: string;
};

function getSearchJsonUrl(): string {
  // Prefer using the feed.json link to preserve BASE_URL (GitHub Pages subpath, etc.).
  const feedLink = document.querySelector<HTMLLinkElement>(
    'link[rel="alternate"][type="application/json"]'
  );
  if (feedLink?.href) {
    return new URL("search.json", feedLink.href).toString();
  }

  // Fallback: assume site is hosted at origin root.
  return new URL("/search.json", window.location.origin).toString();
}

function normalize(input: string): string {
  return input.toLowerCase().trim();
}

function asTagText(tags: SearchIndexItem["tags"]): string {
  if (!tags) return "";
  if (Array.isArray(tags)) return tags.join(" ");
  return tags;
}

function fuzzySubsequenceMatch(haystack: string, needle: string): boolean {
  // Simple & fast fuzzy: checks if all needle chars appear in order in haystack.
  // Good enough for short blog searches; avoids bringing in a heavy search lib.
  let h = 0;
  for (const ch of needle) {
    h = haystack.indexOf(ch, h);
    if (h === -1) return false;
    h += 1;
  }
  return true;
}

function scoreItem(item: SearchIndexItem, q: string): number {
  const title = normalize(item.title);
  const desc = normalize(item.description ?? "");
  const tags = normalize(asTagText(item.tags));

  // Exact & prefix matches should win.
  if (title === q) return 100;
  if (title.startsWith(q)) return 90;
  if (title.includes(q)) return 80;
  if (tags.includes(q)) return 60;
  if (desc.includes(q)) return 40;

  // Fuzzy fallback.
  if (fuzzySubsequenceMatch(title, q)) return 20;
  if (fuzzySubsequenceMatch(tags, q)) return 10;
  if (fuzzySubsequenceMatch(desc, q)) return 5;

  return 0;
}

function renderResults(
  items: SearchIndexItem[],
  resultsEl: HTMLElement,
  query: string
) {
  resultsEl.innerHTML = "";

  const q = normalize(query);
  if (!q) return;

  const scored = items
    .map((item) => ({ item, score: scoreItem(item, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (scored.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No results found..";
    resultsEl.appendChild(li);
    return;
  }

  for (const { item } of scored) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = item.url;
    a.title = item.description ?? "";
    a.textContent = item.title;
    li.appendChild(a);
    resultsEl.appendChild(li);
  }
}

function tryReadInlineIndex(): SearchIndexItem[] | null {
  const el = document.getElementById("search-index");
  if (!el) return null;
  const raw = el.textContent?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as SearchIndexItem[];
  } catch {
    return null;
  }
}

async function fetchIndex(): Promise<SearchIndexItem[]> {
  const res = await fetch(getSearchJsonUrl(), { credentials: "omit" });
  if (!res.ok) throw new Error(`Failed to fetch search index: ${res.status}`);
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) return [];
  return json as SearchIndexItem[];
}

function initSearch() {
  const input = document.getElementById("search-input");
  const results = document.getElementById("search-results");
  if (!(input instanceof HTMLInputElement) || !(results instanceof HTMLElement))
    return;

  let index: SearchIndexItem[] | null = tryReadInlineIndex();
  let indexPromise: Promise<SearchIndexItem[]> | null = null;

  const loadIndex = async (): Promise<SearchIndexItem[]> => {
    if (index) return index;
    if (!indexPromise) indexPromise = fetchIndex();
    index = await indexPromise;
    return index;
  };

  let debounceTimer: number | null = null;

  const onInput = () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      const q = input.value;
      if (!normalize(q)) {
        results.innerHTML = "";
        return;
      }

      void loadIndex()
        .then((items) => renderResults(items, results, q))
        .catch((err) => {
          console.warn("[search] failed to load index:", err);
          results.innerHTML = "";
        });
    }, 80);
  };

  input.addEventListener("input", onInput);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSearch);
} else {
  initSearch();
}

