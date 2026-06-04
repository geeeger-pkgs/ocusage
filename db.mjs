import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { basename } from "node:path";

const DEFAULT_DB_PATH = join(
  process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"),
  "opencode",
  "opencode.db"
);

export function openDB(dbPath) {
  const path = dbPath || DEFAULT_DB_PATH;
  if (!existsSync(path)) {
    console.error(`Database not found: ${path}`);
    console.error(
      `Make sure OpenCode is installed and has been used at least once.`
    );
    process.exit(1);
  }
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL");
  return db;
}

export function validateDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`日期格式无效: "${dateStr}"，请使用 YYYY-MM-DD 格式`);
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  const testDate = new Date(Date.UTC(y, m - 1, d));
  if (testDate.getUTCFullYear() !== y || testDate.getUTCMonth() !== m - 1 || testDate.getUTCDate() !== d) {
    throw new Error(`日期不存在: "${dateStr}"`);
  }
  return dateStr;
}

function _aggregateRows(rows) {
  const toolCallCount = new Map();
  const seenMessages = new Set();
  const messages = [];

  for (const row of rows) {
    // Count tool calls from parts
    if (row.part_data != null) {
      try {
        const d = JSON.parse(row.part_data);
        if (d.type === "tool") {
          toolCallCount.set(
            row.id,
            (toolCallCount.get(row.id) || 0) + 1
          );
        }
      } catch { /* skip malformed part data */ }
    }

    // Deduplicate messages (one message may have multiple parts)
    if (!seenMessages.has(row.id)) {
      seenMessages.add(row.id);
      messages.push({ id: row.id, data: row.data, directory: row.directory });
    }
  }

  const emptyStat = () => ({
    requests: 0, inputTokens: 0, outputTokens: 0, toolCalls: 0,
    cacheRead: 0, cacheWrite: 0, totalTokens: 0,
  });

  const total = emptyStat();
  const byModel = new Map();
  const byProject = new Map();
  const byProvider = new Map();

  for (const msg of messages) {
    let data;
    try {
      data = JSON.parse(msg.data);
    } catch { continue; }

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
      if (!map.has(key)) map.set(key, emptyStat());
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
       WHERE m.time_created >= ? AND m.time_created <= ?`
    )
    .all(startMs, endMs, startMs, endMs);
}

export function getDailyStats(db, dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  validateDate(date);
  const [y, m, d] = date.split("-").map(Number);
  const startMs = Date.UTC(y, m - 1, d, 0, 0, 0);
  const endMs = Date.UTC(y, m - 1, d, 23, 59, 59, 999);

  const rows = _queryRange(db, startMs, endMs);
  const { total, byModel, byProject, byProvider } = _aggregateRows(rows);
  return { total, byModel, byProject, byProvider, date };
}

export function getDateRangeStats(db, fromDate, toDate) {
  validateDate(fromDate);
  validateDate(toDate);

  const [fy, fm, fd] = fromDate.split("-").map(Number);
  const [ty, tm, td] = toDate.split("-").map(Number);
  const startMs = Date.UTC(fy, fm - 1, fd, 0, 0, 0);
  const endMs = Date.UTC(ty, tm - 1, td, 23, 59, 59, 999);

  if (startMs > endMs) {
    throw new Error(`起始日期不能晚于结束日期: ${fromDate} > ${toDate}`);
  }

  const rows = _queryRange(db, startMs, endMs);
  const { total, byModel, byProject, byProvider } = _aggregateRows(rows);
  return { total, byModel, byProject, byProvider, date: `${fromDate} ~ ${toDate}` };
}
