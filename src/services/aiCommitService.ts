/**
 * AI Commit Message Generation Service
 * Supports OpenRouter or any OpenAI-compatible API.
 */

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const STORAGE_KEY_AI_CONFIG = "remora_ai_config";
const STORAGE_KEY_COMMIT_LANG = "remora_git_commit_lang";

export function getAiConfig(): AiConfig {
  let saved: Partial<AiConfig> = {};
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_AI_CONFIG);
      if (raw) saved = JSON.parse(raw);
    } catch (e) {
      console.warn("Failed to load saved AI config:", e);
    }
  }

  const defaultKey = (import.meta as any).env?.VITE_AI_API_KEY || "";
  const defaultBaseUrl =
    (import.meta as any).env?.VITE_AI_BASE_URL || "http://127.0.0.1/v1";
  const defaultModel =
    (import.meta as any).env?.VITE_AI_MODEL || "qwen3.5:2b-optimized";

  return {
    apiKey: (saved.apiKey !== undefined && saved.apiKey !== "") ? saved.apiKey : defaultKey,
    baseUrl: saved.baseUrl?.trim() || defaultBaseUrl,
    model: saved.model?.trim() || defaultModel,
  };
}

export function saveAiConfig(config: Partial<AiConfig>): void {
  if (typeof localStorage === "undefined") return;
  try {
    const current = getAiConfig();
    const next = { ...current, ...config };
    localStorage.setItem(STORAGE_KEY_AI_CONFIG, JSON.stringify(next));
  } catch (e) {
    console.warn("Failed to save AI config:", e);
  }
}

export function getSavedCommitLang(): "en" | "zh" {
  if (typeof localStorage !== "undefined") {
    try {
      const lang = localStorage.getItem(STORAGE_KEY_COMMIT_LANG);
      if (lang === "zh" || lang === "en") return lang;
    } catch {}
  }
  return "en"; // Default English
}

export function saveCommitLang(lang: "en" | "zh"): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_COMMIT_LANG, lang);
  } catch {}
}

export interface GenerateCommitOptions {
  language?: "en" | "zh";
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

/**
 * Generates a clean Conventional Commit message via self-hosted model or OpenRouter / OpenAI API.
 */
export async function generateCommitMessage(
  summaryDiff: string,
  options: GenerateCommitOptions = {}
): Promise<string> {
  const config = getAiConfig();
  const apiKey = options.apiKey || config.apiKey;
  const rawBaseUrl = options.baseUrl || config.baseUrl || "http://127.0.0.1/v1";
  const baseUrl = rawBaseUrl.replace(/\/+$/, "");
  const model = options.model || config.model || "qwen3.5:2b-optimized";
  const language = options.language || getSavedCommitLang();

  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "未检测到 AI API Key。请在设置中输入或在构建环境 / .env 中提供 AI_API_KEY / OPEN_ROUTER_API_KEY"
    );
  }

  if (!summaryDiff || summaryDiff.trim() === "") {
    throw new Error("当前工作区没有可提交的修改内容 (No changes to commit)");
  }

  const langInstruction =
    language === "zh"
      ? "Language Requirement: The subject description of the commit message MUST be in Chinese (简体中文). e.g., 'feat(ui): 增加 GitHub 账号切换与快速推送功能'"
      : "Language Requirement: The subject description of the commit message MUST be in English in imperative mood. e.g., 'feat(ui): add GitHub account switching and quick push buttons'";

  const systemPrompt = `You are an expert software developer and Git commit message generator.
Analyze the provided git status summary and git diff, then generate a single concise Conventional Commit message.

Rules:
1. Strictly follow Conventional Commits format: <type>(<scope>): <subject> or <type>: <subject>.
   - Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore.
   - Scope is optional (lowercase).
2. Keep the subject line concise (under 72 characters).
3. ${langInstruction}
4. Output ONLY the commit message string. Do NOT add markdown code fences (no \`\`\`), no quotes, no explanations, no prefix like "git commit -m".`;

  const userPrompt = `Here is the current git status and diff:\n\n${summaryDiff.slice(0, 4000)}\n\nPlease generate the commit message now:`;

  const endpoint = `${baseUrl}/chat/completions`;
  const isOpenRouter = baseUrl.toLowerCase().includes("openrouter.ai");

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };

  // OpenRouter requires specific metadata headers
  if (isOpenRouter) {
    headers["HTTP-Referer"] = "https://github.com/xzsean666/Remora";
    headers["X-Title"] = "Remora Git Assistant";
  }

  const requestBody: Record<string, any> = {
    model: model.trim(),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    max_tokens: 300,
  };

  if (isOpenRouter) {
    // OpenRouter reasoning token suppression
    requestBody.reasoning = { max_tokens: 0 };
  } else {
    // Ollama / Qwen / standard OpenAI reasoning suppression
    requestBody.reasoning_effort = "none";
  }

  const resp = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!resp.ok) {
    let errorText = "";
    try {
      const errJson = await resp.json();
      errorText = errJson?.error?.message || JSON.stringify(errJson);
    } catch {
      errorText = await resp.text();
    }
    throw new Error(`AI 请求失败 (${resp.status}): ${errorText || resp.statusText}`);
  }

  let rawContent = "";
  const contentType = resp.headers.get("content-type") || "";

  if (contentType.includes("text/event-stream") && resp.body) {
    // Parse SSE streaming response if returned
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let streamBuffer = "";
    let done = false;
    while (!done) {
      const { value, done: isDone } = await reader.read();
      done = isDone;
      if (value) {
        streamBuffer += decoder.decode(value, { stream: !done });
      }
    }

    const lines = streamBuffer.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const chunk = JSON.parse(jsonStr);
        const deltaContent = chunk?.choices?.[0]?.delta?.content;
        if (deltaContent) {
          rawContent += deltaContent;
        }
      } catch {}
    }
  } else {
    const data = await resp.json();
    rawContent = data?.choices?.[0]?.message?.content || "";

    // Fallback: If content is empty but model emitted reasoning, extract from reasoning
    if (!rawContent.trim() && data?.choices?.[0]?.message?.reasoning) {
      rawContent = data.choices[0].message.reasoning;
    }
  }

  if (!rawContent) {
    throw new Error("AI 未返回有效的 Commit 描述信息");
  }

  // Strip reasoning blocks if model outputs <think>...</think>
  rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Strip markdown code fences (e.g. ```text or ```)
  rawContent = rawContent.replace(/^```[a-z0-9_-]*\s*/i, "").replace(/\s*```$/i, "").trim();

  // Strip surrounding quotes
  rawContent = rawContent.replace(/^["'`]+/, "").replace(/["'`]+$/, "").trim();

  // Strip "git commit -m " prefix if any
  rawContent = rawContent.replace(/^git\s+commit\s+-m\s+/i, "").replace(/^["']/, "").replace(/["']$/, "").trim();

  // Take the first non-empty line or full short message
  const lines = rawContent.split("\n").map(l => l.trim()).filter(Boolean);
  const finalMessage = lines[0] || rawContent;

  return finalMessage;
}
