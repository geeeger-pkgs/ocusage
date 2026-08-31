/**
 * DeepSeek Harness provider — reads from ~/.dsh/sessions/ JSONL files.
 *
 * DeepSeek Harness stores session data as JSONL files (optionally zstd-compressed):
 *   - Each line is a JSON object representing a session event
 *   - type: "assistant/message" events contain token usage data
 *   - data.usage contains: inputTokens, outputTokens, cacheReadTokens, reasoningTokens
 *   - data.provenance contains: provider, model
 *   - data.content contains content blocks (tool-call type = tool usage)
 *   - time — Unix epoch milliseconds
 *
 * Data path: ~/.dsh/sessions/<normalized-cwd>/<session-id>/session.jsonl[.zstd]
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import * as fzstd from "fzstd";
import { EMPTY_STAT, validateDate } from "./base.mjs";

const isWindows = process.platform === "win32";

function getDefaultDshDir() {
  const dshHome = process.env.DSH_HOME;
  if (dshHome && existsSync(dshHome)) return dshHome;

  if (isWindows) {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    const winPath = join(appData, "dsh");
    if (existsSync(winPath)) return winPath;
  }

  return join(homedir(), ".dsh");
}

const DEFAULT_DSH_DIR = getDefaultDshDir();

export const name = "DeepSeek Harness";
export const id = "dsh";

export function detect(customPath) {
  const dir = customPath || DEFAULT_DSH_DIR;
  if (existsSync(dir)) {
    const sessionsDir = join(dir, "sessions");
    if (existsSync(sessionsDir)) {
      return dir;
    }
  }
  return null;
}

/**
 * Recursively find all .jsonl and .jsonl.zstd files under the sessions directory.
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
      } else if (entry.name.endsWith(".jsonl.zstd")) {
        results.push({ path: fullPath, compressed: true });
      } else if (entry.name.endsWith(".jsonl")) {
        results.push({ path: fullPath, compressed: false });
      }
    }
  } catch {
    // Permission issues, etc. — skip
  }
  return results;
}

/**
 * Read a JSONL file, decompressing if necessary.
 */
function readJsonlFile(fileInfo) {
  try {
    const buffer = readFileSync(fileInfo.path);
    if (fileInfo.compressed) {
      const decompressed = fzstd.decompress(new Uint8Array(buffer));
      return new TextDecoder().decode(decompressed);
    }
    return buffer.toString("utf-8");
  } catch {
    return null;
  }
}

/**
 * Get the modification date of a file as YYYY-MM-DD string.
 */
