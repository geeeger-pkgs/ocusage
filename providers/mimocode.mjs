/**
 * MiMoCode provider — reads from the MiMoCode SQLite database.
 * Uses the same database schema and path convention as OpenCode.
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { aggregateRows, openDB, queryMessageRange, validateDate } from "./base.mjs";

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
  // Linux
  return [xdgPath];
}

const DEFAULT_DB_PATHS = getDefaultDBPaths();

export const name = "MiMoCode";
export const id = "mimocode";

export function detect(customPath) {
  if (customPath) {
    return existsSync(customPath) ? customPath : null;
  }
  for (const path of DEFAULT_DB_PATHS) {
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
}

export function getDailyStats(dbPath, dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  validateDate(date);
  const [y, m, d] = date.split("-").map(Number);
  const startMs = Date.UTC(y, m - 1, d, 0, 0, 0);
  const endMs = Date.UTC(y, m - 1, d, 23, 59, 59, 999);

  const db = openDB(dbPath || DEFAULT_DB_PATHS.find((p) => existsSync(p)));
  if (!db) return null;

  try {
    const rows = queryMessageRange(db, startMs, endMs);
    const { total, byModel, byProject, byProvider } = aggregateRows(rows);
    return { total, byModel, byProject, byProvider, date, client: id };
  } finally {
    db.close();
  }
}

export function getDateRangeStats(dbPath, fromDate, toDate) {
  validateDate(fromDate);
  validateDate(toDate);

  const [fy, fm, fd] = fromDate.split("-").map(Number);
  const [ty, tm, td] = toDate.split("-").map(Number);
  const startMs = Date.UTC(fy, fm - 1, fd, 0, 0, 0);
  const endMs = Date.UTC(ty, tm - 1, td, 23, 59, 59, 999);

  if (startMs > endMs) {
    throw new Error(`Start date ${fromDate} is after end date ${toDate}`);
  }

  const db = openDB(dbPath || DEFAULT_DB_PATHS.find((p) => existsSync(p)));
  if (!db) return null;

  try {
    const rows = queryMessageRange(db, startMs, endMs);
    const { total, byModel, byProject, byProvider } = aggregateRows(rows);
    return {
      total,
      byModel,
      byProject,
      byProvider,
      date: `${fromDate} ~ ${toDate}`,
      client: id,
    };
  } finally {
    db.close();
  }
}

export function close() {
  // No-op: we open/close DB per call for safety
}
