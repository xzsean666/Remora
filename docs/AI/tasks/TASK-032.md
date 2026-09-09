# TASK-032: 多终端Tab独立TMUX会话隔离与设备命名空间区分 (Terminal Tab & Device TMUX Session Isolation)

## 1. 任务背景与核心痛点

用户反馈在手机端打开了 2 个终端 Tab，先后在两个 Tab 中点击 `TMUX` 时，发现两个终端竟然指向了**同一个 TMUX 会话**（产生了镜像串线，在终端 1 中输入的内容会同步在终端 2 出现）。

经排查，原因是：
1. 先前在 `TerminalMobileBar.tsx` 中的容错回退机制中使用了：
   ```bash
   TARGET="${tmuxSessionName}";
   if ! tmux has-session -t "$TARGET" 2>/dev/null; then
       PREV=$(tmux list-sessions ... | grep -E '^remora_' | head -n 1);
       if [ -n "$PREV" ]; then TARGET="$PREV"; fi;
   fi
   ```
   当用户在 Tab 2 点击 TMUX 时，由于属于 Tab 2 的独立会话尚未创建，脚本直接退回到 `head -n 1`，将属于 Tab 1 的 `remora_git_1` 劫持并强行挂载到了 Tab 2，导致两个标签页产生冲突。
2. 缺少设备命名空间隔离：手机端和电脑端未做前缀区分，若两端同时连同一项目，可能相互冲突。

---

## 2. 解决方案与实现

1. **终端实体绑定恒定槽位 (`slotNumber`)**：
   - 在 `src/stores/terminalStore.ts` 的 `TerminalSession` 中引入 `slotNumber?: number`。
   - 在 `TerminalPanel.tsx` 与 `TerminalTabBar.tsx` 的新建终端逻辑中，动态分配最小未占用的稳定槽位号（1, 2, 3...）。
   - 无论关闭或切换其他 Tab，每个终端 Tab 的 `slotNumber` 终生固定，绝不漂移。

2. **设备命名空间隔离 (`mobile` vs `pc`)**：
   - 手机端会话命名：`remora_mobile_${projectName}_${slotNumber}`（例如 `remora_mobile_git_1`, `remora_mobile_git_2`）。
   - 桌面端会话命名：`remora_pc_${projectName}_${slotNumber}`。
   - 手机与电脑端会话物理隔离，互不抢占、互不干扰。

3. **彻底消灭盲抢逻辑，保证 Tab 独立**：
   - 彻底移除 `grep -E '^remora_' | head -n 1` 逻辑。
   - Tab 2 点击 TMUX 时，直接执行 `tmux new -A -D -s remora_mobile_${projectName}_2`。若不存在则原子化创建属于 Tab 2 的全新独立会话；若已存在则直接附着。
   - 针对 **Slot 1** 增加对历史无前缀会话（`remora_${projectName}_1`）的向前兼容，确保原本正在运行的会话不受影响平滑过渡。

---

## 3. 验收标准与验证结果

1. 前端 TypeScript 类型检查 `pnpm tsc --noEmit` 0 报错。
2. 前端构建 `pnpm build` 100% 成功。
3. Android Release APK (`v0.1.3`) 自动化构建打包成功。
4. 无论打开多少个终端 Tab，每个 Tab 点击 TMUX 均拥有各自独立、互不干扰的 TMUX 会话。
