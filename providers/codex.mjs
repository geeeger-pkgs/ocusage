/**
 * Codex provider — reads from ~/.codex/sessions/ JSONL rollout files.
 *
 * Codex stores conversation data as JSONL rollout files:
 *   - session_meta: session metadata (model, cwd, etc.)
 *   - token_count events: token usage with total_token_usage and last_token_usage
 *     - input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens
 *   - response_item:function_call: tool call events
 *
 * Data path: ~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-*.jsonl
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { EMPTY_STAT, validateDate } from "./base.mjs";

const DEFAULT_CODEX_DIR = join(homedir(), ".codex");
const CONFIG_TOML = join(DEFAULT_CODEX_DIR, "config.toml");

/**
 * Read model name from config.toml.
 * Cached after first call.
 */
let _cachedModel = null;
function getModelFromConfig() {
  if (_cachedModel !== null) return _cachedModel;
  _cachedModel = "unknown";

  try {
    const content = readFileSync(CONFIG_TOML, "utf-8");
    const match = content.match(/^model\s*=\s*"([^"]+)"/m);
    if (match) {
      _cachedModel = match[1];
    }
  } catch {
    // config.toml not found — fallback to "unknown"
  }

  return _cachedModel;
}

export const name = "Codex";
export const id = "codex";

export function detect(customPath) {
  const dir = customPath || DEFAULT_CODEX_DIR;
  if (existsSync(dir)) {
    const sessionsDir = join(dir, "sessions");
    if (existsSync(sessionsDir)) {
      return dir;
    }
  }
  return null;
}

/**
 * Find all JSONL rollout files for a date range.
 */
function findRolloutFiles(dir, startDate, endDate) {
  const results = [];
  if (!existsSync(dir)) return results;

  const sessionsDir = join(dir, "sessions");
  if (!existsSync(sessionsDir)) return results;

  try {
    // Parse date range to iterate year/month/day directories
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);
    const current = new Date(start);

    while (current <= end) {
      const year = current.getUTCFullYear();
      const month = String(current.getUTCMonth() + 1).padStart(2, "0");
      const day = String(current.getUTCDate()).padStart(2, "0");
      const dayDir = join(sessionsDir, String(year), month, day);

      if (existsSync(dayDir)) {
        const files = readdirSync(dayDir);
        for (const f of files) {
          if (f.startsWith("rollout-") && f.endsWith(".jsonl")) {
            results.push(join(dayDir, f));
          }
        }
      }

      // Move to next day
      current.setUTCDate(current.getUTCDate() + 1);
    }
  } catch {
    // Permission issues, etc. — skip
  }
  return results;
}

/**
 * Parse a JSONL rollout file and extract stats.
 */
function parseRolloutFile(file) {
  let content;
  try {
    content = readFileSync(file, "utf-8");
  } catch {
    return null;
  }

  const lines = content.split("\n");
  let model = "unknown";
  let cwd = "(unknown)";
  let lastTokenUsage = null;
  let toolCalls = 0;
  let requestCount = 0;
  let timestamp = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    // Extract session metadata
    if (event.type === "session_meta") {
      const payload = event.payload;
      model = payload?.model || model;
      cwd = payload?.cwd || cwd;
      timestamp = event.timestamp;
    }

    // Count token_count events as requests (each is a turn/response)
    if (event.type === "event_msg" && event.payload?.type === "token_count") {
      requestCount++;
      lastTokenUsage = event.payload.info?.total_token_usage;
      if (!timestamp) timestamp = event.timestamp;
    }

    // Count tool calls (function_call events)
    if (event.type === "response_item" && event.payload?.type === "function_call") {
      toolCalls++;
    }
  }

  if (!lastTokenUsage) return null;

  return {
    model,
    cwd,
    toolCalls,
    requestCount,
    timestamp,
    usage: lastTokenUsage,
  };
}

/**
 * Parse all rollout files and aggregate stats for the given date range.
 */
function aggregateFromFiles(files, startDate, endDate) {
  const total = EMPTY_STAT();
  const byModel = new Map();
  const byProject = new Map();
  const byProvider = new Map();

  for (const file of files) {
    const result = parseRolloutFile(file);
    if (!result) continue;

    // Check date
    const eventDate = result.timestamp ? new Date(result.timestamp).toISOString().slice(0, 10) : null;
    if (eventDate && (eventDate < startDate || eventDate > endDate)) continue;

    const inputTokens = result.usage.input_tokens || 0;
    const outputTokens = result.usage.output_tokens || 0;
    const cacheRead = result.usage.cached_input_tokens || 0;
    const cacheWrite = 0; // Codex doesn't expose cache write separately
    // cached_input_tokens is a subset of input_tokens, don't double-add
    const totalTokens = result.usage.total_tokens || inputTokens + outputTokens;

    // Model name — use config.toml fallback if session_meta doesn't have it
    const rawModel = result.model === "unknown" ? getModelFromConfig() : result.model;
    const modelName = rawModel.replace(/^o(\d)/, "$1");
    const modelKey = `${modelName} (codex)`;

    // Project name from cwd
    let projectName = "(unknown)";
    if (result.cwd) {
      const cwdParts = result.cwd.replace(/\\/g, "/");
      const lastSlash = cwdParts.lastIndexOf("/");
      projectName = lastSlash !== -1 ? cwdParts.slice(lastSlash + 1) : cwdParts;
    }

    total.requests += result.requestCount;
    total.inputTokens += inputTokens;
    total.outputTokens += outputTokens;
    total.toolCalls += result.toolCalls;
    total.cacheRead += cacheRead;
    total.cacheWrite += cacheWrite;
    total.totalTokens += totalTokens;

    for (const [map, key] of [
      [byModel, modelKey],
      [byProject, projectName],
      [byProvider, "codex"],
    ]) {
      if (!map.has(key)) map.set(key, EMPTY_STAT());
      const s = map.get(key);
      s.requests += result.requestCount;
      s.inputTokens += inputTokens;
      s.outputTokens += outputTokens;
      s.toolCalls += result.toolCalls;
      s.cacheRead += cacheRead;
      s.cacheWrite += cacheWrite;
      s.totalTokens += totalTokens;
    }
  }

  return { total, byModel, byProject, byProvider };
}

export function getDailyStats(codexDir, dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  validateDate(date);
  const dir = codexDir || DEFAULT_CODEX_DIR;
  if (!existsSync(dir)) return null;

  const files = findRolloutFiles(dir, date, date);
  if (files.length === 0) return null;

  const { total, byModel, byProject, byProvider } = aggregateFromFiles(files, date, date);
  return { total, byModel, byProject, byProvider, date, client: id };
}

export function getDateRangeStats(codexDir, fromDate, toDate) {
  validateDate(fromDate);
  validateDate(toDate);

  if (fromDate > toDate) {
    throw new Error(`Start date ${fromDate} is after end date ${toDate}`);
  }

  const dir = codexDir || DEFAULT_CODEX_DIR;
  if (!existsSync(dir)) return null;

  const files = findRolloutFiles(dir, fromDate, toDate);
  if (files.length === 0) return null;

  const { total, byModel, byProject, byProvider } = aggregateFromFiles(files, fromDate, toDate);
  return { total, byModel, byProject, byProvider, date: `${fromDate} ~ ${toDate}`, client: id };
}

export function close() {
  // No-op: file-based provider, no resources to release
}
