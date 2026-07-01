/**
 * WorkBuddy provider — reads from ~/.workbuddy/ JSONL session files and SQLite database.
 *
 * WorkBuddy stores conversation data as JSONL files:
 *   - Each line is a JSON object representing a conversation event
 *   - type: "message" with role: "assistant" contain providerData.usage with token data
 *   - providerData.usage.inputTokens — input token count
 *   - providerData.usage.outputTokens — output token count
 *   - providerData.usage.totalTokens — total token count
 *   - providerData.model — model name (e.g. "custom-local:deepseek-v4-flash")
 *   - timestamp — Unix milliseconds
 *   - cwd — project directory path
 *
 * SQLite database (~/.workbuddy/workbuddy.db):
 *   - sessions table: session metadata (id, model, cwd, created_at, updated_at)
 *   - session_usage table: total usage per session (used, size, credit_json)
 *
 * Data path: ~/.workbuddy/projects/<project-hash>/<session-id>.jsonl
 * DB path: ~/.workbuddy/workbuddy.db
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { EMPTY_STAT, validateDate } from "./base.mjs";

const DEFAULT_WORKBUDDY_DIR = join(homedir(), ".workbuddy");
const MODELS_JSON = join(DEFAULT_WORKBUDDY_DIR, "models.json");

/**
 * Extract provider name from a URL's domain.
 * e.g. "https://apihub.agnes-ai.com/v1" → "agnes-ai"
 *      "https://opencode.ai/zen/v1" → "opencode"
 */
function extractProviderFromUrl(url) {
  try {
    const { hostname } = new URL(url);
    const parts = hostname.replace(/^www\./, "").split(".");
    // Take the second-level domain (e.g. "agnes-ai" from "apihub.agnes-ai.com")
    if (parts.length >= 2) {
      return parts[parts.length - 2];
    }
    return parts[0];
  } catch {
    return null;
  }
}

/**
 * Load models.json and build a modelId → provider name mapping.
 * Cached after first call.
 */
let _modelProviderMap = null;
function getModelProviderMap() {
  if (_modelProviderMap) return _modelProviderMap;
  _modelProviderMap = new Map();

  try {
    const models = JSON.parse(readFileSync(MODELS_JSON, "utf-8"));
    for (const model of models) {
      if (model.id && model.url) {
        const provider = extractProviderFromUrl(model.url);
        if (provider) {
          _modelProviderMap.set(model.id, provider);
        }
      }
    }
  } catch {
    // models.json not found or invalid — fallback to "workbuddy"
  }

  return _modelProviderMap;
}

/**
 * Resolve provider name for a custom-local model.
 * Strips "custom-local:" prefix, looks up models.json, extracts domain.
 * Returns the provider name or "workbuddy" as fallback.
 */
function resolveProvider(modelId) {
  const stripped = modelId.replace(/^custom-local:/, "");
  const map = getModelProviderMap();
  return map.get(stripped) || "workbuddy";
}

export const name = "WorkBuddy";
export const id = "workbuddy";

export function detect(customPath) {
  const dir = customPath || DEFAULT_WORKBUDDY_DIR;
  if (existsSync(dir)) {
    const projectsDir = join(dir, "projects");
    if (existsSync(projectsDir)) {
      return dir;
    }
  }
  return null;
}

/**
 * Recursively find all .jsonl files under the projects directory.
 */
function findJsonlFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findJsonlFiles(fullPath));
      } else if (entry.name.endsWith(".jsonl")) {
        results.push(fullPath);
      }
    }
  } catch {
    // Permission issues, etc. — skip
  }
  return results;
}

/**
 * Convert Unix milliseconds to UTC date string (YYYY-MM-DD).
 */
function msToUTCDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Convert a date string to start/end Unix ms for SQLite queries.
 */
function dateToMsRange(dateStr) {
  const start = new Date(`${dateStr}T00:00:00.000Z`).getTime();
  const end = new Date(`${dateStr}T23:59:59.999Z`).getTime();
  return { start, end };
}

