# TASK-019: 多 SSH 服务器并发连接状态维护、活动服务器激活切换与远程项目目录打开工作流

## 任务元数据
- **任务 ID**: TASK-019
- **任务名称**: 多 SSH 服务器并发连接状态维护、活动服务器激活切换与远程项目目录打开工作流 (Multi-Server Concurrent Connection, Active Server Switching & Remote Project Opening Workflow)
- **创建时间**: 2026-09-08
- **依赖任务**: TASK-002, TASK-003, TASK-004, TASK-007, TASK-017, TASK-018
- **状态**: DONE

---

## 1. 业务诉求与演化背景
原 MVP 架构中：
1. **连接状态单一性**: 前端 `connectionStore` 与 `ServerManager` 仅将单一服务器视作全局连接态 (`connectedServerId`)，连接新服务器会覆盖现有状态，无法在 UI 上并发展现多个已连接服务器。
2. **缺乏活动服务器切换机制**: 用户无法在多个在线 SSH 服务器之间自由选择将哪台设为当前活动工作区 (`Active Server`)。
3. **缺乏灵活打开项目（文件夹）的工作流**: 若服务器未配置 `default_workspace`，Project Explorer 仅显示静态占位符，用户无法在界面上手动指定、快速切换任意远程目录，亦未与后端的 `recent_projects` 历史持久化联动。

用户进一步指明核心交互体验：
> "不对啊，我连接了，并不需要打开个目录，而是我可以打开各种project目录啊，这个选项都没有看到我要有，而且需要根据ssh服务器分类看最近打开的project撒"

---

## 2. 详细改造方案

### 2.1 后端连接管理器全量状态查询
- **文件**: `src-tauri/src/connection/manager.rs`, `src-tauri/src/lib.rs`
- 在 `ConnectionManager` 增加 `get_all_states(&self) -> HashMap<String, ConnectionState>` 方法。
- 在 `src-tauri/src/lib.rs` 暴露 `get_all_connection_states` IPC 命令，支持前端随时与 Rust 异步多会话运行时完全对齐真实连接态。
- 单元测试覆盖：`test_get_all_states` 验证多会话连接状态并发检索。

### 2.2 前端连接 Store (`connectionStore.ts`) 架构升级
- 升级为多服务器并发状态字典：
  - `serverStates: Record<string, ConnectionStatus>`
  - `serverDetails: Record<string, { attempt?: number; error?: string }>`
  - `serverMetas: Record<string, ServerMeta>`
- 引入活动服务器状态：`activeServerId: string | null` 与 `setActiveServerId(id)`。
- 新增 `loadServers()` 方法并集成于 `initListener`，应用启动时立即全量拉取已配置服务器列表，无需必须切换到 Servers 面板。
- 自动智能推导 active 派生属性（保持 `connectedServerId`, `connectedServerName`, `status`, `reconnectAttempt` 向下兼容）。
- 连接成功自动激活首个可用服务器；断联时平滑降级切换至剩余在线服务器或空态。
- 全局监听 `connection-state-changed`，精准维护每一台服务器的实时状态。

### 2.3 文件树 Store (`fileTreeStore.ts`) 增强与项目历史持久化
- 引入 `serverRoots: Record<string, string>`，记住每个已连接服务器独立打开的项目路径。
- 提供 `switchServer(serverId)`，在切换活动服务器时无缝恢复或加载该服务器对应的工作区。
- **彻底剔除“连接时自动强行打开默认目录”的代码**：连接 SSH 仅建立网络会话，用户进入工作区可自主选择并打开任意项目。
- 在 `setRoot` 时自动调用 `add_recent_project` 写入 SQLite 数据库，持久化保留最近项目访问时间、服务器绑定与元信息。
- 提供 `closeWorkspace()` 允许随时关闭当前工作区，平滑返回“按 SSH 服务器分类的最近项目”面板。

### 2.4 通用打开远程项目文件夹弹窗 (`OpenFolderModal.tsx`)
- 支持在任意已连接服务器或当前活动服务器上打开项目目录。
- 支持自由输入远程绝对路径（回车即开，自动去除尾部斜杠）。
- 提供快捷路径推荐：
  - 默认工作区 (`defaultWorkspace`)
  - 用户家目录 (`~` / `/root` / `/home/${username}`)
  - 系统根目录 (`/`) 与常用路径 (`/var/www`)
- **按 SSH 服务器分类展示全部历史项目 (Grouped by Server)**：
  - 按服务器分组渲染所有历史项目列表；
  - 每个分组具备服务器名、主机端口标识及项目计数；
  - 跨服务器一键点击直达打开对应项目，无需提前手动切换下拉框。

