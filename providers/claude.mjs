/**
 * Claude Code provider — reads from ~/.claude/projects/ jsonl glob files.
 *
 * Claude Code stores conversation data as JSONL files:
 *   - Each line is a JSON object representing a conversation event
 *   - type: "assistant" messages contain a `usage` field with token data
 *   - `usage.input_tokens` — input token count
 *   - `usage.output_tokens` — output token count
 *   - `usage.cache_creation_input_tokens` — tokens written to cache
 *   - `usage.cache_read_input_tokens` — tokens read from cache
 *   - `message.model` — model name (e.g. "glm-5.1", "deepseek-v4-pro")
 *   - `timestamp` — ISO 8601 string
 *   - `cwd` — project directory path
 *
 * Data path: ~/.claude/projects/<project-dir>/*.jsonl
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { EMPTY_STAT, validateDate } from "./base.mjs";

const DEFAULT_CLAUDE_DIR = join(homedir(), ".claude");
const CC_SWITCH_DB = join(homedir(), ".cc-switch", "cc-switch.db");
const CLAUDE_SETTINGS = join(homedir(), ".claude", "settings.json");

/**
 * Extract provider name from a base URL.
 * e.g. "https://api.deepseek.com/anthropic" → "deepseek"
 * Returns null if the URL cannot be parsed.
 */
function extractProviderFromUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    const hostname = url.hostname;
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      const filtered = parts.filter((p) => p !== "api" && p !== "www");
      return filtered[0] || parts[0];
    }
    return hostname;
  } catch {
    return null;
  }
}

/**
 * Priority 1: Query cc-switch database for current active claude provider.
 * Returns provider name (lowercase) or null.
 */
function getProviderFromCcSwitch() {
  if (!existsSync(CC_SWITCH_DB)) return null;

  let db;
  try {
    db = new DatabaseSync(CC_SWITCH_DB);
    const row = db
      .prepare(
        "SELECT pe.url, p.name " +
          "FROM providers p " +
          "JOIN provider_endpoints pe ON pe.provider_id = p.id AND pe.app_type = p.app_type " +
          "WHERE p.app_type = 'claude' AND p.is_current = 1 " +
          "LIMIT 1",
      )
      .get();
    if (!row) return null;
    // Prefer provider name (lowercase), fall back to URL extraction
    if (row.name) return row.name.toLowerCase();
    if (row.url) return extractProviderFromUrl(row.url);
    return null;
  } catch {
    return null;
  } finally {
    try {
      db?.close();
    } catch {
      // ignore close errors
    }
  }
}

/**
 * Priority 2: Read ~/.claude/settings.json env.ANTHROPIC_BASE_URL.
 * Returns provider name or null.
 */
function getProviderFromClaudeSettings() {
  if (!existsSync(CLAUDE_SETTINGS)) return null;

  try {
    const content = readFileSync(CLAUDE_SETTINGS, "utf-8");
    const settings = JSON.parse(content);
    const baseUrl = settings?.env?.ANTHROPIC_BASE_URL;
    if (!baseUrl) return null;
    return extractProviderFromUrl(baseUrl);
  } catch {
    return null;
  }
}

/**
 * Resolve provider name with four-level priority:
 *   1. cc-switch database (current active claude provider)
 *   2. ~/.claude/settings.json (env.ANTHROPIC_BASE_URL)
 *   3. Environment variable ANTHROPIC_BASE_URL
 *   4. Default: "anthropic"
 *
 * Result is cached after first call.
 */
let _cachedProvider = null;
function resolveProvider() {
  if (_cachedProvider !== null) return _cachedProvider;

  // Priority 1: cc-switch database
  const ccSwitchProvider = getProviderFromCcSwitch();
  if (ccSwitchProvider) {
    _cachedProvider = ccSwitchProvider;
    return _cachedProvider;
  }

  // Priority 2: ~/.claude/settings.json
  const settingsProvider = getProviderFromClaudeSettings();
  if (settingsProvider) {
    _cachedProvider = settingsProvider;
    return _cachedProvider;
  }

  // Priority 3: Environment variable
  const envUrl = process.env.ANTHROPIC_BASE_URL;
  if (envUrl) {
    const p = extractProviderFromUrl(envUrl);
    if (p) {
      _cachedProvider = p;
      return _cachedProvider;
    }
  }

  // Priority 4: Default
  _cachedProvider = "anthropic";
  return _cachedProvider;
}

