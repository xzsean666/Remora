# TASK-043: 移动端 Tab 栏胶囊溢出修复与桌面端终端状态栏重叠布局优化 (Mobile Tab Bar & Terminal Layout Optimization)

## 任务元数据
- **任务 ID**: TASK-043
- **任务名称**: 移动端 Tab 栏胶囊溢出修复与桌面端终端状态栏重叠布局优化 (Mobile Tab Bar & Terminal Layout Optimization)
- **创建时间**: 2026-09-12
- **依赖任务**: TASK-028, TASK-030, TASK-041
- **状态**: DONE

---

## 1. 任务背景与核心问题

1. **移动端底部 Tab 激活指示框突起溢出 (Issue 1)**:
   - 在手机端底部导航栏（`MobileTabBar`）中，当前激活 Tab 项的蓝色指示背景块超出了底栏上下边界，或者与屏幕底部安全区发生视觉重叠/毛刺。
   - **原因**: 导航栏固定高度 `h-12`，而子项激活背景直接使用了粗暴的大面积全高度或负边距指示层，在不同手机屏幕缩放与 `safe-area-inset-bottom` 下导致视觉溢出。
2. **桌面端终端底部与外部蓝色底栏重叠 (Issue 3)**:
   - 在桌面端展开终端视窗时，终端内容的最后一行或滚动条下边界与底部 StatusBar（蓝色状态栏）发生贴边或像素级重叠。
   - **原因**:
     - 中间主内容区缺少 `min-h-0`，导致 Flexbox 在某些视口高度下发生溢出。
     - 状态栏顶部缺少清晰的阴影和分割线。
     - `XtermView` 的内部容器 padding 导致 xterm.js 的 `FitAddon` 计算宽高与实际 canvas 渲染区出现数像素的误差，计算出的终端行数撑爆了带 padding 的外层容器，使得底边字符贴边甚至被遮挡。

---

## 2. 解决方案与核心实现

### 2.1 移动端底部导航栏 UI 优化
- 在 [MobileTabBar.tsx](file:///ssd0/git/Remora/src/components/Layout/MobileTabBar.tsx) 中：
  - 调整底栏主容器高度为 `min-h-[50px] pb-[env(safe-area-inset-bottom)]`，自适应全面屏手机底部 Home Bar 避让。
  - 将激活项重构为“内嵌式圆角胶囊”形态（`px-3 py-1 rounded-full bg-vscode-activityBarActive/15 text-vscode-activityBarActive`），确保其绝对不会超出底栏边界。
  - 优化图标与文字排版，添加轻量按压动效与触摸区域 padding。
- 在 [App.tsx](file:///ssd0/git/Remora/src/App.tsx) 中：
  - 在移动端自动隐藏桌面端的 24px 状态栏（`StatusBar`），消除移动端底部双底栏冲突。

### 2.2 桌面端终端与状态栏布局隔离
- 在 [App.tsx](file:///ssd0/git/Remora/src/App.tsx) 中：
  - 为主工作区容器与终端面板容器赋予 `min-h-0`，保证弹性盒模型在高度收缩时严格受限不溢出。
- 在 [StatusBar.tsx](file:///ssd0/git/Remora/src/components/StatusBar/StatusBar.tsx) 中：
  - 增加 `border-t border-black/25 shadow-xs` 顶部深色微阴影与分割线，明确界定终端与状态栏边界。
- 在 [XtermView.tsx](file:///ssd0/git/Remora/src/components/Terminal/XtermView.tsx) 中：
  - 将 terminal 挂载目标 `containerRef` 与呼吸外边距容器解耦。`containerRef` 自身保持 `p-0 m-0`，使 `fitAddon` 的测算和终端 canvas 像素 100% 吻合；外层通过专用 flex 容器保留 `pt-2 px-2 pb-1` 的安全呼吸边距，彻底解决底部文字被切掉贴边的现象。

---

## 3. 验收标准
1. 手机端底部 Tab 栏激活指示器为精致圆角胶囊，无论横屏竖屏还是全面屏手势条均无任何突起和视觉溢出。
2. 桌面端终端底部与状态栏之间具备清晰的界线与呼吸边距，终端最后一行文字显示完整、无任何内容遮挡或重叠。
3. 前端编译与 TypeScript 检查 0 报错。
