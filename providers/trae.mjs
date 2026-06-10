/**
 * Trae IDE provider — reads from the Trae IDE database.
 *
 * Trae IDE uses the SAME schema as Qoder (shared codebase), but the database
 * is encrypted with SQLCipher 4.
 *
 * Flow:
 *   1. Try to open the database directly with node:sqlite
 *   2. If encrypted:
 *      a. Check config for stored encryption key
 *      b. If key found, decrypt to temp file and open that
 *      c. If no key or decryption fails, try extracting key from process memory
 *      d. On success, persist key in config, decrypt, and open
 *
 * Path: %APPDATA%/Trae/ModularData/ai-agent/database.db
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getEncryptionKey, setEncryptionKey } from "../config.mjs";
import { EMPTY_STAT, validateDate } from "./base.mjs";
import { cleanupDecrypted, decryptDatabase, readFirstPage, verifyEncKey } from "./helpers/trae-crypto.mjs";
import { extractTraeKey } from "./helpers/trae-key-extract.mjs";

const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";

function getDefaultDBPath() {
  if (isWindows) {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(appData, "Trae", "ModularData", "ai-agent", "database.db");
  }
  if (isMac) {
    return join(homedir(), "Library", "Application Support", "Trae", "ModularData", "ai-agent", "database.db");
  }
  // Linux
  const configDir = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(configDir, "Trae", "ModularData", "ai-agent", "database.db");
}

export const name = "Trae";
export const id = "trae";

let _encryptionNote = null;
let _tempDbPath = null; // 当前 session 解密的临时文件，关闭时清理

export function detect(customPath) {
  const path = customPath || getDefaultDBPath();
  if (existsSync(path)) return path;
  return null;
}

/**
 * 尝试用给定密钥解密数据库并打开。
 * @param {string} dbPath
 * @param {Buffer} encKeyBuf
 * @returns {{ db: DatabaseSync|null, error: string|null }}
 */
function tryDecryptAndOpen(dbPath, encKeyBuf) {
  try {
    // 验证密钥
    const page1 = readFirstPage(dbPath);
    if (!page1) return { db: null, error: "无法读取数据库文件" };
    if (!verifyEncKey(encKeyBuf, page1)) return { db: null, error: "密钥无效" };

    // 解密到临时文件
    _tempDbPath = decryptDatabase(encKeyBuf, dbPath);

    // 打开解密后的数据库
    const db = new DatabaseSync(_tempDbPath);
    db.prepare("SELECT count(*) AS cnt FROM chat_message LIMIT 1").get();
    return { db, error: null };
  } catch (err) {
    _encryptionNote = err.message;
    cleanupDecrypted(_tempDbPath);
    _tempDbPath = null;
    return { db: null, error: err.message };
  }
}