### 2.5 视图交互全面升级
1. **ProjectExplorer (`ProjectExplorer.tsx`)**:
   - **未打开工作区时 (`!rootPath`)**：
     - 不再因未激活服务器而呈现空白阻断态，而是展示“远程项目看板”；
     - 顶部提供醒目的“Open Remote Folder / 打开远程项目”大按钮与快捷入口；
     - **根据 SSH 服务器分类展示最近项目 (Projects by SSH Server)**：
       - 为每个服务器呈现卡片分组，标明在线/激活/离线/连接中状态及主机信息；
       - 提供“Connect”、“Set Active”与“+ Open Folder”头部快捷操作；
       - 下属列出该服务器最近打开的所有项目（项目名、绝对路径、相对打开时间、删除历史按钮）；
       - 点击任意项目即可直接打开（若该服务器离线，自动在后台先发起 SSH 连接，成功后立即激活并载入项目工作区）；
       - 若某服务器尚无项目，提供虚线框引导与“Open Folder”按钮；
       - 若项目归属的服务器已被删除，优雅归入“Other / Archived Projects”分组，保证历史不丢失且可清理。
   - **已打开工作区时**：
     - 顶部栏常驻展示 `[ServerName] ProjectName`；
     - 提供“Open Another Folder / 切换或打开新项目”按钮与“Close Workspace / 关闭工作区返回项目列表”按钮；
     - 包含常规文件操作与上下文菜单。
2. **ServerManager (`ServerManager.tsx`)**:
   - 每个服务器卡片独立呈现连接状态（在线、连接中、离线、失败重试）。
   - 在线服务器清晰标示当前是“Active (当前激活)”还是“Standby (待命)”，提供一键“Set Active (激活)”切换。
   - 卡片内嵌“Projects / 最近项目 ({count})”列表，清晰展示该服务器的历史项目，标明当前已打开的“Opened”项目，提供“+ Open Project”入口。
3. **StatusBar (`StatusBar.tsx`)**:
   - 实时显示当前 Active 服务器名称与并发连接数徽章 `(N connected)`。
   - 远程工作区路径支持点击直达 Project Explorer。
4. **TerminalPanel (`TerminalPanel.tsx` & `TerminalTabBar.tsx`)**:
   - 终端根据当前活动服务器与活动工作区自动绑定与命名（例如 `[prod] 1: bash`）。

### 2.6 远程目录打开异常反馈与离线自动连接修复 (Open Remote Folder Blank/Failure Defect Fix)
- **问题原因 (Root Cause)**:
  1. 用户在“Open Remote Folder”弹窗中点击打开时，若目标服务器处于离线状态，原先代码直接调用 `setRoot`，导致后端 SFTP 通道抛出 `Server not connected` 异常。
  2. `fileTreeStore.ts` 的 `loadDirectory` 在发生异常时仅在控制台 `console.error`，未向 store 写入错误状态；且 `ProjectExplorer` 缺乏加载与错误三态处理，错误发生后直接回退为“目录为空”，界面无任何反馈，导致视觉上“什么都不显示”或假死。
  3. 用户输入 `~` 或 `~/...` 时，原先未做家目录自适应展开。
- **修复方案 (Implementation Details)**:
  1. **`OpenFolderModal.tsx` 离线自动连接与家目录展开**:
     - 在执行打开前检查 `isServerConnected(srvId)`；若离线则自动调用 `connect_server` 并在弹窗内展示“Connecting & Opening...”及加载 Spinner，避免未连接便直接建立 SFTP 会话。
     - 自动将 `~` 与 `~/...` 展开为远程主机的真实用户家目录（`/root` 或 `/home/${username}`）。
     - 支持直接在所有配置的服务器列表中切换，并带有 Online / Offline 徽章提示。
  2. **`fileTreeStore.ts` 错误状态持久化**:
     - 新增 `dirErrors: Record<string, string>` 状态字典。
     - 在 `loadDirectory` 捕获异常时记录详细错误信息（去除多余的前缀），成功时自动清理对应路径的错误记录。
  3. **`ProjectExplorer.tsx` 完整三态视图 (Loading / Error / Empty)**:
     - 载入中：展示 `Loading remote directory ${rootPath}...` 旋转指示器。
     - 载入失败：展示高对比度错误卡片（例如权限不足或目录不存在），并提供 `Retry`（重试）、`Change Folder`（切换目录）与 `Close`（返回看板）快捷按钮。
     - 目录正常为空：展示清晰友好的空态提示及“New File”与“Back to Projects”操作引导。
  4. **`layoutStore.ts` 侧边栏展开状态与 ActivityBar 折叠解耦**:
     - 彻底解耦业务导航与图标点击行为：`setActiveSidebarTab(tab)` 专用于程序化业务导航，始终确保 `isSidebarOpen: true` 展开可见，杜绝在 Explorer 视图下点击打开项目后调用 `setActiveSidebarTab("explorer")` 反向把侧边栏收起隐藏的致命缺陷；
     - 新增 `toggleSidebarTab(tab)` 专供 `ActivityBar` 图标点击，维持 VS Code 原生重复点击收起体验。
  5. **`OpenFolderModal.tsx` React Hooks 顺序致命崩溃彻底根除 (Rules of Hooks Fix)**:
     - 解决弹窗白屏的直接根因：原先包含在条件返回之后的 `useMemo`，现已将全部 React Hooks 严格置于顶层无条件执行，彻底根除白屏风险。
     - 编写 Playwright 端到端无头浏览器测试脚本，在真实运行环境下全链路测试通过。

