# TASK-035: TMUX 单会话单终端独占约束与前置会话名识别 (TMUX Single Terminal Enforcement & Prefix Session Title)

---

## 1. 任务背景与目标

### 1.1 背景
用户在使用 Remora TMUX 会话管理时遇到两个显著的交互与体验痛点：
1. **终端重复堆积**: 每次通过 TMUX 会话管理器进入同一个 TMUX 会话时，系统都会无条件新增一个标签页，导致标签栏中存在大量同名会话的重复终端，占满标签栏且浪费系统资源。
2. **标签标题不易辨认**: 此前的终端标题格式为 `[ServerName] tmux: <sessionName>`。在多标签或较长服务器名称场景下，服务器前缀占据了主要视口宽度（且受限于标签截断），导致用户一眼无法分辨不同终端对应哪个 TMUX 会话。

### 1.2 目标
1. **单一 TMUX 会话仅独占一个终端**:
   - 当用户进入已存在的 TMUX 会话时，若此前已有该会话的终端标签，必须自动关闭旧终端并释放其后端 PTY 通道，确保同一服务器下的同一 TMUX 会话始终有且仅有一个终端。
2. **TMUX 终端前置显示会话名称**:
   - 终端标题格式优化为 `<sessionName> (tmux) [ServerName]`（或简短模式下的 `<sessionName> (tmux)`），让用户在标签栏中最先看到 TMUX 会话名称。
   - 在标签栏中为 TMUX 会话终端增加明显的专用图标指示（如琥珀色 Layers 图标），一眼即可识别。
3. **会话销毁联动清理**:
   - 在 TMUX 管理器中销毁会话时，主动清理前端对应的终端标签与底层通道，避免残留无效死终端。

---

## 2. 详细设计与实现方案

### 2.1 状态管理层 (`src/stores/terminalStore.ts`)
- 新增 `openTmuxSession` 方法：
  1. 扫描当前所有终端会话，查找属于同一服务器且绑定同一 TMUX 会话名（或历史旧标题格式匹配）的历史终端。
  2. 针对匹配到的旧终端，若存在活跃的 `backendSessionId`，调用 `safeInvoke("terminal_close")` 关闭后端通道。
  3. 彻底移除旧终端，并将新终端以规范化前置标题格式插入（若此前存在则替换在原位，确保位置稳定；若不存在则追加）。
  4. 激活该终端为当前 `activeSessionId`。
- 新增 `closeTmuxTerminals` 方法：
  - 针对指定服务器和 TMUX 会话名，主动清理对应的所有终端与底层 PTY。
- 优化 `reconnectSession`：
  - 支持从新旧格式标题中准确提取 TMUX 会话名，并在重连时自动规范化标题，确保前置会话名始终保持一致。

### 2.2 TMUX 管理弹窗 (`src/components/Terminal/TmuxManagerModal.tsx`)
- `handleEnterSession`: 改为统一调用 `useTerminalStore.getState().openTmuxSession`，消除重复逻辑。
- `handleKillSession`: 会话销毁成功后，联动调用 `closeTmuxTerminals` 立即清理对应的前端终端。

### 2.3 终端标签栏 (`src/components/Terminal/TerminalTabBar.tsx`)
- 针对具有 `tmuxSessionName` 的会话，在状态圆点旁渲染专属的琥珀色 `Layers` 图标。
- 适当放宽标签标题最大宽度（如 `max-w-[140px] sm:max-w-[200px]`），提升大屏下的信息可见度。

---

## 3. 验收标准 (Acceptance Criteria)
1. **单会话唯一性验证**:
   - 打开 TMUX 会话 `dev`，标签栏出现 `dev (tmux)`。
   - 再次通过 TMUX 管理器点击进入 `dev`，旧终端被正常关闭/替换，终端标签数不增加，依然仅有 1 个 `dev (tmux)`。
2. **前置会话名称验证**:
   - 终端标签首部清晰显示会话名（如 `dev (tmux)` 或 `dev (tmux) [server]`），不再被服务器名称掩盖。
   - 标签栏展示 TMUX 专属图标。
3. **销毁联动验证**:
   - 在 TMUX 管理器中删除/终止某个会话，若该会话有打开的终端，该终端标签被同步关闭。
4. **编译与类型校验**:
   - `pnpm tsc --noEmit` 0 报错。
   - `cargo test` 正常通过。
   - `pnpm build` 构建成功。
