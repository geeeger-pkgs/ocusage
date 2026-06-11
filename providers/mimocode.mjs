/**
 * MiMoCode provider — reads from the MiMoCode SQLite database.
 * Uses the same database schema and path convention as OpenCode.
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { aggregateRows, createSQLiteProvider, queryMessageRange } from "./base.mjs";

const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";

function getDefaultDBPaths() {
  const xdgDataDir = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const xdgPath = join(xdgDataDir, "mimocode", "mimocode.db");

  if (isWindows) {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return [xdgPath, join(appData, "mimocode", "mimocode.db")];
  }
  if (isMac) {
    return [join(homedir(), "Library", "Application Support", "mimocode", "mimocode.db"), xdgPath];
  }
  return [xdgPath];
}

const DEFAULT_DB_PATHS = getDefaultDBPaths();

export const { id, name, detect, getDailyStats, getDateRangeStats, close } = createSQLiteProvider({
  id: "mimocode",
  name: "MiMoCode",
  resolvePath: () => DEFAULT_DB_PATHS.find((p) => existsSync(p)),
  query: queryMessageRange,
  aggregate: aggregateRows,
});
