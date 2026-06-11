import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { setLocale } from "../i18n.mjs";
import { getDailyStats, getDateRangeStats } from "../providers/mimocode.mjs";
import { createFileTestDB, seedTypicalDay } from "./fixtures/helpers.mjs";

setLocale("zh-CN");

describe("MiMoCode getDailyStats", () => {
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
    assert.equal(result.client, "mimocode");
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
    assert.equal(result.client, "mimocode");
  });

  it("counts tool calls from parts", () => {
    seedTypicalDay(db);
    db.close();
    const result = getDailyStats(dbPath, "2025-04-20");
    assert.equal(result.total.toolCalls, 2);
  });

  it("groups by model", () => {
    seedTypicalDay(db);
    db.close();
    const result = getDailyStats(dbPath, "2025-04-20");

    assert.ok(result.byModel.has("claude-3.5 (anthropic)"));
    assert.ok(result.byModel.has("gpt-4o (openai)"));
  });

  it("groups by project", () => {
    seedTypicalDay(db);
    db.close();
    const result = getDailyStats(dbPath, "2025-04-20");

    assert.ok(result.byProject.has("project-a"));
    assert.ok(result.byProject.has("project-b"));
    assert.ok(result.byProject.has("(global)"));
  });

  it("returns null for non-existent path", () => {
    db.close();
    const result = getDailyStats("/nonexistent/path/mimocode.db", "2025-04-20");
    assert.equal(result, null);
  });

  it("throws on invalid date format", () => {
    assert.throws(() => getDailyStats(dbPath, "2025/04/20"), /Invalid date format/);
  });
});

describe("MiMoCode getDateRangeStats", () => {
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
    seedTypicalDay(db);
    db.close();
    const result = getDateRangeStats(dbPath, "2025-04-19", "2025-04-21");
    assert.equal(result.total.requests, 3);
    assert.equal(result.date, "2025-04-19 ~ 2025-04-21");
    assert.equal(result.client, "mimocode");
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
