type Theme = "dark" | "light";

function getStoredTheme(): Theme | null {
  try {
    const v = window.localStorage.getItem("theme");
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

function getPreferredTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) return stored;

  if (window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    window.localStorage.setItem("theme", theme);
  } catch {
    // ignore storage failures (private mode, etc.)
  }

  const toggle = document.getElementById("theme-toggle");
  if (toggle) {
    // Kept for backward-compat (some CSS/old code may depend on these classes).
    if (theme === "dark") {
      toggle.classList.add("sun");
      toggle.classList.remove("moon");
    } else {
      toggle.classList.add("moon");
      toggle.classList.remove("sun");
    }
  }
}

function initTheme() {
  // Apply once on load
  applyTheme(getPreferredTheme());

  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTheme);
} else {
  initTheme();
}

