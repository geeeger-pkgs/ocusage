import initSqlJs from "sql.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { basename } from "node:path";

const DEFAULT_DB_PATH = join(
  process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"),
  "opencode",
  "opencode.db"
);

export async function openDB(dbPath) {
  const path = dbPath || DEFAULT_DB_PATH;
  if (!existsSync(path)) {
    console.error(`Database not found: ${path}`);
    console.error(
      `Make sure OpenCode is installed and has been used at least once.`
    );
    process.exit(1);
  }
  const SQL = await initSqlJs();
  const buffer = readFileSync(path);
  return new SQL.Database(buffer);
}

function queryAll(db, sql, params) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function getDailyStats(db, dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  const [y, m, d] = date.split("-").map(Number);
  const startMs = Date.UTC(y, m - 1, d, 0, 0, 0);
  const endMs = Date.UTC(y, m - 1, d, 23, 59, 59, 999);

  const messages = queryAll(
    db,
    `SELECT m.id, m.data, s.directory
     FROM message m
     LEFT JOIN session s ON m.session_id = s.id
     WHERE m.time_created >= ? AND m.time_created <= ?`,
    [startMs, endMs]
  );

  const parts = queryAll(
    db,
    `SELECT p.message_id, p.data
     FROM part p
     WHERE p.time_created >= ? AND p.time_created <= ?`,
    [startMs, endMs]
  );

  const toolCallCount = new Map();
  for (const part of parts) {
    try {
      const d = JSON.parse(part.data);
      if (d.type === "tool") {
        toolCallCount.set(
          part.message_id,
          (toolCallCount.get(part.message_id) || 0) + 1
        );
      }
    } catch { /* skip malformed part data */ }
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

  return { total, byModel, byProject, byProvider, date };
}
