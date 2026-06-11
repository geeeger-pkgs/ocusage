/**
 * MiMoCode provider — reads from the MiMoCode SQLite database.
 * Uses the same database schema and path convention as OpenCode.
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { EMPTY_STAT, validateDate } from "./base.mjs";

const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";

function getDefaultDBPaths() {
  const xdgDataDir = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const xdgPath = join(xdgDataDir, "mimocode", "mimocode.db");

  if (isWindows) {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return [xdgPath, join(appData, "mimocode", "mimocode.db")];
  }
  if (isMac) {
    return [join(homedir(), "Library", "Application Support", "mimocode", "mimocode.db"), xdgPath];
  }
  // Linux
  return [xdgPath];
}

const DEFAULT_DB_PATHS = getDefaultDBPaths();

export const name = "MiMoCode";
export const id = "mimocode";

export function detect(customPath) {
  if (customPath) {
    return existsSync(customPath) ? customPath : null;
  }
  for (const path of DEFAULT_DB_PATHS) {
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
}

function openDB(dbPath) {
  let path = dbPath;
  if (!path) {
    path = DEFAULT_DB_PATHS.find((p) => existsSync(p));
  }
  if (!path || !existsSync(path)) {
    return null;
  }
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL");
  return db;
}

function _aggregateRows(rows) {
  const toolCallCount = new Map();
  const seenMessages = new Set();
  const messages = [];

  for (const row of rows) {
    if (row.part_data != null) {
      try {
        const d = JSON.parse(row.part_data);
        if (d.type === "tool") {
          toolCallCount.set(row.id, (toolCallCount.get(row.id) || 0) + 1);
        }
      } catch {
        /* skip malformed part data */
      }
    }

    if (!seenMessages.has(row.id)) {
      seenMessages.add(row.id);
      messages.push({ id: row.id, data: row.data, directory: row.directory });
    }
  }

  const total = EMPTY_STAT();
  const byModel = new Map();
  const byProject = new Map();
  const byProvider = new Map();

  for (const msg of messages) {
    let data;
    try {
      data = JSON.parse(msg.data);
    } catch {
      continue;
    }

    if (data.role !== "assistant") continue;

    const tokens = data.tokens || {};
    const inputTokens = tokens.input || 0;
    const outputTokens = tokens.output || 0;
    const cacheRead = tokens.cache?.read || 0;
    const cacheWrite = tokens.cache?.write || 0;
    const totalTokens = tokens.total || 0;
    const modelID = data.modelID || "unknown";
    const providerID = data.providerID || "unknown";
    const projectName = msg.directory ? basename(msg.directory) : "(global)";
    const tc = toolCallCount.get(msg.id) || 0;

    total.requests++;
    total.inputTokens += inputTokens;
    total.outputTokens += outputTokens;
    total.toolCalls += tc;
    total.cacheRead += cacheRead;
    total.cacheWrite += cacheWrite;
    total.totalTokens += totalTokens;

    const modelKey = `${modelID} (${providerID})`;

    for (const [map, key] of [
      [byModel, modelKey],
      [byProject, projectName],
      [byProvider, providerID],
    ]) {
      if (!map.has(key)) map.set(key, EMPTY_STAT());
      const s = map.get(key);
      s.requests++;
      s.inputTokens += inputTokens;
      s.outputTokens += outputTokens;
      s.toolCalls += tc;
      s.cacheRead += cacheRead;
      s.cacheWrite += cacheWrite;
      s.totalTokens += totalTokens;
    }
  }

  return { total, byModel, byProject, byProvider };
}

function _queryRange(db, startMs, endMs) {
  return db
    .prepare(
      `SELECT m.id, m.data, s.directory, p.data AS part_data
       FROM message m
       LEFT JOIN session s ON m.session_id = s.id
       LEFT JOIN part p ON p.message_id = m.id AND p.time_created >= ? AND p.time_created <= ?
       WHERE m.time_created >= ? AND m.time_created <= ?`,
    )
    .all(startMs, endMs, startMs, endMs);
}

export function getDailyStats(dbPath, dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  validateDate(date);
  const [y, m, d] = date.split("-").map(Number);
  const startMs = Date.UTC(y, m - 1, d, 0, 0, 0);
  const endMs = Date.UTC(y, m - 1, d, 23, 59, 59, 999);

  const db = openDB(dbPath);
  if (!db) return null;

  try {
    const rows = _queryRange(db, startMs, endMs);
    const { total, byModel, byProject, byProvider } = _aggregateRows(rows);
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

  const db = openDB(dbPath);
  if (!db) return null;

  try {
    const rows = _queryRange(db, startMs, endMs);
    const { total, byModel, byProject, byProvider } = _aggregateRows(rows);
    return {
      total,
      byModel,
      byProject,
      byProvider,
      date: `${fromDate} ~ ${toDate}`,
      client: id,
    };
  } finally {
    db.close();
  }
}

export function close() {
  // No-op: we open/close DB per call for safety
}