/**
 * Query SQLite database for session usage stats in a date range.
 * Returns { total, byModel, byProject, byProvider } or null if no data.
 */
function aggregateFromDb(dbPath, startDate, endDate) {
  if (!existsSync(dbPath)) return null;

  let db;
  try {
    db = new DatabaseSync(dbPath);
  } catch {
    return null;
  }

  try {
    const { start } = dateToMsRange(startDate);
    const { end } = dateToMsRange(endDate);

    const rows = db
      .prepare(
        `SELECT s.id, s.model, s.cwd, s.created_at, u.used, u.credit_json
         FROM sessions s
         JOIN session_usage u ON s.id = u.session_id
         WHERE s.created_at >= ? AND s.created_at <= ?
         AND u.used > 0`,
      )
      .all(start, end);

    if (rows.length === 0) return null;

    const total = EMPTY_STAT();
    const byModel = new Map();
    const byProject = new Map();
    const byProvider = new Map();

    for (const row of rows) {
      const used = row.used || 0;
      if (used === 0) continue;

      // Model and provider
      const modelRaw = row.model || "unknown";
      const modelName = modelRaw.replace(/^custom-local:/, "");
      const providerName = resolveProvider(modelRaw);
      const modelKey = `${modelName} (${providerName})`;

      // Project name from cwd
      let projectName = "(unknown)";
      if (row.cwd) {
        const cwdParts = row.cwd.replace(/\\/g, "/");
        const lastSlash = cwdParts.lastIndexOf("/");
        projectName = lastSlash !== -1 ? cwdParts.slice(lastSlash + 1) : cwdParts;
      }

      total.requests++;
      total.totalTokens += used;

      for (const [map, key] of [
        [byModel, modelKey],
        [byProject, projectName],
        [byProvider, providerName],
      ]) {
        if (!map.has(key)) map.set(key, EMPTY_STAT());
        const s = map.get(key);
        s.requests++;
        s.totalTokens += used;
      }
    }

    return { total, byModel, byProject, byProvider };
  } finally {
    try {
      db?.close();
    } catch {
      // ignore
    }
  }
}

/**
 * Parse all JSONL files and aggregate stats for the given date range.
 */
