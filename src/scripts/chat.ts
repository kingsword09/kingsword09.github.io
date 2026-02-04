import { marked } from "marked";
import createDOMPurify from "dompurify";

const DOMPurify = createDOMPurify(window);

type PrismInstance = {
  highlightElement: (element: Element) => void;
};

let prismPromise: Promise<PrismInstance> | null = null;
const prismLoadedLanguages = new Set<string>();

async function loadPrism(): Promise<PrismInstance> {
  if (prismPromise) return prismPromise;

  prismPromise = (async () => {
    const mod = (await import("prismjs")) as unknown as { default?: unknown };
    const Prism = (mod.default ?? mod) as PrismInstance;

    // Base languages required by many others.
    await Promise.allSettled([
      import("prismjs/components/prism-markup"),
      import("prismjs/components/prism-css"),
      import("prismjs/components/prism-clike"),
      import("prismjs/components/prism-javascript"),
    ]);
    prismLoadedLanguages.add("markup");
    prismLoadedLanguages.add("css");
    prismLoadedLanguages.add("clike");
    prismLoadedLanguages.add("javascript");

    return Prism;
  })();

  try {
    return await prismPromise;
  } catch (err) {
    prismPromise = null;
    throw err;
  }
}

function getLanguageFromClass(el: Element | null): string | null {
  if (!el) return null;
  const className = el.getAttribute("class") ?? "";
  const match =
    className.match(/(?:^|\s)language-([a-z0-9_-]+)/i) ??
    className.match(/(?:^|\s)lang-([a-z0-9_-]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function normalizeLanguage(lang: string | null): string | null {
  if (!lang) return null;
  const l = lang.toLowerCase();
  const alias: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    sh: "bash",
    shell: "bash",
    zsh: "bash",
    rs: "rust",
  };
  return alias[l] ?? l;
}

const prismLanguageLoaders: Record<string, () => Promise<unknown>> = {
  bash: () => import("prismjs/components/prism-bash"),
  typescript: () => import("prismjs/components/prism-typescript"),
  json: () => import("prismjs/components/prism-json"),
  toml: () => import("prismjs/components/prism-toml"),
  diff: () => import("prismjs/components/prism-diff"),
  rust: () => import("prismjs/components/prism-rust"),
  kotlin: () => import("prismjs/components/prism-kotlin"),
};

async function loadPrismLanguages(langs: Iterable<string>): Promise<void> {
  const toLoad = new Set<string>();
  for (const raw of langs) {
    const lang = normalizeLanguage(raw);
    if (!lang) continue;
    if (prismLoadedLanguages.has(lang)) continue;
    if (!prismLanguageLoaders[lang]) continue;
    toLoad.add(lang);
  }

  if (toLoad.size === 0) return;

  await Promise.allSettled(
    Array.from(toLoad, (lang) => prismLanguageLoaders[lang]())
  );

  for (const lang of toLoad) prismLoadedLanguages.add(lang);
}

async function highlightCodeBlocks(root: Element): Promise<void> {
  const codeEls = Array.from(root.querySelectorAll<HTMLElement>("pre code")).filter(
    (el) => !el.dataset.chatHighlighted
  );
  if (codeEls.length === 0) return;

  const langs = new Set<string>();
  for (const codeEl of codeEls) {
    const rawLang =
      getLanguageFromClass(codeEl) ?? getLanguageFromClass(codeEl.parentElement);
    const lang = normalizeLanguage(rawLang);
    if (lang) langs.add(lang);
  }

  let Prism: PrismInstance;
  try {
    Prism = await loadPrism();
    await loadPrismLanguages(langs);
  } catch {
    // If Prism fails to load, keep blocks unmarked so we can retry later.
    return;
  }

  for (const codeEl of codeEls) {
    const rawLang =
      getLanguageFromClass(codeEl) ?? getLanguageFromClass(codeEl.parentElement);
    const lang = normalizeLanguage(rawLang);
    if (!lang) {
      codeEl.dataset.chatHighlighted = "true";
      continue;
    }

    // Ensure Prism can detect language (looks up class on <code> or ancestors)
    if (!codeEl.className.includes("language-")) codeEl.classList.add(`language-${lang}`);
    const pre = codeEl.parentElement;
    if (pre && !pre.className.includes("language-")) pre.classList.add(`language-${lang}`);

    try {
      Prism.highlightElement(codeEl);
    } catch {
      // ignore per-element failures
    } finally {
      codeEl.dataset.chatHighlighted = "true";
    }
  }
}

type ResizeFrom = "left-bottom" | "right-bottom";

interface ResizeState {
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  from: ResizeFrom;
}

interface ChatElements {
  chatWidget: HTMLElement;
  chatFab: HTMLButtonElement;
  chatCloseBtn: HTMLButtonElement;
  container: HTMLElement;
  resizeHandle: HTMLElement | null;
  chatMessages: HTMLElement;
  chatInput: HTMLTextAreaElement;
  sendButton: HTMLButtonElement;
  statusIndicator: HTMLElement;
}

function getRequiredEls(): ChatElements | null {
  const chatWidget = document.querySelector<HTMLElement>(".chat-widget");
  const container = document.querySelector<HTMLElement>(".chat-widget .chat-container");
  if (!chatWidget || !container) return null;

  const chatFabEl = document.getElementById("chatFab");
  const chatCloseBtnEl = document.getElementById("chatCloseBtn");
  const chatMessagesEl = document.getElementById("chatMessages");
  const chatInputEl = document.getElementById("chatInput");
  const sendButtonEl = document.getElementById("sendButton");
  const statusIndicatorEl = document.getElementById("statusIndicator");
  const resizeHandle = document.querySelector<HTMLElement>(".chat-resize-handle");

  if (
    !(chatFabEl instanceof HTMLButtonElement) ||
    !(chatCloseBtnEl instanceof HTMLButtonElement) ||
    !(chatMessagesEl instanceof HTMLElement) ||
    !(chatInputEl instanceof HTMLTextAreaElement) ||
    !(sendButtonEl instanceof HTMLButtonElement) ||
    !(statusIndicatorEl instanceof HTMLElement)
  ) {
    console.warn("[chat] missing required elements; chat disabled.");
    return null;
  }

  return {
    chatWidget,
    chatFab: chatFabEl,
    chatCloseBtn: chatCloseBtnEl,
    container,
    resizeHandle,
    chatMessages: chatMessagesEl,
    chatInput: chatInputEl,
    sendButton: sendButtonEl,
    statusIndicator: statusIndicatorEl,
  };
}

class ChatApp {
  private readonly chatWidget: HTMLElement;
  private readonly chatFab: HTMLButtonElement;
  private readonly chatCloseBtn: HTMLButtonElement;
  private readonly container: HTMLElement;
  private readonly resizeHandle: HTMLElement | null;
  private resizeState: ResizeState | null = null;

  private readonly chatMessages: HTMLElement;
  private readonly chatInput: HTMLTextAreaElement;
  private readonly sendButton: HTMLButtonElement;
  private readonly statusIndicator: HTMLElement;

  private session: LanguageModelSession | null = null;
  private isLoading = false;

  constructor(els: ChatElements) {
    this.chatWidget = els.chatWidget;
    this.chatFab = els.chatFab;
    this.chatCloseBtn = els.chatCloseBtn;
    this.container = els.container;
    this.resizeHandle = els.resizeHandle;
    this.chatMessages = els.chatMessages;
    this.chatInput = els.chatInput;
    this.sendButton = els.sendButton;
    this.statusIndicator = els.statusIndicator;

    // Bind events immediately so UI works even if AI API is unavailable
    this.bindEvents();
    // Apply saved size if any
    this.applySavedSize();
    void this.init();
  }

  // 从页面提取上下文：标题、URL、主要内容与小标题，做长度限制
  private buildPageContext(): string {
    try {
      const parts: string[] = [];
      const title =
        document.querySelector("h1.title")?.textContent?.trim() ||
        document.title ||
        "";
      if (title) parts.push(`标题: ${title}`);

      const canonical =
        document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ||
        window.location.href;
      if (canonical) parts.push(`URL: ${canonical}`);

      const metaDesc = document
        .querySelector<HTMLMetaElement>('meta[name="description"]')
        ?.content?.trim();
      if (metaDesc) parts.push(`摘要: ${metaDesc}`);

      // 主内容优先选用文章布局中的 section.post
      const mainEl =
        document.querySelector<HTMLElement>("section.post") ||
        document.querySelector<HTMLElement>("main") ||
        document.querySelector<HTMLElement>("article") ||
        document.querySelector<HTMLElement>("#main-content") ||
        document.body;

      // 收集小标题
      const headings = Array.from(mainEl.querySelectorAll("h2, h3"))
        .map((h) => h.textContent?.trim() || "")
        .filter(Boolean);
      if (headings.length) parts.push(`小标题: ${headings.join(" | ")}`);

      // 提取纯文本内容
      const text = this.extractVisibleText(mainEl);
      // 压缩空白并截断，避免超长
      const normalized = text.replace(/\s+/g, " ").trim();
      const maxLen = 4000; // 约束长度，避免超出模型上下文
      const content = normalized.slice(0, maxLen);
      if (content) parts.push(`正文节选: ${content}`);

      return parts.join("\n");
    } catch (e) {
      console.warn("构建页面上下文失败:", e);
      return "";
    }
  }

  // 提取可见文本，跳过脚本/样式/不显示元素
  private extractVisibleText(root: Node): string {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node: Node) => {
        const parent = (node as Text).parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (/(SCRIPT|STYLE|NOSCRIPT|IFRAME|CANVAS|SVG)/.test(tag))
          return NodeFilter.FILTER_REJECT;
        const style = window.getComputedStyle(parent);
        if (
          style &&
          (style.display === "none" || style.visibility === "hidden")
        )
          return NodeFilter.FILTER_REJECT;
        const val = (node as Text).nodeValue?.trim();
        return val ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });

    const chunks: string[] = [];
    while (walker.nextNode()) {
      const v = (walker.currentNode as Text).nodeValue?.trim();
      if (v) chunks.push(v);
    }
    return chunks.join(" ");
  }

  private async init() {
    this.updateStatus("loading");

    const LM = window.LanguageModel || window.ai?.languageModel;
    if (!LM) {
      this.updateStatus("error");
      this.showError(
        "您的浏览器未启用 Prompt API。请使用 Dev/Canary 或开启实验/Origin Trial。"
      );
      return;
    }

    try {
      const availability = await LM.availability();
      if (availability === "unavailable") {
        this.updateStatus("error");
        this.showError(
          "Prompt API 当前不可用：可能缺少 Origin Trial、硬件/系统不满足，或在不支持的平台上。"
        );
        return;
      }

      const pageContext = this.buildPageContext();
      const baseOptions: LanguageModelCreateOptions = {
        initialPrompts: [
          {
            role: "system",
            content: `你是一个专业的博客内容问答助手。请用中文回答用户关于博客内容的问题。
            回答要求：
            1. 简洁明了，重点突出
            2. 友好亲切的语调
            3. 如果不确定答案，请诚实说明
            4. 适当使用emoji让回答更生动`,
          },
          {
            role: "user",
            content: `页面上下文：\n${pageContext}`,
          },
        ],
        topK: 10,
        temperature: 0.7,
      };

      // 如果需要下载模型，显示进度
      if (availability === "downloadable" || availability === "downloading") {
        const progressEl = this.addMessage("正在下载离线模型… 0%", "assistant");
        const contentEl =
          progressEl.querySelector<HTMLElement>(".message-content");

        this.session = await LM.create({
          ...baseOptions,
          monitor(m) {
            m.addEventListener("downloadprogress", (e: Event) => {
              // Non-standard event payload; best-effort typing.
              const loaded = (e as unknown as { loaded?: number }).loaded ?? 0;
              const pct = Math.min(100, Math.max(0, Math.round(loaded * 100)));
              if (contentEl) contentEl.textContent = `正在下载离线模型… ${pct}%`;
            });
          },
        });

        // 下载完成，更新提示
        if (contentEl) contentEl.textContent = "离线模型就绪 ✅";
      } else {
        // available
        this.session = await LM.create(baseOptions);
      }

      this.updateStatus("ready");
    } catch (error) {
      console.error("AI初始化失败:", error);
      this.showError("AI助手初始化失败。消息仍可发送，但暂无法获得 AI 回答。");
      this.updateStatus("error");
    }
  }

  private bindEvents() {
    // Floating open/close
    this.chatFab.addEventListener("click", () => this.openWidget());
    this.chatCloseBtn.addEventListener("click", () => this.closeWidget());

    // ESC to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeWidget();
    });

    this.sendButton.addEventListener("click", () => void this.sendMessage());

    this.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void this.sendMessage();
      }
    });

    this.chatInput.addEventListener("input", () => {
      this.autoResize();
    });

    // Resize handlers
    if (this.resizeHandle) {
      const start = (e: MouseEvent | TouchEvent) => this.startResize(e);
      this.resizeHandle.addEventListener("mousedown", start as EventListener);
      this.resizeHandle.addEventListener("touchstart", start as EventListener, {
        passive: false,
      });
    }

    // Global move/end listeners (attached once)
    window.addEventListener("mousemove", (e) => this.onResizeMove(e));
    window.addEventListener("touchmove", (e) => this.onResizeMove(e), {
      passive: false,
    });
    window.addEventListener("mouseup", () => this.endResize());
    window.addEventListener("touchend", () => this.endResize());
  }

  private autoResize() {
    this.chatInput.style.height = "auto";
    this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 120) + "px";
  }

  private async sendMessage() {
    const message = this.chatInput.value.trim();
    if (!message || this.isLoading) return;

    this.addMessage(message, "user");
    this.chatInput.value = "";
    this.autoResize();

    // If session is not ready, gracefully inform user and return
    if (!this.session) {
      this.addMessage(
        "当前无法连接 AI 服务。已收到你的消息，稍后再试或在支持的浏览器中使用。",
        "assistant"
      );
      return;
    }

    this.setLoading(true);
    const loadingElement = this.addLoadingMessage();

    try {
      const response = await this.session.prompt(message);
      loadingElement.remove();
      this.addMessage(response, "assistant");
    } catch (error) {
      console.error("AI回复失败:", error);
      loadingElement.remove();
      this.addMessage("抱歉，我现在无法回答您的问题。请稍后再试。", "assistant");
    } finally {
      this.setLoading(false);
    }
  }

  private addMessage(content: string, type: "user" | "assistant") {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = type === "user" ? "我" : "AI";

    const messageContent = document.createElement("div");
    messageContent.className = "message-content";

    if (type === "assistant") {
      try {
        const parsed = marked.parse(content);
        if (typeof parsed === "string") {
          messageContent.innerHTML = DOMPurify.sanitize(parsed, {
            USE_PROFILES: { html: true },
          });
        } else {
          // Async parsing (rare): render plain text first, then upgrade.
          messageContent.textContent = content;
          void parsed
            .then((html) => {
              messageContent.innerHTML = DOMPurify.sanitize(html, {
                USE_PROFILES: { html: true },
              });
              void highlightCodeBlocks(messageDiv);
            })
            .catch(() => {
              // keep plain text
            });
        }
      } catch (err) {
        console.warn("Markdown 渲染失败，退回纯文本:", err);
        messageContent.textContent = content;
      }
    } else {
      messageContent.textContent = content;
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);

    const welcomeMessage =
      this.chatMessages.querySelector<HTMLElement>(".welcome-message");
    if (welcomeMessage) welcomeMessage.remove();

    this.chatMessages.appendChild(messageDiv);

    if (type === "assistant") {
      void highlightCodeBlocks(messageDiv);
    }

    this.scrollToBottom();
    return messageDiv;
  }

  private addLoadingMessage() {
    const messageDiv = document.createElement("div");
    messageDiv.className = "message assistant";

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = "AI";

    const messageContent = document.createElement("div");
    messageContent.className = "message-content";

    const loading = document.createElement("div");
    loading.className = "loading";
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("div");
      dot.className = "loading-dot";
      loading.appendChild(dot);
    }

    messageContent.appendChild(loading);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);

    this.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();

    return messageDiv;
  }

  private showError(message: string) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent = message;

    this.chatMessages.appendChild(errorDiv);
    this.scrollToBottom();
  }

  private setLoading(loading: boolean) {
    this.isLoading = loading;
    this.sendButton.disabled = loading;
    this.chatInput.disabled = loading;
  }

  private updateStatus(status: "ready" | "error" | "loading") {
    const indicator = this.statusIndicator;
    indicator.className = "status-indicator";

    switch (status) {
      case "ready":
        indicator.style.background = "#4ade80";
        indicator.title = "AI 就绪";
        break;
      case "error":
        indicator.style.background = "#ef4444";
        indicator.title = "AI 不可用";
        break;
      case "loading":
        indicator.style.background = "#ffa64d";
        indicator.title = "AI 加载中";
        break;
    }
  }

  private scrollToBottom() {
    window.setTimeout(() => {
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }, 100);
  }

  private openWidget() {
    this.chatWidget.classList.add("open");
    this.container.setAttribute("aria-hidden", "false");
    this.chatFab.setAttribute("aria-expanded", "true");
    this.chatFab.setAttribute("tabindex", "-1");

    // Ensure saved size is applied when opening
    this.applySavedSize();

    // Lazy-load syntax highlighting only when the user opens the widget.
    void loadPrism().catch(() => {
      // ignore
    });
    void highlightCodeBlocks(this.chatMessages);

    // Focus input after transition
    window.setTimeout(() => {
      this.chatInput.focus();
    }, 200);
  }

  private closeWidget() {
    this.chatWidget.classList.remove("open");
    this.container.setAttribute("aria-hidden", "true");
    this.chatFab.setAttribute("aria-expanded", "false");
    this.chatFab.removeAttribute("tabindex");
    this.chatFab.focus();
  }

  private applySavedSize() {
    try {
      const saved = window.localStorage.getItem("chat:size");
      if (!saved) return;
      const parsed = JSON.parse(saved) as { w?: number; h?: number };
      if (parsed.w) this.container.style.width = `${parsed.w}px`;
      if (parsed.h) this.container.style.height = `${parsed.h}px`;
    } catch {
      // ignore
    }
  }

  private startResize(e: MouseEvent | TouchEvent) {
    e.preventDefault();

    const isTouch = e.type.startsWith("touch");
    const point = isTouch
      ? (e as TouchEvent).touches[0]
      : (e as MouseEvent);

    const rect = this.container.getBoundingClientRect();
    const from =
      (this.resizeHandle?.dataset.resizeFrom as ResizeFrom | undefined) ??
      "right-bottom";

    this.resizeState = {
      startX: point.clientX,
      startY: point.clientY,
      startW: rect.width,
      startH: rect.height,
      from,
    };
  }

  private onResizeMove(e: MouseEvent | TouchEvent) {
    if (!this.resizeState) return;

    const isTouch = e.type.startsWith("touch");
    const point = isTouch
      ? (e as TouchEvent).touches[0]
      : (e as MouseEvent);
    if (isTouch) e.preventDefault();

    const dx = point.clientX - this.resizeState.startX;
    const dy = point.clientY - this.resizeState.startY;

    const vw = Math.max(
      document.documentElement.clientWidth,
      window.innerWidth || 0
    );
    const vh = Math.max(
      document.documentElement.clientHeight,
      window.innerHeight || 0
    );
    const maxW = Math.min(vw - 40, 960); // keep a margin; cap to 960px
    const maxH = vh - 120; // leave space per layout
    const minW = 280;
    const minH = 320;

    // If resizing from left, invert horizontal delta so dragging left increases width
    const fromLeft = this.resizeState.from.includes("left");
    let newW = this.resizeState.startW + (fromLeft ? -dx : dx);
    let newH = this.resizeState.startH + dy;
    newW = Math.max(minW, Math.min(maxW, newW));
    newH = Math.max(minH, Math.min(maxH, newH));

    this.container.style.width = `${newW}px`;
    this.container.style.height = `${newH}px`;
  }

  private endResize() {
    if (!this.resizeState) return;

    // Persist size
    try {
      const rect = this.container.getBoundingClientRect();
      window.localStorage.setItem(
        "chat:size",
        JSON.stringify({ w: Math.round(rect.width), h: Math.round(rect.height) })
      );
    } catch {
      // ignore
    }

    this.resizeState = null;
  }
}

function mountChat() {
  const els = getRequiredEls();
  if (!els) return;
  new ChatApp(els);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountChat);
} else {
  mountChat();
}
