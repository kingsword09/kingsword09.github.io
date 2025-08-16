class ChatApp {
  constructor() {
    // Floating widget elements
    this.chatWidget = document.querySelector(".chat-widget");
    this.chatFab = document.getElementById("chatFab");
    this.chatCloseBtn = document.getElementById("chatCloseBtn");

    this.container = document.querySelector(".chat-widget .chat-container");
    this.resizeHandle = document.querySelector(".chat-resize-handle");
    this._resizeState = null;

    this.chatMessages = document.getElementById("chatMessages");
    this.chatInput = document.getElementById("chatInput");
    this.sendButton = document.getElementById("sendButton");
    this.statusIndicator = document.getElementById("statusIndicator");

    this.session = null;
    this.isLoading = false;

    // Bind events immediately so UI works even if AI API is unavailable
    this.bindEvents();
    // Apply saved size if any
    this.applySavedSize();
    this.init();
  }

  // 从页面提取上下文：标题、URL、主要内容与小标题，做长度限制
  buildPageContext() {
    try {
      const parts = [];
      const title = document.querySelector('h1.title')?.textContent?.trim() || document.title || '';
      if (title) parts.push(`标题: ${title}`);

      const canonical = document.querySelector('link[rel="canonical"]')?.href || location.href;
      if (canonical) parts.push(`URL: ${canonical}`);

      const metaDesc = document.querySelector('meta[name="description"]')?.content?.trim();
      if (metaDesc) parts.push(`摘要: ${metaDesc}`);

      // 主内容优先选用文章布局中的 section.post
      const mainEl = document.querySelector('section.post')
        || document.querySelector('main')
        || document.querySelector('article')
        || document.querySelector('#main-content')
        || document.body;

      // 收集小标题
      const headings = Array.from(mainEl.querySelectorAll('h2, h3'))
        .map(h => h.textContent.trim())
        .filter(Boolean);
      if (headings.length) parts.push(`小标题: ${headings.join(' | ')}`);

      // 提取纯文本内容
      const text = this.extractVisibleText(mainEl);
      // 压缩空白并截断，避免超长
      const normalized = text.replace(/\s+/g, ' ').trim();
      const maxLen = 4000; // 约束长度，避免超出模型上下文
      const content = normalized.slice(0, maxLen);
      if (content) parts.push(`正文节选: ${content}`);

      return parts.join('\n');
    } catch (e) {
      console.warn('构建页面上下文失败:', e);
      return '';
    }
  }

  // 提取可见文本，跳过脚本/样式/不显示元素
  extractVisibleText(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (/(SCRIPT|STYLE|NOSCRIPT|IFRAME|CANVAS|SVG)/.test(tag)) return NodeFilter.FILTER_REJECT;
        const style = window.getComputedStyle(parent);
        if (style && (style.display === 'none' || style.visibility === 'hidden')) return NodeFilter.FILTER_REJECT;
        const val = node.nodeValue?.trim();
        return val ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const chunks = [];
    while (walker.nextNode()) chunks.push(walker.currentNode.nodeValue.trim());
    return chunks.join(' ');
  }

  async init() {
    this.updateStatus("loading");
    const LM = window.LanguageModel || (window.ai && window.ai.languageModel);
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
      const baseOptions = {
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
        let progressEl = this.addMessage("正在下载离线模型… 0%", "assistant");
        const contentEl = progressEl.querySelector(".message-content");

        this.session = await LM.create({
          ...baseOptions,
          monitor(m) {
            m.addEventListener("downloadprogress", (e) => {
              const pct = Math.min(
                100,
                Math.max(0, Math.round(e.loaded * 100))
              );
              if (contentEl)
                contentEl.textContent = `正在下载离线模型… ${pct}%`;
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

  bindEvents() {
    // Floating open/close
    if (this.chatFab) {
      this.chatFab.addEventListener("click", () => this.openWidget());
    }
    if (this.chatCloseBtn) {
      this.chatCloseBtn.addEventListener("click", () => this.closeWidget());
    }
    // ESC to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeWidget();
    });

    this.sendButton.addEventListener("click", () => this.sendMessage());

    this.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.chatInput.addEventListener("input", () => {
      this.autoResize();
    });

    // Resize handlers
    if (this.resizeHandle) {
      const start = (e) => this.startResize(e);
      this.resizeHandle.addEventListener("mousedown", start);
      this.resizeHandle.addEventListener("touchstart", start, { passive: false });
    }
    // Global move/end listeners (attached once)
    window.addEventListener("mousemove", (e) => this.onResizeMove(e));
    window.addEventListener("touchmove", (e) => this.onResizeMove(e), { passive: false });
    window.addEventListener("mouseup", () => this.endResize());
    window.addEventListener("touchend", () => this.endResize());
  }

  autoResize() {
    this.chatInput.style.height = "auto";
    this.chatInput.style.height =
      Math.min(this.chatInput.scrollHeight, 120) + "px";
  }

  async sendMessage() {
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
      this.addMessage(
        "抱歉，我现在无法回答您的问题。请稍后再试。",
        "assistant"
      );
    } finally {
      this.setLoading(false);
    }
  }

  addMessage(content, type) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = type === "user" ? "我" : "AI";

    const messageContent = document.createElement("div");
    messageContent.className = "message-content";
    if (type === "assistant") {
      try {
        const markedApi = window.marked;
        const rawHtml = markedApi
          ? (markedApi.parse ? markedApi.parse(content) : markedApi(content))
          : content;
        const safeHtml = window.DOMPurify
          ? window.DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } })
          : rawHtml;
        messageContent.innerHTML = safeHtml;
      } catch (err) {
        console.warn("Markdown 渲染失败，退回纯文本:", err);
        messageContent.textContent = content;
      }
    } else {
      messageContent.textContent = content;
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);

    const welcomeMessage = this.chatMessages.querySelector(".welcome-message");
    if (welcomeMessage) {
      welcomeMessage.remove();
    }

    this.chatMessages.appendChild(messageDiv);
    // Syntax highlight for code blocks inside assistant messages
    try {
      if (type === "assistant" && window.Prism && typeof window.Prism.highlightAllUnder === "function") {
        window.Prism.highlightAllUnder(messageDiv);
      }
    } catch {}
    this.scrollToBottom();

    return messageDiv;
  }

  addLoadingMessage() {
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

  showError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent = message;

    this.chatMessages.appendChild(errorDiv);
    this.scrollToBottom();
  }

  setLoading(loading) {
    this.isLoading = loading;
    this.sendButton.disabled = loading;
    this.chatInput.disabled = loading;
  }

  updateStatus(status) {
    const indicator = this.statusIndicator;
    indicator.className = "status-indicator";

    switch (status) {
      case "ready":
        indicator.style.background = "#4ade80";
        break;
      case "error":
        indicator.style.background = "#ef4444";
        break;
      case "loading":
        indicator.style.background = "#ffa64d";
        break;
    }
  }

  scrollToBottom() {
    setTimeout(() => {
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }, 100);
  }

  openWidget() {
    if (!this.chatWidget) return;
    this.chatWidget.classList.add("open");
    const dialog = this.chatWidget.querySelector(".chat-container");
    if (dialog) {
      dialog.setAttribute("aria-hidden", "false");
    }
    // Ensure saved size is applied when opening
    this.applySavedSize();
    // focus input after transition
    setTimeout(() => {
      this.chatInput && this.chatInput.focus();
    }, 200);
  }

  closeWidget() {
    if (!this.chatWidget) return;
    this.chatWidget.classList.remove("open");
    const dialog = this.chatWidget.querySelector(".chat-container");
    if (dialog) {
      dialog.setAttribute("aria-hidden", "true");
    }
  }

  applySavedSize() {
    if (!this.container) return;
    try {
      const saved = localStorage.getItem("chat:size");
      if (!saved) return;
      const { w, h } = JSON.parse(saved);
      if (w) this.container.style.width = `${w}px`;
      if (h) this.container.style.height = `${h}px`;
    } catch {}
  }

  startResize(e) {
    if (!this.container) return;
    e.preventDefault();
    const isTouch = e.type.startsWith("touch");
    const point = isTouch ? e.touches[0] : e;
    const rect = this.container.getBoundingClientRect();
    this._resizeState = {
      startX: point.clientX,
      startY: point.clientY,
      startW: rect.width,
      startH: rect.height,
      from: "left-bottom", // current handle at bottom-left
    };
  }

  onResizeMove(e) {
    if (!this._resizeState || !this.container) return;
    const isTouch = e.type.startsWith("touch");
    const point = isTouch ? e.touches[0] : e;
    if (isTouch) e.preventDefault();

    const dx = point.clientX - this._resizeState.startX;
    const dy = point.clientY - this._resizeState.startY;

    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const maxW = Math.min(vw - 40, 960); // keep a margin; cap to 960px
    const maxH = vh - 120; // leave space per layout
    const minW = 280;
    const minH = 320;

    // If resizing from left, invert horizontal delta so dragging left increases width
    const fromLeft = this._resizeState.from && this._resizeState.from.includes("left");
    let newW = this._resizeState.startW + (fromLeft ? -dx : dx);
    let newH = this._resizeState.startH + dy;
    newW = Math.max(minW, Math.min(maxW, newW));
    newH = Math.max(minH, Math.min(maxH, newH));

    this.container.style.width = `${newW}px`;
    this.container.style.height = `${newH}px`;
  }

  endResize() {
    if (!this._resizeState || !this.container) return;
    // persist
    try {
      const rect = this.container.getBoundingClientRect();
      localStorage.setItem("chat:size", JSON.stringify({ w: Math.round(rect.width), h: Math.round(rect.height) }));
    } catch {}
    this._resizeState = null;
  }
}

// 初始化应用（仅在聊天页面存在容器时）
document.addEventListener("DOMContentLoaded", () => {
  if (document.querySelector(".chat-container")) {
    new ChatApp();
  }
});
