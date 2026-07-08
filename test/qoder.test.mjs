import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, it } from "node:test";
import { setLocale } from "../i18n.mjs";
import { getDailyStats, getDateRangeStats } from "../providers/qoder.mjs";

setLocale("zh-CN");

function createQoderTestDB() {
  const dir = mkdtempSync(join(tmpdir(), "ocusage-qoder-test-"));
  const dbPath = join(dir, "local.db");
  const db = new DatabaseSync(dbPath);

  db.exec(`
    CREATE TABLE chat_session (
      session_id TEXT PRIMARY KEY,
      project_uri TEXT
    );
    CREATE TABLE chat_message (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      role TEXT,
      token_info TEXT,
      model_info TEXT,
      gmt_create INTEGER
    );
  `);

  let closed = false;
  return {
    db,
    dbPath,
    cleanup() {
      if (!closed) {
        try {
          db.close();
        } catch {
          /* already closed */
        }
        closed = true;
      }
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

const DAY_MS = Date.UTC(2025, 3, 20);

function seedQoderDay(db) {
  db.prepare("INSERT INTO chat_session (session_id, project_uri) VALUES (?, ?)").run("sess1", "/home/user/project-a");
  db.prepare("INSERT INTO chat_session (session_id, project_uri) VALUES (?, ?)").run("sess2", "/home/user/project-b");

  // assistant message with tokens
  db.prepare(
    "INSERT INTO chat_message (session_id, role, token_info, model_info, gmt_create) VALUES (?, ?, ?, ?, ?)",
  ).run(
    "sess1",
    "assistant",
    JSON.stringify({ prompt_tokens: 1000, completion_tokens: 500, cached_tokens: 200 }),
    JSON.stringify({ model_key: "deepseek-v3" }),
    DAY_MS + 3600000,
  );

  // tool message (counts as tool call)
  db.prepare(
    "INSERT INTO chat_message (session_id, role, token_info, model_info, gmt_create) VALUES (?, ?, ?, ?, ?)",
  ).run("sess1", "tool", null, null, DAY_MS + 3601000);

  // another assistant message
  db.prepare(
    "INSERT INTO chat_message (session_id, role, token_info, model_info, gmt_create) VALUES (?, ?, ?, ?, ?)",
  ).run(
    "sess2",
    "assistant",
    JSON.stringify({ prompt_tokens: 2000, completion_tokens: 1000, cached_tokens: 0 }),
    JSON.stringify({ model_key: "deepseek-v3" }),
    DAY_MS + 7200000,
  );

  // user message (should be skipped)
  db.prepare(
    "INSERT INTO chat_message (session_id, role, token_info, model_info, gmt_create) VALUES (?, ?, ?, ?, ?)",
  ).run("sess1", "user", null, null, DAY_MS + 1000);
}

describe("Qoder getDailyStats", () => {
  let db;
  let dbPath;
  let cleanup;

  beforeEach(() => {
    const result = createQoderTestDB();
    db = result.db;
    dbPath = result.dbPath;
    cleanup = result.cleanup;
  });

  afterEach(() => {
    if (cleanup) cleanup();
  });

  it("returns empty stats for a day with no data", () => {
    db.close();
    const result = getDailyStats(dbPath, "2025-01-01");
    assert.equal(result.total.requests, 0);
    assert.equal(result.date, "2025-01-01");
    assert.equal(result.client, "qoder");
  });

  it("aggregates stats from a typical day", () => {
    seedQoderDay(db);
    db.close();
    const result = getDailyStats(dbPath, "2025-04-20");

    assert.equal(result.date, "2025-04-20");
    assert.equal(result.client, "qoder");
    // 2 assistant messages
    assert.equal(result.total.requests, 2);
    assert.equal(result.total.inputTokens, 3000); // 1000+2000
    assert.equal(result.total.outputTokens, 1500); // 500+1000
    assert.equal(result.total.totalTokens, 4500); // inputTokens(3000) + outputTokens(1500), cache is subset of input
    assert.equal(result.total.cacheRead, 200);
  });

  it("counts tool role messages as tool calls", () => {
    seedQoderDay(db);
    db.close();
    const result = getDailyStats(dbPath, "2025-04-20");
    assert.equal(result.total.toolCalls, 1);
  });

  it("skips user role messages", () => {
    seedQoderDay(db);
    db.close();
    const result = getDailyStats(dbPath, "2025-04-20");
    // Only 2 assistant messages count as requests
    assert.equal(result.total.requests, 2);
  });

  it("groups by model", () => {
    seedQoderDay(db);
    db.close();
    const result = getDailyStats(dbPath, "2025-04-20");

    const modelKey = "deepseek-v3 (qoder)";
    assert.ok(result.byModel.has(modelKey));
    const m = result.byModel.get(modelKey);
    assert.equal(m.requests, 2);
    assert.equal(m.totalTokens, 4500); // cache is subset of input, not additive
  });

  it("groups by project", () => {
    seedQoderDay(db);
    db.close();
    const result = getDailyStats(dbPath, "2025-04-20");

    assert.ok(result.byProject.has("project-a"));
    assert.ok(result.byProject.has("project-b"));
  });

  it("returns null for non-existent path", () => {
    db.close();
    const result = getDailyStats("/nonexistent/path/local.db", "2025-04-20");
    assert.equal(result, null);
  });

  it("throws on invalid date format", () => {
    assert.throws(() => getDailyStats(dbPath, "2025/04/20"), /Invalid date format/);
  });

  it("handles malformed token_info gracefully", () => {
    db.prepare("INSERT INTO chat_session (session_id, project_uri) VALUES (?, ?)").run("s-bad", "/project");
    db.prepare(
      "INSERT INTO chat_message (session_id, role, token_info, model_info, gmt_create) VALUES (?, ?, ?, ?, ?)",
    ).run("s-bad", "assistant", "not-json", null, DAY_MS + 1000);
    db.close();
    const result = getDailyStats(dbPath, "2025-04-20");
    assert.equal(result.total.requests, 0);
  });
});

describe("Qoder getDateRangeStats", () => {
  let db;
  let dbPath;
  let cleanup;

  beforeEach(() => {
    const result = createQoderTestDB();
    db = result.db;
    dbPath = result.dbPath;
    cleanup = result.cleanup;
  });

  afterEach(() => {
    if (cleanup) cleanup();
  });

  it("returns aggregated stats across date range", () => {
    seedQoderDay(db);
    db.close();
    const result = getDateRangeStats(dbPath, "2025-04-19", "2025-04-21");
    assert.equal(result.total.requests, 2);
    assert.equal(result.date, "2025-04-19 ~ 2025-04-21");
    assert.equal(result.client, "qoder");
  });

  it("throws when from > to", () => {
    assert.throws(() => getDateRangeStats(dbPath, "2025-04-21", "2025-04-20"), /Start date/);
  });

  it("works when from equals to (single day)", () => {
    seedQoderDay(db);
    db.close();
    const result = getDateRangeStats(dbPath, "2025-04-20", "2025-04-20");
    assert.equal(result.total.requests, 2);
  });
});
