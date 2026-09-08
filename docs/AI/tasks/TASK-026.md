# TASK-026: 快捷输入批量导入与导出功能 (Quick Snippets Import & Export)

---

## 1. 任务背景与目标

在 TASK-025 中，我们为 Remora 实现了全局快捷输入与分组管理系统。
为了方便用户在多台电脑之间同步快捷命令、团队成员之间共享常用命令库，以及防止重装系统造成命令丢失，用户提出明确诉求：
- **快捷输入导出 (Export)**：支持将现有的所有快捷输入及其分组一键导出为标准的 JSON 配置文件。
- **快捷输入导入 (Import)**：支持从外部 JSON 文件批量导入快捷输入与分组，支持合并更新与全量覆盖两种导入策略，并提供导入内容预览与解析校验。

本任务目标：
1. **后端 SQLite 事务批量入库支持**:
   - 在 `StorageService` 中新增 `import_quick_snippets(&self, snippets: &[QuickSnippet], overwrite: bool) -> Result<usize>`。
   - 使用单一 SQLite Transaction 保证原子写入，支持 `overwrite` 模式在事务内清空旧数据后重装载。
   - 暴露 `import_quick_snippets` Tauri IPC 命令。
2. **前端标准 JSON 导出与下载**:
   - 提供标准导出格式（包含版本号、导出时间、条目数量与完整的 Snippets 字段）。
   - 采用标准 Blob + 动态下载链接机制，自动命名为 `remora-snippets-YYYY-MM-DD.json`。
3. **前端解析校验与导入预览弹窗 (`ImportSnippetModal`)**:
   - 支持隐藏 `<input type="file" accept=".json">` 选取文件。
   - 宽松兼容对象包装格式与直接数组格式，对缺失字段进行防御性补齐（如生成安全 ID、默认分组等）。
   - 弹窗展示导入预览：统计条目数、分组标签集、前几条快捷输入样本。
   - 提供“合并更新 (Merge & Update)”与“清空覆盖 (Overwrite All)”两种策略。
4. **侧边栏无缝集成**:
   - 在 `QuickInputPanel` 顶部操作栏提供醒目的“导入”与“导出”图标按钮，并带有清晰的 Tooltip。

---

## 2. 详细技术方案

### 2.1 导出数据格式规范
```json
{
  "version": 1,
  "app": "remora",
  "exported_at": "2026-09-08T13:45:00.000Z",
  "count": 12,
  "snippets": [
    {
      "id": "snip-...",
      "title": "System Info",
      "command": "uname -a",
      "group_name": "System",
      "auto_execute": true,
      "description": "Print kernel and OS info",
      "sort_order": 1,
      "created_at": 1773000000000,
      "updated_at": 1773000000000
    }
  ]
}
```

### 2.2 导入解析兼容性
- 若输入文件为 `{ snippets: [...] }`，提取其中的 `snippets`。
- 若输入文件直接为 `[...]`，直接作为数组处理。
- 逐项校验：必须具备非空的 `title` 与 `command`；若缺少 `group_name` 默认归入 `"Imported"`；若缺少 `id` 自动生成全新 UUID/时间戳；若缺少 `auto_execute` 默认 true。

---

## 3. 验收标准

1. 点击“导出”按钮，能生成并下载格式清晰的 `remora-snippets-YYYY-MM-DD.json` 文件。
2. 点击“导入”按钮，可选取本地 `.json` 文件，弹窗清晰呈现待导入的命令数量与涉及的分组名称。
3. 支持“合并更新”模式（不破坏现有其它分组）与“覆盖替换”模式（全新重置）。
4. 导入后数据立刻写入本地 SQLite，侧边栏列表与终端快捷条即时刷新可见。
5. 具有完善的容错处理（非 JSON 文件或非法格式时给出友好报错提示，不导致崩溃）。
6. 后端测试、TypeScript 编译检查与打包 100% 通过。

---

## 4. 状态与验证结果

- **状态**: **DONE**
- **验证结果**:
  - `cargo check --manifest-path src-tauri/Cargo.toml`: 0 错误 0 告警通过。
  - `cargo test --manifest-path src-tauri/Cargo.toml`: 23 组单元测试 + 1 组 e2e 测试全部 100% 通过（新增 `test_quick_snippets_batch_import` 测试合并导入与覆盖导入）。
  - `pnpm tsc --noEmit`: 前端 TypeScript 类型检查 0 报错通过。
  - `pnpm build`: Vite 生产打包通过，各组件分包正常生成。

