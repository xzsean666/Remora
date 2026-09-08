# TASK-016: UI 界面容器布局与溢出缺陷全面优化修复 (UI Layout & Overflow Fixes)

## 1. 任务背景与目标

用户在使用 Remora 过程中反馈部分 UI 界面存在“跳出框架 / 元素溢出”缺陷。
经系统性排查，主要诱因在于：
1. **服务器管理弹窗高度超限无视口约束**: `ServerManager` 弹窗未限制 `max-h` 与滚动区，表单超 580px，在 600px~800px 窗口下底部“保存 / 取消”按钮完全跳出屏幕框架外；
2. **Flex 容器缺少 min-w-0 导致 truncate 失效**: Flex 规范中 flex 元素默认 min-width: auto，未显式声明 min-w-0 时文字不会截断，直接撑破卡片、文件树和标题栏，并将右侧操作按钮推出边框；
3. **嵌套双滚动条**: `SidebarContainer` 外层 overflow-y-auto 与内部子面板滚动区冲突，导致滚动条重叠及头部工具栏失位；
4. **状态栏右侧项目被推出视口**: 状态栏左侧容器缺少 min-w-0 flex-1 overflow-hidden，长连接名或长路径直接将右侧操作按钮顶出窗口边框；
5. **分栏拖动缺乏动态窗口限制**: 小屏幕下可将侧边栏或终端拖动至极大尺寸，造成工作区塌陷。

目标：彻底修复上述所有布局溢出缺陷，保证在任意分辨率和极端尺寸下界面均整洁受控、永不越界。

---

## 2. 影响文件清单

- `src/components/Sidebar/ServerManager/ServerManager.tsx`
- `src/components/Sidebar/SidebarContainer.tsx`
- `src/components/Sidebar/ProjectExplorer/ProjectExplorer.tsx`
- `src/components/Sidebar/ProjectExplorer/FileTreeNode.tsx`
- `src/components/Sidebar/ProjectExplorer/NewItemInput.tsx`
- `src/components/Sidebar/ContextMenu.tsx`
- `src/components/Sidebar/TransferManager/TransferPanel.tsx`
- `src/components/Editor/EditorArea.tsx`
- `src/components/Editor/EditorTabBar.tsx`
- `src/components/Editor/ConflictModal.tsx`
- `src/components/Terminal/TerminalPanel.tsx`
- `src/components/Terminal/TerminalTabBar.tsx`
- `src/components/StatusBar/StatusBar.tsx`
- `src/stores/layoutStore.ts`
- `src/App.tsx`

---

## 3. 验收标准

1. `ServerManager` 模态弹窗在任何高度窗口（包括 600px 最小尺寸）下均完整居中呈现，弹窗头部与底部操作按钮固定，中间表单流畅滚动，右上角支持快捷关闭，绝不跳出视口。
2. 侧边栏所有卡片（Server 卡片、Transfer 卡片）、文件树（深层嵌套、长文件名、重命名输入框）、Header 工具栏无论在 160px 还是更宽尺寸下，均平滑截断，操作按钮完整展示。
3. 侧边栏内杜绝双滚动条，子面板头部工具栏始终固定吸顶。
4. 状态栏左右分栏严格受控，右侧终端开关与编码指示器恒定吸附在右侧，不受左侧文本长度影响。
5. 前端 `pnpm build` 与整体编译 100% 成功。
