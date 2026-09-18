# TASK-072: 集成 Mermaid 实现 Markdown 阅读器图表动态渲染 (Integrate Mermaid for Markdown Viewer Diagram Rendering)

---

## 1. 任务元信息
- **Task ID**: TASK-072
- **Goal**: 集成 Mermaid 实现 Markdown 阅读器图表动态渲染 (Integrate Mermaid for Markdown Viewer Diagram Rendering)
- **状态**: DONE
- **依赖任务**: TASK-067, TASK-071
- **创建时间**: 2026-09-18
- **完成时间**: 2026-09-18

---

## 2. 需求背景与目标

在远程开发中，开发者广泛使用 Markdown 编写技术设计文档、流程图、时序图与架构设计（如系统流程、API 交互、状态流转等），而 Mermaid 是目前全球最通用的 Markdown 图表文本标准。

在过去版本中，Remora 的 Markdown 阅读器（`MarkdownViewer.tsx`）使用 `marked` + `highlight.js`，遇到 ````mermaid ... ```` 块时，仅将其作为等宽代码块文本展示，无法生成可视化矢量图，极大影响了技术文档的阅读体验。

本任务目标：
1. 集成 `mermaid` 官方渲染引擎，在 Markdown 阅读器中自动将 ````mermaid ```` 代码块转换为暗色矢量 SVG 图表；
2. 深度适配 Remora / VS Code 暗色主题色板，确保连线、节点、背景与字体高清晰度呈现；
3. 为每个 Mermaid 图表配备顶栏工具条：包含图表类型标签、一键复制源码按钮、以及【图表/源码】双向切换抽屉；
4. 建立严密的语法异常容错与 DOM 隔离机制：当 Mermaid 代码编写有误时，友好提示错误信息并自动展开源码视图，杜绝整屏崩溃或 DOM 节点残留。

---

## 3. 详细设计与实现方案

### 3.1 依赖引入与主题色板定制
- 安装 `mermaid@^12.0.0` 依赖；
- 在 `MarkdownViewer.tsx` 中封装 `initMermaid` 单例初始化逻辑，配置暗色主题与自定义调色板：
  - `startOnLoad: false`：完全交由 React 生命周期受控渲染；
  - `suppressErrorRendering: true`：禁止 Mermaid 在出错时向 DOM 强行插入默认报错节点，交由应用层优雅处理；
  - `theme: "dark"`：配置 `#0d1117` 图表背景、`#161b22` 节点底色、`#1f6feb` / `#388bfd` 主边框与强调色、`#8b949e` 连线色、`#f0f6fc` 文本高对比度呈现。

### 3.2 Marked 语法树拦截与图表容器构建
- 在自定义 renderer 的 `code({ text, lang })` 中，精准拦截 `lang.toLowerCase() === "mermaid"`；
- 生成具有独立 UUID 的骨架结构：
  - **顶栏 (`mermaid-block-header`)**: 显示绿点呼吸灯徽标 `MERMAID DIAGRAM`、`查看源码/隐藏源码` 切换按钮与 `Copy` 复制代码按钮；
  - **图表区 (`mermaid-chart-area`)**: 包含加载过渡状态动画与用于承载 SVG 的安全视口；
  - **源码区 (`mermaid-source-area`)**: 默认隐藏（`hidden`），内置语法高亮的代码块，便于随时核对原始定义。

### 3.3 异步渲染架构重构：缓存驱动直出 (Cache-First Pre-render) 与脱节 DOM 根治
- **卡死在“渲染图表中...”的根因深度剖析**:
  - 原方案中 Marked 解析器仅生成带有旋转 Spinner 占位骨架的 HTML 字符串，通过 `dangerouslySetInnerHTML` 注入页面。
  - 在 React 19 / 重新渲染（如 60ms 防抖更新、切换分屏、StrictMode）时，`dangerouslySetInnerHTML` 会将内部子 DOM 节点彻底销毁并重新创建。
  - 异步 `mermaid.render()` 完成时持有的 `container` 已经脱离文档树（Detached Node），对其进行的 `innerHTML = svg` 修改被丢弃；而屏幕上展现的是 React 新创建的占位节点，永久卡在“渲染图表中...”。
