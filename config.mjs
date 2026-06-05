/**
 * Configuration management module for ocusage.
 *
 * Reads/writes a persistent config file that stores custom database paths
 * for each provider.
 *
 * Config file locations:
 *   Windows:  %APPDATA%/ocusage/config.json
 *   macOS:    ~/Library/Application Support/ocusage/config.json
 *   Linux:    $XDG_CONFIG_HOME/ocusage/config.json
 *             or ~/.config/ocusage/config.json
 *
 * Config file format:
 *   { "locale": "zh-CN", "customPaths": { "<providerId>": "<path>", ... } }
 *
 * The "locale" field is optional — when present it stores the user's preferred
 * output language so that --lang does not need to be passed every time.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";

const EMPTY_CONFIG = { customPaths: {} };

/**
 * Determine the platform-specific config directory.
 */
function getConfigDir() {
  if (isWindows) {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(appData, "ocusage");
  }
  if (isMac) {
    return join(homedir(), "Library", "Application Support", "ocusage");
  }
  // Linux — follow XDG Base Directory Specification for config
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(xdgConfig, "ocusage");
}

/**
 * Get the full path to the config file.
 * @returns {string}
 */
export function getConfigPath() {
  return join(getConfigDir(), "config.json");
}

/**
 * Load configuration from disk.
 * Returns `{ customPaths: {} }` if the file does not exist or cannot be parsed.
 * @returns {{ customPaths: Object<string, string> }}
 */
export function loadConfig() {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return { ...EMPTY_CONFIG, customPaths: { ...EMPTY_CONFIG.customPaths } };
  }
  try {
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      locale: typeof parsed.locale === "string" ? parsed.locale : undefined,
      customPaths: parsed.customPaths && typeof parsed.customPaths === "object" ? { ...parsed.customPaths } : {},
    };
  } catch {
    return { ...EMPTY_CONFIG, customPaths: { ...EMPTY_CONFIG.customPaths } };
  }
}

/**
 * Save configuration to disk.
 * Automatically creates the config directory if it does not exist.
 * Writes formatted JSON with 2-space indentation.
 * @param {{ customPaths: Object<string, string> }} config
 */
export function saveConfig(config) {
  const configPath = getConfigPath();
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
}

/**
 * Convenience method: return the saved customPaths mapping.
 * @returns {Object<string, string>}
 */
export function getCustomPaths() {
  return loadConfig().customPaths;
}

/**
 * Convenience method: return the saved locale or undefined.
 * @returns {string | undefined}
 */
export function getSavedLocale() {
  return loadConfig().locale;
}
