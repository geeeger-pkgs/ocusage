# @geeeger/ocusage

OpenCode daily token usage report CLI. ESM Node.js (`"type": "module"`), no build step.

## Commands

```bash
# Run the CLI locally (no install)
node cli.mjs

# With options
node cli.mjs --date 2025-04-20   # specific date
node cli.mjs --db /path/to/db    # custom DB path
node cli.mjs --json              # JSON output instead of tables
```

## Architecture

- **cli.mjs** — entrypoint, arg parsing
- **db.mjs** — opens the OpenCode SQLite DB (default `~/.local/share/opencode/opencode.db`) in readonly mode, queries `message` + `part` tables for a given UTC date
- **report.mjs** — formats and prints results as CLI tables or JSON

## Key facts

- Reads the OpenCode SQLite DB directly; DB must already exist (created by OpenCode itself)
- Uses `better-sqlite3` (native addon) — requires a C++ toolchain to install
- Node >= 18 required
- No tests, no lint, no CI
- UI strings are in Chinese (表头、分隔符等)
