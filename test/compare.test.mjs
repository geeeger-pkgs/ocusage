import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePeriod } from "../db.mjs";
import { setLocale } from "../i18n.mjs";
import { formatChangeRate, formatDiff, printCompareReport } from "../report.mjs";

setLocale("zh-CN");

describe("parsePeriod", () => {
  it("parses YYYY-MM-DD format returning same from/to", () => {
    const result = parsePeriod("2025-04-20");
    assert.deepEqual(result, { from: "2025-04-20", to: "2025-04-20" });
  });

  it("parses YYYY-MM format expanding to first and last day of month", () => {
    const result = parsePeriod("2025-03");
    assert.equal(result.from, "2025-03-01");
    assert.equal(result.to, "2025-03-31");
  });

  it("handles February in a leap year (2024-02 -> 29)", () => {
    const result = parsePeriod("2024-02");
    assert.equal(result.from, "2024-02-01");
    assert.equal(result.to, "2024-02-29");
  });

  it("handles February in a non-leap year (2025-02 -> 28)", () => {
    const result = parsePeriod("2025-02");
    assert.equal(result.from, "2025-02-01");
    assert.equal(result.to, "2025-02-28");
  });

  it("throws on invalid format", () => {
    assert.throws(() => parsePeriod("abc"), /时段格式无效/);
    assert.throws(() => parsePeriod("2025"), /时段格式无效/);
    assert.throws(() => parsePeriod("2025-1"), /时段格式无效/);
  });

  it("throws on invalid month (month 13)", () => {
    assert.throws(() => parsePeriod("2025-13"), /时段格式无效/);
  });

  it("throws on invalid month (month 0)", () => {
    assert.throws(() => parsePeriod("2025-00"), /时段格式无效/);
  });

  it("throws on non-existent date in YYYY-MM-DD format", () => {
    assert.throws(() => parsePeriod("2025-02-29"), /日期不存在/);
  });
});

describe("formatDiff", () => {
  it("returns positive diff with + prefix", () => {
    assert.equal(formatDiff(100, 200), "+100");
  });

  it("returns negative diff without + prefix", () => {
    assert.equal(formatDiff(200, 100), "-100");
  });

  it("returns +0 for zero diff", () => {
    assert.equal(formatDiff(100, 100), "+0");
  });

  it("formats large numbers with K suffix", () => {
    assert.equal(formatDiff(1000, 5000), "+4.0K");
  });
});

describe("formatChangeRate", () => {
  it("returns 0% when both values are 0", () => {
    assert.equal(formatChangeRate(0, 0), "0%");
  });

  it("returns N/A when a is 0 and b is not", () => {
    assert.equal(formatChangeRate(0, 100), "N/A");
  });

  it("calculates positive change rate with + prefix", () => {
    assert.equal(formatChangeRate(100, 150), "+50.0%");
  });

  it("calculates negative change rate", () => {
    assert.equal(formatChangeRate(200, 100), "-50.0%");
  });

  it("handles 100% increase (doubled)", () => {
    assert.equal(formatChangeRate(100, 200), "+100.0%");
  });
});

function makeStats(requests, inputTokens, outputTokens, toolCalls, cacheRead, cacheWrite, totalTokens) {
  return {
    requests,
    inputTokens,
    outputTokens,
    toolCalls,
    cacheRead,
    cacheWrite,
    totalTokens,
  };
}

function makeCompareStats(totalA, totalB, byModelA = new Map(), byModelB = new Map()) {
  return {
    statsA: {
      date: "2025-03",
      total: totalA,
      byModel: byModelA,
      byProject: new Map(),
      byProvider: new Map(),
    },
    statsB: {
      date: "2025-04",
      total: totalB,
      byModel: byModelB,
      byProject: new Map(),
      byProvider: new Map(),
    },
  };
}

describe("printCompareReport (table format)", () => {
  it("outputs compare title without throwing", () => {
    const { statsA, statsB } = makeCompareStats(
      makeStats(10, 1000, 500, 5, 100, 50, 1650),
      makeStats(20, 2000, 1000, 10, 200, 100, 3300),
    );

    const logs = [];
    const origLog = console.log;
    console.log = (s) => logs.push(s);
    try {
      printCompareReport(statsA, statsB, { format: "table", labelA: "2025-03", labelB: "2025-04" });
    } finally {
      console.log = origLog;
    }

    const output = logs.join("\n");
    assert.ok(output.includes("对比"));
    assert.ok(output.includes("差值"));
    assert.ok(output.includes("变化率"));
  });
});

describe("printCompareReport (json format)", () => {
  it("outputs valid JSON with correct structure", () => {
    const { statsA, statsB } = makeCompareStats(
      makeStats(10, 1000, 500, 5, 100, 50, 1650),
      makeStats(20, 2000, 1000, 10, 200, 100, 3300),
    );

    const logs = [];
    const origLog = console.log;
    console.log = (s) => logs.push(s);
    try {
      printCompareReport(statsA, statsB, { format: "json", labelA: "2025-03", labelB: "2025-04" });
    } finally {
      console.log = origLog;
    }

    const parsed = JSON.parse(logs[0]);
    assert.equal(parsed.labelA, "2025-03");
    assert.equal(parsed.labelB, "2025-04");
    assert.equal(parsed.statsA.totalTokens, 1650);
    assert.equal(parsed.statsB.totalTokens, 3300);
    assert.equal(parsed.diff.totalTokens, 1650);
    assert.ok(parsed.changeRate);
  });
});

describe("printCompareReport (csv format)", () => {
  it("outputs CSV with headers", () => {
    const { statsA, statsB } = makeCompareStats(
      makeStats(5, 500, 200, 2, 50, 10, 760),
      makeStats(10, 1000, 400, 4, 100, 20, 1520),
    );

    const logs = [];
    const origLog = console.log;
    console.log = (s) => logs.push(s);
    try {
      printCompareReport(statsA, statsB, { format: "csv", labelA: "2025-03", labelB: "2025-04" });
    } finally {
      console.log = origLog;
    }

    assert.ok(logs[0].startsWith("metric,"));
    assert.ok(logs.some((l) => l.includes("请求数")));
  });
});

describe("printCompareReport (markdown format)", () => {
  it("outputs markdown table", () => {
    const { statsA, statsB } = makeCompareStats(
      makeStats(5, 500, 200, 2, 50, 10, 760),
      makeStats(10, 1000, 400, 4, 100, 20, 1520),
    );

    const logs = [];
    const origLog = console.log;
    console.log = (s) => logs.push(s);
    try {
      printCompareReport(statsA, statsB, { format: "markdown", labelA: "2025-03", labelB: "2025-04" });
    } finally {
      console.log = origLog;
    }

    const output = logs.join("\n");
    assert.ok(output.includes("对比"));
    assert.ok(output.includes("|---|"));
  });
});

describe("printCompareReport A=0 shows N/A", () => {
  it("shows N/A change rate when A value is 0", () => {
    const { statsA, statsB } = makeCompareStats(
      makeStats(0, 0, 0, 0, 0, 0, 0),
      makeStats(10, 1000, 500, 5, 100, 50, 1650),
    );

    const logs = [];
    const origLog = console.log;
    console.log = (s) => logs.push(s);
    try {
      printCompareReport(statsA, statsB, { format: "json", labelA: "empty", labelB: "2025-04" });
    } finally {
      console.log = origLog;
    }

    const parsed = JSON.parse(logs[0]);
    assert.equal(parsed.changeRate.totalTokens, "N/A");
  });
});
