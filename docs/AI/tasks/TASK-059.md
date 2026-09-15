# TASK-059: VS Code 风格全局跨文件搜索系统 (VS Code Style Remote Global Search via SSH Exec)

## 1. 任务背景与目标

在远程 SSH 开发场景下，开发者迫切需要像 VS Code 一样便捷高效的跨文件全局内容搜索（`Ctrl+Shift+F`）。
由于通过 SFTP 下载全部文件到客户端搜索会导致灾难性的网络延迟和内存消耗，Remora 采用 **SSH Exec 管道流与远端自适应智能级联搜索架构 (Adaptive Cascading Search Pipeline)**：
1. **Tier 1 (极致性能)**: `ripgrep` (`rg`) —— VS Code 同款搜索工具，原生多线程，自动遵循 `.gitignore`，跳过二进制与 `node_modules`，毫秒级响应（50ms~150ms）；
2. **Tier 2 (零安装依赖)**: `git grep` —— 绝大多数开发服务器 100% 预装，原生过滤 `.gitignore`，性能接近 `rg`；
3. **Tier 3 (全平台兜底)**: GNU/BSD `grep -rnI` —— 任何精简 Linux/macOS/容器系统 100% 支持；
4. **安全与鲁棒性**:
   - 搜索词与正则模式通过 Base64 编码注入远端 Shell，彻底杜绝 Shell 命令注入风险；
   - 1000 行软上限防爆流截断，防止单字符搜索产生巨额数据冲垮网络通道。

## 2. 核心架构与功能设计

1. **Rust 后端 (`src-tauri/src/search/mod.rs` & `lib.rs`)**:
   - 提供 `search_in_files` Tauri 命令；
   - 自动在远端执行探测与搜索，统一将 `rg` (`path:line:col:content`) 或 `git grep`/`grep` (`path:line:content`) 转换为结构化的 `SearchResult`；
   - 统计耗时、命中总数、命中文件数、是否发生截断以及使用的底层引擎（`ripgrep` / `git-grep` / `grep`）。

2. **前端数据流 (`src/stores/searchStore.ts`)**:
   - 维护查询词、三个经典切换开关（大小写敏感 `Aa`、全字匹配 `\b`、正则表达式 `.*`）、包含通配符（include pattern）、排除通配符（exclude pattern）；
   - 提供全部展开/全部折叠、单文件折叠状态记忆；
   - 匹配关键字高亮切分逻辑。

3. **编辑器精确定位跳转 (`src/stores/editorStore.ts` & `src/components/Editor/CodeEditor.tsx`)**:
   - `openFile` 支持传递 `targetPosition: { line: number; ch?: number }`；
   - `CodeEditor` 在渲染时自动将视口平滑滚动至对应行号，并将光标移动至对应列。

4. **VS Code 视觉与交互面板 (`src/components/Sidebar/Search/SearchPanel.tsx`)**:
   - ActivityBar 放大镜图标与快捷键 `Ctrl+Shift+F`；
   - 搜索输入框集成 VS Code 风格的三联切换开关徽标；
   - 可折叠的高级过滤栏（files to include / files to exclude）；
   - 树状结果呈现，文件节点带图标与匹配数 Badge，行结果带行号与高亮文本，点击直达。

## 3. 验收标准与验证命令

- `cargo test --manifest-path src-tauri/Cargo.toml` 100% 通过（含搜索解析与格式化单元测试）；
- `pnpm tsc --noEmit` 0 报错；
- `pnpm build` 生产构建成功。
