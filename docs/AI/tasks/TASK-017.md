# TASK-017: SSH 命令行快速解析导入与代理示例复制填充 (SSH Command Quick Parse & Proxy Examples)

## 1. 任务背景与目标

用户在使用 Remora 添加/配置 SSH 服务器时反馈两个关键体验诉求：
1. **支持直接输入/粘贴 SSH 命令行自动解析**:
   - 现有的添加服务器弹窗需用户逐个手动填写 Server Name、Host、Port、Username、Authentication Type、Private Key Path。
   - 开发者通常直接持有现成的命令行（例如：`ssh -i ~/ssh/sean -p 22 root@192.168.31.110` 或 `ssh -p 2222 admin@10.0.0.1`）。希望系统能够直接输入该命令行并自动智能解析分发到对应表单字段。
2. **代理配置增强（默认空，但提供可见、易复制与一键填入的示例）**:
   - 默认保持无代理，但在输入框上方显式展示典型示例（如 `127.0.0.1:1080`、`127.0.0.1:7890`、`socks5://127.0.0.1:1080`），便于用户选择复制或一键点击填入。
   - 自动清洗全角冒号 `：`（如 `127.0.0.1：1080` 自动转化为 `127.0.0.1:1080`），杜绝中文输入法带来的语法错误。

---

## 2. 变更文件清单

- **新建文件**:
  - `src/utils/sshParser.ts`: SSH 命令行分词器（引号/空格/转义处理）与解析器（支持 `-i`、`-p`、`-l`、`-o`、`user@host[:port]`）。
  - `src/utils/tauriBridge.ts`: Tauri 2 IPC 与标准浏览器 Web Preview 模式自适应桥接模块（在普通网页浏览器中将服务器配置自动保存在 localStorage，防止直接访问开发服务器时抛出 `reading 'invoke'` 异常）。
- **修改文件**:
  - `src/components/Sidebar/ServerManager/ServerManager.tsx`:
    - 弹窗顶部增加“⚡ 快捷命令解析 (Quick Parse SSH Command)”区域，支持实时粘贴自动解析、回车/点击解析以及快捷示例体验。
    - 在 Host 输入框中增加智能探测：当用户误将完整 `ssh ...` 命令粘贴入 Host 框时，自动触发解析并分发各字段。
    - 在 Remote Proxy 上方增加常用示例卡片（`127.0.0.1:1080`、`127.0.0.1:7890`、`socks5://127.0.0.1:1080`、`http://127.0.0.1:10808`），支持鼠标选中、一键复制到剪贴板、一键直接填充至输入框，以及一键清空；输入值自动执行全角冒号 `：` 规范化。
    - 引入 `safeInvoke` 与 Web 预览模式提示横幅，彻底解决在普通浏览器访问 `http://localhost:1420/` 时调用底层 Tauri 原生 `invoke` 抛错的问题。
  - `package.json`: 增加 `dev:tauri` 便捷指令。
  - `docs/AI/TASK_INDEX.md`
  - `docs/AI/SESSION_STATE.md`

---

## 3. 验收标准

1. 输入 `ssh -i ~/ssh/sean -p 22 root@192.168.31.110`，能够精准提取：Host: `192.168.31.110`, Port: `22`, Username: `root`, AuthType: `private_key`, KeyPath: `~/ssh/sean`, Name: `root@192.168.31.110`。
2. 支持引号路径（如 `-i "/path with spaces/id_rsa"`）、OpenSSH 选项（`-o Port=2222`、`-o IdentityFile=...`）以及无 `ssh` 前缀的简写。
3. Remote Proxy 默认为空；输入框上方展示可视化示例，支持点击填入或复制；支持全角冒号自动转换。
4. 无论在普通网页浏览器（`http://localhost:1420/`）还是在 Tauri 原生桌面端，添加/保存 SSH 服务器均 100% 成功，绝不出现 `Cannot read properties of undefined (reading 'invoke')` 报错。
5. `cargo check` 与 `pnpm build` (`tsc && vite build`) 100% 编译通过。
