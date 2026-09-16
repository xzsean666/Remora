# TASK-063: 适配私有部署模型生成 Commit Message 并保留 OpenRouter 兼容支持 (Adapt Self-Hosted Model for AI Commit Generation while Preserving OpenRouter Compatibility)

## 1. 任务背景与目标

用户在本地部署了轻量高性能模型 `qwen3.5:2b-optimized`，用于替代原先的云端 OpenRouter 模型，同时要求：
1. **完整保留 OpenRouter 原有调用逻辑**：当用户使用 OpenRouter 密钥或选择 OpenRouter 官方端点时，依然能够正常运行且保留专属优化（如特定元数据请求头与 `reasoning: { max_tokens: 0 }` 参数）；
2. **全面适配私有部署与 OpenAI 兼容接口**：在 `.env` 与前端配置中无缝支持自建模型（如 `qwen3.5:2b-optimized`、`http://127.0.0.1/v1` 及相关密钥）；
3. **消除模型思考导致的空白输出**：针对私有模型在遇到 OpenRouter 专属参数时将思考内容写入 `reasoning` 耗尽 token 导致正文空白的问题，实施自适应请求参数分流（私建模型采用 `reasoning_effort: "none"`，OpenRouter 采用 `reasoning: { max_tokens: 0 }`）以及双轨内容解析（正文优先，回退解析 `reasoning`，剥离 `<think>` 标签）；
4. **双向流式与非流式兼容解析**：支持标准 JSON 与 SSE Event Stream 双重协议解析；
5. **开箱即用体验与可视化配置**：更新 `.env`、`.env.example` 与 `vite.config.ts`，在前端 AI 配置弹窗中增加自建模型快捷预设选项。

---

## 2. 核心架构与功能设计

1. **双轨模型分流与智能适配引擎 (`src/services/aiCommitService.ts`)**:
   - 识别 `baseUrl.toLowerCase().includes("openrouter.ai")`：
     - **OpenRouter 模式**：携带 `HTTP-Referer: https://github.com/xzsean666/Remora` 与 `X-Title: Remora Git Assistant` 请求头，并注入 `reasoning: { max_tokens: 0 }`；
     - **自建 / 通用 OpenAI 兼容模式**：移除 OpenRouter 专有头部，注入 `reasoning_effort: "none"`，彻底杜绝小模型在生成 Commit 时消耗 token 产生冗余长思考；
   - 提升 `max_tokens` 至 300，避免复杂改动下的字符截断；
   - 健壮的多模式结果抽取：支持 `text/event-stream` SSE 流与标准 `application/json`；
   - 严格的提交信息正则清洗：自动剥除 `<think>...</think>`、Markdown 代码栅栏（````text` / ````）、单双引号及 `git commit -m` 前缀，严格提取规范的 Conventional Commit 单行消息。

2. **多层级配置优先级解析 (`vite.config.ts` & `.env` / `.env.example`)**:
   - 优先读取用户在 `.env` 中设置的 `AI_API_KEY`、`AI_BASE_URL`（`http://127.0.0.1/v1`）与 `AI_MODEL`（`qwen3.5:2b-optimized`）；
   - 当仅配置 `OPEN_ROUTER_API_KEY` 时，自动智能回退为 OpenRouter 默认 Base URL 与免费模型 `nvidia/nemotron-3.5-lightning:free`；
   - 在 `.env.example` 中补充自建模型与 OpenRouter 的双模板说明。

3. **可视化配置弹窗升级 (`src/components/Sidebar/Git/AiConfigModal.tsx`)**:
   - 弹窗重置默认值联动本地与构建环境；
   - 增加 `qwen3.5:2b (自建)`、`nemotron-3.5 (OpenRouter)` 与 `gemma-4-31b (OpenRouter)` 快捷预设按钮，支持一键填充模型名与匹配的 Base URL。

---

## 3. 验收标准与验证结果

- [x] **私有模型生成测试**：真实调用 `http://127.0.0.1/v1/chat/completions` 生成 Conventional Commit，中英文均在 2 秒内极速生成规范提交信息；
- [x] **OpenRouter 回退验证**：调用 OpenRouter 官方接口验证原有参数与头部兼容性，正常生成提交；
- [x] **TypeScript 严格检查**：`pnpm tsc --noEmit` 0 报错；
- [x] **生产构建校验**：`pnpm build` 100% 成功（耗时 7.05s）；
- [x] **Rust 测试覆盖**：`cargo test --manifest-path src-tauri/Cargo.toml` 34 个单元测试与 1 个 E2E 测试全量通过。
