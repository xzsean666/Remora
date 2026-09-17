import React, { useMemo, useState, useEffect, useRef } from "react";
import { Marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import {
  ListTree,
  Clock,
  FileText,
  X,
  PenLine,
} from "lucide-react";
import { EditorTab, useEditorStore } from "../../stores/editorStore";
import { copyTextToClipboard } from "../../utils/clipboard";

interface MarkdownViewerProps {
  tab: EditorTab;
  readOnly?: boolean;
}

interface HeadingItem {
  id: string;
  text: string;
  depth: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fa5\- ]+/g, "")
    .replace(/\s+/g, "-");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const alertConfig: Record<
  string,
  {
    border: string;
    bg: string;
    text: string;
    title: string;
    iconSvg: string;
  }
> = {
  NOTE: {
    border: "border-sky-500",
    bg: "bg-sky-950/25",
    text: "text-sky-300",
    title: "Note",
    iconSvg: `<svg class="w-4 h-4 text-sky-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  },
  TIP: {
    border: "border-emerald-500",
    bg: "bg-emerald-950/25",
    text: "text-emerald-300",
    title: "Tip",
    iconSvg: `<svg class="w-4 h-4 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
  },
  IMPORTANT: {
    border: "border-purple-500",
    bg: "bg-purple-950/25",
    text: "text-purple-300",
    title: "Important",
    iconSvg: `<svg class="w-4 h-4 text-purple-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`,
  },
  WARNING: {
    border: "border-amber-500",
    bg: "bg-amber-950/25",
    text: "text-amber-300",
    title: "Warning",
    iconSvg: `<svg class="w-4 h-4 text-amber-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  },
  CAUTION: {
    border: "border-rose-500",
    bg: "bg-rose-950/25",
    text: "text-rose-300",
    title: "Caution",
    iconSvg: `<svg class="w-4 h-4 text-rose-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m14.5 9-5 5"/><path d="m9.5 9 5 5"/></svg>`,
  },
};

// Global scroll position cache for markdown tabs
const markdownScrollCache = new Map<string, number>();

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ tab }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showToc, setShowToc] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string>("");
  const { setMarkdownViewMode, saveActiveFile } = useEditorStore();

  // Support Ctrl+S / Cmd+S save in MarkdownViewer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      if (modKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        saveActiveFile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveActiveFile]);

  // Debounce content updates slightly so typing in Split mode stays smooth at 60fps
  const [debouncedContent, setDebouncedContent] = useState(tab.content);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedContent(tab.content);
    }, 60);
    return () => clearTimeout(timer);
  }, [tab.content]);

  // Extract outline headings using marked.lexer
  const headings = useMemo<HeadingItem[]>(() => {
    try {
      const markedInstance = new Marked();
      const tokens = markedInstance.lexer(debouncedContent);
      const items: HeadingItem[] = [];
      for (const t of tokens) {
        if (t.type === "heading" && t.depth <= 3) {
          const rawText = t.text.trim();
          items.push({
            id: slugify(t.raw.replace(/^[#\s]+/, "").trim()),
            text: rawText,
            depth: t.depth,
          });
        }
      }
      return items;
    } catch {
      return [];
    }
  }, [debouncedContent]);

  // Document statistics
  const stats = useMemo(() => {
    const raw = debouncedContent || "";
    const lines = raw.split("\n").length;
    const cjkChars = (raw.match(/[\u4e00-\u9fa5]/g) || []).length;
    const words = (raw.replace(/[\u4e00-\u9fa5]/g, " ").match(/\b\w+\b/g) || []).length;
    const totalCount = words + cjkChars;
    const readTimeMinutes = Math.max(1, Math.ceil(totalCount / 220));
    return {
      lines,
      words: totalCount,
      readTime: readTimeMinutes,
    };
  }, [debouncedContent]);

  // Render HTML using customized Marked parser
  const htmlContent = useMemo(() => {
    const marked = new Marked({
      gfm: true,
      breaks: true,
    });

    marked.use({
      renderer: {
        // Syntax-highlighted code blocks with language badge and copy button
        code({ text, lang }: { text: string; lang?: string }) {
          const rawLang = (lang || "").trim();
          let highlighted = "";
          if (rawLang && hljs.getLanguage(rawLang)) {
            try {
              highlighted = hljs.highlight(text, { language: rawLang }).value;
            } catch {
              highlighted = hljs.highlightAuto(text).value;
            }
          } else {
            try {
              highlighted = hljs.highlightAuto(text).value;
            } catch {
              highlighted = escapeHtml(text);
            }
          }

          const langLabel = rawLang ? rawLang.toUpperCase() : "CODE";
          const encoded = encodeURIComponent(text);

          return `<div class="code-block-wrapper my-4 rounded-lg overflow-hidden border border-vscode-border/80 bg-[#161b22] shadow-sm">
            <div class="code-block-header flex items-center justify-between px-3.5 py-1.5 bg-[#1c2128] border-b border-vscode-border/50 text-xs select-none">
              <div class="flex items-center gap-1.5 font-mono text-[11px] text-vscode-textMuted">
                <span class="w-2 h-2 rounded-full bg-vscode-activityBarActive/80 inline-block"></span>
                <span class="font-medium text-vscode-textBright/90">${langLabel}</span>
              </div>
              <button class="copy-code-btn flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-vscode-textMuted hover:text-vscode-textBright hover:bg-white/10 transition-colors cursor-pointer select-none" data-code="${encoded}">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span>Copy</span>
              </button>
            </div>
            <pre class="p-4 overflow-x-auto text-[13px] font-mono leading-relaxed bg-[#161b22] m-0"><code class="hljs ${rawLang ? `language-${rawLang}` : ""}">${highlighted}</code></pre>
          </div>`;
        },

        // GitHub-style Alerts callout renderer (> [!NOTE], > [!TIP], etc.)
        blockquote(token: any) {
          const match = token.text.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s*\n)?([\s\S]*)$/i);
          if (match) {
            const type = match[1].toUpperCase();
            const cfg = alertConfig[type] || alertConfig.NOTE;

            // Remove the [!TYPE] marker from the first token's text
            if (token.tokens && token.tokens[0] && token.tokens[0].tokens && token.tokens[0].tokens[0]) {
              token.tokens[0].tokens[0].text = token.tokens[0].tokens[0].text.replace(
                /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i,
                ""
              );
            }
            const bodyHtml = this.parser.parse(token.tokens);

            return `<div class="markdown-alert markdown-alert-${type.toLowerCase()} border-l-4 ${cfg.border} ${cfg.bg} my-4 p-3.5 rounded-r shadow-xs">
              <div class="flex items-center gap-2 font-semibold text-xs mb-1.5 uppercase tracking-wider ${cfg.text}">
                ${cfg.iconSvg}
                <span>${cfg.title}</span>
              </div>
              <div class="text-[13.5px] leading-relaxed text-[#c9d1d9] pl-6">${bodyHtml}</div>
            </div>`;
          }

          return `<blockquote>${this.parser.parse(token.tokens)}</blockquote>`;
        },

        // Slugified anchor headings
        heading(token: any) {
          const depth = token.depth;
          const id = slugify(token.raw.replace(/^[#\s]+/, "").trim());
          const inlineHtml = this.parser.parseInline(token.tokens);
          return `<h${depth} id="${id}" class="heading-anchor group flex items-center gap-2">
            <span>${inlineHtml}</span>
            <a href="#${id}" class="opacity-0 group-hover:opacity-100 text-vscode-textMuted hover:text-vscode-activityBarActive transition-opacity text-sm font-normal select-none" title="Direct link to this section">#</a>
          </h${depth}>`;
        },

        // External vs Anchor Links
        link(token: any) {
          const href = token.href || "#";
          const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
          const text = this.parser.parseInline(token.tokens);
          const isExternal = href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//");
          return `<a href="${href}"${title}${isExternal ? ' class="external-link" target="_blank" rel="noopener noreferrer"' : ""}>${text}</a>`;
        },

        // Table with responsive horizontal scroll wrapper
        table(token: any) {
          const defaultTable = (Marked.prototype.defaults.renderer?.table as any)?.call(this, token) || "";
          return `<div class="table-wrapper my-4 overflow-x-auto rounded-lg border border-vscode-border/70 shadow-xs">${defaultTable}</div>`;
        },
      },
    });

    return marked.parse(debouncedContent);
  }, [debouncedContent]);

  // Restore scroll position on mount
  useEffect(() => {
    const savedTop = markdownScrollCache.get(tab.path);
    if (savedTop !== undefined && containerRef.current) {
      containerRef.current.scrollTop = savedTop;
    }

    const container = containerRef.current;
    return () => {
      if (container) {
        markdownScrollCache.set(tab.path, container.scrollTop);
      }
    };
  }, [tab.path]);

  // Handle click delegation (Copy Code, Anchor scroll, External links)
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // 1. Copy Code Button
    const copyBtn = target.closest(".copy-code-btn") as HTMLElement;
    if (copyBtn) {
      const encoded = copyBtn.getAttribute("data-code");
      if (encoded) {
        const code = decodeURIComponent(encoded);
        copyTextToClipboard(code).then(() => {
          const originalHtml = copyBtn.innerHTML;
          copyBtn.innerHTML = `<svg class="w-3.5 h-3.5 text-emerald-400 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg><span class="text-emerald-400 font-medium">Copied!</span>`;
          setTimeout(() => {
            copyBtn.innerHTML = originalHtml;
          }, 2000);
        });
      }
      return;
    }

    // 2. Link Navigation
    const anchor = target.closest("a") as HTMLAnchorElement;
    if (anchor && anchor.href) {
      const href = anchor.getAttribute("href");
      if (!href) return;

      if (href.startsWith("#")) {
        e.preventDefault();
        const id = href.slice(1);
        const headingElement = containerRef.current?.querySelector(`[id="${id}"]`);
        if (headingElement) {
          headingElement.scrollIntoView({ behavior: "smooth", block: "start" });
          setActiveHeadingId(id);
        }
      } else if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")) {
        e.preventDefault();
        try {
          import("@tauri-apps/plugin-opener").then(({ openUrl }) => {
            openUrl(href).catch(() => window.open(href, "_blank", "noopener,noreferrer"));
          });
        } catch {
          window.open(href, "_blank", "noopener,noreferrer");
        }
      }
    }
  };

  const scrollToHeading = (id: string) => {
    const headingElement = containerRef.current?.querySelector(`[id="${id}"]`);
    if (headingElement) {
      headingElement.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveHeadingId(id);
    }
  };

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden bg-vscode-bg select-text">
      {/* Scoped Custom Markdown CSS */}
      <style>{`
        .markdown-rendered {
          color: #c9d1d9;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
          line-height: 1.68;
          font-size: 14px;
          word-wrap: break-word;
        }
        .markdown-rendered h1,
        .markdown-rendered h2,
        .markdown-rendered h3,
        .markdown-rendered h4,
        .markdown-rendered h5,
        .markdown-rendered h6 {
          margin-top: 24px;
          margin-bottom: 12px;
          font-weight: 600;
          line-height: 1.35;
          color: #f0f6fc;
        }
        .markdown-rendered h1 {
          font-size: 1.85rem;
          padding-bottom: 0.4rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          margin-top: 0.5rem;
        }
        .markdown-rendered h2 {
          font-size: 1.4rem;
          padding-bottom: 0.3rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          margin-top: 2rem;
        }
        .markdown-rendered h3 {
          font-size: 1.15rem;
          margin-top: 1.5rem;
        }
        .markdown-rendered h4 {
          font-size: 1rem;
        }
        .markdown-rendered p {
          margin-top: 0;
          margin-bottom: 16px;
          line-height: 1.72;
          color: #c9d1d9;
        }
        .markdown-rendered strong {
          color: #f0f6fc;
          font-weight: 600;
        }
        .markdown-rendered em {
          font-style: italic;
        }
        .markdown-rendered blockquote {
          margin: 16px 0;
          padding: 8px 16px;
          color: #8b949e;
          border-left: 0.25em solid #388bfd;
          background-color: rgba(56, 139, 253, 0.08);
          border-radius: 0 6px 6px 0;
        }
        .markdown-rendered ul,
        .markdown-rendered ol {
          margin-top: 0;
          margin-bottom: 16px;
          padding-left: 2em;
        }
        .markdown-rendered ul {
          list-style-type: disc;
        }
        .markdown-rendered ol {
          list-style-type: decimal;
        }
        .markdown-rendered li {
          margin-top: 4px;
          margin-bottom: 4px;
        }
        .markdown-rendered li > p {
          margin-top: 8px;
          margin-bottom: 8px;
        }
        .markdown-rendered code:not(pre code) {
          padding: 0.2em 0.45em;
          margin: 0 2px;
          font-size: 85%;
          white-space: break-spaces;
          background-color: rgba(110, 118, 129, 0.22);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 6px;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
          color: #f0883e;
        }
        .markdown-rendered hr {
          height: 1px;
          padding: 0;
          margin: 24px 0;
          background-color: rgba(255, 255, 255, 0.12);
          border: 0;
        }
        .markdown-rendered a {
          color: #58a6ff;
          text-decoration: none;
        }
        .markdown-rendered a:hover {
          text-decoration: underline;
        }
        .markdown-rendered img {
          max-width: 100%;
          box-sizing: content-box;
          border-radius: 8px;
          margin: 16px 0;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .markdown-rendered table {
          border-spacing: 0;
          border-collapse: collapse;
          width: 100%;
          margin: 0;
          font-size: 13px;
        }
        .markdown-rendered th {
          font-weight: 600;
          background-color: #161b22;
          color: #f0f6fc;
          padding: 8px 14px;
          border: 1px solid #30363d;
        }
        .markdown-rendered td {
          padding: 8px 14px;
          border: 1px solid #30363d;
        }
        .markdown-rendered tr:nth-child(2n) {
          background-color: rgba(22, 27, 34, 0.5);
        }
        .markdown-rendered tr:hover {
          background-color: rgba(255, 255, 255, 0.03);
        }
        .markdown-rendered input[type="checkbox"] {
          margin-right: 6px;
          vertical-align: middle;
          accent-color: #1f6feb;
          cursor: pointer;
        }
      `}</style>

      {/* Viewer Floating Tools (TOC Outline toggle & Edit Source) */}
      <div className="absolute top-3 right-5 z-20 flex items-center gap-1.5 select-none animate-in fade-in duration-150">
        {headings.length > 0 && (
          <button
            onClick={() => setShowToc(!showToc)}
            className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1.5 border backdrop-blur-md transition-all shadow-sm ${
              showToc
                ? "bg-vscode-activityBarActive text-white border-vscode-activityBarActive/80 font-medium"
                : "bg-vscode-sidebar/85 text-vscode-text border-vscode-border/80 hover:bg-vscode-hover hover:text-white"
            }`}
            title="查看文档大纲 (Table of Contents)"
          >
            <ListTree className="w-3.5 h-3.5" />
            <span className="text-[11px]">大纲 ({headings.length})</span>
          </button>
        )}

        <button
          onClick={() => setMarkdownViewMode(tab.path, "source")}
          className="px-2.5 py-1 rounded-md text-xs flex items-center gap-1.5 bg-vscode-sidebar/85 border border-vscode-border/80 text-vscode-text hover:bg-vscode-hover hover:text-white backdrop-blur-md transition-all shadow-sm"
          title="切换至编辑模式 (Ctrl+E)"
        >
          <PenLine className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-[11px]">编辑源码</span>
        </button>
      </div>

      {/* Main Content Layout with optional TOC outline sidebar */}
      <div className="flex-1 flex min-h-0 min-w-0 relative">
        {/* Rendered HTML Container */}
        <div
          ref={containerRef}
          onClick={handleClick}
          className="flex-1 overflow-y-auto overflow-x-hidden p-6 sm:p-10 scrollbar-thin scrollbar-thumb-vscode-border"
        >
          <div className="max-w-4xl mx-auto pb-16">
            <div
              className="markdown-rendered"
              dangerouslySetInnerHTML={{ __html: htmlContent as string }}
            />
          </div>
        </div>

        {/* Outline / TOC Drawer */}
        {showToc && headings.length > 0 && (
          <div className="w-64 border-l border-vscode-border/80 bg-vscode-sidebar/95 flex flex-col flex-shrink-0 z-10 select-none animate-in slide-in-from-right-4 duration-200">
            <div className="h-9 px-3 border-b border-vscode-border/70 flex items-center justify-between text-xs text-vscode-textBright font-medium">
              <div className="flex items-center gap-1.5">
                <ListTree className="w-3.5 h-3.5 text-vscode-activityBarActive" />
                <span>文档大纲</span>
              </div>
              <button
                onClick={() => setShowToc(false)}
                className="p-1 rounded hover:bg-vscode-hover text-vscode-textMuted hover:text-white transition-colors"
                title="关闭大纲"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-thin">
              {headings.map((h, i) => {
                const isActive = activeHeadingId === h.id;
                return (
                  <button
                    key={`${h.id}-${i}`}
                    onClick={() => scrollToHeading(h.id)}
                    className={`w-full text-left px-2 py-1 rounded transition-colors truncate block text-xs ${
                      isActive
                        ? "bg-vscode-activityBarActive/20 text-vscode-activityBarActive font-medium"
                        : "text-vscode-text hover:bg-vscode-hover hover:text-white"
                    } ${
                      h.depth === 1
                        ? "font-medium"
                        : h.depth === 2
                        ? "pl-4 text-[11.5px] opacity-90"
                        : "pl-6 text-[11px] opacity-75"
                    }`}
                    title={h.text}
                  >
                    {h.text}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Reading Mode Bottom Status Bar */}
      <div className="h-6 px-3 bg-vscode-sidebar/95 border-t border-vscode-border/60 flex items-center justify-between text-[11px] text-vscode-textMuted select-none flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-sky-400" />
            预计阅读 {stats.readTime} 分钟
          </span>
          <span className="opacity-40">|</span>
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3 text-emerald-400" />
            {stats.words} 字 · {stats.lines} 行
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-vscode-textMuted/70">
            按 <kbd className="px-1 py-0.2 bg-vscode-border/60 rounded font-mono text-[9px] text-vscode-textBright">Ctrl+E</kbd> 切换编辑
          </span>
        </div>
      </div>
    </div>
  );
};
