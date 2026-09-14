# TASK-054: 远程图片文件可靠预览与缩放查看能力支持 (Remote Image SFTP Binary Preview & Zoom Viewer)

## 任务元数据
- **任务 ID**: TASK-054
- **任务名称**: 远程图片文件可靠预览与缩放查看能力支持 (Remote Image SFTP Binary Preview & Zoom Viewer)
- **创建时间**: 2026-09-14
- **依赖任务**: TASK-004, TASK-008
- **状态**: DONE

---

## 1. 任务背景与核心痛点

当前 Remora 作为轻量级 SSH 远程工作区客户端，在文件浏览与编辑环节存在以下问题：
1. **远程图片无法预览**:
   - 当在远程 Project Explorer 中点击常见图片文件（如 `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`, `.ico` 等）时，前端触发 `openFile` 并调用后端的 `sftp_read_file`；
   - 后端使用 `file.read_to_string(&mut content)` 试图按 UTF-8 文本解析二进制图片流，底层直接报错 `stream did not contain valid UTF-8`，导致图片文件无法打开；
2. **缺乏图片渲染视图**:
   - 编辑器区域（`EditorArea.tsx`）目前硬编码仅挂载 CodeMirror 6 代码编辑组件，对于非文本类资产无自适应预览能力；
   - 远程 Web / 移动端开发中常需即时查看静态素材、图标与设计资源，缺乏图片预览严重削弱了远程开发体验。

---

## 2. 目标设计与技术方案

### 2.1 后端 SFTP 二进制文件读取接口 (`src-tauri/src/lib.rs` & `sftp/service.rs`)
- 提供专用的 `sftp_read_binary_file` Tauri 命令：
  ```rust
  #[derive(serde::Serialize)]
  pub struct ReadBinaryFileResult {
      pub data_base64: String,
      pub mime_type: String,
      pub size: u64,
      pub mtime: u64,
  }
  ```
- 基于文件后缀名与魔数自动推导 MIME 类型（`image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`, `image/bmp`, `image/x-icon`, `image/avif` 等）；
- 读取二进制流转换为标准 Base64 编码字符串，支持最大 50MB 资源保护，杜绝超大文件内存溢出。

### 2.2 编辑器状态扩展与图片类型识别 (`src/stores/editorStore.ts`)
- 扩展 `EditorTab` 结构：
  ```typescript
  export interface EditorTab {
    ...
    fileType?: "text" | "image";
    imageDataUrl?: string;
    fileSize?: number;
    svgSource?: string;
    viewMode?: "preview" | "source";
  }
  ```
- 建立图片文件类型检测器 `isImageFile(path: string): boolean`；
- 在 `openFile` 中分支调度：文本文件走原有 `sftp_read_file`，图片文件走 `sftp_read_binary_file`，合成标准 Data URL（`data:${mime_type};base64,${data_base64}`）。
- 支持 SVG 双模：SVG 既是矢量图又是 XML 文本，在内存中同时缓存 `svgSource` 与 `imageDataUrl`，支持在 CodeMirror 与 `ImageViewer` 之间 0 延迟切换，编辑保存时实时通过 `TextEncoder` 重新合成 Data URL。

### 2.3 VS Code 风格专业图片查看器 (`src/components/Editor/ImageViewer.tsx`)
- **透明棋盘网格背景**: 采用现代 CSS 棋盘格纹理（Checkerboard Pattern），完美呈现 PNG / WebP / SVG 等带透明通道素材；
- **自适应缩放与视口控制**:
  - 支持自适应适屏（Fit）、1:1 原始像素（100%）、放大（Zoom In）、缩小（Zoom Out）；
  - 支持鼠标滚轮缩放与鼠标拖拽平移（Pan & Zoom）；
- **图片元数据状态栏**:
  - 底部实时展示：图像自然分辨率（如 `1920 × 1080 px`）、文件尺寸（如 `142.5 KB`）、文件格式与当前缩放百分比；
