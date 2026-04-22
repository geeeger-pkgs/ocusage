import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatNumber, printReport } from "../report.mjs";

describe("formatNumber", () => {
  it("returns 0 for 0", () => {
    assert.equal(formatNumber(0), "0");
  });

  it("returns 0 for null", () => {
    assert.equal(formatNumber(null), "0");
  });

  it("returns 0 for undefined", () => {
    assert.equal(formatNumber(undefined), "0");
  });

  it("formats numbers under 1000 as-is", () => {
    assert.equal(formatNumber(42), "42");
    assert.equal(formatNumber(999), "999");
  });

  it("formats thousands with K suffix", () => {
    assert.equal(formatNumber(1000), "1.0K");
    assert.equal(formatNumber(15000), "15.0K");
    assert.equal(formatNumber(999999), "1000.0K");
  });

  it("formats millions with M suffix", () => {
    assert.equal(formatNumber(1_000_000), "1.0M");
    assert.equal(formatNumber(2_500_000), "2.5M");
  });
});

describe("printReport (json mode)", () => {
  it("outputs valid JSON with correct structure", () => {
    const emptyStat = () => ({
      requests: 0, inputTokens: 0, outputTokens: 0, toolCalls: 0,
      cacheRead: 0, cacheWrite: 0, totalTokens: 0,
    });

    const byModel = new Map();
    byModel.set("test-model (test-provider)", {
      requests: 1, inputTokens: 100, outputTokens: 50, toolCalls: 0,
      cacheRead: 0, cacheWrite: 0, totalTokens: 150,
    });

    const stats = {
      date: "2025-04-20",
      total: { requests: 1, inputTokens: 100, outputTokens: 50, toolCalls: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 150 },
      byModel,
      byProject: new Map(),
      byProvider: new Map(),
    };

    const logs = [];
    const origLog = console.log;
    console.log = (s) => logs.push(s);

    try {
      printReport(stats, { json: true });
    } finally {
      console.log = origLog;
    }

    const parsed = JSON.parse(logs[0]);
    assert.equal(parsed.date, "2025-04-20");
    assert.equal(parsed.total.totalTokens, 150);
    assert.ok(parsed.byModel["test-model (test-provider)"]);
    assert.ok(!parsed.byProject["(global)"]);
  });
});
