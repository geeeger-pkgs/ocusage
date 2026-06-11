/**
 * Trae Solo provider — reads from the Trae Solo database.
 *
 * Trae Solo is a standalone AI coder from ByteDance, separate from Trae IDE.
 * It uses the SAME database schema as Qoder/Trae IDE (shared codebase),
 * but the database is encrypted with SQLCipher.
 *
 * NOTE: Trae Solo uses a fundamentally different encryption architecture
 * from Trae IDE. The encryption key is randomly generated at database
 * creation time and is NOT stored in process memory. Memory scanning,
 * DPAPI/safeStorage key derivation, and other extraction methods have
 * all been attempted and failed. See:
 * https://forum.trae.cn/t/topic/18289
 *
 * Path: %APPDATA%/TRAE SOLO/ModularData/ai-agent/database.db
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
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    // Note: TRAE SOLO directory name has a space
    return join(appData, "TRAE SOLO", "ModularData", "ai-agent", "database.db");
  }
  if (isMac) {
    return join(homedir(), "Library", "Application Support", "Trae-Solo", "ModularData", "ai-agent", "database.db");
  }
  // Linux
  const configDir = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(configDir, "Trae-Solo", "ModularData", "ai-agent", "database.db");
}

export const name = "Trae Solo";
export const id = "trae-solo";

let _encryptionNote = null;

export function detect(customPath) {
  const path = customPath || getDefaultDBPath();
  if (existsSync(path)) return path;
  return null;
}

function tryOpenDB(dbPath) {
  const path = dbPath || getDefaultDBPath();
  if (!existsSync(path)) return { db: null, encrypted: false, notFound: true };
  try {
    const db = new DatabaseSync(path);
    db.prepare("SELECT count(*) AS cnt FROM chat_message LIMIT 1").get();
    return { db, encrypted: false, notFound: false };
  } catch (err) {
    _encryptionNote = err.message;
    return { db: null, encrypted: true, notFound: false };
  }
}

function aggregateMessages(rows) {
  const total = EMPTY_STAT();
  const byModel = new Map();
  const byProject = new Map();
  const byProvider = new Map();

  for (const row of rows) {
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
    } catch {}

    const inputTokens = tokenInfo.prompt_tokens || 0;
    const outputTokens = tokenInfo.completion_tokens || 0;
    const cacheRead = tokenInfo.cached_tokens || 0;
    const cacheWrite = 0;
    const totalTokens = inputTokens + outputTokens;
    const modelKey = modelInfo?.model_key || "unknown";
    const projectName = row.project_uri ? basename(row.project_uri) : "(global)";

    total.requests++;
    total.inputTokens += inputTokens;
    total.outputTokens += outputTokens;
    total.toolCalls += 0;
    total.cacheRead += cacheRead;
    total.cacheWrite += cacheWrite;
    total.totalTokens += totalTokens;

    for (const [map, key] of [
      [byModel, modelKey],
      [byProject, projectName],
      [byProvider, "trae-solo"],
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
     FROM chat_message cm LEFT JOIN chat_session cs ON cm.session_id = cs.session_id
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
  const { db, encrypted, notFound } = tryOpenDB(dbPath);
  if (notFound) return null;
  if (encrypted) return { encrypted: true, client: id, date };
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
  if (startMs > endMs) throw new Error(`Start date ${fromDate} is after end date ${toDate}`);
  const { db, encrypted, notFound } = tryOpenDB(dbPath);
  if (notFound) return null;
  if (encrypted) return { encrypted: true, client: id, date: `${fromDate} ~ ${toDate}` };
  try {
    const rows = queryRange(db, startMs, endMs);
    const { total, byModel, byProject, byProvider } = aggregateMessages(rows);
    return { total, byModel, byProject, byProvider, date: `${fromDate} ~ ${toDate}`, client: id };
  } finally {
    db.close();
  }
}

export function getEncryptionNote() {
  return _encryptionNote;
}
export function close() {}