- **缓存驱动直出 (Cache-First Pre-render) 架构设计**:
  1. **内存级全局 LRU 缓存**: 组件外定义 `mermaidRenderCache = new Map<string, { svg?: string; error?: string }>()`（容量 500），彻底将渲染结果与 DOM 生命周期解耦；
  2. **响应式版本状态驱动**: 组件内使用 `const [mermaidVersion, setMermaidVersion] = useState(0)`，并将其加入 `htmlContent` 的 `useMemo` 依赖项；
  3. **Marked 编译器缓存直出**:
     - 命中 `svg` 缓存时：Marked 在生成 HTML 字符串阶段直接在 `.mermaid-chart-area` 内部输出完整的响应式暗色 SVG 矢量图，实现 0ms 秒开直出、0 DOM 查询、React 单次原子提交；
     - 命中 `error` 缓存时：Marked 直接输出暗色错误警告卡片并默认展开源码；
     - 未命中缓存时：展示优雅的加载 Spinner 占位骨架；
  4. **AST 异步批量提取与 4 秒超时熔断保护**:
     - `useEffect([debouncedContent])` 中基于词法解析精准提取所有待渲染 Mermaid 块；
     - 使用 `mermaidPendingRenders` 集合拦截并发重复任务；
     - 针对每个块调用 `Promise.race([mermaid.render(id, code), timeout(4000)])`，严防复杂或畸变图表无限挂起；
     - 渲染完成后存入缓存并自动清理 `document.body` 中的临时 `#d...` 节点，随后调用 `setMermaidVersion(v => v + 1)` 触发一次性原子重绘。

### 3.4 异常容错、响应式缩放与交互事件代理
- **自适应响应式缩放**:
  - 为 `.mermaid-chart-area svg` 注入 `max-width: 100% !important; height: auto !important; display: block; margin: 0 auto;`，确保在任何视口尺寸或分屏比例下完美呈现且不溢出；
- **错误优雅降级机制**:
  - 若用户输入的 Mermaid 存在语法错误或在 4 秒内超时熔断，友好展示玫瑰红暗色报错卡片（包含错误详情），并自动展开源码视图协助修正；
- **事件代理控制 (`handleClick`)**:
  - 拦截 `.toggle-mermaid-btn` 点击事件，动态切换源码区域的展开/折叠，并同步翻转按钮文字（`查看源码` ↔ `隐藏源码`）；
  - 保持与现有 `copy-code-btn` 剪贴板复制逻辑的天然兼容。

---

## 4. 涉及文件与修改清单

| 文件路径 | 修改类型 | 说明 |
| :--- | :--- | :--- |
| `package.json` | 修改 | 添加 `mermaid: ^12.0.0` 依赖 |
| `pnpm-lock.yaml` | 修改 | 锁定 Mermaid 依赖版本 |
| `src/components/Editor/MarkdownViewer.tsx` | 修改 | 集成 Mermaid 初始化、渲染管线、图表骨架、源码切换与 scoped 样式 |
| `docs/AI/tasks/TASK-072.md` | 新建 | 完整任务需求、设计架构与测试验证记录 |
| `docs/AI/TASK_INDEX.md` | 修改 | 登记 TASK-072 为 DONE |
| `docs/AI/SESSION_STATE.md` | 修改 | 更新会话状态与成果记录 |

---

## 5. 验收标准与测试结果

- [x] **验收标准 1**: 打开包含 ````mermaid ... ```` 的 Markdown 文件时，自动渲染为暗色 SVG 图表，支持 flowchart、sequenceDiagram、classDiagram、stateDiagram、erDiagram、pie 等主流图表类型。
- [x] **验收标准 2**: 每个 Mermaid 图表块具备专属顶栏，包含一键复制代码按钮以及【图表/源码】无缝切换。
- [x] **验收标准 3**: 语法错误防御机制生效，当 Mermaid 语法有误时不崩溃、不白屏，优雅降级展示报错信息并自动展开源码。
- [x] **验收标准 4**: 前端 TypeScript 0 报错，`pnpm run build` 打包构建 100% 成功（Mermaid 相关图表组件成功分包）。
- [x] **验收标准 5**: 后端 41 项 Rust 单元测试与 1 项 E2E 测试全量通过（`cargo test` 0 failure）。
