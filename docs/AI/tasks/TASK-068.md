# TASK-068: IDE 常规文档与数据格式深度支持 (PDF 预览、CSV/TSV 表格网格与源码双模、Parquet 列式数据与 Schema 预览)

- **ID**: TASK-068
- **Title**: IDE 常规文档与数据格式深度支持 (PDF Preview, CSV/TSV Table Grid & Source Code Modes, Parquet Columnar Data & Schema Viewer)
- **Status**: DONE
- **Created**: 2026-09-18
- **Dependencies**: TASK-008, TASK-067

---

## 1. 任务背景与目标

在日常远程开发与数据分析场景中，工程师经常需要在工作区中直接查看与排查多种常见格式文档：
1. **PDF 文档与论文/报表**：以往无法直接在 IDE 内置打开预览；
2. **CSV / TSV 结构化表格数据**：以往直接以纯文本展示，无法列对齐、缺乏表头固定、排序与搜索过滤能力，排查体验极差；
3. **Apache Parquet 列式二进制文件**：现代大数据、AI 训练集与数据分析高频使用格式，以往打开即为乱码且无法解析字段与 Schema。

**核心目标**：
在 Remora IDE 中提供现代化、零延迟、纯暗色主题深度契合的文档与数据查看体系，全方位支持 PDF 流式高清预览、CSV/TSV 表格网格与源码双模编辑、Parquet 列式数据与 Schema 结构检查。

---

## 2. 详细技术方案

### 2.1 PDF 高清 Canvas 渲染引擎 (`PdfViewer.tsx`)
- 采用 Mozilla 官方工业标准 `pdfjs-dist` (v6)；
- 通过 SFTP 二进制流（Base64 转 Uint8Array）在内存中直接解码并分发渲染；
- 配置高 DPI 缩放（`window.devicePixelRatio`），确保 Retina 与 4K 高清屏下文字锐利不模糊；
- 顶部提供完整控制工具栏：
  - 页码前后导航与手动输入页码跳转；
  - 缩放控制（缩小、放大、100% 重置、百分比展示）；
  - 适应宽度 (`Fit Width`) 自适应缩放；
  - 顺时针 90° 旋转 (`Rotate`)；
  - 一键下载 PDF 副本。

### 2.2 通用高性能暗色数据表格组件 (`DataTableViewer.tsx`)
- 深度融合 VS Code 深色暗色主题，提供极致现代的表格体验；
- **实时全局搜索过滤**：快速在所有字段中过滤目标文本并高亮显示匹配行数；
- **点击列头三态排序**：点击列头支持升序 (ASC) $\rightarrow$ 降序 (DESC) $\rightarrow$ 取消排序 (DEFAULT)，数字与字符串智能对比；
- **分页与虚拟行控制**：支持 25 / 50 / 100 / 250 / 500 行分页切换与首末页快速跳转；
- **单元格与行操作**：双击单元格快速复制单值，行头一键复制整行 JSON 结构；
- **导出支持**：支持将当前网格数据一键导出下载为标准 CSV 文件；
- **自适应列宽与冻结表头**：表头自动置顶，横向与纵向平滑滚动。

### 2.3 CSV / TSV 交互式数据网格与源码双模 (`CsvViewer.tsx`)
- 集成 `papaparse`，原生支持 RFC 4180、自动推断分隔符（`,`、`\t`、`;`、`|`）；
- 智能字段类型推断（`string`、`number`、`boolean`、`json`）；
- **双模体验**：顶栏提供 `📊 表格` 与 `✏️ 源码` 模式快速切换（支持 `Ctrl+E` / `Cmd+E` 快捷键）；
- 源码模式切回 CodeMirror 6，允许直接编辑并通过 `Ctrl+S` 安全回写远程服务器。

### 2.4 Apache Parquet 列式数据与 Schema 预览器 (`ParquetViewer.tsx`)
- 集成纯 JavaScript 轻量级解析引擎 `hyparquet`（~35KB 零依赖，支持 Snappy 压缩）；
- **双视图切换**：
  - **行数据网格 (Rows Grid)**：解析 Parquet 列并加载行记录，防范 BigInt 精度溢出与序列化报错，对接 `DataTableViewer` 提供强大排序与搜索；
  - **Schema 结构树与元数据 (Schema & Meta)**：展示总行数、列数、RowGroup 数量、文件大小、创建者（`created_by`），以及所有列的字段名、逻辑类型、物理类型、Repetition 规范与压缩算法；
- 支持将 Parquet 数据导出转存为标准 CSV。

### 2.5 文件系统与状态机联动
- 在 `fileIcons.tsx` 中为 `.pdf`、`.csv`、`.tsv`、`.parquet`、`.pq` 赋予专属高识别度多彩图标；
- 在 `editorStore.ts` 扩展 `fileType: "pdf" | "csv" | "parquet"` 及对应的 viewMode 状态流转。

---

## 3. 验收标准与验证结果

1. **PDF 文档预览**: 打开 `.pdf` 文件时无白屏报错，Canvas 渲染清晰，翻页与缩放丝滑无阻；[PASSED]
2. **CSV/TSV 数据表格与源码双模**: 打开 `.csv` / `.tsv` 文件默认以表格网格呈现，支持表头排序与全文检索；支持切换至源码模式编辑并通过 Ctrl+S 保存；[PASSED]
3. **Parquet 解析与 Schema 查看**: 打开 `.parquet` 文件成功读取 BigInt 与列式数据，Schema 字段与物理/逻辑类型展示完整；[PASSED]
4. **TypeScript 检查**: `pnpm exec tsc --noEmit` 0 报错通过；[PASSED]
5. **前端构建**: `pnpm build` 成功打包生成目标产物；[PASSED]
6. **Rust 测试**: `cargo test` 36 项单测与 1 项端到端全流程测试 100% 通过。[PASSED]
