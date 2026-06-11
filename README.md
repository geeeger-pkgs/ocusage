# @geeeger/ocusage

[![npm version](https://img.shields.io/npm/v/@geeeger/ocusage.svg)](https://www.npmjs.com/package/@geeeger/ocusage) [![license](https://img.shields.io/npm/l/@geeeger/ocusage.svg)](https://github.com/geeeger-pkgs/ocusage/blob/main/LICENSE) [![node](https://img.shields.io/node/v/@geeeger/ocusage.svg)](https://nodejs.org)

AI 客户端每日 Token 用量报告 CLI。统一读取多个 AI 客户端的本地数据（SQLite/JSONL），按模型、项目、供应商分组展示每日 token 消耗，支持跨客户端聚合与对比分析。

Daily token usage report CLI for AI clients. Reads local data (SQLite/JSONL) from multiple AI clients and shows per-day token consumption grouped by model, project, and provider, with cross-client aggregation and comparison.

## 安装 / Install

```bash
npm install -g @geeeger/ocusage
```

或直接本地运行（无需安装）：

```bash
node cli.mjs
```

> 使用 Node.js 内置 `node:sqlite` 模块读取 SQLite 数据库，零外部依赖；JSONL 客户端直接读取文件系统。
>
> Uses Node.js built-in `node:sqlite` for SQLite databases — zero external dependencies. JSONL-based clients are read directly from the filesystem.

## 支持的 AI 客户端 / Supported AI Clients

| 客户端 / Client | 数据源 / Data Source | 格式 / Format | 状态 / Status |
|------|---------|------|------|
| OpenCode | `~/.local/share/opencode/opencode.db` | SQLite | ✅ 完整支持 / Full support |
| MiMoCode | `~/.local/share/mimocode/mimocode.db` | SQLite | ✅ 完整支持 / Full support |
| Qoder | `%APPDATA%/Qoder/SharedClientCache/cache/db/local.db` | SQLite | ✅ 完整支持 / Full support |
| Claude Code | `~/.claude/projects/**/*.jsonl` | JSONL | ✅ 完整支持 / Full support |
| Qoder CLI | `~/.qoder/logs/sessions/**/*.jsonl` | JSONL | ✅ 完整支持 / Full support |
| CodeWhale | `~/.codewhale/sessions/*.json` | JSON | ✅ 完整支持 / Full support |
| Trae | `%APPDATA%/Trae/ModularData/ai-agent/database.db` | SQLCipher | ✅ SQLCipher 4 解密（Windows）/ Decryption (Windows) |
| Trae Solo | `%APPDATA%/TRAE SOLO/ModularData/ai-agent/database.db` | SQLCipher | ✅ SQLCipher 4 解密（Windows）/ Decryption (Windows) |

## 使用 / Usage

```bash
# 查看今天的用量 / Today's usage
ocusage

# 查看指定日期 / Specific date
ocusage --date 2025-04-20

# 快捷日期别名 / Date aliases
ocusage -d yesterday          # 昨天 / Yesterday
ocusage -d week               # 本周一到今天 / This week (Mon–today)
ocusage -d month              # 本月1号到今天 / This month (1st–today)
ocusage -d last-week          # 上周 / Last week (Mon–Sun)
ocusage -d last-month         # 上月 / Last month

# 日期范围查询 / Date range query
ocusage --from 2025-04-01 --to 2025-04-30

# 只指定起始日期（默认到今天）/ From date to today
ocusage --from 2025-04-01

# 指定数据库路径（仅 OpenCode）/ Custom DB path (OpenCode only)
ocusage --db /path/to/opencode.db

# 输出格式 / Output format
ocusage --json                    # JSON 输出
ocusage --format csv              # CSV 格式
ocusage --format markdown         # Markdown 表格

# 切换语言 / Switch language
ocusage --lang en                 # English
ocusage --lang zh-TW              # 繁體中文
ocusage --lang ja                 # 日本語
ocusage --lang ko                 # 한국어

# 数据对比 / Compare periods
ocusage compare --a 2025-04 --b 2025-05            # 月对比 / Monthly
ocusage compare --a 2025-04-01 --b 2025-04-02      # 日对比 / Daily
ocusage compare --a last-month --b month            # 别名对比 / Alias compare
ocusage compare --a 2025-04 --b 2025-05 --json     # JSON 格式输出
ocusage compare --a 2025-04 --b 2025-05 --lang en  # English output
```

### 多客户端选择 / Multi-client Selection

通过 `-c/--client` 选项可指定一个或多个 AI 客户端进行查询：

Use `-c/--client` to query one or multiple AI clients:

```bash
ocusage -c all              # 所有检测到的客户端 / All detected clients
ocusage -c opencode         # 仅 OpenCode / OpenCode only
ocusage -c mimocode         # 仅 MiMoCode / MiMoCode only
ocusage -c qoder            # 仅 Qoder / Qoder only
ocusage -c claude           # 仅 Claude Code / Claude Code only
ocusage -c qoder-cli        # 仅 Qoder CLI / Qoder CLI only
ocusage -c codewhale        # 仅 CodeWhale / CodeWhale only
ocusage -c opencode,qoder   # 多客户端组合 / Multiple clients
```

### 检测命令 / Detect Command

```bash
ocusage detect              # 检测已安装的 AI 客户端 / Detect installed AI clients
```

### 配置命令 / Config Command

通过 `config` 子命令可对每个 provider 配置自定义数据库或日志路径，配置持久化保存到本地。

The `config` subcommand persists custom data paths per provider on disk.

```bash
ocusage config              # 交互式配置 / Interactive configuration
ocusage config --list       # 列出当前配置 / List current path configuration
ocusage config --reset      # 重置所有自定义路径 / Reset all custom paths
```

## 支持语言 / Supported Languages

| 代码 | 语言 |
|------|------|
| zh-CN | 简体中文 (默认) |
| zh-TW | 繁體中文 |
| en | English |
| ja | 日本語 |
| ko | 한국어 |

可通过 `OCUSAGE_LANG` 环境变量设置默认语言。Set the default language via the `OCUSAGE_LANG` environment variable.

## 输出示例 / Example Output

```
📊 总体数据 (2025-04-20)
┌────────────┬────────────┬────────────┬──────────┬──────────┬──────────┬────────────┐
│ 今日总请求数 │ 输入Tokens │ 输出Tokens │ 工具调用数量 │ 缓存读取  │ 缓存创建  │ 总计Tokens │
├────────────┼────────────┼────────────┼──────────┼──────────┼──────────┼────────────┤
│ 42         │ 120.5K     │ 35.2K      │ 87       │ 80.1K    │ 15.3K    │ 251.1K     │
└────────────┴────────────┴────────────┴──────────┴──────────┴──────────┴────────────┘
```

### 对比输出 / Compare Output

```
📊 对比: 2025-04 vs 2025-05
┌──────────────┬─────────┬─────────┬────────┬────────┐
│              │ 2025-04 │ 2025-05 │ 差值   │ 变化率  │
├──────────────┼─────────┼─────────┼────────┼────────┤
│ 今日总请求数  │ 120     │ 150     │ +30    │ +25.0% │
│ 输入Tokens   │ 50.2K   │ 62.8K   │ +12.6K │ +25.1% │
│ 输出Tokens   │ 15.1K   │ 18.3K   │ +3.2K  │ +21.2% │
│ 总计Tokens   │ 80.5K   │ 96.4K   │ +15.9K │ +19.8% │
└──────────────┴─────────┴─────────┴────────┴────────┘
```

## 项目结构 / Project Structure

```
cli.mjs       — 入口，参数解析 / Entry point, argument parsing
multi.mjs     — 多客户端编排层 / Multi-client orchestration layer
config.mjs    — 持久化配置管理 / Persistent configuration management
report.mjs    — 多格式输出 / Multi-format output (table/JSON/CSV/Markdown)
i18n.mjs      — 国际化 / Internationalization
locales/      — 翻译文件 / Translation files (zh-CN, zh-TW, en, ja, ko)
providers/    — 可插拔 Provider 系统 / Pluggable provider system
  base.mjs       — 基础类型和工具 / Shared types and utilities
  opencode.mjs   — OpenCode SQLite provider
  mimocode.mjs   — MiMoCode SQLite provider
  qoder.mjs      — Qoder SQLite provider
  claude.mjs     — Claude Code JSONL provider
  qoder-cli.mjs  — Qoder CLI JSONL provider
  codewhale.mjs  — CodeWhale JSON session provider
  trae.mjs       — Trae IDE (SQLCipher, 仅检测 / detect only)
  trae-solo.mjs  — Trae Solo (SQLCipher, 仅检测 / detect only)
  index.mjs      — Provider 注册表与自动检测 / Provider registry and auto-detection
```

## 要求 / Requirements

- Node.js >= 22.5.0
- 至少一个受支持的 AI 客户端已安装并使用过 / At least one supported AI client installed and used at least once

## License

[MIT](./LICENSE)
