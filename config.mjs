/**
 * Configuration management module for ocusage.
 *
 * Reads/writes a persistent config file that stores custom database paths
 * for each provider, encryption keys for SQLCipher-encrypted databases,
 * and user locale preferences.
 *
 * Config file locations:
 *   Windows:  %APPDATA%/ocusage/config.json
 *   macOS:    ~/Library/Application Support/ocusage/config.json
 *   Linux:    $XDG_CONFIG_HOME/ocusage/config.json
 *             or ~/.config/ocusage/config.json
 *
 * Config file format:
 *   {
 *     "locale": "zh-CN",
 *     "customPaths": { "<providerId>": "<path>", ... },
 *     "encryptionKeys": { "<providerId>": "<hexkey>", ... }
 *   }
 *
 * The "locale" field is optional — when present it stores the user's preferred
 * output language so that --lang does not need to be passed every time.
 * The "encryptionKeys" field stores SQLCipher keys for encrypted databases
 * (e.g. Trae, Trae Solo) extracted from process memory.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";

const EMPTY_CONFIG = { customPaths: {}, encryptionKeys: {} };

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
 * Returns `{ customPaths: {}, encryptionKeys: {} }` if the file does not exist
 * or cannot be parsed.
 * @returns {{ locale: string|undefined, customPaths: Object<string, string>, encryptionKeys: Object<string, string> }}
 */
export function loadConfig() {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return { ...EMPTY_CONFIG, customPaths: { ...EMPTY_CONFIG.customPaths }, encryptionKeys: { ...EMPTY_CONFIG.encryptionKeys } };
  }
  try {
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      locale: typeof parsed.locale === "string" ? parsed.locale : undefined,
      customPaths: parsed.customPaths && typeof parsed.customPaths === "object" ? { ...parsed.customPaths } : {},
      encryptionKeys: parsed.encryptionKeys && typeof parsed.encryptionKeys === "object" ? { ...parsed.encryptionKeys } : {},
    };
  } catch {
    return { ...EMPTY_CONFIG, customPaths: { ...EMPTY_CONFIG.customPaths }, encryptionKeys: { ...EMPTY_CONFIG.encryptionKeys } };
  }
}

/**
 * Save configuration to disk.
 * Automatically creates the config directory if it does not exist.
 * Writes formatted JSON with 2-space indentation.
 * @param {{ customPaths: Object<string, string>, encryptionKeys?: Object<string, string> }} config
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

/**
 * Retrieve the stored SQLCipher encryption key for a provider.
 * @param {string} providerId - e.g. "trae", "trae-solo"
 * @returns {string|null} hex key string or null if not stored
 */
export function getEncryptionKey(providerId) {
  const config = loadConfig();
  return config.encryptionKeys?.[providerId] ?? null;
}

/**
 * Store a SQLCipher encryption key for a provider.
 * @param {string} providerId - e.g. "trae", "trae-solo"
 * @param {string} keyHex - 64-character hex string
 */
export function setEncryptionKey(providerId, keyHex) {
  const config = loadConfig();
  config.encryptionKeys = config.encryptionKeys || {};
  if (keyHex) {
    config.encryptionKeys[providerId] = keyHex;
  } else {
    delete config.encryptionKeys[providerId];
  }
  saveConfig(config);
}
