/**
 * ZCode provider — reads from the ZCode SQLite database.
 * Same schema as OpenCode/MiMoCode (message, session, part tables).
 * Resolves UUID provider IDs to human-readable names via ~/.zcode/v2/config.json.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { aggregateRows, createSQLiteProvider, EMPTY_STAT, queryMessageRange } from "./base.mjs";

const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";

function getDefaultDBPaths() {
  const xdgDataDir = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const xdgPath = join(xdgDataDir, "zcode", "cli", "db", "db.sqlite");

  if (isWindows) {
    const homePath = join(homedir(), ".zcode", "cli", "db", "db.sqlite");
    return [xdgPath, homePath];
  }
  if (isMac) {
    return [join(homedir(), ".zcode", "cli", "db", "db.sqlite"), xdgPath];
  }
  return [xdgPath, join(homedir(), ".zcode", "cli", "db", "db.sqlite")];
}

const DEFAULT_DB_PATHS = getDefaultDBPaths();

function getConfigPath() {
  const home = homedir();
  return join(home, ".zcode", "v2", "config.json");
}

let providerNameCache = null;

function getProviderNameMap() {
  if (providerNameCache) return providerNameCache;
  providerNameCache = new Map();
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return providerNameCache;
  try {
    const raw = readFileSync(configPath, "utf8");
    const config = JSON.parse(raw);
    if (config.provider && typeof config.provider === "object") {
      for (const [id, entry] of Object.entries(config.provider)) {
        if (entry.name) {
          providerNameCache.set(id, entry.name);
        }
      }
    }
  } catch {
    // ignore malformed config
  }
  return providerNameCache;
}

function aggregateWithResolvedNames(rows) {
  const base = aggregateRows(rows);
  const nameMap = getProviderNameMap();
  if (nameMap.size === 0) return base;

  const resolved = new Map();
  for (const [key, val] of base.byProvider) {
    const resolvedKey = nameMap.get(key) || key;
    if (!resolved.has(resolvedKey)) resolved.set(resolvedKey, EMPTY_STAT());
    const s = resolved.get(resolvedKey);
    s.requests += val.requests;
    s.inputTokens += val.inputTokens;
    s.outputTokens += val.outputTokens;
    s.toolCalls += val.toolCalls;
    s.cacheRead += val.cacheRead;
    s.cacheWrite += val.cacheWrite;
    s.totalTokens += val.totalTokens;
  }
  base.byProvider = resolved;

  const resolvedModel = new Map();
  for (const [key, val] of base.byModel) {
    const parts = key.split(" (");
    if (parts.length === 2) {
      const uuid = parts[1].replace(/\)$/, "");
      const resolvedUuid = nameMap.get(uuid) || uuid;
      parts[1] = `${resolvedUuid})`;
    }
    const resolvedKey = parts.join(" (");
    if (!resolvedModel.has(resolvedKey)) resolvedModel.set(resolvedKey, EMPTY_STAT());
    const s = resolvedModel.get(resolvedKey);
    s.requests += val.requests;
    s.inputTokens += val.inputTokens;
    s.outputTokens += val.outputTokens;
    s.toolCalls += val.toolCalls;
    s.cacheRead += val.cacheRead;
    s.cacheWrite += val.cacheWrite;
    s.totalTokens += val.totalTokens;
  }
  base.byModel = resolvedModel;

  return base;
}

export const { id, name, detect, getDailyStats, getDateRangeStats, close } = createSQLiteProvider({
  id: "zcode",
  name: "ZCode",
  resolvePath: () => DEFAULT_DB_PATHS.find((p) => existsSync(p)),
  query: queryMessageRange,
  aggregate: aggregateWithResolvedNames,
});
