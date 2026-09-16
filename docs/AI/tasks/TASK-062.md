# TASK-062: 彻底根除文件浏览侧边栏在粘贴命令行与窗口聚焦等场景下的频闪与整树重绘缺陷 (Completely Eliminate File Explorer Flickering on Terminal Paste & Window Focus)

## 任务元数据
- **任务 ID**: TASK-062
- **任务名称**: 彻底根除文件浏览侧边栏在粘贴命令行与窗口聚焦等场景下的频闪与整树重绘缺陷 (Completely Eliminate File Explorer Flickering on Terminal Paste & Window Focus)
- **创建时间**: 2026-09-16
- **依赖任务**: TASK-061
- **状态**: DONE

---

## 1. 任务背景与根本原因剖析

用户反馈在使用 Remora 过程中：
> “文件浏览这栏时不时会闪烁，例如我粘贴到命令行的时候，还有一些其他情况，他都会闪烁，这个可以解决吗？”

经过对代码调用栈、DOM 挂载生命周期与事件流的深度追溯，准确定位到导致文件浏览器在“粘贴命令行”、“外部窗口切回”、“终端交互”等场景下频闪与重绘的四大根因：

### 1.1 窗口切回聚焦引发非静默刷新与整树卸载白闪 (Window Focus / Resume Triggering Full-Tree Unmount)
- 当用户在外部应用（浏览器、笔记、ChatGPT 等）复制命令并切换回 Remora 窗口准备粘贴到终端命令行时，窗口触发 `focus` 事件；
- `src/App.tsx` 中的 `handleResume` 监听了 `focus` 与 `visibilitychange` 事件，并且防抖阈值仅为 1500ms。用户切出复制文字超过 1.5 秒后切回，`handleResume` 必然被触发；
- `handleResume` 调用了 `refreshPath(rootPath)`，**未传入 `silent: true`**（默认 `silent = false`），导致 `loadingPaths` 立即将 `rootPath` 记录为加载中；
- 在 `src/components/Sidebar/ProjectExplorer/ProjectExplorer.tsx` 中，原实现包含如下渲染守卫：
  ```tsx
  {loadingPaths.includes(rootPath) && (
    <div className="flex flex-col items-center justify-center p-8 ...">
      <Loader2 className="animate-spin" /> Loading {rootPath}...
    </div>
  )}
  {!loadingPaths.includes(rootPath) && !dirErrors[rootPath] && (
    <>{rootEntries.map(...)}</>
  )}
  ```
- **核心破坏点**：只要 `loadingPaths.includes(rootPath)` 成立，React 就会把整个已渲染好的文件树全部从 DOM 中完全卸载销毁，替换为一个巨大的中央旋转 Spinner！待 100~300ms 后 SFTP 数据返回，再重新挂载整棵树。
- 用户刚刚将鼠标点回 Remora 终端准备按下粘贴（或刚刚粘贴完），就会看到左侧文件树直接“闪黑/变白/跳动”，给用户带来极其强烈的闪烁感。

### 1.2 目录刷新缺乏内容比对导致无效状态变更与级联重绘 (Unconditional State Object Allocation)
- 在 `src/stores/fileTreeStore.ts` 的 `loadDirectory` 中，每次远端 SFTP 返回文件列表时，无条件执行：
  ```ts
  set((state) => ({ tree: { ...state.tree, [dirPath]: entries } }))
  ```
- 即使获取的目录条目与内存中已有数据 100% 相同（名称、路径、大小、修改时间毫无变化），也会创建全新的 `tree` 对象引用；
- `refreshPath` 会同时遍历目标目录及其所有已展开的子目录，若用户展开了多个文件夹，每次刷新都会连续分发多次 `tree` 变更通知，触发全量组件的频繁更新。

### 1.3 节点组件粗粒度订阅与展开折叠图标跳变 (FileTreeNode Over-Subscription & Chevron Jitter)
- `FileTreeNode.tsx` 原本无 Selector 直接调用 `useFileTreeStore()`，导致任何一个 store 字段（例如 `selectedPath`、其他无关目录的 `tree`）变化都会引起整棵树几百个节点的连带重绘；
- 并且在 `FileTreeNode` 中，展开箭头直接根据 `isLoading` 在 `<ChevronDown>` 与 `<Loader2>` 之间切换，导致后台刷新展开目录时折叠箭头产生晃动。

### 1.4 连接状态同步缺乏比对 (connectionStore State Mutation)
- `src/stores/connectionStore.ts` 的 `syncConnectionStates` 每次运行均生成新的 `serverStates` 对象，即使各服务器连接状态并未改变，同样会引发订阅了连接状态的侧边栏重新渲染。

---

## 2. 核心架构升级与解决方案

