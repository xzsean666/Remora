# TASK-025: 全局快捷输入与分组管理系统 (Quick Snippets & Groups)

---

## 1. 任务背景与目标

用户在远程 Linux 运维与开发过程中，存在大量高频重复执行的 shell 命令（如查看系统负载 `uname -a` / `free -h`、Docker 容器排查 `docker ps` / `docker logs`、Git 协同操作、服务状态检查等）。
用户提出明确诉求：
1. **全局快捷输入**：提供常用命令库，点击即可自动帮用户输入至当前 SSH 终端中。
2. **提前编辑与管理**：用户可随时预先编辑（新建、修改、删除）这些快捷命令，支持自定义命令内容、标题、自动执行策略。
3. **支持分组归类**：支持按业务或场景将快捷输入进行多维度分组（如 System, Docker, Git, Network, Dev 等），支持新建/重命名/删除分组。
4. **全局生效**：不绑定单一服务器或单次会话，在整个应用所有终端、所有服务器会话中全局可用，持久化保存。

本任务目标：
- **后端 SQLite 持久化与 CRUD 支持**：
  - 在 `StorageService` 中新增 `quick_snippets` 数据表，记录 `id`, `title`, `command`, `group_name`, `auto_execute`, `description`, `sort_order`, `created_at`, `updated_at`。
  - 首次运行自动播种内置的高频实用指令库（包含 System, Docker, Network, Git 等典型分类），开箱即用。
  - 暴露完整的 Tauri IPC 命令（查询、保存、删除、分组批量操作）。
- **前端状态管理与终端桥接 (useQuickSnippetStore)**:
  - 管理全局 snippets 与动态计算 groups 列表，支持分组过滤与实时搜索。
  - 实现 `sendToTerminal`：向当前激活的在线终端 session 发送 UTF-8 字节流；支持配置是否自动带回车执行，或仅填入命令以便用户修改参数。
- **ActivityBar & 侧边栏全功能管理面板 (QuickInputPanel)**:
  - ActivityBar 新增 `snippets` (⚡ Zap 图标) 导航入口，支持快捷键 `Ctrl+Shift+K`。
  - 提供分组切换胶囊、搜索过滤、卡片手风琴折叠展开。
  - 支持快捷运行、复制到剪贴板、编辑、删除与分组管理。
  - 提供优雅易用的模态框 `SnippetEditModal` 支持配置命令详情。
- **终端界面快捷悬浮栏/操作条 (TerminalQuickBar)**:
  - 终端面板内置快捷命令条，开发者在终端输入界面内无需离开视线，即可一键点击直发高频指令。

---

## 2. 详细技术方案

### 2.1 后端数据模型与 SQLite 结构

在 `src-tauri/src/core/types.rs` 中定义数据模型：
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickSnippet {
    pub id: String,
    pub title: String,
    pub command: String,
    pub group_name: String,
    pub auto_execute: bool,
    pub description: Option<String>,
    pub sort_order: i32,
    pub created_at: i64,
    pub updated_at: i64,
}
```

在 `src-tauri/src/storage/db.rs` 中初始化表：
```sql
CREATE TABLE IF NOT EXISTS quick_snippets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    command TEXT NOT NULL,
    group_name TEXT NOT NULL,
    auto_execute INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

若表为空，默认注入开箱即用推荐命令种子。

### 2.2 前端终端通信机制

终端数据写入通过已有的 `terminal_write` IPC 渠道：
1. 从 `useTerminalStore` 获取 `activeSessionId` 及对应的 `TerminalSession`。
2. 校验会话状态为 `connected` 并存在有效的 `backendSessionId`。
3. 规范化命令字符串：
   ```ts
   const textToSend = autoExecute
     ? (command.endsWith("\n") || command.endsWith("\r") ? command : command + "\n")
     : command;
   ```
4. 将文本通过 UTF-8 编码为 `Uint8Array`，发送至 `terminal_write`。
5. 若当前无激活终端，提供温和的 Toast 提示指导用户连接或新建终端。

---

## 3. 验收标准

1. 用户可以在侧边栏通过 ActivityBar ⚡ 图标或快捷键 `Ctrl+Shift+K` 打开快捷输入管理面板。
2. 支持点击快捷输入卡片或“运行”按钮，命令立刻被输入到当前活动的 SSH 终端中。
3. 若勾选“自动回车”，输入后立即执行；若未勾选，仅填充在命令行上保留光标供用户追加参数。
4. 支持对快捷输入进行编辑（修改名称、指令、所属分组、自动执行开关、备注）和删除。
5. 支持自由添加新分组，支持按分组过滤和关键字模糊搜索。
6. 支持在终端面板直接通过快捷条查看与一键点击输入当前分组命令。
7. 数据在本地 SQLite 数据库持久化保存，重启应用与不同服务器连接间全局共享。
8. 零配置默认预置常用系统、Docker、Git、网络排查命令模板。
9. 单元测试、TypeScript 类型检查与生产打包全量通过。

---

## 4. 状态与验证结果

- **状态**: **DONE**
- **验证结果**:
  - `cargo check --manifest-path src-tauri/Cargo.toml`: 0 错误 0 告警通过。
  - `cargo test --manifest-path src-tauri/Cargo.toml`: 22 组单元测试 + 1 组 e2e 测试全部 100% 通过（新增 `test_quick_snippets_crud_and_groups` 测试分组与 CRUD 完整生命周期）。
  - `pnpm tsc --noEmit`: 前端 TypeScript 类型检查 0 报错通过。
  - `pnpm build`: Vite 生产打包通过，各组件与代码分包构建成功。

