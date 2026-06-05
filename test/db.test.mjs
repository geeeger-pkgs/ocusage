import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { setLocale } from "../i18n.mjs";
import { validateDate } from "../providers/base.mjs";
import { getDailyStats, getDateRangeStats } from "../providers/opencode.mjs";
import { createFileTestDB, DAY, insertSession, seedTypicalDay } from "./fixtures/helpers.mjs";

setLocale("zh-CN");

describe("getDailyStats", () => {
  let db;
  let dbPath;
  let cleanup;

  beforeEach(() => {
    const result = createFileTestDB();
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
    assert.equal(result.total.totalTokens, 0);
    assert.equal(result.date, "2025-01-01");
  });

  it("aggregates stats from typical day", () => {
    seedTypicalDay(db);
    db.close();
    const result = getDailyStats(dbPath, "2025-04-20");

    assert.equal(result.date, "2025-04-20");
    assert.equal(result.total.requests, 3);
    assert.equal(result.total.inputTokens, 3500);
    assert.equal(result.total.outputTokens, 1700);
    assert.equal(result.total.totalTokens, 5500);
    assert.equal(result.total.cacheRead, 200);
    assert.equal(result.total.cacheWrite, 100);
  });

  it("counts tool calls from parts", () => {
    seedTypicalDay(db);
    db.close();
    const result = getDailyStats(dbPath, "2025-04-20");

    assert.equal(result.total.toolCalls, 2);
  });

  it("skips user role messages", () => {
    seedTypicalDay(db);
    db.close();
    const result = getDailyStats(dbPath, "2025-04-20");

    const claudeStats = result.byModel.get("claude-3.5 (anthropic)");
    assert.ok(claudeStats);
    assert.equal(claudeStats.requests, 2);
  });

  it("groups by model", () => {
    seedTypicalDay(db);
    db.close();
    const result = getDailyStats(dbPath, "2025-04-20");

    assert.ok(result.byModel.has("claude-3.5 (anthropic)"));
    assert.ok(result.byModel.has("gpt-4o (openai)"));

    const gptStats = result.byModel.get("gpt-4o (openai)");
    assert.equal(gptStats.requests, 1);
    assert.equal(gptStats.totalTokens, 3000);
  });

  it("groups by project", () => {
    seedTypicalDay(db);
    db.close();
    const result = getDailyStats(dbPath, "2025-04-20");

    assert.ok(result.byProject.has("project-a"));
    assert.ok(result.byProject.has("project-b"));
    assert.ok(result.byProject.has("(global)"));

    const paStats = result.byProject.get("project-a");
    assert.equal(paStats.requests, 1);
  });

  it("groups by provider", () => {
    seedTypicalDay(db);
    db.close();
    const result = getDailyStats(dbPath, "2025-04-20");

    assert.ok(result.byProvider.has("anthropic"));
    assert.ok(result.byProvider.has("openai"));

    const anthropicStats = result.byProvider.get("anthropic");
    assert.equal(anthropicStats.requests, 2);
  });

  it("does not leak data across days", () => {
    seedTypicalDay(db);
    db.close();
    const result = getDailyStats(dbPath, "2025-04-21");
    assert.equal(result.total.requests, 0);
  });

  it("handles malformed message data gracefully", () => {
    insertSession(db, "s1", "/project");
    db.prepare("INSERT INTO message (id, session_id, data, time_created) VALUES (?, ?, ?, ?)").run(
      "m-bad",
      "s1",
      "not-json",
      DAY["2025-04-20"].start + 1000,
    );
    db.close();

    const result = getDailyStats(dbPath, "2025-04-20");
    assert.equal(result.total.requests, 0);
  });

  // 日期校验测试
  it("throws on invalid date format", () => {
    assert.throws(() => getDailyStats(dbPath, "2025/04/20"), /Invalid date format/);
    assert.throws(() => getDailyStats(dbPath, "abc"), /Invalid date format/);
    assert.throws(() => getDailyStats(dbPath, "2025-13-01"), /Date does not exist/);
    assert.throws(() => getDailyStats(dbPath, "2025-02-30"), /Date does not exist/);
  });
});

describe("validateDate", () => {
  it("accepts valid dates", () => {
    assert.equal(validateDate("2025-04-20"), "2025-04-20");
    assert.equal(validateDate("2024-02-29"), "2024-02-29"); // leap year
  });

  it("throws on invalid format", () => {
    assert.throws(() => validateDate("2025/04/20"), /Invalid date format/);
    assert.throws(() => validateDate("not-a-date"), /Invalid date format/);
  });

  it("throws on non-existent date", () => {
    assert.throws(() => validateDate("2025-02-29"), /Date does not exist/);
    assert.throws(() => validateDate("2025-13-01"), /Date does not exist/);
  });
});

describe("getDateRangeStats", () => {
  let db;
  let dbPath;
  let cleanup;

  beforeEach(() => {
    const result = createFileTestDB();
    db = result.db;
    dbPath = result.dbPath;
    cleanup = result.cleanup;
  });

  afterEach(() => {
    if (cleanup) cleanup();
  });

  it("returns aggregated stats across date range", () => {
    seedTypicalDay(db); // seeds data on 2025-04-20
    db.close();
    const result = getDateRangeStats(dbPath, "2025-04-19", "2025-04-21");
    assert.equal(result.total.requests, 3);
    assert.equal(result.date, "2025-04-19 ~ 2025-04-21");
  });

  it("returns empty stats for range with no data", () => {
    db.close();
    const result = getDateRangeStats(dbPath, "2025-01-01", "2025-01-31");
    assert.equal(result.total.requests, 0);
  });

  it("throws when from > to", () => {
    assert.throws(() => getDateRangeStats(dbPath, "2025-04-21", "2025-04-20"), /Start date/);
  });

  it("works when from equals to (single day)", () => {
    seedTypicalDay(db);
    db.close();
    const result = getDateRangeStats(dbPath, "2025-04-20", "2025-04-20");
    assert.equal(result.total.requests, 3);
  });
});
