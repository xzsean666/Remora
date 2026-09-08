# TASK-006: VS Code 风格响应式多面板布局系统 (Splitter)

## Objective
在 React 前端实现经典 VS Code 风格的多面板响应式布局容器，包括 Activity Bar 导航栏、可左右自由拖拽拉伸的侧边栏 (Sidebar Splitter)、主编辑工作区、可上下自由拖拽拉伸的底部面板 (Bottom Panel Splitter) 以及状态栏 (StatusBar)，并通过 Zustand `layoutStore` 实现布局尺寸与面板状态的响应式管理与本地 SQLite 偏好持久化。

## Scope
- 创建 `layoutStore.ts`（Zustand）：管理 `sidebarWidth`, `terminalHeight`, `isSidebarOpen`, `isTerminalOpen`, `activeSidebarTab`
- 实现持久化：应用加载时调用 `get_layout_preferences` 恢复尺寸，尺寸变动后自动同步调用 `set_layout_preferences`
- 实现 `ActivityBar` 组件：图标导航、高亮活动项与点击折叠/展开侧边栏切换
- 实现 `Splitter` 组件：支持水平方向 (`col-resize`) 与垂直方向 (`row-resize`) 的丝滑鼠标拖拽，防止文本误选中，具备最小/最大尺寸边界约束
- 实现 `SidebarContainer` 组件：展示当前活动 Tab 容器，支持折叠与拉伸
- 实现 `PanelContainer` 组件：底部终端/输出面板容器，支持折叠与拉伸
- 实现 `StatusBar` 组件：显示当前 SSH 连接状态、项目路径、终端/侧边栏切换快捷按钮
- 组装至 `App.tsx` 并确保构建无报错

## Allowed Files
- `src/stores/layoutStore.ts`
- `src/components/Layout/**/*`
- `src/components/ActivityBar/**/*`
- `src/components/Sidebar/**/*`
- `src/components/StatusBar/**/*`
- `src/App.tsx`
- `docs/AI/tasks/TASK-006.md`

## Dependencies
- 前置依赖: TASK-001 (项目前端骨架就绪), TASK-002 (本地 SQLite 偏好持久化接口就绪)

## Inputs and Outputs
- **Inputs**: 鼠标拖拽事件、用户切换导航按钮、存储层布局偏好
- **Outputs**: 流畅自适应的桌面 VS Code 风格布局体系

## Acceptance Criteria
1. 侧边栏可通过鼠标拖拽边框实时调节宽度（约束在 160px ~ 600px 之间）。
2. 底部终端面板可通过鼠标拖拽边框实时调节高度（约束在 100px ~ 600px 之间）。
3. 拖拽过程中界面平滑无卡顿，无光标失焦或选中页面文本问题。
4. 点击 Activity Bar 活动图标可切换 Tab 或收起/展开侧边栏。
5. 前端 `pnpm run build` 成功，类型检查全部通过。

## Verification Commands
```bash
pnpm run build
```

## Risks and Assumptions
- 风险: 拖拽经过 iframe 或特殊元素时丢失 mouseup；在 window 级别监听 mousemove 与 mouseup 并在 body 添加 user-select: none。

## Status
DONE
