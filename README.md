# @geeeger/ocusage

[![npm version](https://img.shields.io/npm/v/@geeeger/ocusage.svg)](https://www.npmjs.com/package/@geeeger/ocusage) [![license](https://img.shields.io/npm/l/@geeeger/ocusage.svg)](https://github.com/geeeger-pkgs/ocusage/blob/main/LICENSE) [![node](https://img.shields.io/node/v/@geeeger/ocusage.svg)](https://nodejs.org)

OpenCode 每日 Token 用量报告 CLI。直接读取 OpenCode 本地 SQLite 数据库，按模型、项目、供应商分组展示每日 token 消耗。

Daily token usage report for [OpenCode](https://opencode.ai). Reads the local SQLite database and shows per-day token consumption grouped by model, project, and provider.

## 安装 / Install

```bash
npm install -g @geeeger/ocusage
```

或直接本地运行（无需安装）：

```bash
node cli.mjs
```

> 依赖 `better-sqlite3`（原生 C++ 模块），需要 C++ 编译工具链。
>
> Requires `better-sqlite3` (native addon) — a C++ toolchain is needed for installation.

## 使用 / Usage

```bash
# 查看今天的用量 / Today's usage
ocusage

# 查看指定日期 / Specific date
ocusage --date 2025-04-20

# 指定数据库路径 / Custom DB path
ocusage --db /path/to/opencode.db

# JSON 格式输出 / JSON output
ocusage --json
```

首次运行前确保 [OpenCode](https://opencode.ai) 已使用过至少一次。数据库默认位于：

Make sure OpenCode has been used at least once. Database default location:

- **Linux/macOS**: `~/.local/share/opencode/opencode.db`
- **Windows**: `%XDG_DATA_HOME%\opencode\opencode.db` 或 `~/.local/share/opencode/opencode.db`

## 输出示例 / Example Output

```
📊 总体数据 (2025-04-20)
┌────────────┬────────────┬────────────┬──────────┬──────────┬──────────┬────────────┐
│ 今日总请求数 │ 输入Tokens │ 输出Tokens │ 工具调用数量 │ 缓存读取  │ 缓存创建  │ 总计Tokens │
├────────────┼────────────┼────────────┼──────────┼──────────┼──────────┼────────────┤
│ 42         │ 120.5K     │ 35.2K      │ 87       │ 80.1K    │ 15.3K    │ 251.1K     │
└────────────┴────────────┴────────────┴──────────┴──────────┴──────────┴────────────┘
```

## 项目结构 / Project Structure

```
cli.mjs      — 入口，参数解析 / Entry point, argument parsing
db.mjs       — 数据库读取与统计 / DB access and aggregation
report.mjs   — 表格 / JSON 格式化输出 / Table and JSON formatting
```

## 要求 / Requirements

- Node.js >= 18
- [OpenCode](https://opencode.ai) 已安装并使用过 / Installed and used at least once

## License

[MIT](./LICENSE)
