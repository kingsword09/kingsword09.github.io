function getCodeText(codeEl: HTMLElement): string {
  const lines = codeEl.querySelectorAll<HTMLElement>(".code-line");
  if (lines.length > 0) {
    return Array.from(lines, (line) => line.textContent ?? "").join("\n").trimEnd();
  }
  return (codeEl.textContent ?? "").trimEnd();
}

async function writeToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "-9999px";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  const execCommand = (
    document as unknown as { execCommand?: (commandId: string) => boolean }
  ).execCommand;
  execCommand?.call(document, "copy");
  ta.remove();
}

function enhanceCodeBlocks() {
  const figures = document.querySelectorAll<HTMLElement>(
    'figure[data-rehype-pretty-code-figure]'
  );

  for (const figure of figures) {
    if (figure.querySelector(".code-copy-button")) continue;

    const pre = figure.querySelector("pre");
    const code = pre?.querySelector("code");
    if (!(code instanceof HTMLElement)) continue;

    const text = getCodeText(code);
    if (!text) continue;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "code-copy-button";
    btn.textContent = "Copy";
    btn.setAttribute("aria-label", "Copy code to clipboard");

    let resetTimer: number | null = null;
    const setLabel = (label: string) => {
      btn.textContent = label;
      if (resetTimer) window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        btn.textContent = "Copy";
        resetTimer = null;
      }, 1200);
    };

    btn.addEventListener("click", () => {
      void writeToClipboard(text)
        .then(() => setLabel("Copied"))
        .catch(() => setLabel("Failed"));
    });

    figure.appendChild(btn);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", enhanceCodeBlocks);
} else {
  enhanceCodeBlocks();
}