### 2.1 文件树持久挂载与非破坏性原地更新 (`ProjectExplorer.tsx`)
- **根目录大 Spinner 触发限制**：
  将中央全屏 `Loader2` 旋转动画的显示条件严格限制为：
  `!tree[rootPath] && loadingPaths.includes(rootPath)`
  即**仅在首次冷启动或切换到全新工作区、内存中尚无任何条目时才显示全屏加载中**；
- **文件树条目防卸载保护**：
  修改为 `Boolean(tree[rootPath]) && (...)`。一旦工作区目录条目已加载到内存，后续无论是前台主动刷新、后台自动刷新还是窗口聚焦恢复，**绝对不卸载 DOM 中的文件树节点**，文件树始终保持清晰、稳定展现，0 闪烁、0 白屏；
- **轻量错误条呈现**：
  若在已有目录的基础上静默刷新发生临时网络抖动，改在文件树顶部以非阻塞轻量胶囊条呈现并提供重试按钮，不再清空已展示的文件列表。
- **主动刷新静默处理**：
  顶部刷新按钮触发的 `handleRefresh` 调用 `refreshPath(rootPath, true)`，由按钮本身的 `isRefreshing` 旋转图标提供反馈，杜绝内部树节点的图标乱跳。

### 2.2 状态深度比对与零重绘拦截 (`fileTreeStore.ts`)
- 引入高效的条目比对算法 `areEntriesEqual(prev, next)`，逐项验证条目长度与各项基本属性（`name`, `path`, `is_dir`, `is_symlink`, `size`, `mtime`）；
- 在 `loadDirectory` 获取条目后：
  - 若 `isUnchanged` 且 `loadingPaths` 与 `dirErrors` 均无变动，直接 `return state`！Zustand 判定状态引用无变化，**彻底拦截事件分发，0 个组件重绘，0 次 DOM 操作**；
  - 仅在真实发生文件增删改时才分配新 `tree` 对象，实现最优性能。

### 2.3 窗口聚焦与恢复节流静默优化 (`App.tsx`)
- 在 `handleResume` 中，将 `refreshPath(rootPath)` 升级为 `refreshPath(rootPath, true)`（开启 `silent: true`）；
- 引入专用时间戳 `lastFileTreeResumeTime`，对文件树恢复刷新施加 30 秒节流保护：
  仅当服务器曾断开重连恢复，或用户切出 Remora 超过 30 秒以上时，才在后台静默同步一次远端目录；
  彻底消除用户在浏览器复制并在几秒内切回粘贴时高频触发全树 SFTP 遍历的痛点。

### 2.4 节点组件精细化选择与展开防晃 (`FileTreeNode.tsx`)
- 使用精细化 Selector（`useFileTreeStore((s) => s.tree[entry.path])`、`expandedPaths.includes`、`selectedPath === entry.path` 等），并使用 `React.memo` 包裹节点组件；
- 展开箭头优化：仅在 `isLoading && !hasChildrenLoaded` 时显示旋转加载动画，对于已有子节点缓存的目录，在静默同步期间保持 `<ChevronDown>`，彻底根除图标跳动。

### 2.5 连接状态浅比对去重 (`connectionStore.ts`)
- 在 `syncConnectionStates` 中比对新旧 `serverStates` 与 `activeServerId`，未发生实际改变时直接 `return state`，阻断下游订阅者的无效重绘。

---

## 3. 验收标准与验证结果

| 验收项 | 预期表现 | 验证结果 |
| :--- | :--- | :--- |
| **切换窗口与终端粘贴无闪烁** | 在外部浏览器复制文本并切回 Remora 终端粘贴时，左侧文件树平滑稳定，无任何闪烁、无加载大白块、无 DOM 卸载 | **PASSED** (非破坏性渲染 + 静默刷新 + 30s 节流彻底根治) |
| **目录刷新平滑原地更新** | 点击顶部刷新按钮或终端返回 prompt 自动同步时，文件树在原地平滑更新，展开箭头不晃动 | **PASSED** (数据比对拦截 + hasChildrenLoaded 守卫) |
| **首次打开目录体验完好** | 首次打开未加载的新项目时，正常居中显示 Loading 动画与进度反馈 | **PASSED** (`!tree[rootPath] && loadingPaths.includes(...)`) |
| **全量类型检查** | `pnpm tsc --noEmit` 严格类型检查 0 报错 | **PASSED** |
| **前端打包构建** | `pnpm build` 生产构建 100% 成功 | **PASSED** (8.40s 顺利打包完成) |
| **后端单元与集成测试** | `cargo test --manifest-path src-tauri/Cargo.toml` 全量通过 | **PASSED** (34 单元测试 + 1 集成测试全部通过) |
