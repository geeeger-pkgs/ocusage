/**
 * Base provider interface for AI client token usage data.
 *
 * Each provider must implement:
 *   - name: string           — Human-readable client name
 *   - id: string             — Unique identifier for CLI flags
 *   - detect(): string|null  — Return data path if client is installed & has data, else null
 *   - getDailyStats(dateStr): StatsResult
 *   - getDateRangeStats(from, to): StatsResult
 *   - close(): void          — Release any resources (DB handles, etc.)
 *
 * StatsResult shape:
 *   {
 *     total:    { requests, inputTokens, outputTokens, toolCalls, cacheRead, cacheWrite, totalTokens },
 *     byModel:  Map<string, StatEntry>,
 *     byProject: Map<string, StatEntry>,
 *     byProvider: Map<string, StatEntry>,
 *     date: string,
 *     client: string  — provider id
 *   }
 */

import { existsSync } from "node:fs";
import { basename } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const EMPTY_STAT = () => ({
  requests: 0,
  inputTokens: 0,
  outputTokens: 0,
  toolCalls: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
});

/**
 * Check if a stat entry is all zeros.
 */
export function isAllZero(s) {
  return (
    s.requests === 0 &&
    s.inputTokens === 0 &&
    s.outputTokens === 0 &&
    s.toolCalls === 0 &&
    s.cacheRead === 0 &&
    s.cacheWrite === 0 &&
    s.totalTokens === 0
  );
}

/**
 * Add two stat entries together (mutates and returns a).
 */
export function addStat(a, b) {
  a.requests += b.requests;
  a.inputTokens += b.inputTokens;
  a.outputTokens += b.outputTokens;
  a.toolCalls += b.toolCalls;
  a.cacheRead += b.cacheRead;
  a.cacheWrite += b.cacheWrite;
  a.totalTokens += b.totalTokens;
  return a;
}

/**
 * Open a SQLite database with WAL mode.
 * Returns null if the path does not exist.
 */
export function openDB(path) {
  if (!path || !existsSync(path)) return null;
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL");
  return db;
}

/**
 * Query message+part rows within a time range.
 * Shared by OpenCode and MiMoCode providers (same schema).
 */
export function queryMessageRange(db, startMs, endMs) {
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

/**
 * Aggregate message+part rows into stat maps.
 * Shared by OpenCode and MiMoCode providers (same schema).
 */
export function aggregateRows(rows) {
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

/**
 * Validate a date string (YYYY-MM-DD) and return it.
 * Throws on invalid format.
 */
export function validateDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  const testDate = new Date(Date.UTC(y, m - 1, d));
  if (testDate.getUTCFullYear() !== y || testDate.getUTCMonth() !== m - 1 || testDate.getUTCDate() !== d) {
    throw new Error(`Date does not exist: ${dateStr}`);
  }
  return dateStr;
}

/**
 * Format a Date object as a local-time YYYY-MM-DD string.
 */
function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Resolve a date alias to a single date or a date range.
 *
 * Supported aliases (case-insensitive):
 *   - today       → { type: 'single', date }
 *   - yesterday   → { type: 'single', date }
 *   - week        → { type: 'range', from: monday, to: today }
 *   - month       → { type: 'range', from: first-of-month, to: today }
 *   - last-week   → { type: 'range', from: last-monday, to: last-sunday }
 *   - last-month  → { type: 'range', from: first-of-last-month, to: last-of-last-month }
 *
 * Returns null when the input is not a recognized alias
 * (callers should fall back to existing date/period parsing).
 */
export function resolveDateAlias(input, now = new Date()) {
  if (typeof input !== "string") return null;
  const key = input.trim().toLowerCase();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (key) {
    case "today":
      return { type: "single", date: formatLocalDate(today) };
    case "yesterday": {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      return { type: "single", date: formatLocalDate(d) };
    }
    case "week": {
      const mon = new Date(today);
      const day = mon.getDay();
      mon.setDate(mon.getDate() - (day === 0 ? 6 : day - 1));
      return { type: "range", from: formatLocalDate(mon), to: formatLocalDate(today) };
    }
    case "month": {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { type: "range", from: formatLocalDate(first), to: formatLocalDate(today) };
    }
    case "last-week": {
      const mon = new Date(today);
      const day = mon.getDay();
      mon.setDate(mon.getDate() - (day === 0 ? 6 : day - 1) - 7);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { type: "range", from: formatLocalDate(mon), to: formatLocalDate(sun) };
    }
    case "last-month": {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { type: "range", from: formatLocalDate(first), to: formatLocalDate(last) };
    }
    default:
      return null;
  }
}

/**
 * Parse a period string (YYYY-MM or YYYY-MM-DD) into {from, to}.
 */
export function parsePeriod(period) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    validateDate(period);
    return { from: period, to: period };
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number);
    if (m < 1 || m > 12) {
      throw new Error(`Invalid period: ${period}`);
    }
    const from = `${period}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const to = `${period}-${String(lastDay).padStart(2, "0")}`;
    return { from, to };
  }
  throw new Error(`Invalid period: ${period}`);
}
