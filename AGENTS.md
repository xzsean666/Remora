# AGENTS.md - Remora AI 代理开发规范与规则

本文档是 AI 辅助开发在本项目中的事实来源之一。所有进入本仓库工作的 AI 代理必须严格遵循以下规则。

---

## 1. 核心技术栈与全局工具规范

- **Node.js / 包管理器**: 必须严格使用 `pnpm`，禁止使用 npm 或 yarn。
- **Python**: 如涉及脚本或工具，统一使用 `uv`。
- **Git / PR**: 提交 PR 统一使用 GitHub CLI `gh`。
- **前端技术栈**: Tauri 2 + React + TypeScript + Zustand + TailwindCSS + CodeMirror 6 + xterm.js。
- **后端技术栈**: Rust + Tokio + russh + russh-sftp + SQLite (rusqlite)。

---

## 2. 事实来源 (Single Source of Truth)

AI 代理在任何会话中均须优先读取并依据以下文档：
- **项目总目标**: `docs/AI/GOAL.md`
- **任务索引**: `docs/AI/TASK_INDEX.md`
- **当前会话状态**: `docs/AI/SESSION_STATE.md`
- **当前任务详情**: `docs/AI/tasks/TASK-xxx.md`
- **架构说明与设计**: `docs/AI/ARCHITECTURE.md`
- **架构决策记录**: `docs/AI/DECISIONS.md`
- **完整代理规范提示词**: `docs/AI_AGENT_PROMPT.md`

---

## 3. 工作原则

1. **单目标原则**: 一次只处理一个 Goal 和一个当前 Task。
2. **单会话单任务**: 一个 session 默认最多完成一个 Task。
3. **严格范围限制**: 不实现当前 Task 之外的功能；不修改与任务无关的文件。
4. **尊重用户修改**: 不删除、覆盖或回滚用户已有修改；不执行 reset、checkout 等破坏性操作。
5. **最小依赖原则**: 不添加依赖，除非当前 Task 明确需要且现有库无法满足。
6. **实事求是**: 所有结论必须基于实际文件读取或命令运行结果。未运行过的测试不得声称通过。
7. **发现额外工作**: 记录为新 Task（写入 `TASK_INDEX.md`），不要在当前 Task 顺带实现。
8. **跨会话状态维护**: 每次会话结束前必须更新 `docs/AI/SESSION_STATE.md`。

---

## 4. 任务生命周期与状态流转

状态流转仅允许以下路径：
```
TODO -> IN_PROGRESS -> REVIEW -> DONE
                    \-> BLOCKED
```

- **TODO**: 待处理。
- **IN_PROGRESS**: 当前正在执行。
- **REVIEW**: 代码已编写，正在等待或进行验证。
- **DONE**: 验收标准全部满足，测试与验证命令实际执行成功，文档已更新。
- **BLOCKED**: 缺少必要外部条件或关键信息，阻塞原因已明确记录。

---

## 5. 修改前计划规范

在执行任何代码修改前，必须在对话中输出结构化计划：
- Request Type
- Goal
- Current Behavior
- Current Task
- Dependencies
- Files To Read
- Files To Modify
- Files To Create
- Implementation Approach
- Acceptance Criteria
- Verification Method
- Risks and Assumptions

---

## 6. 会话结束交接格式

会话结束时必须输出标准交接报告（包含 Goal, Task, Status, Changed Files, Created Files, Implementation Summary, Verification and Test Results, Known Issues, Remaining Work, Next Task）。
