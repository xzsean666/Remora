# TASK-047: 文件浏览 VS Code 体验增强与 .gitignore 视觉感知 (File Explorer VS Code Experience & .gitignore Dimming Enhancement)

## 任务元数据
- **任务 ID**: TASK-047
- **任务名称**: 文件浏览 VS Code 体验增强与 .gitignore 视觉感知 (File Explorer VS Code Experience & .gitignore Dimming Enhancement)
- **创建时间**: 2026-09-12
- **依赖任务**: TASK-007, TASK-045, TASK-046
- **状态**: DONE

---

## 1. 任务背景与核心需求

1. **文件树缺少 .gitignore 忽略文件置灰视觉感知**:
   - 在 VS Code 等现代编辑器中，被 `.gitignore` 规则匹配的文件和目录均呈现低饱和度置灰/半透明视觉（例如 `dist/`、`node_modules/`、`target/`），并支持在悬浮提示中标识 `[gitignored]`。
   - Remora 此前在文件浏览器中对所有文件呈现相同颜色，开发者无法一眼识别哪些文件已被忽略、哪些文件会被提交到远端版本库。
2. **VS Code 常用高效小功能集成调查与落地**:
   - 右键文件/文件夹时仅有“复制完整绝对路径”，缺少在日常模块引用、撰写文档、调试时最高频使用的“复制相对路径 (Copy Relative Path)”；
   - 缺少直接在文件树定位并进入终端的“在集成终端中打开 (Open in Integrated Terminal)”功能；
   - 在大型项目中文件数量众多，缺少类似 VS Code 的文件树即时过滤搜索功能（Quick Filter）。

---

## 2. 解决方案与核心实现

### 2.1 高性能 .gitignore 解析与文件树置灰/Git 状态角标联动
- **Rust 后端高效提取忽略规则**:
  - 在 [src-tauri/src/lib.rs](file:///ssd0/git/Remora/src-tauri/src/lib.rs) 的 `git_get_status` 指令中，追加执行 `git -C "{path}" status --porcelain=v1 --ignored 2>/dev/null | grep '^!!' || true`。
  - 采用非递归的目录级忽略提取机制，在 0.05 秒内即刻获取所有被忽略的顶级目录和文件，避免了对 `node_modules` 等数万文件的深层无效递归遍历。
  - 在 `GitStatusResult` 结构中新增 `pub ignored: Vec<String>` 字段回传至前端。
- **前端全局 Git Store 状态与层级判定**:
  - 在 [src/stores/gitStore.ts](file:///ssd0/git/Remora/src/stores/gitStore.ts) 中增加 `ignored: string[]` 字段与 `isPathIgnored(path, rootPath)` 判定函数。
  - 自动递归匹配子目录与深层路径：若父级目录（如 `node_modules` 或 `target`）被忽略，其内部所有深层子文件自动继承忽略状态；
  - 自动默认忽略 `.git` 内部文件；
  - 在 [src/utils/tauriBridge.ts](file:///ssd0/git/Remora/src/utils/tauriBridge.ts) 中同步更新 TypeScript 接口。
- **FileTreeNode 视觉置灰与 Git 状态角标**:
  - 在 [src/components/Sidebar/ProjectExplorer/FileTreeNode.tsx](file:///ssd0/git/Remora/src/components/Sidebar/ProjectExplorer/FileTreeNode.tsx) 中：
    - 针对 `isIgnored` 节点赋予 `opacity-50 text-vscode-textMuted/70` 置灰样式，并在悬浮 `title` 中追加 `[gitignored]` 提示，右侧展示轻量淡灰色 `I` 忽略标识；
    - 针对未被忽略且有变动的文件联动呈现 VS Code 同款 Git 状态色彩与角标：`M`（修改，黄色/amber）、`U`/`A`（未跟踪/暂存，绿色/emerald）、`D`（删除，红色/rose）、`R`（重命名，蓝色/sky）。

### 2.2 VS Code 常用小功能落地集成
1. **复制相对路径 (Copy Relative Path)**:
   - 在 [src/components/Sidebar/ContextMenu.tsx](file:///ssd0/git/Remora/src/components/Sidebar/ContextMenu.tsx) 与 [FileTreeNode.tsx](file:///ssd0/git/Remora/src/components/Sidebar/ProjectExplorer/FileTreeNode.tsx) 中，新增“复制相对路径”选项；
   - 自动截断工作区根目录前缀，一键复制以项目根为基准的标准相对路径（例如 `src/components/Sidebar/ContextMenu.tsx`），便于代码导入与文档编写。
2. **在集成终端中打开 (Open in Integrated Terminal)**:
   - 在右键菜单中新增“在集成终端中打开”功能。对于目录直接进入该目录，对于文件自动进入其所在父目录；
   - 联动 `terminalStore`：如果已有活跃终端，自动执行 `cd "<targetDir>"\n`；如果没有终端，自动为当前服务器新建一个工作目录锁定在该路径的终端会话，并保证底部终端面板自动展开或移动端自动切换到终端 Tab。
3. **文件树快速过滤搜索 (Explorer Quick Filter)**:
   - 在 [ProjectExplorer.tsx](file:///ssd0/git/Remora/src/components/Sidebar/ProjectExplorer/ProjectExplorer.tsx) 顶部工具栏新增 `Filter` 按钮；
   - 点击展开即时筛选框（支持输入文件名过滤与一键清除 `X`），输入关键字后文件树实时筛选匹配项；
   - 包含匹配项的父级目录自动展开呈现匹配文件，非匹配项平滑隐藏。

---

## 3. 验收标准
1. 文件树中被 `.gitignore` 匹配的文件和目录呈现 VS Code 风格的半透明置灰效果，并在 tooltip 中显示 `[gitignored]`。
2. 未忽略且有修改/未跟踪的文件显示标准的黄色 `M` 或绿色 `U` 状态角标。
3. 文件树右键菜单支持“复制相对路径”，剪贴板内容符合预期。
4. 文件树右键菜单支持“在集成终端中打开”，终端自动切换至所选目录。
5. 工具栏点击筛选图标可打开快速过滤输入框，能按输入名称即时过滤文件树。
6. 前端 TypeScript `pnpm tsc --noEmit` 与 Rust `cargo test` 全部测试 100% 通过。