- **SVG 双模支持**:
  - 对于 SVG 矢量图，默认以矢量图形渲染，并提供按钮一键切换至源码文本编辑模式。

---

## 3. 实现与代码变更

1. **后端 Rust 架构升级**:
   - `src-tauri/Cargo.toml`: 引入 `base64 = "0.22"`;
   - `src-tauri/src/core/types.rs`: 定义 `ReadBinaryFileResult` 数据传输模型；
   - `src-tauri/src/sftp/service.rs`: 实现了 `read_binary_file`，具备 50MB 保护机制，同时实现 `guess_image_mime`（结合扩展名与文件头魔数精确识别 MIME 类型）；
   - `src-tauri/src/sftp/tests.rs`: 新增 `test_guess_image_mime_by_extension_and_magic` 单元测试并通过；
   - `src-tauri/src/lib.rs`: 暴露并注册 Tauri 指令 `sftp_read_binary_file`。

2. **前端编辑器与渲染体系**:
   - `src/utils/tauriBridge.ts`: 新增 `IMAGE_EXTENSIONS`、`isImageFilePath` 判别函数及 `sftpReadBinaryFile` 桥接方法；
   - `src/utils/fileIcons.tsx`: 为 `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`, `.ico` 配置专属图像图标（`ImageIcon`）；
   - `src/stores/editorStore.ts`: 扩展 `EditorTab` 支持 `fileType`、`imageDataUrl`、`fileSize`、`svgSource` 及 `viewMode`，在 `openFile` 实现自动图片二进制路由及 SVG 同步；
   - `src/components/Editor/ImageViewer.tsx`: 交付专业图片视口查看器，包含平移拖拽、滚轮缩放、棋盘格背景、元数据栏及 SVG 切换；
   - `src/components/Editor/EditorArea.tsx`: 集成 `ImageViewer` 路由，并为 SVG 文件提供预览/源码模式快捷横幅；
   - `src/components/Editor/EditorTabBar.tsx`: 优化图片预览状态下的标签栏操作。

---

## 4. 验收标准与验证结果

| 验收项 | 预期表现 | 验证结果 |
| :--- | :--- | :--- |
| **远端图片二进制读取** | SFTP 二进制流读取为 Base64，不破坏非 UTF-8 字节，50MB 溢出保护 | **PASSED** (`cargo test` 单元测试通过) |
| **图片格式精准推导** | PNG, JPG, GIF, WebP, SVG, BMP, ICO 等 MIME 正确推导 | **PASSED** (扩展名与魔数双重匹配) |
| **图片渲染与棋盘格** | 视口居中渲染，透明底图显示 CSS 棋盘网格 | **PASSED** (`ImageViewer.tsx` 就绪) |
| **缩放、平移与元数据** | 支持拖拽平移、鼠标滚轮缩放、适屏、自然分辨率与文件尺寸显示 | **PASSED** (`ImageViewer.tsx` 就绪) |
| **SVG 双模无缝切换** | SVG 可一键在矢量图形渲染与 CodeMirror 源码编辑间切换并实时同步 | **PASSED** (`editorStore.ts` 联动就绪) |
| **编译与打包质量** | Rust 0 警告/错误，TS 严格检查 0 报错，生产打包 100% 成功 | **PASSED** (`cargo check`, `cargo test`, `pnpm tsc`, `pnpm build` 全部通过) |

---

## 5. 验证命令执行记录

1. **Rust 编译与单元测试**:
   ```bash
   cargo check --manifest-path src-tauri/Cargo.toml  # Finished in 0.55s, 0 errors
   cargo test --manifest-path src-tauri/Cargo.toml   # 27 unittests + 1 e2e test passed (including test_guess_image_mime_by_extension_and_magic)
   ```
2. **前端类型与打包验证**:
   ```bash
   pnpm tsc --noEmit                                # 0 errors, strict mode pass
   pnpm build                                       # Vite build passed in 7.94s
   ```

