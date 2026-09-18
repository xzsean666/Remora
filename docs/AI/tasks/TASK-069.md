# TASK-069: Parquet 首屏极速采样切片加载与全文件按需深度检索支持 (Parquet Windowed Sample Loading & Full-File Deep Search)

- **ID**: TASK-069
- **Title**: Parquet 首屏极速采样切片加载与全文件按需深度检索支持 (Parquet Windowed Sample Loading & Full-File Deep Search)
- **Status**: DONE
- **Created**: 2026-09-18
- **Dependencies**: TASK-068

---

## 1. 任务背景与目标

对于现代大数据与 AI 训练集（包含数十万甚至数百万行）的 Apache Parquet 文件，如果一打开就试图全量解压所有行，会导致前端内存剧烈膨胀甚至 UI 冻结。

**核心目标**：
1. **首屏采样极速秒开**：打开 Parquet 文件时，仅读取 Footer 元数据与前 1,000 行（`rowStart: 0, rowEnd: 1000`），实现毫秒级快速打开；
2. **全文件按需深度检索**：支持用户在搜索框输入关键词后，一键点击【全文件深度检索】，在后台分批扫描整份 Parquet 文件的所有 Row Groups，将所有匹配行汇聚呈现在表格中；
3. **分批追加扩充加载**：提供 `+1000 行` 与 `加载全部` 控制，按需扩充预览行数；
4. **状态恢复**：随时可一键重置返回初始采样预览。

---

## 2. 详细技术方案

### 2.1 初始采样与切片窗口读取 (`ParquetViewer.tsx`)
- 维护 `bufferRef` 避免 Base64 重复解码；
- 通过 `parquetReadObjects({ file: arrayBuffer, rowStart: 0, rowEnd: 1000 })` 仅切片解压前 1,000 行；
- 顶部信息条清晰标注当前采样状态：`Sample: 1,000 / 500,000 rows`。

### 2.2 全文件分块流式深度检索 (`handleDeepSearch`)
- 按照每批 5,000 行进行分块遍历扫描（Chunk Scanning）；
- 逐行模糊比对所有字段是否包含检索关键词；
- 利用 `await new Promise(r => setTimeout(r, 0))` 适时让出主线程事件循环，驱动 UI 进度条与加载动效平滑更新；
- 检索完成后自动切换为搜索结果视图，并显示匹配条数徽章与【返回采样预览】按钮。

### 2.3 分批追加扩充加载 (`handleLoadMore` & `handleLoadAll`)
- 允许用户每次追加 1,000 行（`rowStart: loadedRowsCount, rowEnd: loadedRowsCount + 1000`）；
- 若文件在 50,000 行以内，支持一键 `Load All` 加载全部。

---

## 3. 验收标准与验证结果

1. **首屏加载**: Parquet 文件默认仅加载前 1,000 行，瞬时呈现，零卡顿；[PASSED]
2. **全文件深度检索**: 输入关键词点击【全文件深度检索】成功跨全文件遍历所有 Row Groups 并准确返回匹配项；[PASSED]
3. **追加加载**: 点击 `+1,000` 可平滑加载下一批数据；[PASSED]
4. **TypeScript 检查**: `pnpm exec tsc --noEmit` 0 报错；[PASSED]
5. **前端构建**: `pnpm build` 成功完成；[PASSED]
6. **Rust 测试**: `cargo test` 36 项单测与 1 项全流程 E2E 测试全量通过。[PASSED]
