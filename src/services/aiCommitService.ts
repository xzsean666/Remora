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
    (import.meta as any).env?.VITE_AI_BASE_URL || "https://openrouter.ai/api/v1";
  const defaultModel =
    (import.meta as any).env?.VITE_AI_MODEL || "nvidia/nemotron-3.5-lightning:free";

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
 * Generates a clean Conventional Commit message via OpenRouter / OpenAI API.
 */
export async function generateCommitMessage(
  summaryDiff: string,
  options: GenerateCommitOptions = {}
): Promise<string> {
  const config = getAiConfig();
  const apiKey = options.apiKey || config.apiKey;
  let baseUrl = (options.baseUrl || config.baseUrl || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const model = options.model || config.model || "nvidia/nemotron-3.5-lightning:free";
  const language = options.language || getSavedCommitLang();

  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "未检测到 AI API Key。请在设置中输入或在构建环境 / .env 中提供 OPEN_ROUTER_API_KEY"
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

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/xzsean666/Remora",
      "X-Title": "Remora Git Assistant",
    },
    body: JSON.stringify({
      model: model.trim(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 150,
      reasoning: { max_tokens: 0 },
    }),
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

  const data = await resp.json();
  let rawContent: string = data?.choices?.[0]?.message?.content || "";

  if (!rawContent) {
    throw new Error("AI 未返回有效的 Commit 描述信息");
  }

  // Strip reasoning blocks if model outputs <think>...</think>
  rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Strip markdown code fences
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
