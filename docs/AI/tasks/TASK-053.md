# TASK-053: 桌面端新窗口行为规范化 (Desktop Multi-Window VS Code Alignment & Clean Workspace)

## 任务元数据
- **任务 ID**: TASK-053
- **任务名称**: 桌面端新窗口行为规范化 (Desktop Multi-Window VS Code Alignment & Clean Workspace)
- **创建时间**: 2026-09-14
- **依赖任务**: TASK-021
- **状态**: DONE

---

## 1. 任务背景与核心痛点

在 Remora 桌面端使用过程中，用户反馈多窗口工作流存在如下不符合直觉的体验：
1. **新建窗口强制加载上一项目**:
   - 当用户在已有窗口运行中按下 `Ctrl+Shift+N`、点击 ActivityBar 新建窗口按钮或在终端中运行 `remora --new-window` 时，新打开的窗口并未呈现类似 VS Code 的空白干净工作区；
   - 相反，新窗口自动加载了上一个窗口正在打开的项目目录，并自动触发了远程服务器连接与目录加载。
2. **预期差异 (VS Code 规范)**:
   - 在现代代码编辑器（如 VS Code）中，“新建窗口 (New Window)”的预期是开启一个全新的空白工作区（Empty Workspace），展示 Welcome 引导页与“打开文件夹/项目”选项；
   - 各窗口相互独立，互不影响；各窗口打开的项目在系统桌面任务栏与窗口标题栏清晰可辨。

---

## 2. 根本成因深度剖析 (Root Cause Analysis)

1. **URL 未区分窗口类型**:
   - 在 `src-tauri/src/lib.rs` 的 `open_new_window` 中：
     ```rust
     tauri::WebviewWindowBuilder::new(
         app,
         &window_id,
         tauri::WebviewUrl::App("index.html".into()),
     )
     ```
     新窗口加载的 URL 依然是纯粹的 `index.html`，前端无法在第一时间识别该 Webview 是否属于辅助/新建窗口。
2. **LocalStorage 跨 Webview 共享与无条件恢复**:
   - Tauri 桌面端在同一个 App 域名下，所有的 WebviewWindow 共享相同的 `localStorage` 命名空间；
   - 前端 `src/App.tsx` 在组件初次挂载时，无条件调用了：
     ```typescript
     useFileTreeStore.getState().restoreLastWorkspace();
     ```
   - 该方法直接从 `localStorage` 中获取 `remora_last_workspace_server` 与 `remora_last_workspace_path`，导致新窗口自动继承了上一窗口的工作区路径。
3. **窗口标题缺乏动态上下文**:
   - 之前所有窗口标题一律固定为 `Remora`，在多窗口并行开发时，用户在系统任务栏、Dock 或 Alt-Tab 切换中无法直观区分哪个窗口对应哪个远程项目。

---

## 3. 解决方案与技术实现

### 3.1 原生层标记辅助窗口与参数路由 (`src-tauri/src/lib.rs`)
- 在 `open_new_window` 中，将 Webview 加载 URL 指定为带参数的 `index.html?new_window=1`：
  ```rust
  tauri::WebviewWindowBuilder::new(
      app,
      &window_id,
      tauri::WebviewUrl::App("index.html?new_window=1".into()),
  )
  ```
- 无论是前端通过快捷键、UI 按钮触发 `create_new_window`，还是从单实例命令行 `--new-window` 启动，均统一携带该标识。

### 3.2 双重辅助窗口检测引擎 (`src/utils/tauriBridge.ts`)
- 实现了同步判断 `isNewOrAuxiliaryWindow()` 与异步验证 `isAuxiliaryWindowAsync()`：
  1. 同步层面：直接读取 `window.location.search` 中的 `new_window=1` 或 `isNewWindow=true`，无需任何异步 IPC，0 延迟判定；
  2. 原生层面：读取 Tauri 窗口的标签名（主窗口为 `main`，新建窗口为 `window-<uuid>`），两级兜底确保 100% 精准识别。

### 3.3 欢迎页空工作区与视图布局自适应 (`src/App.tsx`)
- 在 `App.tsx` 初始化生命周期中：
  - 若为冷启动首个主窗口：保持原有体验，优雅恢复上一次活跃工作区（`restoreLastWorkspace()`）；
  - 若为辅助/新建窗口（`isAuxiliaryWindowAsync() === true`）：
    - 坚决跳过 `restoreLastWorkspace()`，保持 `rootPath: null` 与 `currentServerId: null`；
    - 联动 `layoutStore` 默认将底部终端面板收起（`setTerminalOpen(false)`）；
    - Project Explorer 展现清晰的服务器列表与“打开项目/文件夹”直达入口；Editor 区域呈现 VS Code 风格的全新欢迎界面（Remora Remote Code Editor）。

### 3.4 VS Code 风格动态窗口标题联动 (`src/stores/fileTreeStore.ts`)
- 封装跨平台窗口标题更新函数 `setAppWindowTitle(title)`，安全兼容桌面 Tauri 原生层（`getCurrentWebviewWindow().setTitle`）与浏览器调试模式；
- 在工作区状态流转中自动同步原生窗口标题：
  - 打开项目（`setRoot`）时：更新为 `[项目名] - Remora`；
  - 切换无工作区的服务器或关闭项目（`closeWorkspace`）时：还原为 `Remora`；
  - 新建空白窗口初始化时：确保标题为 `Remora`。

---

## 4. 验证与测试结果

1. **前端类型与语法检查**:
   - 执行 `pnpm tsc --noEmit`：0 错误，TypeScript 严格检查通过。
2. **前端生产打包验证**:
   - 执行 `pnpm build`：Vite 生产打包成功，产物正常生成。
3. **后端 Rust 编译检查**:
   - 执行 `cargo check`：编译顺利通过，耗时 3.79s，0 警告阻断。

---

## 5. 后续规划关联

- 本次会话完成 **TASK-053**（桌面端新窗口行为规范化）；
- 下一阶段将启动 **TASK-054**（远程图片文件可靠预览与缩放查看能力支持）。
