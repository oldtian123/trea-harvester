# Trae Harvester 🚜

**AI 驱动的自动化测试编排与评估平台 | MCP-Powered Test Orchestration & Evaluation**

一个专为 AI Agent 评测设计的 VS Code 扩展，通过 MCP (Model Context Protocol) 让大模型直接控制测试执行、收集证据并完成评分。完美适配 **"AI 填表 → 人工监考 → AI 收卷评分"** 的评估工作流。

[![Version](https://img.shields.io/badge/version-0.5.2-blue.svg)](https://github.com/oldtian123/trae-harvester/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 🌟 核心特性

### 🔌 多窗口 MCP Server 架构
- **Hub 守护进程**：统一管理本地和远程（Dev Container/SSH）的多个 VS Code 窗口
- **独立端口分配**：每个窗口自动分配端口（37651-37700），基于 PID 避免冲突
- **实时 Web 监控**：访问 `http://127.0.0.1:37650` 查看所有窗口状态
- **零配置远程支持**：容器/SSH 窗口的端口自动转发到本地

### 🤖 AI Agent 完整工具链
- **测试编排**：JSON 格式导入测试步骤，自动执行命令并捕获结果
- **人工监考**：UI 检查项让人工验证 AI 无法直接观察的页面效果
- **证据收集**：自动收割 Git Patch、测试日志、AI 上下文、人工勾选状态
- **多维标识**：Repo ID / Branch / Model / Prompt 四维标签追踪测试会话

### 🛠️ 开发者友好
- **自动更新**：基于 GitHub Releases API，一键更新到最新版本
- **可配置选项**：仓库列表、模型列表、Prompt 版本均可自定义
- **详细日志**：所有操作可追溯，支持导出完整运行日志

---

## 📦 安装

### 方式 1: 从 Release 安装（推荐）
1. 前往 [Releases](https://github.com/oldtian123/trae-harvester/releases) 页面
2. 下载最新的 `.vsix` 文件
3. 在 VS Code 中：`Extensions: Install from VSIX...`
4. 选择下载的文件完成安装

### 方式 2: 手动编译
```bash
git clone https://github.com/oldtian123/trae-harvester.git
cd trae-harvester
npm install
npm run compile
npx vsce package
```

---

## 🚀 快速开始

### 1. 启动插件
打开 VS Code 侧边栏，点击 **🚜 Trae Harvester** 图标，进入 Test Steps 面板。

### 2. 配置窗口标识（可选）
在面板顶部配置：
- **仓库编号**：选择当前测试的仓库（如 `Repo_1`）
- **当前分支**：自动检测显示（如 `main`）
- **测试模型**：选择评测的模型（如 `GPT-4o`）
- **测试提示词**：选择 Prompt 版本（如 `Prompt_V1`）

### 3. 启动 MCP Server
点击 **🔴 启动 MCP** 按钮，成功后变为 **🟢 关闭 MCP**。
- 本地窗口监听：`127.0.0.1:37651`（或其他端口）
- 远程窗口自动通过 VS Code 转发到本地

### 4. 启动 Hub 守护进程
在**本地终端**执行：
```bash
# 找到插件安装路径
node ~/.vscode/extensions/trae-harvester-*/out/hub/daemon.js

# 或直接从源码运行
cd trae-harvester
node out/hub/daemon.js
```

成功后会看到：
```
[Hub] ✅ Hub listening on http://127.0.0.1:37650
[Hub] 🔍 Starting port scanner...
```

### 5. 打开监控页面
浏览器访问 `http://127.0.0.1:37650`，实时查看所有窗口状态。

---

## 🤖 MCP Server 使用指南

### 配置 AI 客户端

Trae Harvester 提供标准 MCP Server，支持所有兼容 MCP 的 AI 客户端（Claude Desktop、Cline、Cursor 等）。

#### 配置示例（Claude Desktop）
编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）或  
`%APPDATA%\Claude\claude_desktop_config.json`（Windows）：

```json
{
  "mcpServers": {
    "trae-harvester": {
      "command": "node",
      "args": [
        "/Users/yourname/.vscode/extensions/trae-harvester-0.5.2/out/hub/bridge.js"
      ],
      "env": {}
    }
  }
}
```

**重要**：将路径替换为你的实际扩展安装路径。

#### 配置示例（直连 HTTP）
如果 AI 客户端支持直连 HTTP MCP Server：
```
URL: http://127.0.0.1:37650/mcp
Authorization: Bearer <从 http://127.0.0.1:37650/token 获取>
```

---

### MCP 工具列表

所有工具均以 `trae_harvester_` 为前缀，便于模型识别和调用。

#### 📋 测试编排工具

| 工具名称 | 描述 | 参数 |
|---------|------|------|
| `trae_harvester_import_test_plan` | 导入测试计划 JSON | `session_id`, `json_text` |
| `trae_harvester_run_all_tests` | 执行所有测试步骤 | `session_id` |
| `trae_harvester_get_plan` | 获取当前测试计划 | `session_id` |
| `trae_harvester_get_test_results` | 获取测试执行结果 | `session_id` |
| `trae_harvester_get_check_items` | 获取人工检查项状态 | `session_id` |

#### 📦 证据收集工具

| 工具名称 | 描述 | 参数 |
|---------|------|------|
| `trae_harvester_export_patch` | 导出 Git Patch | `session_id` |
| `trae_harvester_get_patch_content` | 获取已导出的 Patch 内容 | `session_id` |
| `trae_harvester_get_ai_context` | 获取 AI 生成的上下文 | `session_id` |
| `trae_harvester_get_evaluation_evidence` | **收卷**：打包所有证据 | `session_id` |

#### 🔍 管理工具

| 工具名称 | 描述 | 参数 |
|---------|------|------|
| `trae_harvester_list_windows` | 列出所有窗口 | 无 |
| `trae_harvester_test_connection` | 测试连接 | `session_id` |
| `trae_harvester_get_logs` | 获取插件日志 | `session_id` |

---

### 测试计划 JSON 格式

```json
{
  "steps": [
    {
      "step_number": 1,
      "title": "安装依赖",
      "command": "npm install",
      "cwd": "/path/to/project",
      "timeout": 60000
    },
    {
      "step_number": 2,
      "title": "运行测试",
      "command": "npm test"
    }
  ],
  "check_items": [
    { "text": "页面正常显示登录按钮", "passed": false },
    { "text": "点击按钮后跳转正确", "passed": false }
  ]
}
```

---

### 典型工作流示例

```javascript
// 1. 列出所有窗口
const windows = await use_mcp_tool('trae_harvester_list_windows', {});
const sessionId = windows[0].sessionId; // 选择第一个窗口

// 2. 导入测试计划
await use_mcp_tool('trae_harvester_import_test_plan', {
  session_id: sessionId,
  json_text: JSON.stringify({
    steps: [
      { step_number: 1, title: "构建项目", command: "npm run build" }
    ]
  })
});

// 3. 执行测试
await use_mcp_tool('trae_harvester_run_all_tests', { session_id: sessionId });

// 4. 导出 Patch
await use_mcp_tool('trae_harvester_export_patch', { session_id: sessionId });

// 5. 收集所有证据用于评分
const evidence = await use_mcp_tool('trae_harvester_get_evaluation_evidence', {
  session_id: sessionId
});

// evidence 包含：
// - git_patch: 完整的代码变更
// - test_results: 每个步骤的执行结果
// - manual_check_items: 人工检查项状态
// - ai_context: AI 生成的上下文（如果已保存）
```

---

## ⚙️ 配置选项

在 VS Code 设置中搜索 `Trae Harvester`：

### 路径配置
```json
{
  "traeHarvester.patchOutputPath": "/gitdiff_shared",
  "traeHarvester.resultsOutputPath": "/gitdiff_shared"
}
```

### 标识配置
```json
{
  "traeHarvester.modelOptions": [
    "GPT-4o",
    "Claude-3.5-Sonnet",
    "DeepSeek-V3",
    "Qwen-2.5-Coder"
  ],
  "traeHarvester.promptOptions": [
    "Prompt_V1_Baseline",
    "Prompt_V2_Enhanced",
    "Prompt_V3_CoT"
  ],
  "traeHarvester.repoOptions": [
    "Repo_1_WebApp",
    "Repo_2_API",
    "Repo_3_Mobile"
  ]
}
```

### 安全配置
```json
{
  "traeHarvester.mcpAllowExecution": true,
  "traeHarvester.githubToken": "ghp_your_token_here"
}
```

---

## 🏗️ 架构说明

```
┌─────────────────────────────────────────────────────────────┐
│  AI 客户端 (Claude Desktop / Cline / Cursor)                │
│  通过 MCP 协议连接                                           │
└─────────────────┬───────────────────────────────────────────┘
                  │ MCP Tools
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Hub 守护进程 (daemon.js)                                    │
│  - 监听 http://127.0.0.1:37650                              │
│  - 定期扫描 37651-37700 端口发现窗口                         │
│  - 转发工具调用到目标窗口                                    │
│  - 提供 Web 监控界面                                         │
└─────────────────┬──────────┬──────────┬────────────────────┘
                  │          │          │ HTTP POST /execute_tool
                  ▼          ▼          ▼
         ┌────────────┐ ┌────────────┐ ┌────────────┐
         │ 窗口 1      │ │ 窗口 2      │ │ 窗口 3      │
         │ (本地)      │ │ (Container) │ │ (SSH)       │
         │ :37651      │ │ :37652      │ │ :37653      │
         └────────────┘ └────────────┘ └────────────┘
```

---

## 🧪 开发与调试

### 启动开发模式
```bash
npm install
npm run compile
# 按 F5 在 VS Code 中启动调试
```

### 查看日志
- **插件日志**：Output → Trae Harvester Log
- **Hub 日志**：Hub 守护进程的终端输出
- **导出日志**：点击面板中的「导出日志」按钮

### 监控窗口状态
访问 `http://127.0.0.1:37650` 查看：
- 所有活跃窗口
- 端口分配情况
- 窗口标识（Repo/Branch/Model/Prompt）
- 测试状态（IDLE/RUNNING/COMPLETED）

---

## 📝 常见问题

### Q: 远程窗口（Container/SSH）无法连接？
**A**: 确保：
1. 窗口内点击了「启动 MCP」按钮
2. 检查 PORTS 面板，端口已自动转发到本地
3. Hub 守护进程正在运行（`http://127.0.0.1:37650` 可访问）
4. 等待 5-10 秒让 Hub 完成扫描

### Q: 多个窗口端口冲突？
**A**: 端口基于 PID 自动分配（`37651 + PID % 50`），冲突概率极低。如果仍有冲突，插件会自动尝试下一个端口。

### Q: MCP 工具调用失败？
**A**: 检查：
1. `session_id` 是否正确（通过 `list_windows` 获取）
2. 目标窗口是否在线（Web 页面查看）
3. Hub 日志是否有错误信息

### Q: 如何更新到最新版本？
**A**: 点击面板中的「检查更新」按钮，或访问 [Releases](https://github.com/oldtian123/trae-harvester/releases) 手动下载。

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发流程
1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交改动：`git commit -m 'feat: Add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- [Model Context Protocol](https://modelcontextprotocol.io/) - 提供标准化的 AI-Tool 通信协议
- [VS Code Extension API](https://code.visualstudio.com/api) - 强大的扩展开发能力

---

## 📮 联系方式

- **GitHub Issues**: [https://github.com/oldtian123/trae-harvester/issues](https://github.com/oldtian123/trae-harvester/issues)
- **作者**: oldtian123

---

**⭐ 如果这个项目对你有帮助，请给个 Star！**