function getFileModifiedDate(filePath) {
  try {
    const stats = statSync(filePath);
    return stats.mtime.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

/**
 * Parse a Unix epoch milliseconds timestamp and return UTC date string (YYYY-MM-DD).
 */
function epochToUTCDate(epochMs) {
  const d = new Date(epochMs);
  return d.toISOString().slice(0, 10);
}

/**
 * Extract project name from session file path.
 * Path format: ~/.dsh/sessions/<normalized-cwd>/<session-id>/session.jsonl
 */
function extractProjectName(filePath) {
  const pathParts = filePath.replace(/\\/g, "/");
  const sessionsIdx = pathParts.indexOf("/sessions/");
  if (sessionsIdx === -1) return "(unknown)";

  const afterSessions = pathParts.slice(sessionsIdx + "/sessions/".length);
  const slashIdx = afterSessions.indexOf("/");
  if (slashIdx === -1) return "(unknown)";

  const normalizedCwd = afterSessions.slice(0, slashIdx);
  // Convert normalized path back to readable name
  // Common patterns: "C--Users-geeeger-project" -> "project"
  const segments = normalizedCwd.split("-");
  return segments[segments.length - 1] || normalizedCwd;
}

/**
 * Parse all JSONL files and aggregate stats for the given date range.
 */
function aggregateFromFiles(files, startDate, endDate) {
  const total = EMPTY_STAT();
  const byModel = new Map();
  const byProject = new Map();
  const byProvider = new Map();

  // Track tool calls per message (assistant/message seq -> tool call count)
  const toolCallCounts = new Map();

  for (const fileInfo of files) {
    // Quick filter: skip files whose modification date is outside the query range
    // This avoids expensive zstd decompression for old files
    const fileModifiedDate = getFileModifiedDate(fileInfo.path);
    if (fileModifiedDate && (fileModifiedDate < startDate || fileModifiedDate > endDate)) {
      continue;
    }

    const projectName = extractProjectName(fileInfo.path);

    const content = readJsonlFile(fileInfo);
    if (!content) continue;

    const lines = content.split("\n");

    // First pass: count tool/call events per (turn, step)
    for (const line of lines) {
      if (!line.trim()) continue;

      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }

      if (event.type === "tool/call" && event.data) {
        const key = `${event.data.turn}-${event.data.step}`;
        toolCallCounts.set(key, (toolCallCounts.get(key) || 0) + 1);
      }
    }

    // Second pass: aggregate usage from assistant/message events
    for (const line of lines) {
      if (!line.trim()) continue;

      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }

      // Only process assistant/message events with usage
      if (event.type !== "assistant/message") continue;
      if (!event.data?.usage) continue;

      const usage = event.data.usage;
      const inputTokens = usage.inputTokens || 0;
      const outputTokens = usage.outputTokens || 0;
      const cacheRead = usage.cacheReadTokens || 0;
      const cacheWrite = usage.cacheWriteTokens || 0;
      const totalTokens = inputTokens + outputTokens + cacheRead + cacheWrite;

      // Skip events with zero tokens
      if (totalTokens === 0) continue;

      // Determine timestamp
      const timestamp = event.time;
      if (!timestamp) continue;
      const eventDate = epochToUTCDate(timestamp);

      // Filter by date range
      if (eventDate < startDate || eventDate > endDate) continue;

      // Get provider and model from provenance or source
      const provenance = event.data.message?.provenance || event.data.provenance || {};
      const source = event.data.message?.source || {};
      const providerName = provenance.provider || source.provider || "deepseek";
      const modelName = provenance.model || source.model || "unknown";
      const modelKey = `${modelName} (${providerName})`;

      // Count tool calls for this (turn, step)
      const stepKey = `${event.data.turn}-${event.data.step}`;
      const toolCalls = toolCallCounts.get(stepKey) || 0;

      total.requests++;
      total.inputTokens += inputTokens;
      total.outputTokens += outputTokens;
      total.toolCalls += toolCalls;
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
        s.toolCalls += toolCalls;
        s.cacheRead += cacheRead;
        s.cacheWrite += cacheWrite;
        s.totalTokens += totalTokens;
      }
    }
  }

  return { total, byModel, byProject, byProvider };
}

export function getDailyStats(dshDir, dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  validateDate(date);
  const dir = dshDir || DEFAULT_DSH_DIR;
  if (!existsSync(dir)) return null;

  const sessionsDir = join(dir, "sessions");
  const files = findJsonlFiles(sessionsDir);
  if (files.length === 0) return null;

  const { total, byModel, byProject, byProvider } = aggregateFromFiles(files, date, date);
  return { total, byModel, byProject, byProvider, date, client: id };
}

export function getDateRangeStats(dshDir, fromDate, toDate) {
  validateDate(fromDate);
  validateDate(toDate);

  if (fromDate > toDate) {
    throw new Error(`Start date ${fromDate} is after end date ${toDate}`);
  }

  const dir = dshDir || DEFAULT_DSH_DIR;
  if (!existsSync(dir)) return null;

  const sessionsDir = join(dir, "sessions");
  const files = findJsonlFiles(sessionsDir);
  if (files.length === 0) return null;

  const { total, byModel, byProject, byProvider } = aggregateFromFiles(files, fromDate, toDate);
  return { total, byModel, byProject, byProvider, date: `${fromDate} ~ ${toDate}`, client: id };
}

export function close() {
  // No-op: file-based provider, no resources to release
}
