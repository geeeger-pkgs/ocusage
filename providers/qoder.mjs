/**
 * Qoder provider — reads from the Qoder IDE SQLite database.
 *
 * Qoder uses the same schema as Trae (they share the same codebase):
 *   - chat_message.token_info → JSON with token usage
 *   - chat_message.model_info → JSON with model identifier
 *   - chat_session.project_uri → project path
 *   - chat_message.gmt_create → timestamp in ms epoch
 *
 * Path: %APPDATA%/Qoder/SharedClientCache/cache/db/local.db (Windows)
 *       ~/.config/Qoder/... (Linux/macOS — untested)
 */

import { homedir } from "node:os";
import { basename, join } from "node:path";
import { createSQLiteProvider, EMPTY_STAT } from "./base.mjs";

const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";

function getDefaultDBPath() {
  if (isWindows) {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(appData, "Qoder", "SharedClientCache", "cache", "db", "local.db");
  }
  if (isMac) {
    return join(homedir(), "Library", "Application Support", "Qoder", "SharedClientCache", "cache", "db", "local.db");
  }
  const configDir = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(configDir, "Qoder", "SharedClientCache", "cache", "db", "local.db");
}

function aggregateMessages(rows) {
  const total = EMPTY_STAT();
  const byModel = new Map();
  const byProject = new Map();
  const byProvider = new Map();

  let lastModelKey = null;

  for (const row of rows) {
    if (row.role === "tool") {
      const projectName = row.project_uri ? basename(row.project_uri) : "(global)";
      total.toolCalls++;

      if (lastModelKey) {
        if (!byModel.has(lastModelKey)) byModel.set(lastModelKey, EMPTY_STAT());
        byModel.get(lastModelKey).toolCalls++;
      }

      if (!byProject.has(projectName)) byProject.set(projectName, EMPTY_STAT());
      byProject.get(projectName).toolCalls++;

      if (!byProvider.has("qoder")) byProvider.set("qoder", EMPTY_STAT());
      byProvider.get("qoder").toolCalls++;

      continue;
    }

    if (row.role !== "assistant") continue;

    let tokenInfo = null;
    try {
      tokenInfo = row.token_info ? JSON.parse(row.token_info) : null;
    } catch {
      continue;
    }
    if (!tokenInfo) continue;

    let modelInfo = null;
    try {
      modelInfo = row.model_info ? JSON.parse(row.model_info) : null;
    } catch {
      // ignore
    }

    const inputTokens = tokenInfo.prompt_tokens || 0;
    const outputTokens = tokenInfo.completion_tokens || 0;
    const cacheRead = tokenInfo.cached_tokens || 0;
    const cacheWrite = 0;
    // cached_tokens is a subset of prompt_tokens, don't double-add
    const totalTokens = inputTokens + outputTokens;
    const modelKey = `${modelInfo?.model_key || "unknown"} (qoder)`;
    const projectName = row.project_uri ? basename(row.project_uri) : "(global)";
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
      [byProvider, "qoder"],
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

  return { total, byModel, byProject, byProvider };
}

export const { id, name, detect, getDailyStats, getDateRangeStats, close } = createSQLiteProvider({
  id: "qoder",
  name: "Qoder",
  resolvePath: getDefaultDBPath,
  query(db, startMs, endMs) {
    return db
      .prepare(
        `SELECT cm.role, cm.token_info, cm.model_info, cs.project_uri
         FROM chat_message cm
         LEFT JOIN chat_session cs ON cm.session_id = cs.session_id
         WHERE cm.gmt_create >= ? AND cm.gmt_create <= ?`,
      )
      .all(startMs, endMs);
  },
  aggregate: aggregateMessages,
});
