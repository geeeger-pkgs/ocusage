import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getDailyStats } from "../db.mjs";
import { createTestDB, seedTypicalDay, insertSession, insertMessage, DAY } from "./fixtures/helpers.mjs";

describe("getDailyStats", () => {
  let db;

  beforeEach(async () => {
    db = await createTestDB();
  });

  it("returns empty stats for a day with no data", () => {
    const result = getDailyStats(db, "2025-01-01");
    assert.equal(result.total.requests, 0);
    assert.equal(result.total.totalTokens, 0);
    assert.equal(result.date, "2025-01-01");
  });

  it("aggregates stats from typical day", () => {
    seedTypicalDay(db);
    const result = getDailyStats(db, "2025-04-20");

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
    const result = getDailyStats(db, "2025-04-20");

    assert.equal(result.total.toolCalls, 2);
  });

  it("skips user role messages", () => {
    seedTypicalDay(db);
    const result = getDailyStats(db, "2025-04-20");

    const claudeStats = result.byModel.get("claude-3.5 (anthropic)");
    assert.ok(claudeStats);
    assert.equal(claudeStats.requests, 2);
  });

  it("groups by model", () => {
    seedTypicalDay(db);
    const result = getDailyStats(db, "2025-04-20");

    assert.ok(result.byModel.has("claude-3.5 (anthropic)"));
    assert.ok(result.byModel.has("gpt-4o (openai)"));

    const gptStats = result.byModel.get("gpt-4o (openai)");
    assert.equal(gptStats.requests, 1);
    assert.equal(gptStats.totalTokens, 3000);
  });

  it("groups by project", () => {
    seedTypicalDay(db);
    const result = getDailyStats(db, "2025-04-20");

    assert.ok(result.byProject.has("project-a"));
    assert.ok(result.byProject.has("project-b"));
    assert.ok(result.byProject.has("(global)"));

    const paStats = result.byProject.get("project-a");
    assert.equal(paStats.requests, 1);
  });

  it("groups by provider", () => {
    seedTypicalDay(db);
    const result = getDailyStats(db, "2025-04-20");

    assert.ok(result.byProvider.has("anthropic"));
    assert.ok(result.byProvider.has("openai"));

    const anthropicStats = result.byProvider.get("anthropic");
    assert.equal(anthropicStats.requests, 2);
  });

  it("does not leak data across days", () => {
    seedTypicalDay(db);
    const result = getDailyStats(db, "2025-04-21");
    assert.equal(result.total.requests, 0);
  });

  it("handles malformed message data gracefully", () => {
    insertSession(db, "s1", "/project");
    db.run("INSERT INTO message (id, session_id, data, time_created) VALUES (?, ?, ?, ?)",
      ["m-bad", "s1", "not-json", DAY["2025-04-20"].start + 1000]);

    const result = getDailyStats(db, "2025-04-20");
    assert.equal(result.total.requests, 0);
  });
});
