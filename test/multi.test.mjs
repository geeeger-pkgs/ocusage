import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setLocale } from "../i18n.mjs";
import { aggregateStats } from "../providers/index.mjs";

setLocale("zh-CN");

function makeStats(overrides = {}) {
  return {
    total: {
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      toolCalls: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      ...overrides.total,
    },
    byModel: new Map(overrides.byModel || []),
    byProject: new Map(overrides.byProject || []),
    byProvider: new Map(overrides.byProvider || []),
    date: overrides.date || "2025-04-20",
    client: overrides.client || "test",
  };
}

describe("aggregateStats", () => {
  it("returns empty stats for empty input", () => {
    const result = aggregateStats([], "2025-04-20");
    assert.equal(result.total.requests, 0);
    assert.equal(result.total.totalTokens, 0);
    assert.equal(result.date, "2025-04-20");
    assert.equal(result.byModel.size, 0);
    assert.equal(result.byProject.size, 0);
    assert.equal(result.byProvider.size, 0);
  });

  it("skips null stats", () => {
    const result = aggregateStats([{ stats: null }, { stats: undefined }], "2025-04-20");
    assert.equal(result.total.requests, 0);
  });

  it("skips encrypted stats", () => {
    const result = aggregateStats([{ stats: { encrypted: true } }], "2025-04-20");
    assert.equal(result.total.requests, 0);
  });

  it("aggregates totals from multiple clients", () => {
    const s1 = makeStats({
      total: {
        requests: 10,
        inputTokens: 1000,
        outputTokens: 500,
        toolCalls: 3,
        cacheRead: 100,
        cacheWrite: 50,
        totalTokens: 1500,
      },
    });
    const s2 = makeStats({
      total: {
        requests: 5,
        inputTokens: 2000,
        outputTokens: 800,
        toolCalls: 1,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 2800,
      },
    });

    const result = aggregateStats([{ stats: s1 }, { stats: s2 }], "2025-04-20");

    assert.equal(result.total.requests, 15);
    assert.equal(result.total.inputTokens, 3000);
    assert.equal(result.total.outputTokens, 1300);
    assert.equal(result.total.toolCalls, 4);
    assert.equal(result.total.cacheRead, 100);
    assert.equal(result.total.cacheWrite, 50);
    assert.equal(result.total.totalTokens, 4300);
  });

  it("merges byModel from multiple clients", () => {
    const s1 = makeStats({
      total: {
        requests: 2,
        inputTokens: 1000,
        outputTokens: 500,
        toolCalls: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 1500,
      },
      byModel: [
        [
          "claude-3.5 (anthropic)",
          {
            requests: 2,
            inputTokens: 1000,
            outputTokens: 500,
            toolCalls: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 1500,
          },
        ],
      ],
    });
    const s2 = makeStats({
      total: {
        requests: 1,
        inputTokens: 2000,
        outputTokens: 1000,
        toolCalls: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 3000,
      },
      byModel: [
        [
          "gpt-4o (openai)",
          {
            requests: 1,
            inputTokens: 2000,
            outputTokens: 1000,
            toolCalls: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 3000,
          },
        ],
      ],
    });

    const result = aggregateStats([{ stats: s1 }, { stats: s2 }], "2025-04-20");

    assert.equal(result.byModel.size, 2);
    assert.ok(result.byModel.has("claude-3.5 (anthropic)"));
    assert.ok(result.byModel.has("gpt-4o (openai)"));
    assert.equal(result.byModel.get("claude-3.5 (anthropic)").totalTokens, 1500);
    assert.equal(result.byModel.get("gpt-4o (openai)").totalTokens, 3000);
  });

  it("merges same model across clients", () => {
    const s1 = makeStats({
      total: {
        requests: 1,
        inputTokens: 1000,
        outputTokens: 0,
        toolCalls: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 1000,
      },
      byModel: [
        [
          "gpt-4o (openai)",
          {
            requests: 1,
            inputTokens: 1000,
            outputTokens: 0,
            toolCalls: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 1000,
          },
        ],
      ],
    });
    const s2 = makeStats({
      total: {
        requests: 1,
        inputTokens: 2000,
        outputTokens: 0,
        toolCalls: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 2000,
      },
      byModel: [
        [
          "gpt-4o (openai)",
          {
            requests: 1,
            inputTokens: 2000,
            outputTokens: 0,
            toolCalls: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 2000,
          },
        ],
      ],
    });

    const result = aggregateStats([{ stats: s1 }, { stats: s2 }], "2025-04-20");

    assert.equal(result.byModel.size, 1);
    const m = result.byModel.get("gpt-4o (openai)");
    assert.equal(m.requests, 2);
    assert.equal(m.totalTokens, 3000);
  });

  it("merges byProject from multiple clients", () => {
    const s1 = makeStats({
      total: {
        requests: 1,
        inputTokens: 500,
        outputTokens: 0,
        toolCalls: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 500,
      },
      byProject: [
        [
          "project-a",
          {
            requests: 1,
            inputTokens: 500,
            outputTokens: 0,
            toolCalls: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 500,
          },
        ],
      ],
    });
    const s2 = makeStats({
      total: {
        requests: 1,
        inputTokens: 300,
        outputTokens: 0,
        toolCalls: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 300,
      },
      byProject: [
        [
          "project-b",
          {
            requests: 1,
            inputTokens: 300,
            outputTokens: 0,
            toolCalls: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 300,
          },
        ],
      ],
    });

    const result = aggregateStats([{ stats: s1 }, { stats: s2 }], "2025-04-20");

    assert.equal(result.byProject.size, 2);
    assert.equal(result.byProject.get("project-a").totalTokens, 500);
    assert.equal(result.byProject.get("project-b").totalTokens, 300);
  });

  it("merges byProvider from multiple clients", () => {
    const s1 = makeStats({
      total: {
        requests: 1,
        inputTokens: 100,
        outputTokens: 0,
        toolCalls: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 100,
      },
      byProvider: [
        [
          "anthropic",
          {
            requests: 1,
            inputTokens: 100,
            outputTokens: 0,
            toolCalls: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 100,
          },
        ],
      ],
    });
    const s2 = makeStats({
      total: {
        requests: 1,
        inputTokens: 200,
        outputTokens: 0,
        toolCalls: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 200,
      },
      byProvider: [
        [
          "openai",
          {
            requests: 1,
            inputTokens: 200,
            outputTokens: 0,
            toolCalls: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 200,
          },
        ],
      ],
    });

    const result = aggregateStats([{ stats: s1 }, { stats: s2 }], "2025-04-20");

    assert.equal(result.byProvider.size, 2);
    assert.equal(result.byProvider.get("anthropic").totalTokens, 100);
    assert.equal(result.byProvider.get("openai").totalTokens, 200);
  });

  it("preserves date label", () => {
    const result = aggregateStats([], "2025-04-01 ~ 2025-04-30");
    assert.equal(result.date, "2025-04-01 ~ 2025-04-30");
  });
});
