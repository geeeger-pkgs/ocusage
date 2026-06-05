import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { getConfigPath, getCustomPaths, getSavedLocale, loadConfig, saveConfig } from "../config.mjs";

const isWindows = process.platform === "win32";

/**
 * Create a temp config directory and point the config module at it
 * by overriding the environment variable the module reads.
 */
function makeTempDir() {
  const dir = join(tmpdir(), `ocusage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("config.mjs", () => {
  let tempDir;
  let origAppdata;
  let origXdg;

  beforeEach(() => {
    tempDir = makeTempDir();
    // Save original env values
    origAppdata = process.env.APPDATA;
    origXdg = process.env.XDG_CONFIG_HOME;

    if (isWindows) {
      process.env.APPDATA = tempDir;
    } else {
      process.env.XDG_CONFIG_HOME = tempDir;
    }
  });

  afterEach(() => {
    // Restore original env values
    if (isWindows) {
      if (origAppdata === undefined) {
        delete process.env.APPDATA;
      } else {
        process.env.APPDATA = origAppdata;
      }
    } else if (origXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = origXdg;
    }

    // Clean up temp directory
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("getConfigPath()", () => {
    it("returns a non-empty string", () => {
      const path = getConfigPath();
      assert.ok(typeof path === "string");
      assert.ok(path.length > 0);
    });

    it("ends with config.json", () => {
      const path = getConfigPath();
      assert.ok(path.endsWith("config.json"), `expected path to end with config.json, got: ${path}`);
    });
  });

  describe("loadConfig()", () => {
    it("returns { customPaths: {} } when no config file exists", () => {
      const config = loadConfig();
      assert.deepEqual(config.customPaths, {});
      assert.equal(config.locale, undefined);
    });

    it("returns saved customPaths when config file exists", () => {
      const configDir = join(tempDir, "ocusage");
      mkdirSync(configDir, { recursive: true });
      const configPath = join(configDir, "config.json");
      writeFileSync(configPath, JSON.stringify({ customPaths: { opencode: "/custom/path/db.sqlite" } }), "utf8");

      const config = loadConfig();
      assert.deepEqual(config.customPaths, { opencode: "/custom/path/db.sqlite" });
      assert.equal(config.locale, undefined);
    });

    it("returns empty customPaths when config file has invalid JSON", () => {
      const configDir = join(tempDir, "ocusage");
      mkdirSync(configDir, { recursive: true });
      const configPath = join(configDir, "config.json");
      writeFileSync(configPath, "not-json", "utf8");

      const config = loadConfig();
      assert.deepEqual(config.customPaths, {});
      assert.equal(config.locale, undefined);
    });

    it("returns empty customPaths when customPaths is not an object", () => {
      const configDir = join(tempDir, "ocusage");
      mkdirSync(configDir, { recursive: true });
      const configPath = join(configDir, "config.json");
      writeFileSync(configPath, JSON.stringify({ customPaths: "invalid" }), "utf8");

      const config = loadConfig();
      assert.deepEqual(config.customPaths, {});
    });

    it("returns locale when present in config file", () => {
      const configDir = join(tempDir, "ocusage");
      mkdirSync(configDir, { recursive: true });
      const configPath = join(configDir, "config.json");
      writeFileSync(configPath, JSON.stringify({ locale: "en", customPaths: { opencode: "/db" } }), "utf8");

      const config = loadConfig();
      assert.equal(config.locale, "en");
      assert.deepEqual(config.customPaths, { opencode: "/db" });
    });

    it("returns undefined locale when not in config file", () => {
      const configDir = join(tempDir, "ocusage");
      mkdirSync(configDir, { recursive: true });
      const configPath = join(configDir, "config.json");
      writeFileSync(configPath, JSON.stringify({ customPaths: {} }), "utf8");

      const config = loadConfig();
      assert.equal(config.locale, undefined);
    });

    it("returns undefined locale when locale is not a string", () => {
      const configDir = join(tempDir, "ocusage");
      mkdirSync(configDir, { recursive: true });
      const configPath = join(configDir, "config.json");
      writeFileSync(configPath, JSON.stringify({ locale: 123, customPaths: {} }), "utf8");

      const config = loadConfig();
      assert.equal(config.locale, undefined);
    });
  });

  describe("saveConfig()", () => {
    it("writes config that can be read back by loadConfig()", () => {
      const config = { customPaths: { qoder: "C:/custom/qoder.db", claude: "/home/user/.claude" } };
      saveConfig(config);

      const loaded = loadConfig();
      assert.deepEqual(loaded.customPaths, config.customPaths);
      assert.equal(loaded.locale, undefined);
    });

    it("creates the config directory if it does not exist", () => {
      // The ocusage subdir under tempDir should not exist yet
      const configDir = join(tempDir, "ocusage");
      assert.ok(!existsSync(configDir));

      saveConfig({ customPaths: { opencode: "/some/path" } });
      assert.ok(existsSync(configDir));
    });

    it("writes formatted JSON with 2-space indentation", () => {
      saveConfig({ customPaths: { opencode: "/db" } });

      const configPath = getConfigPath();
      const raw = readFileSync(configPath, "utf8");
      assert.ok(raw.includes('  "customPaths"'), "expected 2-space indentation");
    });
  });

  describe("getCustomPaths()", () => {
    it("returns an object", () => {
      const paths = getCustomPaths();
      assert.ok(typeof paths === "object");
      assert.ok(paths !== null);
    });

    it("returns saved customPaths", () => {
      saveConfig({ customPaths: { opencode: "/my/opencode.db" } });
      const paths = getCustomPaths();
      assert.deepEqual(paths, { opencode: "/my/opencode.db" });
    });
  });

  describe("getSavedLocale()", () => {
    it("returns undefined when no locale is saved", () => {
      saveConfig({ customPaths: {} });
      const locale = getSavedLocale();
      assert.equal(locale, undefined);
    });

    it("returns saved locale", () => {
      saveConfig({ locale: "ja", customPaths: {} });
      const locale = getSavedLocale();
      assert.equal(locale, "ja");
    });
  });
});
