# @geeeger/ocusage

OpenCode daily token usage report CLI. ESM Node.js (`"type": "module"`), no build step.

## Commands

```bash
# Run the CLI locally (no install)
node cli.mjs

# With options
node cli.mjs --date 2025-04-20   # specific date
node cli.mjs --db /path/to/db    # custom DB path (OpenCode only)
node cli.mjs --json              # JSON output instead of tables
node cli.mjs --client all        # all detected AI clients
node cli.mjs --client opencode   # OpenCode only
node cli.mjs --client mimocode   # MiMoCode only
node cli.mjs --client qoder      # Qoder only
node cli.mjs --client claude     # Claude Code only
node cli.mjs --client codewhale  # CodeWhale only
node cli.mjs --client trae       # Trae IDE only
node cli.mjs --client trae-solo   # Trae Solo only
node cli.mjs --client qoder-cli  # Qoder CLI only
node cli.mjs --client opencode,qoder  # multiple clients

# Detect installed AI clients
node cli.mjs detect

# Compare periods
node cli.mjs compare -a 2025-04 -b 2025-05

# Configure custom database paths
node cli.mjs config              # interactive configuration
node cli.mjs config --list       # list current path configuration
node cli.mjs config --reset      # clear all custom paths
```

## Supported AI Clients

| Client | Data Source | Format | Status |
|--------|-------------|--------|--------|
| OpenCode | `~/.local/share/opencode/opencode.db` | SQLite | ✅ Full support |
| MiMoCode | `~/.local/share/mimocode/mimocode.db` | SQLite | ✅ Full support |
| Qoder | `%APPDATA%/Qoder/SharedClientCache/cache/db/local.db` | SQLite | ✅ Full support |
| Claude Code | `~/.claude/projects/**/*.jsonl` | JSONL | ✅ Full support |
| Qoder CLI | `~/.qoder/logs/sessions/**/*.jsonl` | JSONL | ✅ Full support |
| CodeWhale | `~/.codewhale/sessions/*.json` | JSON | ✅ Full support |
| Trae | `%APPDATA%/Trae/ModularData/ai-agent/database.db` | SQLCipher | ⚠️ Encrypted DB — detected but cannot read |
| Trae Solo | `%APPDATA%/TRAE SOLO/ModularData/ai-agent/database.db` | SQLCipher | ⚠️ Encrypted DB — detected but cannot read |

## Architecture

- **cli.mjs** — entrypoint, arg parsing
- **multi.mjs** — multi-client orchestration layer
- **providers/** — pluggable provider system
  - **base.mjs** — shared types and utilities
  - **opencode.mjs** — OpenCode SQLite provider
  - **mimocode.mjs** — MiMoCode SQLite provider
  - **qoder.mjs** — Qoder SQLite provider
  - **claude.mjs** — Claude Code JSONL provider
  - **codewhale.mjs** — CodeWhale JSON session provider
  - **qoder-cli.mjs** — Qoder CLI JSONL provider
  - **trae.mjs** — Trae IDE (SQLCipher, detect + graceful degradation)
  - **trae-solo.mjs** — Trae Solo (SQLCipher, detect + graceful degradation)
  - **index.mjs** — provider registry and auto-detection
- **config.mjs** — persistent configuration management (custom paths per provider)
- **report.mjs** — formats and prints results as CLI tables or JSON
- **i18n.mjs** — internationalization (zh-CN, zh-TW, en, ja, ko)

## Key facts

- Reads AI client databases/files directly; they must already exist
- OpenCode uses `node:sqlite` (Node.js built-in) — zero external dependencies
- MiMoCode uses the same `node:sqlite` for its SQLite database
- Qoder uses the same `node:sqlite` for its SQLite database
- Claude Code parses JSONL files from the filesystem
- Qoder CLI parses session JSONL files from the filesystem
- CodeWhale parses session JSON files from the filesystem (metadata + message counting)
- Trae database is SQLCipher encrypted — detected but data cannot be read yet
- Node >= 22.5.0 required
- Tests: `npm test` · Lint: `npm run lint` · CI: GitHub Actions (`.github/workflows/ci.yml`)
- UI strings are in Chinese (表头、分隔符等)
