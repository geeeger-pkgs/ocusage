import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { getDailyStats, getDateRangeStats } from "../providers/deepseek-harness.mjs";

const date = "2026-09-09";
const time = Date.parse(`${date}T12:00:00Z`);

function message(step = 1, timestamp = time) {
  return {
    type: "assistant/message",
    time: timestamp,
    data: {
      turn: 1,
      step,
      usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 50, cacheWriteTokens: 10, reasoningTokens: 5 },
      message: { source: { provider: "deepseek", model: "test-model" } },
    },
  };
}

function tool(step = 1) {
  return { type: "tool/call", time, data: { turn: 1, step } };
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "ocusage-dsh-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function header(id, createdAt) {
  return { type: "session", version: 3, id, createdAt };
}

function session(root, id, fileName, events, modified = time, created = events[0]?.time ?? modified) {
  const dir = join(root, "sessions", "project", id);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, fileName);
  writeFileSync(path, `${[header(id, created), ...events].map((event) => JSON.stringify(event)).join("\n")}\n`);
  utimesSync(path, new Date(modified), new Date(modified));
  return path;
}

it("counts a session once when legacy and v1 generations contain the same usage and tools", (t) => {
  const root = fixture(t);
  const events = [message(), tool()];
  session(root, "one", "session.jsonl", events);
  session(root, "one", "session.v1.jsonl", events);

  const stats = getDailyStats(root, date);
  const expected = {
    requests: 1,
    inputTokens: 100,
    outputTokens: 20,
    toolCalls: 1,
    cacheRead: 50,
    cacheWrite: 10,
    totalTokens: 180,
  };
  assert.deepEqual(stats.total, expected);
  assert.deepEqual(stats.byModel.get("test-model (deepseek)"), expected);
  assert.deepEqual(stats.byProject.get("project"), expected);
  assert.deepEqual(stats.byProvider.get("deepseek"), expected);
});

it("selects the highest numeric generation separately for each session", (t) => {
  const root = fixture(t);
  session(root, "one", "session.jsonl", [message()]);
  session(root, "one", "session.v2.jsonl", [message(), message(2)]);
  session(root, "one", "session.v3.jsonl", [message(), message(2), message(3)]);
  session(root, "two", "session.jsonl", [message()]);
  assert.equal(getDailyStats(root, date).total.requests, 4);
});

it("finds in-range events in files last modified after the range end", (t) => {
  const root = fixture(t);
  const nextDay = Date.parse("2026-09-10T12:00:00Z");
  session(root, "spanning", "session.jsonl", [message(), message(2, nextDay)], Date.parse("2026-09-15T12:00:00Z"));
  assert.equal(getDailyStats(root, date).total.requests, 1);
  assert.equal(getDailyStats(root, "2026-09-10").total.requests, 1);
  assert.equal(getDateRangeStats(root, date, "2026-09-10").total.requests, 2);
});

it("skips files last modified before the range starts", (t) => {
  const root = fixture(t);
  const earlier = Date.parse("2026-09-01T12:00:00Z");
  session(root, "stale", "session.jsonl", [message(1, earlier)], earlier);
  assert.equal(getDailyStats(root, date).total.requests, 0);
});

it("skips files created after the range ends", (t) => {
  const root = fixture(t);
  const later = Date.parse("2026-09-10T12:00:00Z");
  session(root, "newer", "session.jsonl", [message(1, later)], later);
  assert.equal(getDailyStats(root, date).total.requests, 0);
  assert.equal(getDailyStats(root, "2026-09-10").total.requests, 1);
});

it("keeps tool counts isolated across sessions with identical turn and step identifiers", (t) => {
  const root = fixture(t);
  session(root, "one", "session.jsonl", [message(), tool(), tool()]);
  session(root, "two", "session.jsonl", [message(), tool()]);
  session(root, "three", "session.jsonl", [message()]);
  const stats = getDailyStats(root, date);
  assert.equal(stats.total.requests, 3);
  assert.equal(stats.total.toolCalls, 3);
});

it("still includes noncanonical JSONL files alongside canonical sessions", (t) => {
  const root = fixture(t);
  session(root, "one", "session.jsonl", [message()]);
  session(root, "one", "other.jsonl", [message(2)]);
  assert.equal(getDailyStats(root, date).total.requests, 2);
});
