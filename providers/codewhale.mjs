/**
 * CodeWhale provider — reads from ~/.codewhale/sessions/ JSON session files.
 *
 * CodeWhale stores session data as individual JSON files:
 *   - Directory: ~/.codewhale/sessions/
 *   - File pattern: {uuid}.json
 *   - Key data: metadata.total_tokens — session-level aggregate token count
 *   - metadata.model — model name (e.g. "auto", "deepseek-v4-pro")
 *   - metadata.created_at — ISO 8601 timestamp
 *   - metadata.workspace — project directory path
 *
 * Per-message data (role, content blocks) is extracted from the full
 * messages array to count actual assistant requests and tool calls.
 *
 * Note: CodeWhale session metadata does not split input/output tokens.
 * All tokens are attributed to inputTokens for internal consistency.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { EMPTY_STAT, validateDate } from "./base.mjs";

const DEFAULT_SESSIONS_DIR = join(homedir(), ".codewhale", "sessions");

export const name = "CodeWhale";
export const id = "codewhale";

export function detect(customPath) {
  const dir = customPath || DEFAULT_SESSIONS_DIR;
  if (existsSync(dir)) {
    return dir;
  }
  return null;
}

/**
 * List all session JSON files in the given directory.
 * Excludes checkpoints/latest.json (a pointer, not a real session).
 */
function findSessionFiles(sessionsDir) {
  try {
    const entries = readdirSync(sessionsDir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".json") && entry.name !== "latest.json") {
        files.push(join(sessionsDir, entry.name));
      }
    }
    return files;
  } catch {
    return [];
  }
}

/**
 * Extract the project name from a workspace path string.
 * e.g. "C:\\Users\\geeeger\\my-project" → "my-project"
 */
function projectNameFromWorkspace(workspace) {
  if (!workspace) return "(global)";
  const normalized = workspace.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash !== -1 ? normalized.slice(lastSlash + 1) : workspace;
}

/**
 * Parse ISO 8601 timestamp and return YYYY-MM-DD date string in UTC.
 */
function isoToUTCDate(isoStr) {
  const d = new Date(isoStr);
  return d.toISOString().slice(0, 10);
}

/**
 * Parse a full session JSON file and return aggregated session stats.
 *
 * Returns an object with:
 *   totalTokens, requests, toolCalls, model, projectName
 * or null if the file can't be parsed or has no metadata.
 */
function parseSessionFile(filePath) {
  let content;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const meta = parsed.metadata;
  if (!meta) return null;

  // Count assistant messages → requests
  // Count tool_use content blocks → toolCalls
  let requests = 0;
  let toolCalls = 0;
  const messages = parsed.messages || [];

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    requests++;

    const blocks = msg.content;
    if (!Array.isArray(blocks)) continue;
    for (const block of blocks) {
      if (block.type === "tool_use") {
        toolCalls++;
      }
    }
  }

  return {
    totalTokens: meta.total_tokens || 0,
    requests,
    toolCalls,
    model: meta.model || "unknown",
    createdDate: meta.created_at ? isoToUTCDate(meta.created_at) : null,
    projectName: projectNameFromWorkspace(meta.workspace),
  };
}

/**
 * Aggregate stats from all session files in the given date range.
 */
function aggregateFromFiles(sessionsDir, startDate, endDate) {
  const total = EMPTY_STAT();
  const byModel = new Map();
  const byProject = new Map();
  const byProvider = new Map();

  const files = findSessionFiles(sessionsDir);
  if (files.length === 0) return { total, byModel, byProject, byProvider };

  const providerKey = id; // "codewhale"

  for (const file of files) {
    const session = parseSessionFile(file);
    if (!session) continue;

    // Filter by date range
    if (!session.createdDate) continue;
    if (session.createdDate < startDate || session.createdDate > endDate) continue;

    const modelKey = `${session.model} (codewhale)`;

    // Since codewhale metadata only has totalTokens (no input/output split),
    // attribute all tokens to inputTokens for internal consistency.
    total.requests += session.requests;
    total.inputTokens += session.totalTokens;
    total.toolCalls += session.toolCalls;
    total.totalTokens += session.totalTokens;

    // byModel
    if (!byModel.has(modelKey)) byModel.set(modelKey, EMPTY_STAT());
    const m = byModel.get(modelKey);
    m.requests += session.requests;
    m.inputTokens += session.totalTokens;
    m.toolCalls += session.toolCalls;
    m.totalTokens += session.totalTokens;

    // byProject
    if (!byProject.has(session.projectName)) byProject.set(session.projectName, EMPTY_STAT());
    const p = byProject.get(session.projectName);
    p.requests += session.requests;
    p.inputTokens += session.totalTokens;
    p.toolCalls += session.toolCalls;
    p.totalTokens += session.totalTokens;

    // byProvider
    if (!byProvider.has(providerKey)) byProvider.set(providerKey, EMPTY_STAT());
    const pr = byProvider.get(providerKey);
    pr.requests += session.requests;
    pr.inputTokens += session.totalTokens;
    pr.toolCalls += session.toolCalls;
    pr.totalTokens += session.totalTokens;
  }

  return { total, byModel, byProject, byProvider };
}

export function getDailyStats(sessionsDir, dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  validateDate(date);
  const dir = sessionsDir || DEFAULT_SESSIONS_DIR;
  if (!existsSync(dir)) return null;

  const { total, byModel, byProject, byProvider } = aggregateFromFiles(dir, date, date);
  const files = findSessionFiles(dir);
  if (files.length === 0) return null;

  return { total, byModel, byProject, byProvider, date, client: id };
}

export function getDateRangeStats(sessionsDir, fromDate, toDate) {
  validateDate(fromDate);
  validateDate(toDate);

  if (fromDate > toDate) {
    throw new Error(`Start date ${fromDate} is after end date ${toDate}`);
  }

  const dir = sessionsDir || DEFAULT_SESSIONS_DIR;
  if (!existsSync(dir)) return null;

  const { total, byModel, byProject, byProvider } = aggregateFromFiles(dir, fromDate, toDate);
  const files = findSessionFiles(dir);
  if (files.length === 0) return null;

  return { total, byModel, byProject, byProvider, date: `${fromDate} ~ ${toDate}`, client: id };
}

export function close() {
  // No-op: file-based provider, no resources to release
}
