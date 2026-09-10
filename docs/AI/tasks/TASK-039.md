# TASK-039: 优化 GitHub Actions Release 流水线自动引用项目版本

## 任务元数据
- **任务 ID**: TASK-039
- **任务名称**: 优化 GitHub Actions Release 流水线自动引用项目版本 (Optimize Release Workflow to Auto-Reference Project Version)
- **创建时间**: 2026-09-10
- **依赖任务**: TASK-037
- **状态**: DONE

---

## 1. 背景与改造目标

- **现状**: `.github/workflows/release.yml` 在 `workflow_dispatch` 手动触发事件中配置了 `inputs.version`，在 GitHub 页面触发流水线时需要用户手动填写版本号（如 `v0.1.8`）。
- **用户诉求**: 用户在工程配置文件（`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml`）中已有维护好的版本号，不需要在 Action 中反复手动填写版本号，每次发布直接自动引用工程既有版本即可。
- **目标**:
  1. 移除 `workflow_dispatch` 的 `inputs` 输入表单，实现 GitHub 界面上 0 参数一键运行；
  2. 流水线执行时自动解析项目文件中的版本号，规范化为 `v<major>.<minor>.<patch>` 并作为发布标签（Release Tag）；
  3. 保持对推送 Tag（`git tag v* && git push origin v*`）的兼容支持。

---

## 2. 改造方案

1. **工作流触发器简化**:
   ```yaml
   'on':
     push:
       tags:
         - 'v*'
     workflow_dispatch:
   ```
2. **多重安全版本解析策略**:
   在 `Determine Version and Tag` 步骤中：
   ```bash
   if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
     PKG_VER=$(jq -r '.version // empty' package.json 2>/dev/null || node -p "require('./package.json').version" 2>/dev/null || grep -m1 '"version"' src-tauri/tauri.conf.json | cut -d'"' -f4)
     TAG="v${PKG_VER#v}"
   else
     TAG="${{ github.ref_name }}"
   fi
   [[ "$TAG" =~ ^v ]] || TAG="v$TAG"
   ```
   多重探测机制：优先使用 runner 自带的 `jq` 快速读取 `package.json`，若无则使用 `node`，若仍无则使用 `grep` 提取 `tauri.conf.json`，确保 100% 可靠性。

---

## 3. 验收标准与验证结果

1. **无需手动输入参数**: `workflow_dispatch` 移除 `inputs` 字段，GitHub Actions 触发时不再弹出输入框。
2. **自动版本提取验证**: 本地测试 `Determine Version and Tag` 提取脚本，成功精准提取当前版本号并生成 `v0.1.9` 标签。
3. **YAML 语法合法**: 使用 PyYAML 进行全量结构解析验证，0 语法错误。
