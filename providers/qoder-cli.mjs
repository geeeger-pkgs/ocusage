/**
 * Qoder CLI provider — reads from ~/.qoder/logs/sessions/ JSONL files.
 *
 * Qoder CLI stores session logs as JSONL files:
 *   - Directory: ~/.qoder/logs/sessions/{workspace}/{session-id}/segments/
 *   - File pattern: {ISO_TIMESTAMP}-{RANDOM}-p{PID}.jsonl
 *   - Key event: type === "model.response.completed"
 *   - data.input_tokens — input token count
 *   - data.output_tokens — output token count
 *   - data.cache_read_input_tokens — tokens read from cache
 *   - data.cache_creation_input_tokens — tokens written to cache
 *   - data.model — model name (e.g. "auto")
 *   - ts — ISO 8601 with timezone
 *
 * Workspace directory name encoding:
 *   C--Users-geeeger → C:\Users\geeeger
 *   (-- separates drive letter, - separates path segments)
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { EMPTY_STAT, validateDate } from "./base.mjs";

const DEFAULT_SESSIONS_DIR = join(homedir(), ".qoder", "logs", "sessions");

export const name = "Qoder CLI";
export const id = "qoder-cli";

export function detect(customPath) {
  const dir = customPath || DEFAULT_SESSIONS_DIR;
  if (existsSync(dir)) {
    return dir;
  }
  return null;
}

/**
 * Decode workspace directory name back to a readable path.
 * e.g. "C--Users-geeeger-project" → "C:\Users\geeeger\project"
 *      "home-user-project" → "/home/user/project"
 */
function decodeWorkspaceName(dirName) {
  // Check if it starts with a drive letter pattern (e.g. "C--")
  const driveMatch = dirName.match(/^([A-Za-z])--(.*)$/);
  if (driveMatch) {
    const drive = driveMatch[1];
    const rest = driveMatch[2].replace(/-/g, "\\");
    return `${drive}:\\${rest}`;
  }
  // Unix-style path
  return `/${dirName.replace(/-/g, "/")}`;
}

/**
 * Extract a short project name from the decoded workspace path.
 */
function extractProjectName(dirName) {
  const decoded = decodeWorkspaceName(dirName);
  // Take the last segment of the path
  const normalized = decoded.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash !== -1 ? normalized.slice(lastSlash + 1) : decoded;
}

/**
 * Recursively find all .jsonl files under the segments directories.
 * Structure: sessions/{workspace}/{session-id}/segments/*.jsonl
 */
function findJsonlFiles(sessionsDir) {
  const results = [];
  if (!existsSync(sessionsDir)) return results;

  try {
    const workspaces = readdirSync(sessionsDir, { withFileTypes: true });
    for (const ws of workspaces) {
      if (!ws.isDirectory()) continue;
      const wsPath = join(sessionsDir, ws.name);

      let sessions;
      try {
        sessions = readdirSync(wsPath, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const session of sessions) {
        if (!session.isDirectory()) continue;
        const segmentsPath = join(wsPath, session.name, "segments");
        if (!existsSync(segmentsPath)) continue;

        let files;
        try {
          files = readdirSync(segmentsPath, { withFileTypes: true });
        } catch {
          continue;
        }

        for (const file of files) {
          if (file.isFile() && file.name.endsWith(".jsonl")) {
            results.push({
              file: join(segmentsPath, file.name),
              workspace: ws.name,
            });
          }
        }
      }
    }
  } catch {
    // Permission issues, etc. — skip
  }
  return results;
}

/**
 * Aggregate stats from JSONL files for the given date range.
 */
function aggregateFromFiles(fileEntries, startDate, endDate) {
  const total = EMPTY_STAT();
  const byModel = new Map();
  const byProject = new Map();
  const byProvider = new Map();

  for (const { file, workspace } of fileEntries) {
    const projectName = extractProjectName(workspace);

    let content;
    try {
      content = readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    let lastModelKey = null;
    for (const line of lines) {
      if (!line.trim()) continue;

      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }

      // Determine date from timestamp
      const ts = event.ts;
      if (!ts) continue;
      const eventDate = ts.substring(0, 10);

      // Filter by date range
      if (eventDate < startDate || eventDate > endDate) continue;

      // Count tool.requested events as tool calls
      if (event.type === "tool.requested") {
        total.toolCalls++;

        if (lastModelKey) {
          if (!byModel.has(lastModelKey)) byModel.set(lastModelKey, EMPTY_STAT());
          byModel.get(lastModelKey).toolCalls++;
        }

        if (!byProject.has(projectName)) byProject.set(projectName, EMPTY_STAT());
        byProject.get(projectName).toolCalls++;

        if (!byProvider.has("qoder-cli")) byProvider.set("qoder-cli", EMPTY_STAT());
        byProvider.get("qoder-cli").toolCalls++;

        continue;
      }

      // Only process model.response.completed events for token data
      if (event.type !== "model.response.completed") continue;
      if (!event.data) continue;

      const inputTokens = event.data.input_tokens || 0;
      const outputTokens = event.data.output_tokens || 0;
      const cacheRead = event.data.cache_read_input_tokens || 0;
      const cacheWrite = event.data.cache_creation_input_tokens || 0;
      const totalTokens = inputTokens + outputTokens;
      const modelKey = `${event.data.model || "unknown"} (qoder-cli)`;
      lastModelKey = modelKey;

      total.requests++;
      total.inputTokens += inputTokens;
      total.outputTokens += outputTokens;
      total.cacheRead += cacheRead;
      total.cacheWrite += cacheWrite;
      total.totalTokens += totalTokens;

      for (const [map, key] of [
        [byModel, modelKey],
        [byProject, projectName],
        [byProvider, "qoder-cli"],
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

export function getDailyStats(sessionsDir, dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  validateDate(date);
  const dir = sessionsDir || DEFAULT_SESSIONS_DIR;
  if (!existsSync(dir)) return null;

  const fileEntries = findJsonlFiles(dir);
  if (fileEntries.length === 0) return null;

  const { total, byModel, byProject, byProvider } = aggregateFromFiles(fileEntries, date, date);
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

  const fileEntries = findJsonlFiles(dir);
  if (fileEntries.length === 0) return null;

  const { total, byModel, byProject, byProvider } = aggregateFromFiles(fileEntries, fromDate, toDate);
  return { total, byModel, byProject, byProvider, date: `${fromDate} ~ ${toDate}`, client: id };
}

export function close() {
  // No-op: file-based provider, no resources to release
}
