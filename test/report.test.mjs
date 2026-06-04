import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setLocale } from "../i18n.mjs";
import { formatNumber, printReport } from "../report.mjs";

setLocale("zh-CN");

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
    const _emptyStat = () => ({
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      toolCalls: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
    });

    const byModel = new Map();
    byModel.set("test-model (test-provider)", {
      requests: 1,
      inputTokens: 100,
      outputTokens: 50,
      toolCalls: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 150,
    });

    const stats = {
      date: "2025-04-20",
      total: {
        requests: 1,
        inputTokens: 100,
        outputTokens: 50,
        toolCalls: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 150,
      },
      byModel,
      byProject: new Map(),
      byProvider: new Map(),
    };

    const logs = [];
    const origLog = console.log;
    console.log = (s) => logs.push(s);

    try {
      printReport(stats, { format: "json" });
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

describe("printReport (csv mode)", () => {
  it("outputs CSV with correct headers and data", () => {
    const stats = {
      date: "2025-04-20",
      total: {
        requests: 2,
        inputTokens: 500,
        outputTokens: 200,
        toolCalls: 1,
        cacheRead: 50,
        cacheWrite: 10,
        totalTokens: 760,
      },
      byModel: new Map([
        [
          "gpt-4o (openai)",
          {
            requests: 2,
            inputTokens: 500,
            outputTokens: 200,
            toolCalls: 1,
            cacheRead: 50,
            cacheWrite: 10,
            totalTokens: 760,
          },
        ],
      ]),
      byProject: new Map([
        [
          "my-project",
          {
            requests: 2,
            inputTokens: 500,
            outputTokens: 200,
            toolCalls: 1,
            cacheRead: 50,
            cacheWrite: 10,
            totalTokens: 760,
          },
        ],
      ]),
      byProvider: new Map([
        [
          "openai",
          {
            requests: 2,
            inputTokens: 500,
            outputTokens: 200,
            toolCalls: 1,
            cacheRead: 50,
            cacheWrite: 10,
            totalTokens: 760,
          },
        ],
      ]),
    };

    const logs = [];
    const origLog = console.log;
    console.log = (s) => logs.push(s);
    try {
      printReport(stats, { format: "csv" });
    } finally {
      console.log = origLog;
    }

    assert.ok(logs[0].startsWith("分组,"));
    assert.ok(logs[1].startsWith("总计,"));
    assert.ok(logs.some((l) => l.includes("模型")));
    assert.ok(logs.some((l) => l.includes("项目")));
    assert.ok(logs.some((l) => l.includes("供应商")));
  });
});

describe("printReport (markdown mode)", () => {
  it("outputs valid markdown tables", () => {
    const stats = {
      date: "2025-04-20",
      total: {
        requests: 1,
        inputTokens: 100,
        outputTokens: 50,
        toolCalls: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 150,
      },
      byModel: new Map([
        [
          "test-model (test)",
          {
            requests: 1,
            inputTokens: 100,
            outputTokens: 50,
            toolCalls: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 150,
          },
        ],
      ]),
      byProject: new Map(),
      byProvider: new Map([
        [
          "test",
          {
            requests: 1,
            inputTokens: 100,
            outputTokens: 50,
            toolCalls: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 150,
          },
        ],
      ]),
    };

    const logs = [];
    const origLog = console.log;
    console.log = (s) => logs.push(s);
    try {
      printReport(stats, { format: "markdown" });
    } finally {
      console.log = origLog;
    }

    const output = logs.join("\n");
    assert.ok(output.includes("## 📊 使用报告"));
    assert.ok(output.includes("### 总计"));
    assert.ok(output.includes("| 请求数 |"));
    assert.ok(output.includes("### 按模型"));
  });
});

describe("printReport (empty data friendly message)", () => {
  it("shows friendly message in table mode when no data", () => {
    const stats = {
      date: "2025-04-20",
      total: {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        toolCalls: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
      },
      byModel: new Map(),
      byProject: new Map(),
      byProvider: new Map(),
    };

    const logs = [];
    const origLog = console.log;
    console.log = (s) => logs.push(s);
    try {
      printReport(stats, { format: "table" });
    } finally {
      console.log = origLog;
    }

    assert.ok(logs.join("").includes("暂无使用记录"));
  });
});
