/**
 * Gemini Markdown Viewer - content script
 *
 * Gemini (gemini.google.com) の応答内コードブロックに「プレビュー」ボタンを注入し、
 * クリック時にその時点のコード内容を Markdown としてレンダリングしてモーダル表示する。
 *
 * 依存 (manifest で先に読み込み): marked (window.marked), DOMPurify (window.DOMPurify)
 */
(() => {
  "use strict";

  // Firefox の content script では UMD ライブラリはサンドボックスの globalThis に
  // エクスポートされ、window には付かない (Chrome は globalThis === window)。
  // bare 識別子ならどちらの環境でもスコープチェーンで解決できる。
  const libMarked = typeof marked !== "undefined" ? marked : window.marked;
  const libPurify = typeof DOMPurify !== "undefined" ? DOMPurify : window.DOMPurify;
  const libHljs = typeof hljs !== "undefined" ? hljs : window.hljs;

  // ---------------------------------------------------------------
  // セレクタ定義: Gemini の DOM 構造が変わったらここだけ直す
  // ---------------------------------------------------------------
  const SELECTORS = {
    // Gemini のコードブロックコンポーネント(第一候補)
    codeBlock: "code-block",
    // code-block 内のヘッダーツールバー(コピー ボタン等が並ぶ場所)の候補。
    // 順に querySelector して最初に見つかったものを使う。
    toolbar: [
      ".code-block-decoration .buttons",
      ".code-block-decoration",
      ".header-formatted .buttons",
      "[class*='code-block'] [class*='buttons']",
    ],
    // コード本文
    codeBody: "pre code, pre",
    // フォールバック: code-block 要素が見つからないページ構造向け
    fallbackPre: "pre",
    // ヘッダー内の言語ラベル(最初に見つかったものを使う)
    langLabel: [
      ".code-block-decoration > span",
      ".code-block-decoration span",
      "[class*='decoration'] span",
    ],
  };

  // Gemini の言語ラベル → highlight.js の言語 ID
  const LANG_ALIASES = {
    "c++": "cpp",
    "c#": "csharp",
    "objective-c": "objectivec",
    "shell": "bash",
    "sh": "bash",
    "plain text": "plaintext",
    "text": "plaintext",
    "html": "xml",
  };

  /** ラベル文字列を highlight.js の言語 ID に正規化。不明なら null */
  function normalizeLang(label) {
    if (!label) return null;
    const raw = label.trim().toLowerCase();
    if (!raw) return null;
    const lang = LANG_ALIASES[raw] || raw;
    if (lang === "markdown" || lang === "md") return "markdown";
    return libHljs && libHljs.getLanguage(lang) ? lang : null;
  }

  const ATTACHED_ATTR = "data-mdv-attached";
  const DEBOUNCE_MS = 300;

  // ---------------------------------------------------------------
  // プレビューボタン
  // ---------------------------------------------------------------
  function createPreviewButton(getText, getLang) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mdv-preview-btn";
    btn.title = "レンダリングして表示";
    btn.textContent = "プレビュー";
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const text = getText();
      if (text && text.trim()) {
        openModal(text, getLang ? getLang() : null);
      }
    });
    return btn;
  }

  /** code-block 要素 1 つにボタンを注入する */
  function attachToCodeBlock(block) {
    if (block.hasAttribute(ATTACHED_ATTR)) return;
    block.setAttribute(ATTACHED_ATTR, "1");

    // クリック時点の最新テキストを読む(ストリーミング途中でも OK)
    const getText = () => {
      const body = block.querySelector(SELECTORS.codeBody);
      return body ? body.textContent : "";
    };
    // ヘッダーの言語ラベルもクリック時点で読む
    const getLang = () => {
      for (const sel of SELECTORS.langLabel) {
        const el = block.querySelector(sel);
        if (el && el.textContent.trim()) return el.textContent;
      }
      return null;
    };

    // Markdown 以外の言語ラベルが付いたブロックにはボタンを出さない
    // (ラベルが無い・不明な場合は Markdown の可能性があるので出す)
    const langNow = normalizeLang(getLang());
    if (langNow && langNow !== "markdown") return;

    let toolbar = null;
    for (const sel of SELECTORS.toolbar) {
      toolbar = block.querySelector(sel);
      if (toolbar) break;
    }

    const btn = createPreviewButton(getText, getLang);
    if (toolbar) {
      toolbar.insertBefore(btn, toolbar.firstChild);
    } else {
      // ツールバーが見つからない場合はブロック右上に浮かせる
      btn.classList.add("mdv-floating");
      const style = getComputedStyle(block);
      if (style.position === "static") {
        block.style.position = "relative";
      }
      block.appendChild(btn);
    }
  }

  /** code-block に属さない裸の pre にボタンを注入する(フォールバック) */
  function attachToBarePre(pre) {
    if (pre.hasAttribute(ATTACHED_ATTR)) return;
    if (pre.closest(SELECTORS.codeBlock)) return; // code-block 側で処理済み
    if (pre.closest(".mdv-modal-host")) return; // 自前モーダル内は対象外
    pre.setAttribute(ATTACHED_ATTR, "1");

    const getText = () => pre.textContent;
    const btn = createPreviewButton(getText);
    btn.classList.add("mdv-floating");

    const wrapper = pre.parentElement;
    if (wrapper && getComputedStyle(wrapper).position !== "static") {
      wrapper.appendChild(btn);
    } else {
      if (getComputedStyle(pre).position === "static") {
        pre.style.position = "relative";
      }
      pre.appendChild(btn);
    }
  }

  function scan(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope
      .querySelectorAll(`${SELECTORS.codeBlock}:not([${ATTACHED_ATTR}])`)
      .forEach(attachToCodeBlock);
    scope
      .querySelectorAll(`${SELECTORS.fallbackPre}:not([${ATTACHED_ATTR}])`)
      .forEach(attachToBarePre);
  }

  // ---------------------------------------------------------------
  // モーダル (Shadow DOM で Gemini の CSS から隔離)
  // ---------------------------------------------------------------
  let modalHost = null;
  let modalRefs = null;

  const MODAL_CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .backdrop {
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex; align-items: center; justify-content: center;
      z-index: 2147483647;
      font-family: "Segoe UI", "Hiragino Sans", "Noto Sans JP", Meiryo, sans-serif;
    }
    .panel {
      background: #1e1f22; color: #e3e3e3;
      width: min(900px, 92vw); height: 85vh;
      border-radius: 12px;
      border: 1px solid #444746;
      display: flex; flex-direction: column;
      box-shadow: 0 8px 40px rgba(0,0,0,.5);
      overflow: hidden;
    }
    .panel-header {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 16px;
      border-bottom: 1px solid #444746;
      flex: 0 0 auto;
    }
    .panel-title { font-size: 14px; font-weight: 600; flex: 1; color: #c4c7c5; }
    .panel-header button {
      background: #2d2f33; color: #e3e3e3;
      border: 1px solid #444746; border-radius: 16px;
      padding: 4px 14px; font-size: 12px; cursor: pointer;
    }
    .panel-header button:hover { background: #3c4043; }
    .panel-header .close-btn {
      border-radius: 50%; width: 30px; height: 30px; padding: 0;
      font-size: 15px; line-height: 1;
    }
    .content {
      flex: 1 1 auto; overflow-y: auto;
      padding: 20px 28px 40px;
      font-size: 15px; line-height: 1.7;
    }

    /* --- Markdown スタイル (GitHub 風・ダーク) --- */
    .content h1, .content h2, .content h3,
    .content h4, .content h5, .content h6 {
      margin: 1.4em 0 0.6em; font-weight: 600; line-height: 1.3; color: #fff;
    }
    .content h1 { font-size: 1.7em; border-bottom: 1px solid #444746; padding-bottom: .3em; }
    .content h2 { font-size: 1.4em; border-bottom: 1px solid #3c4043; padding-bottom: .3em; }
    .content h3 { font-size: 1.2em; }
    .content h4 { font-size: 1.05em; }
    .content p { margin: 0.7em 0; }
    .content a { color: #8ab4f8; }
    .content ul, .content ol { margin: 0.5em 0; padding-left: 1.8em; }
    .content li { margin: 0.25em 0; }
    .content li > ul, .content li > ol { margin: 0.15em 0; }
    .content blockquote {
      margin: 0.8em 0; padding: 0.2em 1em;
      border-left: 4px solid #5f6368; color: #b0b3b8;
    }
    .content code {
      background: #2d2f33; border-radius: 4px;
      padding: 0.15em 0.4em; font-size: 0.9em;
      font-family: Consolas, "Courier New", monospace;
    }
    .content pre {
      background: #17181a; border: 1px solid #3c4043; border-radius: 8px;
      padding: 12px 16px; overflow-x: auto; margin: 0.9em 0;
    }
    .content pre code { background: none; padding: 0; font-size: 0.88em; }
    .content table {
      border-collapse: collapse; margin: 1em 0; display: block;
      max-width: 100%; overflow-x: auto;
    }
    .content th, .content td {
      border: 1px solid #444746; padding: 6px 13px;
    }
    .content th { background: #2d2f33; font-weight: 600; }
    .content tr:nth-child(2n) td { background: #232427; }
    .content hr { border: none; border-top: 1px solid #444746; margin: 1.6em 0; }
    .content img { max-width: 100%; }
    .content input[type="checkbox"] { margin-right: 0.4em; }

    /* --- コード表示モード --- */
    .content pre.code-view {
      margin: 0; border: none; background: none;
      padding: 0; font-size: 0.95em;
    }

    /* --- highlight.js テーマ (GitHub Dark 風) --- */
    .hljs-comment, .hljs-quote { color: #8b949e; font-style: italic; }
    .hljs-keyword, .hljs-selector-tag, .hljs-doctag,
    .hljs-meta .hljs-keyword, .hljs-template-tag { color: #ff7b72; }
    .hljs-meta { color: #ff7b72; font-weight: 600; }
    .hljs-string, .hljs-meta .hljs-string, .hljs-regexp { color: #a5d6ff; }
    .hljs-title, .hljs-title.function_ { color: #d2a8ff; }
    .hljs-title.class_, .hljs-type, .hljs-built_in { color: #ffa657; }
    .hljs-number, .hljs-literal { color: #79c0ff; }
    .hljs-variable, .hljs-template-variable, .hljs-attr,
    .hljs-attribute, .hljs-property, .hljs-params { color: #79c0ff; }
    .hljs-symbol, .hljs-bullet, .hljs-link { color: #79c0ff; }
    .hljs-selector-id, .hljs-selector-class { color: #7ee787; }
    .hljs-tag, .hljs-name { color: #7ee787; }
    .hljs-section { color: #79c0ff; font-weight: 600; }
    .hljs-emphasis { font-style: italic; }
    .hljs-strong { font-weight: 700; }
    .hljs-addition { color: #aff5b4; background: #033a16; }
    .hljs-deletion { color: #ffdcd7; background: #67060c; }
  `;

  function buildModal() {
    modalHost = document.createElement("div");
    modalHost.className = "mdv-modal-host";
    const shadow = modalHost.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = MODAL_CSS;

    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";

    const panel = document.createElement("div");
    panel.className = "panel";

    const header = document.createElement("div");
    header.className = "panel-header";

    const title = document.createElement("span");
    title.className = "panel-title";
    title.textContent = "Markdown プレビュー";

    const modeBtn = document.createElement("button");
    modeBtn.type = "button";
    modeBtn.textContent = "コードとして表示";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = "Raw をコピー";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "close-btn";
    closeBtn.title = "閉じる (Esc)";
    closeBtn.textContent = "✕";

    const content = document.createElement("div");
    content.className = "content";

    header.append(title, modeBtn, copyBtn, closeBtn);
    panel.append(header, content);
    backdrop.append(panel);
    shadow.append(style, backdrop);

    // 閉じる操作: ×ボタン / バックドロップクリック / Esc
    closeBtn.addEventListener("click", closeModal);
    backdrop.addEventListener("click", (ev) => {
      if (ev.target === backdrop) closeModal();
    });
    panel.addEventListener("click", (ev) => ev.stopPropagation());

    modalRefs = {
      content,
      title,
      modeBtn,
      copyBtn,
      rawText: "",
      lang: null,
      langLabel: "",
      mode: "markdown",
    };

    modeBtn.addEventListener("click", () => {
      modalRefs.mode = modalRefs.mode === "code" ? "markdown" : "code";
      renderModalContent();
      modalRefs.content.scrollTop = 0;
    });

    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(modalRefs.rawText);
        copyBtn.textContent = "コピーしました ✓";
      } catch {
        copyBtn.textContent = "コピー失敗";
      }
      setTimeout(() => (copyBtn.textContent = "Raw をコピー"), 1500);
    });
  }

  function onKeydown(ev) {
    if (ev.key === "Escape") {
      ev.stopPropagation();
      closeModal();
    }
  }

  /** rootEl 内の pre>code を highlight.js で色分けする */
  function highlightIn(rootEl) {
    if (!libHljs) return;
    rootEl.querySelectorAll("pre code").forEach((el) => {
      try {
        libHljs.highlightElement(el);
      } catch {
        /* 解析に失敗したコードは素のまま表示 */
      }
    });
  }

  function renderModalContent() {
    const { content, title, modeBtn, rawText, mode, lang, langLabel } = modalRefs;
    if (mode === "code") {
      // シンタックスハイライト付きのコード表示
      content.textContent = "";
      const pre = document.createElement("pre");
      pre.className = "code-view";
      const code = document.createElement("code");
      if (lang && lang !== "markdown") code.className = `language-${lang}`;
      code.textContent = rawText;
      pre.appendChild(code);
      content.appendChild(pre);
      title.textContent = langLabel ? `コードプレビュー (${langLabel})` : "コードプレビュー";
      modeBtn.textContent = "Markdown として表示";
    } else {
      // Markdown レンダリング表示
      const html = libMarked.parse(rawText, { gfm: true, breaks: false });
      content.innerHTML = libPurify.sanitize(html);
      title.textContent = "Markdown プレビュー";
      modeBtn.textContent = "コードとして表示";
    }
    highlightIn(content); // ネストしたコードブロックも色分け
  }

  function openModal(rawText, langLabelRaw) {
    if (!modalHost) buildModal();
    const lang = normalizeLang(langLabelRaw);
    modalRefs.rawText = rawText;
    modalRefs.lang = lang;
    modalRefs.langLabel = langLabelRaw ? langLabelRaw.trim() : "";
    // Markdown ラベル or ラベル不明 → Markdown 表示、それ以外の言語 → コード表示
    modalRefs.mode = lang && lang !== "markdown" ? "code" : "markdown";
    renderModalContent();

    document.body.appendChild(modalHost);
    document.addEventListener("keydown", onKeydown, true);
    modalRefs.content.scrollTop = 0;
  }

  function closeModal() {
    if (modalHost && modalHost.isConnected) {
      modalHost.remove();
    }
    document.removeEventListener("keydown", onKeydown, true);
  }

  // ---------------------------------------------------------------
  // 監視: SPA / ストリーミング描画に追従
  // ---------------------------------------------------------------
  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => scan(document), DEBOUNCE_MS);
  });

  function init() {
    if (!libMarked || !libPurify) {
      console.warn("[mdviewer] marked / DOMPurify が読み込まれていません");
      return;
    }
    scan(document);
    observer.observe(document.body, { childList: true, subtree: true });
    console.log(
      `[mdviewer] initialized: code-block=${document.querySelectorAll(SELECTORS.codeBlock).length}, pre=${document.querySelectorAll(SELECTORS.fallbackPre).length}, buttons=${document.querySelectorAll(".mdv-preview-btn").length}`
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
