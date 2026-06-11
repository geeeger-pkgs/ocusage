/**
 * Integration tests — run the CLI end-to-end and verify output.
 *
 * Tests that query real databases are skipped when no AI clients are detected
 * (e.g. on CI).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, "..", "cli.mjs");

function run(args, opts = {}) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      encoding: "utf8",
      timeout: 15000,
      windowsHide: true,
      ...opts,
    });
    return { stdout, exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || "",
      exitCode: err.status || 1,
    };
  }
}

let hasClients = false;
try {
  const { stdout } = run(["detect"]);
  hasClients = !stdout.includes("No AI") && !stdout.includes("未检测到");
} catch {
  hasClients = false;
}

describe("CLI integration", () => {
  it("prints version", () => {
    const { stdout } = run(["--version"]);
    assert.ok(stdout.trim().match(/^\d+\.\d+\.\d+$/));
  });

  it("prints help", () => {
    const { stdout } = run(["--help"]);
    assert.ok(stdout.includes("ocusage"));
    assert.ok(stdout.includes("--client"));
    assert.ok(stdout.includes("--date"));
  });

  it("runs detect command", () => {
    const { stdout, exitCode } = run(["detect"]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("Detected") || stdout.includes("检测") || stdout.includes("No AI"));
  });

  it("runs default command (opencode) with --json", { skip: !hasClients && "no AI clients installed" }, () => {
    const { stdout, exitCode } = run(["--client", "opencode", "--date", "2025-04-20", "--json"]);
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.ok(parsed.opencode !== undefined || Object.keys(parsed).length === 0);
  });

  it("runs with --client all --json", { skip: !hasClients && "no AI clients installed" }, () => {
    const { stdout, exitCode } = run(["--client", "all", "--date", "2025-04-20", "--json"]);
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.equal(typeof parsed, "object");
  });

  it("rejects invalid date format", () => {
    const { exitCode } = run(["--client", "opencode", "--date", "not-a-date"]);
    assert.notEqual(exitCode, 0);
  });

  it("rejects unknown client", () => {
    const { exitCode } = run(["--client", "nonexistent", "--date", "2025-04-20"]);
    assert.notEqual(exitCode, 0);
  });

  it("compare command with --json", { skip: !hasClients && "no AI clients installed" }, () => {
    const { stdout, exitCode } = run(["compare", "--a", "2025-04", "--b", "2025-05", "--client", "opencode", "--json"]);
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.ok(parsed.statsA !== undefined);
    assert.ok(parsed.statsB !== undefined);
    assert.ok(parsed.diff !== undefined);
  });

  it("config --list runs without error", () => {
    const { exitCode } = run(["config", "--list"]);
    assert.equal(exitCode, 0);
  });

  it("--lang en produces English output", { skip: !hasClients && "no AI clients installed" }, () => {
    const { stdout } = run(["--client", "opencode", "--date", "2025-04-20", "--lang", "en", "--json"]);
    const parsed = JSON.parse(stdout);
    assert.ok(parsed);
  });
});