function aggregateFromFiles(files, startDate, endDate) {
  const total = EMPTY_STAT();
  const byModel = new Map();
  const byProject = new Map();
  const byProvider = new Map();

  for (const file of files) {
    let content;
    try {
      content = readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;

      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }

      // Determine timestamp (Unix ms)
      const timestamp = event.timestamp;
      if (!timestamp) continue;
      const eventDate = msToUTCDate(timestamp);

      // Filter by date range
      if (eventDate < startDate || eventDate > endDate) continue;

      // Project name from cwd
      let projectName = "(unknown)";
      const cwd = event.cwd;
      if (cwd) {
        const cwdParts = cwd.replace(/\\/g, "/");
        const lastSlash = cwdParts.lastIndexOf("/");
        projectName = lastSlash !== -1 ? cwdParts.slice(lastSlash + 1) : cwdParts;
      }

      // Model and provider from providerData
      const modelRaw = event.providerData?.model || "unknown";
      const modelName = modelRaw.replace(/^custom-local:/, "");
      const providerName = resolveProvider(modelRaw);
      const modelKey = `${modelName} (${providerName})`;

      // Count tool calls from function_call events
      if (event.type === "function_call") {
        const pd = event.providerData;
        const tcModelRaw = pd?.model || modelRaw;
        const tcModelName = tcModelRaw.replace(/^custom-local:/, "");
        const tcProviderName = resolveProvider(tcModelRaw);
        const tcModelKey = `${tcModelName} (${tcProviderName})`;

        total.toolCalls++;
        if (!byModel.has(tcModelKey)) byModel.set(tcModelKey, EMPTY_STAT());
        byModel.get(tcModelKey).toolCalls++;
        if (!byProject.has(projectName)) byProject.set(projectName, EMPTY_STAT());
        byProject.get(projectName).toolCalls++;
        if (!byProvider.has(tcProviderName)) byProvider.set(tcProviderName, EMPTY_STAT());
        byProvider.get(tcProviderName).toolCalls++;
        continue;
      }

      // Only process assistant messages with usage data
      if (event.type !== "message" || event.role !== "assistant") continue;
      if (!event.providerData?.usage) continue;

      const usage = event.providerData.usage;
      const rawUsage = event.providerData.rawUsage || {};
      const inputTokens = usage.inputTokens || 0;
      const outputTokens = usage.outputTokens || 0;
      if (inputTokens === 0 && outputTokens === 0) continue;

      // Cache: read from inputTokensDetails or rawUsage
      const cacheRead =
        usage.inputTokensDetails?.[0]?.cached_tokens ||
        rawUsage.prompt_tokens_details?.cached_tokens ||
        rawUsage.cache_read_input_tokens ||
        0;
      const cacheWrite = rawUsage.cache_creation_input_tokens || 0;
      const totalTokens = inputTokens + outputTokens + cacheRead + cacheWrite;

      total.requests++;
      total.inputTokens += inputTokens;
      total.outputTokens += outputTokens;
      total.cacheRead += cacheRead;
      total.cacheWrite += cacheWrite;
      total.totalTokens += totalTokens;

      for (const [map, key] of [
        [byModel, modelKey],
        [byProject, projectName],
        [byProvider, providerName],
      ]) {
        if (!map.has(key)) map.set(key, EMPTY_STAT());
        const s = map.get(key);
        s.requests++;
        s.inputTokens += inputTokens;
        s.outputTokens += outputTokens;
        s.cacheRead += cacheRead;
        s.cacheWrite += cacheWrite;
        s.totalTokens += totalTokens;
      }
    }
  }

  return { total, byModel, byProject, byProvider };
}

export function getDailyStats(workbuddyDir, dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  validateDate(date);
  const dir = workbuddyDir || DEFAULT_WORKBUDDY_DIR;
  if (!existsSync(dir)) return null;

  // Primary: JSONL files (detailed input/output/cache/tool call breakdown)
  const projectsDir = join(dir, "projects");
  const files = findJsonlFiles(projectsDir);
  if (files.length > 0) {
    const { total, byModel, byProject, byProvider } = aggregateFromFiles(files, date, date);
    return { total, byModel, byProject, byProvider, date, client: id };
  }

  // Fallback: SQLite database (total tokens only)
  const dbPath = join(dir, "workbuddy.db");
  const dbResult = aggregateFromDb(dbPath, date, date);
  if (dbResult) {
    return { ...dbResult, date, client: id };
  }

  return null;
}

export function getDateRangeStats(workbuddyDir, fromDate, toDate) {
  validateDate(fromDate);
  validateDate(toDate);

  if (fromDate > toDate) {
    throw new Error(`Start date ${fromDate} is after end date ${toDate}`);
  }

  const dir = workbuddyDir || DEFAULT_WORKBUDDY_DIR;
  if (!existsSync(dir)) return null;

  // Primary: JSONL files (detailed input/output/cache/tool call breakdown)
  const projectsDir = join(dir, "projects");
  const files = findJsonlFiles(projectsDir);
  if (files.length > 0) {
    const { total, byModel, byProject, byProvider } = aggregateFromFiles(files, fromDate, toDate);
    return { total, byModel, byProject, byProvider, date: `${fromDate} ~ ${toDate}`, client: id };
  }

  // Fallback: SQLite database (total tokens only)
  const dbPath = join(dir, "workbuddy.db");
  const dbResult = aggregateFromDb(dbPath, fromDate, toDate);
  if (dbResult) {
    return { ...dbResult, date: `${fromDate} ~ ${toDate}`, client: id };
  }

  return null;
}

export function close() {
  // No-op: file-based provider, no resources to release
}
