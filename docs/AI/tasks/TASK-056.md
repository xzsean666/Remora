# TASK-056: 服务器负载轻量实时概览 (CPU/内存/磁盘/网络 5秒免存盘轮询) 与桌面蓝色状态栏及移动端紧凑微型栏全景展示 (Server Lightweight Real-Time Overview)

## 任务元数据
- **任务 ID**: TASK-056
- **状态**: DONE
- **负责人**: AI 代理
- **所属 Goal**: Remora 体验增强与服务器实时监控感知
- **依赖任务**: TASK-003, TASK-005, TASK-019, TASK-028, TASK-043
- **创建时间**: 2026-09-15
- **完成时间**: 2026-09-15

---

## 1. 需求背景与设计目标

用户提出明确需求：
> "帮我升级一下,我在桌面端得时候可以在下方得蓝色状态栏轻松得看到当前机器的负债情况,CPU,内存,硬盘,网络,你每5秒采集一次就可以了,这个数据不需要存储下来,只是服务器得over view,手机端也要想办法帮我展示,但是手机端空间没有那么多,你来想个办法."

### 核心约束与痛点分析：
1. **轻量免存盘**: 仅作为服务器 overview，严禁写入 SQLite 本地数据库，纯内存临时状态；
2. **极速无感采集**: 每 5 秒轮询一次，探针必须轻如鸿毛（单次执行 < 30ms），不能在远端安装任何额外守护进程或侵入式 Agent；
3. **桌面端体验**: 在 VS Code 经典风格的下方蓝色状态栏中自然融入 CPU、内存、磁盘、网络指标，直观易读且支持悬停详情；
4. **移动端空间极限解法**: 手机端屏幕宽度有限（360-430px），高度极为宝贵，不能盲目复制桌面栏。设计“22px 微型常驻负载条 + 点击展开全景抽屉浮层”的双模方案，实现零空间浪费与全量详情兼备；
5. **节能与断联保护**: 手机端切后台或桌面端最小化时自动挂起 5 秒轮询，断开或切服时自动销毁重置。

---

## 2. 架构设计与实现方案

### 2.1 后端服务 (`src-tauri/src/overview/`)
- **数据结构 `ServerOverview`**:
  - `cpu_usage: f32` (0-100%)
  - `cpu_cores: u32`
  - `load_avg: [f32; 3]` (1m, 5m, 15m)
  - `mem_total: u64`, `mem_used: u64`, `mem_usage: f32`
  - `disk_total: u64`, `disk_used: u64`, `disk_usage: f32`, `disk_mount: String`
  - `net_rx_speed: u64`, `net_tx_speed: u64` (Bytes/s)
  - `uptime_seconds: u64`
  - `timestamp: u64`
- **采样算法与 POSIX 探针**:
  - 单行命令一次性抓取 `/proc/stat`、`/proc/meminfo`、`df -Pk /`、`/proc/net/dev`、`/proc/loadavg`、`/proc/uptime`、核心数；
  - 维护上一采样的 `(cpu_total, cpu_idle, rx_bytes, tx_bytes, timestamp)` 内存结构；
  - 基于前后采样差值计算精确的瞬时 CPU 使用率与实时网速；
  - 兼容 macOS 系统的 `sysctl` / `vm_stat` 兜底回退。
- **Tauri 命令**:
  - `get_server_overview(server_id: String) -> Result<ServerOverview>`

### 2.2 前端状态与轮询 (`src/stores/serverOverviewStore.ts`)
- Zustand store 统一管理当前活动服务器的 overview 数据、加载状态与轮询定时器；
- 5000ms 定时器自动轮询，仅对 `connected` 状态的 `activeServerId` 发起请求；
- 监听 `document.addEventListener("visibilitychange")`：后台自动挂起，前台恢复立刻刷新；
- 支持手动即时刷新与主动开关控制。

### 2.3 桌面端集成 (`src/components/StatusBar/StatusBar.tsx`)
- 在蓝色状态栏中展示四个紧凑指标胶囊：
  - `CPU 12%` (带 CPU 图标)
  - `MEM 45%` (带内存图标)
  - `DISK 62%` (带磁盘图标)
  - `↓120KB/s ↑45KB/s` (带网络图标)
- 高负载 (>85%) 视觉微调预警；
- 点击任意位置弹出全景概览模态框。

### 2.4 移动端紧凑微型栏与全景抽屉 (`MobileOverviewBar.tsx` + `ServerOverviewModal.tsx`)
- **微型条**: 仅 22px 高度，停靠在 `MobileTabBar` 上方，紧凑排布 `CPU 15% · MEM 42% · DISK 58% · ↓18K ↑4K`；
- **全景抽屉**: 向上滑出，展示 CPU 进度条、核心数、Load Avg、内存已用/总计、磁盘已用/容量、网络下载/上传速度与服务器运行时间（Uptime）。

---

## 3. 验收标准 (Acceptance Criteria)

1. [x] 后端通过单行原生命令高效采集各项指标，单次解析耗时 < 50ms，且无任何数据落盘；
2. [x] 桌面端蓝色状态栏实时展示 CPU、内存、磁盘根目录、网络上下行速度；
3. [x] 移动端通过 22px 微型条展示核心指标，点击可查看大图全量指标；
4. [x] 页面切后台自动暂停采集，前台恢复即刻更新；
5. [x] Rust 测试、TypeScript 类型检查与生产打包全量通过。

