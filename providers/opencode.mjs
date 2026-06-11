/**
 * OpenCode provider — reads from the OpenCode SQLite database.
 * This is the original ocusage data source.
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { aggregateRows, createSQLiteProvider, queryMessageRange } from "./base.mjs";

const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";

function getDefaultDBPaths() {
  const xdgDataDir = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const xdgPath = join(xdgDataDir, "opencode", "opencode.db");

  if (isWindows) {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return [xdgPath, join(appData, "opencode", "opencode.db")];
  }
  if (isMac) {
    return [join(homedir(), "Library", "Application Support", "opencode", "opencode.db"), xdgPath];
  }
  return [xdgPath];
}

const DEFAULT_DB_PATHS = getDefaultDBPaths();

export const { id, name, detect, getDailyStats, getDateRangeStats, close } = createSQLiteProvider({
  id: "opencode",
  name: "OpenCode",
  resolvePath: () => DEFAULT_DB_PATHS.find((p) => existsSync(p)),
  query: queryMessageRange,
  aggregate: aggregateRows,
});