function tryOpenDB(dbPath) {
  const path = dbPath || getDefaultDBPath();
  if (!existsSync(path)) return { db: null, encrypted: false, notFound: true };

  // 1. 直接打开（可能未加密或已经是解密文件）
  try {
    const db = new DatabaseSync(path);
    db.prepare("SELECT count(*) AS cnt FROM chat_message LIMIT 1").get();
    return { db, encrypted: false, notFound: false };
  } catch (err) {
    _encryptionNote = err.message;
    // 加密了，继续尝试解密
  }

  // 2. 尝试从配置文件读取密钥
  const storedKey = getEncryptionKey(id);
  if (storedKey) {
    try {
      const keyBuf = Buffer.from(storedKey, "hex");
      const { db, error } = tryDecryptAndOpen(path, keyBuf);
      if (db) {
        return { db, encrypted: true, notFound: false, decrypted: true };
      }
      // 密钥失效，清除并继续尝试提取
      _encryptionNote = error;
      setEncryptionKey(id, null); // 清空失效密钥
    } catch {
      // 密钥解析失败，忽略
    }
  }

  // 3. 尝试从进程内存提取密钥（仅 Windows）
  const { key, error: extractErr } = extractTraeKey(path);
  if (!key) {
    _encryptionNote = extractErr || "无法提取解密密钥，请确保 Trae 正在运行";
    return { db: null, encrypted: true, notFound: false };
  }

  // 4. 用提取的密钥解密
  try {
    const keyBuf = Buffer.from(key, "hex");
    const { db, error } = tryDecryptAndOpen(path, keyBuf);
    if (db) {
      // 持久化密钥
      setEncryptionKey(id, key);
      return { db, encrypted: true, notFound: false, decrypted: true };
    }
    _encryptionNote = error || "解密失败";
    return { db: null, encrypted: true, notFound: false };
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
    // Trae stores token usage in chat_turn.context JSON, not in chat_message
    let context = null;
    try {
      context = row.context ? JSON.parse(row.context) : null;
    } catch {
      continue;
    }
    if (!context?.token_usage) continue;

    const tu = context.token_usage;
    const inputTokens = tu.prompt_tokens || 0;
    const outputTokens = tu.completion_tokens || 0;
    const cacheRead = tu.cache_read_input_tokens || 0;
    const cacheWrite = tu.cache_creation_input_tokens || 0;
    const totalTokens = tu.total_tokens || inputTokens + outputTokens;

    // Skip rows with no actual usage
    if (inputTokens === 0 && outputTokens === 0) continue;

    // Model info is in context.persist_user_message_context.model_info
    const modelCtx = context.persist_user_message_context;
    let modelKey = "unknown";
    if (modelCtx?.model_info) {
      const mi = modelCtx.model_info;
      const configName = mi.config_name || mi.model_key || "unknown";
      // Trae does not store a provider field; infer from model name pattern
      modelKey = `${configName}(trae)`;
    }

    // Project name: use directory name from project_path, fallback to session title
    let projectName = "(global)";
    if (row.project_path) {
      projectName = basename(row.project_path);
    } else if (row.session_title) {
      projectName = row.session_title;
    }

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
      [byProvider, "trae"],
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

function queryRange(db, startSec, endSec) {
  // Trae uses created_at as Unix SECONDS (not milliseconds)
  // Use absolute_path from project table, fallback to session_title
  return db
    .prepare(
      `SELECT ct.context,
              p.absolute_path AS project_path,
              cs.session_title AS session_title
     FROM chat_turn ct
     LEFT JOIN chat_session cs ON ct.session_id = cs.session_id
     LEFT JOIN project p ON cs.project_id = p.project_id
     WHERE ct.created_at >= ? AND ct.created_at <= ?`,
    )
    .all(startSec, endSec);
}

export function getDailyStats(dbPath, dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  validateDate(date);
  const [y, m, d] = date.split("-").map(Number);
  // Trae uses Unix seconds, not milliseconds
  const startSec = Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1000);
  const endSec = Math.floor(Date.UTC(y, m - 1, d, 23, 59, 59, 999) / 1000);
  const { db, notFound } = tryOpenDB(dbPath);
  if (notFound) return null;
  if (!db) return { encrypted: true, client: id, date };
  try {
    const rows = queryRange(db, startSec, endSec);
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
  const startSec = Math.floor(Date.UTC(fy, fm - 1, fd, 0, 0, 0) / 1000);
  const endSec = Math.floor(Date.UTC(ty, tm - 1, td, 23, 59, 59, 999) / 1000);
  if (startSec > endSec) throw new Error(`Start date ${fromDate} is after end date ${toDate}`);
  const { db, notFound } = tryOpenDB(dbPath);
  if (notFound) return null;
  if (!db) return { encrypted: true, client: id, date: `${fromDate} ~ ${toDate}` };
  try {
    const rows = queryRange(db, startSec, endSec);
    const { total, byModel, byProject, byProvider } = aggregateMessages(rows);
    return { total, byModel, byProject, byProvider, date: `${fromDate} ~ ${toDate}`, client: id };
  } finally {
    db.close();
  }
}

export function getEncryptionNote() {
  return _encryptionNote;
}

export function close() {
  // 清理解密临时文件
  if (_tempDbPath) {
    cleanupDecrypted(_tempDbPath);
    _tempDbPath = null;
  }
}
