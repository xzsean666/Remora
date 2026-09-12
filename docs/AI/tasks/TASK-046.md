# TASK-046: TMUX 右键系统菜单统一与远端文件浏览器实时刷新增强 (TMUX Right-Click Context Menu Consistency & Remote File Explorer Realtime Refresh Enhancement)

## 任务元数据
- **任务 ID**: TASK-046
- **任务名称**: TMUX 右键系统菜单统一与远端文件浏览器实时刷新增强 (TMUX Right-Click Context Menu Consistency & Remote File Explorer Realtime Refresh Enhancement)
- **创建时间**: 2026-09-12
- **依赖任务**: TASK-004, TASK-007, TASK-009, TASK-040, TASK-044
- **状态**: DONE

---

## 1. 任务背景与核心问题

1. **TMUX 模式下右键弹出内置 ASCII 菜单，无法调出系统复制/粘贴菜单**:
   - 在普通终端模式下，鼠标右键可直接呼出系统级上下文菜单（支持复制/粘贴）。
   - 为支持鼠标滚轮浏览日志，TASK-044 开启了 TMUX 的 `set -g mouse on`。然而 xterm.js 启动 SGR 鼠标跟踪协议后，默认会将鼠标右键（`button === 2`）也转译为 SGR 转义序列发送给远程 PTY。
   - 远程 TMUX 接收到转义序列后，触发默认按键绑定 `MouseDown3Pane display-menu`，弹出了 TMUX 内部由 `-`、`|` 拼接的纯文本菜单（包含 split-window / kill-pane 等操作），拦截了系统级的复制/粘贴上下文菜单。
   - **用户要求**: 在所有远程服务器上，TMUX 终端与普通终端的右键菜单必须完全一致，右键粘贴功能必须顺畅，且不能只对单台特定机器生效，必须适用于所有 SSH 连接的目标服务器。

2. **远端产生新文件时文件浏览器未更新，点击左上方刷新按钮无响应/无效**:
   - 用户在远端创建文件后，左侧 ProjectExplorer 无法看到新文件；点击文件树顶部的刷新按钮依然没有刷新内容。
   - **根本原因**:
     - `fileTreeStore.ts` 中的 `refreshPath` 对展开的子目录使用无序、非阻塞并发刷新，容易因 SFTP 会话通道的互斥锁竞争导致超时或丢失更新；
     - `toggleExpand` 展开目录时若本地已有内存缓存则直接读取缓存，未重新向远端拉取最新目录结构；
     - `loadDirectory` 在 `currentServerId` 缺失时未兜底回退到活跃服务器；
     - SFTP 路径如果包含 `~` 或 `~/`，部分 OpenSSH sftp-server 不支持 shell 波浪号展开而抛出 `SSH_FX_NO_SUCH_FILE`；
     - 刷新按钮缺乏加载动效与防重防并发保护，无法反馈加载状态。

---

## 2. 解决方案与核心实现

### 2.1 全局客户端拦截 + 远端解绑双重保障 (无需目标机预先配置)
- **客户端 DOM 捕获层绝对拦截**:
  - 在 [XtermView.tsx](file:///ssd0/git/Remora/src/components/Terminal/XtermView.tsx) 中，为容器 DOM 节点在捕获阶段（`capture: true`）挂载 `mousedown` 与 `mouseup` 事件监听。
  - 当检测到右键点击（`e.button === 2`）时，立即调用 `e.stopImmediatePropagation()`。
  - 这从源头上阻止了 xterm.js 内部的 mouse-tracking 机制将右键包装为 SGR 序列发往远端 PTY，使事件顺利冒泡并触发标准 `contextmenu` 事件，调起系统原生上下文菜单（粘贴、复制）。
- **启动与接入会话时自动注入解绑指令**:
  - 在 [terminalStore.ts](file:///ssd0/git/Remora/src/stores/terminalStore.ts) 中定义统一宏 `TMUX_SETUP_AND_ATTACH(name)`，在接入任何会话时自动注入：
    `tmux set -g mouse on 2>/dev/null; tmux unbind-key -n MouseDown3Pane 2>/dev/null; tmux unbind-key -n MouseDown3Status 2>/dev/null; tmux unbind-key -n MouseDown3StatusLeft 2>/dev/null; tmux unbind-key -n M-MouseDown3Pane 2>/dev/null; tmux attach -d -t "${name}"\n`
  - 在 [src-tauri/src/lib.rs](file:///ssd0/git/Remora/src-tauri/src/lib.rs) 的 `tmux_new_session` 指令中，同样在创建会话时追加上述 `unbind-key -n MouseDown3*`。
  - **普适性保障**: 由于该逻辑完全由 Remora 客户端负责在连接与接入阶段自动执行，用户连接任意远程机器均会自动生效，无需在目标服务器上修改 `.tmux.conf`。

### 2.2 远端文件浏览器可靠刷新与终端 Prompt 联动感知
- **顺序等待展开子目录，消除并发互斥冲突**:
  - 重构 [fileTreeStore.ts](file:///ssd0/git/Remora/src/stores/fileTreeStore.ts) 中的 `refreshPath`：先 `await loadDirectory(cleanPath)` 刷新目标目录本身，然后找出所有属于该目录并处于展开状态（`expandedPaths.has(...)`）的子目录，使用 `for...of` 循环逐一 `await loadDirectory(subPath)` 刷新。彻底避免了多通道并发造成的 SFTP 死锁或结果吞并。
  - 修改 `toggleExpand`：每次展开目录时无论是否有缓存，均 `await get().loadDirectory(dirPath)` 重新拉取最新数据。
  - 增强 `loadDirectory`：增加 `activeServerId` 容错回退机制。
- **SFTP 用户主目录波浪号兼容**:
  - 在 [src-tauri/src/sftp/service.rs](file:///ssd0/git/Remora/src-tauri/src/sftp/service.rs) 中，识别 `~` 与 `~/` 开头的路径，通过 `sftp.canonicalize(".")` 获取远端真实 home 绝对路径后拼接，解决 OpenSSH sftp-server 报错问题。
- **刷新交互与加载状态动效**:
  - 在 [ProjectExplorer.tsx](file:///ssd0/git/Remora/src/components/Sidebar/ProjectExplorer/ProjectExplorer.tsx) 中增加 `isRefreshing` 状态，触发刷新时为刷新按钮添加 `animate-spin` 旋转动画并设置 `disabled={isRefreshing}`，杜绝连击与并发。
- **终端 Prompt 变动防抖自动刷新**:
  - 在 [XtermView.tsx](file:///ssd0/git/Remora/src/components/Terminal/XtermView.tsx) 中监听 `term.onTitleChange`，当用户在终端完成命令执行并返回 shell prompt 时，自动防抖 800ms 触发工作区根目录刷新，无需手动点击刷新按钮即可实时感知新生成的文件。

---

## 3. 验收标准
1. 在 TMUX 会话及普通终端中鼠标右键，均能弹出系统上下文菜单并正常粘贴/复制剪贴板内容。
2. 切换 SSH 连接至任何其他远程 Linux 服务器，均具备完全一致的 TMUX 右键系统菜单体验。
3. 点击文件树顶部刷新按钮，图标带有旋转加载动画；刷新后新创建的文件立即呈现。
4. 在终端中运行命令生成新文件后，左侧文件浏览器在命令结束返回 prompt 时能自动感知并呈现新文件。
5. 前后端类型检查与代码检查全量通过。
