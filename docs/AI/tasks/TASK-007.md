# TASK-007: Project Explorer 远程文件树与按需懒加载组件

## Objective
在 React 前端实现完整的远程项目文件树浏览器 (`ProjectExplorer`)，支持按需懒加载 (Lazy Loading)、层级折叠展开、智能临时文件过滤、文件图标映射、右键上下文菜单（新建文件/文件夹、重命名、删除、刷新、复制路径）以及与后端 SFTP API 的无缝联动。

## Scope
- 创建 `fileTreeStore.ts`（Zustand）：管理远程目录树节点状态、加载中状态 (`loadingMap`)、展开集合 (`expandedPaths`)、当前选中项 (`selectedPath`)
- 实现 `fileIcons.ts`：根据文件扩展名与目录状态匹配友好图标（Rust, TS, JS, Python, Go, JSON, Markdown, 文件夹等）
- 实现 `FileTreeNode` 递归/扁平树形组件：具备缩进层级、展开/收起箭头、双击打开与单击选中效果
- 实现智能折叠：默认收起大规模依赖目录 (`.git`, `node_modules`, `target`, `vendor`)
- 实现右键上下文菜单 (`ContextMenu`)：新建文件、新建目录、重命名、删除（二次确认）、刷新、复制路径
- 提供顶部操作栏：新建文件图标按钮、新建文件夹图标按钮、全量刷新按钮、全部折叠按钮
- 与 Tauri IPC `sftp_read_dir`, `sftp_create_file`, `sftp_create_dir`, `sftp_rename`, `sftp_remove` 联动
- 在 `SidebarContainer` 中渲染 `ProjectExplorer`

## Allowed Files
- `src/stores/fileTreeStore.ts`
- `src/utils/fileIcons.tsx` / `src/utils/fileIcons.ts`
- `src/components/Sidebar/ProjectExplorer/**/*`
- `src/components/Sidebar/ContextMenu.tsx`
- `src/App.tsx`
- `docs/AI/tasks/TASK-007.md`

## Dependencies
- 前置依赖: TASK-004 (SFTP 核心接口就绪), TASK-006 (多面板布局系统就绪)

## Inputs and Outputs
- **Inputs**: Server ID, Remote Root Path, 用户点击/展开/右键菜单动作
- **Outputs**: 具备完整文件操作与状态同步的现代化远程文件树组件

## Acceptance Criteria
1. 仅在用户展开目录节点时按需触发 `sftp_read_dir`，已加载目录缓存子节点。
2. 新建文件、新建文件夹、重命名、删除成功后自动局部刷新或全量刷新父节点。
3. 右键点击任意文件或目录弹出对应上下文菜单。
4. 常见文件类型呈现对应的高保真图标与颜色。
5. 前端 `pnpm run build` 成功，TypeScript 类型检查无报错。

## Verification Commands
```bash
pnpm run build
```

## Risks and Assumptions
- 风险: 深度递归嵌套导致 DOM 溢出；采用扁平层级与缩进计算避免性能瓶颈。

## Status
DONE
