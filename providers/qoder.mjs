/**
 * Qoder provider — reads from the Qoder IDE SQLite database.
 *
 * Qoder uses the same schema as Trae (they share the same codebase):
 *   - chat_message.token_info → JSON with token usage
 *   - chat_message.model_info → JSON with model identifier
 *   - chat_session.project_uri → project path
 *   - chat_message.gmt_create → timestamp in ms epoch
 *
 * Path: %APPDATA%/Qoder/SharedClientCache/cache/db/local.db (Windows)
 *       ~/.config/Qoder/... (Linux/macOS — untested)
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { EMPTY_STAT, validateDate } from "./base.mjs";

const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";

function getDefaultDBPath() {
  if (isWindows) {
    // %APPDATA%\Qoder\SharedClientCache\cache\db\local.db
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(appData, "Qoder", "SharedClientCache", "cache", "db", "local.db");
  }
  if (isMac) {
    return join(homedir(), "Library", "Application Support", "Qoder", "SharedClientCache", "cache", "db", "local.db");
  }
  // Linux
  const configDir = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(configDir, "Qoder", "SharedClientCache", "cache", "db", "local.db");
}

export const name = "Qoder";
export const id = "qoder";

export function detect(customPath) {
  const path = customPath || getDefaultDBPath();
  if (existsSync(path)) {
    return path;
  }
  return null;
}

function aggregateMessages(rows) {
  const total = EMPTY_STAT();
  const byModel = new Map();
  const byProject = new Map();
  const byProvider = new Map();

  for (const row of rows) {
    // Only count assistant messages with token_info
    if (row.role !== "assistant") continue;

    let tokenInfo = null;
    try {
      tokenInfo = row.token_info ? JSON.parse(row.token_info) : null;
    } catch {
      continue;
    }
    if (!tokenInfo) continue;

    let modelInfo = null;
    try {
      modelInfo = row.model_info ? JSON.parse(row.model_info) : null;
    } catch {
      // ignore
    }

    const inputTokens = tokenInfo.prompt_tokens || 0;
    const outputTokens = tokenInfo.completion_tokens || 0;
    const cacheRead = tokenInfo.cached_tokens || 0;
    const cacheWrite = 0; // Qoder schema doesn't have cache_write in token_info
    const totalTokens = inputTokens + outputTokens;
    const modelKey = `${modelInfo?.model_key || "unknown"} (qoder)`;
    const projectName = row.project_uri ? basename(row.project_uri) : "(global)";

    total.requests++;
    total.inputTokens += inputTokens;
    total.outputTokens += outputTokens;
    total.toolCalls += 0; // Qoder doesn't expose tool_calls in chat_message
    total.cacheRead += cacheRead;
    total.cacheWrite += cacheWrite;
    total.totalTokens += totalTokens;

    for (const [map, key] of [
      [byModel, modelKey],
      [byProject, projectName],
      [byProvider, "qoder"],
    ]) {
      if (!map.has(key)) map.set(key, EMPTY_STAT());
      const s = map.get(key);
      s.requests++;
      s.inputTokens += inputTokens;
      s.outputTokens += outputTokens;
      s.toolCalls += 0;
      s.cacheRead += cacheRead;
      s.cacheWrite += cacheWrite;
      s.totalTokens += totalTokens;
    }
  }

  return { total, byModel, byProject, byProvider };
}

function queryRange(db, startMs, endMs) {
  return db
    .prepare(
      `SELECT cm.role, cm.token_info, cm.model_info, cs.project_uri
       FROM chat_message cm
       LEFT JOIN chat_session cs ON cm.session_id = cs.session_id
       WHERE cm.gmt_create >= ? AND cm.gmt_create <= ?`,
    )
    .all(startMs, endMs);
}

export function getDailyStats(dbPath, dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  validateDate(date);
  const [y, m, d] = date.split("-").map(Number);
  const startMs = Date.UTC(y, m - 1, d, 0, 0, 0);
  const endMs = Date.UTC(y, m - 1, d, 23, 59, 59, 999);

  const path = dbPath || getDefaultDBPath();
  if (!existsSync(path)) return null;
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL");
  try {
    const rows = queryRange(db, startMs, endMs);
    const { total, byModel, byProject, byProvider } = aggregateMessages(rows);
    return { total, byModel, byProject, byProvider, date, client: id };
  } finally {
    db.close();
  }
}

export function getDateRangeStats(dbPath, fromDate, toDate) {
  validateDate(fromDate);
  validateDate(toDate);

  const [fy, fm, fd] = fromDate.split("-").map(Number);
  const [ty, tm, td] = toDate.split("-").map(Number);
  const startMs = Date.UTC(fy, fm - 1, fd, 0, 0, 0);
  const endMs = Date.UTC(ty, tm - 1, td, 23, 59, 59, 999);

  if (startMs > endMs) {
    throw new Error(`Start date ${fromDate} is after end date ${toDate}`);
  }

  const path = dbPath || getDefaultDBPath();
  if (!existsSync(path)) return null;
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL");
  try {
    const rows = queryRange(db, startMs, endMs);
    const { total, byModel, byProject, byProvider } = aggregateMessages(rows);
    return { total, byModel, byProject, byProvider, date: `${fromDate} ~ ${toDate}`, client: id };
  } finally {
    db.close();
  }
}

export function close() {
  // No-op: we open/close DB per call
}
