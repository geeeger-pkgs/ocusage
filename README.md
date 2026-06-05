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

> 使用 Node.js 内置 `node:sqlite` 模块，零外部依赖，支持 WAL 模式实时读取。
>
> Uses Node.js built-in `node:sqlite` module — zero external dependencies, supports WAL mode for live reading.

## 使用 / Usage

```bash
# 查看今天的用量 / Today's usage
ocusage

# 查看指定日期 / Specific date
ocusage --date 2025-04-20

# 日期范围查询 / Date range query
ocusage --from 2025-04-01 --to 2025-04-30

# 只指定起始日期（默认到今天）/ From date to today
ocusage --from 2025-04-01

# 指定数据库路径 / Custom DB path
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
ocusage compare --a 2025-04 --b 2025-05 --json     # JSON 格式输出
ocusage compare --a 2025-04 --b 2025-05 --lang en  # English output
```

首次运行前确保 [OpenCode](https://opencode.ai) 已使用过至少一次。数据库默认位于：

Make sure OpenCode has been used at least once. Database default location:

- **Linux/macOS**: `~/.local/share/opencode/opencode.db`
- **Windows**: `%XDG_DATA_HOME%\opencode\opencode.db` 或 `~/.local/share/opencode/opencode.db`

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
cli.mjs      — 入口，参数解析 / Entry point, argument parsing
report.mjs   — 多格式输出 / Multi-format output (table/JSON/CSV/Markdown)
i18n.mjs     — 国际化 / Internationalization
locales/     — 翻译文件 / Translation files (zh-CN, zh-TW, en, ja, ko)
```

## 要求 / Requirements

- Node.js >= 22.5.0
- [OpenCode](https://opencode.ai) 已安装并使用过 / Installed and used at least once

## License

[MIT](./LICENSE)