### 2.7 交互式远程文件夹浏览器与选择器 (Remote Directory Browser & Selector)
- **用户反馈背景**:
  > "只有open没有browser啊，我要去选文件夹啊"
  此前对话框仅提供手动文本输入框和确认按钮，缺乏像专业 IDE 那样的图形化远程目录选择器与层级下钻能力。
- **架构升级方案**:
  1. **双标签页导航 (Tabbed Layout)**:
     - **Tab 1: 🧭 Browse Folders (远程文件夹浏览器)**（默认打开即进入）；
     - **Tab 2: 🕒 Recent Projects (最近项目看板)**（按服务器分类展示历史项目与一键清除）。
  2. **交互式远程目录浏览器 (Remote Directory Browser)**:
     - **路径导航工具栏**:
       - 向上上一级目录按钮（`↑ Up` / `..`，在根目录 `/` 时智能禁用）；
       - 可点击的面包屑路径节点（例如 ` / / root / my-project `），点击任一祖先层级可瞬间跳转；
       - 手动路径输入框与 `↳ Go` 快捷跳转按钮；
       - 单键快速跳转标签（`Default: ...`、`~ Home`、`/ (Root)`、`/var/www`）；
       - 刷新按钮（`RotateCw`）；
       - `Folders only` 筛选复选框（默认开启，专为选择项目文件夹优化）。
     - **动态 SFTP 目录列表**:
       - 实时调用 `sftp_read_dir`，按文件夹在前、首字母升序排列；
       - 离线保护：若服务器离线，呈现引导卡片与“Connect to Browse”按钮；
       - **单击目录行**: 选中该目录，以蓝色背景高亮并呈现 `✓ Selected` 徽章，同时同步到底部已选路径显示；
       - **双击目录行或点击右侧箭头 (➔)**: 深入（下钻）进入该子目录，动态拉取并展示子目录条目；
       - 包含加载指示器、空文件夹友好提示、权限拒绝或路径不存在时的错误提示与一键重试。
  3. **底部常驻选定与打开操作栏**:
     - 实时展示当前已选定的完整远程路径（`Selected / 已选路径: /root/my-project`）；
     - 提供“Cancel”与“Open Selected Folder”按钮；
     - 点击打开时支持离线自动连接、工作区挂载、历史记录沉淀与 Explorer 视图无缝切入。

---

## 3. 验收标准与测试执行结果
1. 后端 `cargo check` 0 错误 0 告警，`cargo test` 17 个测试（16 单元测试 + 1 集成测试）100% 全部通过。
2. 前端 `pnpm tsc --noEmit` 0 错误。
3. 前端 `pnpm build` (`tsc && vite build`) 100% 成功构建打包。
4. 连接 SSH 服务器时绝不自动强行打开任何工作区目录。
5. Project Explorer 与打开文件夹弹窗完整支持根据 SSH 服务器分类查看与管理最近打开的 Project。
6. 支持离线服务器一键连接并打开所选项目，支持在线服务器自由激活切换。
7. 打开远程目录在离线时自动连接并显示 Spinner；目录不存在或无权限时弹出错误提示卡片并提供恢复操作，彻底杜绝空白假死。
8. 打开远程目录或跨面板切换时侧边栏始终保持展开可见，绝不出现侧边栏自动关闭导致界面空白的现象。
9. 远程文件夹浏览器完整支持：
   - 上一级目录导航、面包屑祖先跳转与快捷路径切换；
   - 单击选中目标目录、双击/箭头下钻子目录；
   - 底部同步展示选定路径并一键挂载工作区；
10. Playwright 自动化 E2E 真实 Chromium 仿真测试 100% 成功运行并通过（覆盖目录列表加载、条目选中高亮、下钻子目录、向上返回上一级、快捷跳转 `/`、选择子目录打开并在 Explorer 中挂载对应项目文件树的全交互闭环），截图与执行日志 100% 验证无误，0 控制台错误。