export const name = "Claude Code";
export const id = "claude";

export function detect(customPath) {
  const dir = customPath || DEFAULT_CLAUDE_DIR;
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
 * Parse a date string from ISO 8601 format and return UTC date string (YYYY-MM-DD).
 */
function isoToUTCDate(isoStr) {
  const d = new Date(isoStr);
  return d.toISOString().slice(0, 10);
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
    // Extract project name from file path
    // Path format: ~/.claude/projects/C--Users-geeeger-project/session.jsonl
    const pathParts = file.replace(/\\/g, "/");
    const projectsIdx = pathParts.indexOf("/projects/");
    let projectName = "(unknown)";
    if (projectsIdx !== -1) {
      const afterProjects = pathParts.slice(projectsIdx + "/projects/".length);
      const slashIdx = afterProjects.indexOf("/");
      const dirName = slashIdx !== -1 ? afterProjects.slice(0, slashIdx) : afterProjects;
      // Convert "C--Users-geeeger-project" back to readable name
      projectName = dirName.replace(/^C--/, "").replace(/--/g, "/").replace(/-/g, "/");
      // Better: just take the last segment
      const segments = dirName.split("-");
      projectName = segments[segments.length - 1] || dirName;
    }

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

      // Only process assistant messages with usage
      if (event.type !== "assistant") continue;
      if (!event.message?.usage) continue;

      // Skip error messages with zero tokens
      const usage = event.message.usage;
      if (usage.input_tokens === 0 && usage.output_tokens === 0 && !event.message.model) continue;

      // Determine timestamp
      const timestamp = event.timestamp;
      if (!timestamp) continue;
      const eventDate = isoToUTCDate(timestamp);

      // Filter by date range
      if (eventDate < startDate || eventDate > endDate) continue;

      const inputTokens = usage.input_tokens || 0;
      const outputTokens = usage.output_tokens || 0;
      const cacheRead = usage.cache_read_input_tokens || 0;
      const cacheWrite = usage.cache_creation_input_tokens || 0;
      // Claude's total_tokens = input + output (cache tokens are subtractions from input)
      const totalTokens = inputTokens + outputTokens;
      const modelKey = `${event.message.model || "unknown"} (${resolveProvider()})`;

      // Better project name from cwd field if available
      const cwd = event.cwd;
      if (cwd) {
        const cwdParts = cwd.replace(/\\/g, "/");
        const lastSlash = cwdParts.lastIndexOf("/");
        projectName = lastSlash !== -1 ? cwdParts.slice(lastSlash + 1) : cwdParts;
      }

      total.requests++;
      total.inputTokens += inputTokens;
      total.outputTokens += outputTokens;
      total.toolCalls += 0; // Counted separately from tool events, but hard to parse from this format
      total.cacheRead += cacheRead;
      total.cacheWrite += cacheWrite;
      total.totalTokens += totalTokens;

      for (const [map, key] of [
        [byModel, modelKey],
        [byProject, projectName],
        [byProvider, resolveProvider()],
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
  }

  return { total, byModel, byProject, byProvider };
}

export function getDailyStats(claudeDir, dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  validateDate(date);
  const dir = claudeDir || DEFAULT_CLAUDE_DIR;
  if (!existsSync(dir)) return null;

  const projectsDir = join(dir, "projects");
  const files = findJsonlFiles(projectsDir);
  if (files.length === 0) return null;

  const { total, byModel, byProject, byProvider } = aggregateFromFiles(files, date, date);
  return { total, byModel, byProject, byProvider, date, client: id };
}

export function getDateRangeStats(claudeDir, fromDate, toDate) {
  validateDate(fromDate);
  validateDate(toDate);

  if (fromDate > toDate) {
    throw new Error(`Start date ${fromDate} is after end date ${toDate}`);
  }

  const dir = claudeDir || DEFAULT_CLAUDE_DIR;
  if (!existsSync(dir)) return null;

  const projectsDir = join(dir, "projects");
  const files = findJsonlFiles(projectsDir);
  if (files.length === 0) return null;

  const { total, byModel, byProject, byProvider } = aggregateFromFiles(files, fromDate, toDate);
  return { total, byModel, byProject, byProvider, date: `${fromDate} ~ ${toDate}`, client: id };
}

export function close() {
  // No-op: file-based provider, no resources to release
}
