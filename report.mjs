import chalk from "chalk";
import Table from "cli-table3";

export function formatNumber(n) {
  if (n === null || n === undefined || n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function makeTable(headers) {
  return new Table({
    head: headers,
    style: {
      head: ["cyan", "bold"],
      border: ["gray"],
      compact: true,
    },
    chars: {
      top: "─",
      "top-mid": "┬",
      "top-left": "┌",
      "top-right": "┐",
      bottom: "─",
      "bottom-mid": "┴",
      "bottom-left": "└",
      "bottom-right": "┘",
      left: "│",
      "left-mid": "├",
      mid: "─",
      "mid-mid": "┼",
      right: "│",
      "right-mid": "┤",
      middle: "│",
    },
    wordWrap: true,
  });
}

function statRow(label, s, labelChalk) {
  return [
    labelChalk ? labelChalk(label) : label,
    formatNumber(s.requests),
    formatNumber(s.inputTokens),
    formatNumber(s.outputTokens),
    formatNumber(s.toolCalls),
    formatNumber(s.cacheRead),
    formatNumber(s.cacheWrite),
    chalk.yellow.bold(formatNumber(s.totalTokens)),
  ];
}

function isAllZero(s) {
  return (
    s.requests === 0 &&
    s.inputTokens === 0 &&
    s.outputTokens === 0 &&
    s.toolCalls === 0 &&
    s.cacheRead === 0 &&
    s.cacheWrite === 0 &&
    s.totalTokens === 0
  );
}

const COL_HEADERS = ["今日总请求数", "输入Tokens", "输出Tokens", "工具调用数量", "缓存读取", "缓存创建", "总计Tokens"];
const GROUP_HEADERS = (first) => [
  first,
  "请求数",
  "输入Tokens",
  "输出Tokens",
  "工具调用数量",
  "缓存读取",
  "缓存创建",
  "总计Tokens",
];

function csvEscape(val) {
  const s = String(val);
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

function printCSV(stats) {
  const headers = [
    "分组",
    "名称",
    "请求数",
    "输入Tokens",
    "输出Tokens",
    "工具调用数量",
    "缓存读取",
    "缓存创建",
    "总计Tokens",
  ];
  console.log(headers.join(","));
  console.log(
    [
      "总计",
      "-",
      stats.total.requests,
      stats.total.inputTokens,
      stats.total.outputTokens,
      stats.total.toolCalls,
      stats.total.cacheRead,
      stats.total.cacheWrite,
      stats.total.totalTokens,
    ].join(","),
  );

  for (const [name, s] of stats.byModel) {
    if (isAllZero(s)) continue;
    console.log(
      [
        "模型",
        csvEscape(name),
        s.requests,
        s.inputTokens,
        s.outputTokens,
        s.toolCalls,
        s.cacheRead,
        s.cacheWrite,
        s.totalTokens,
      ].join(","),
    );
  }
  for (const [name, s] of stats.byProject) {
    if (isAllZero(s)) continue;
    console.log(
      [
        "项目",
        csvEscape(name),
        s.requests,
        s.inputTokens,
        s.outputTokens,
        s.toolCalls,
        s.cacheRead,
        s.cacheWrite,
        s.totalTokens,
      ].join(","),
    );
  }
  for (const [name, s] of stats.byProvider) {
    if (isAllZero(s)) continue;
    console.log(
      [
        "供应商",
        csvEscape(name),
        s.requests,
        s.inputTokens,
        s.outputTokens,
        s.toolCalls,
        s.cacheRead,
        s.cacheWrite,
        s.totalTokens,
      ].join(","),
    );
  }
}

function printMarkdown(stats) {
  console.log(`## 📊 使用报告 (${stats.date})\n`);
  console.log("### 总计\n");
  console.log("| 请求数 | 输入Tokens | 输出Tokens | 工具调用 | 缓存读取 | 缓存创建 | 总计Tokens |");
  console.log("|--------|-----------|-----------|---------|---------|---------|-----------|");
  const t = stats.total;
  console.log(
    `| ${t.requests} | ${t.inputTokens} | ${t.outputTokens} | ${t.toolCalls} | ${t.cacheRead} | ${t.cacheWrite} | ${t.totalTokens} |`,
  );

  // 按模型
  console.log("\n### 按模型\n");
  console.log("| 模型 | 请求数 | 输入Tokens | 输出Tokens | 工具调用 | 缓存读取 | 缓存创建 | 总计Tokens |");
  console.log("|------|--------|-----------|-----------|---------|---------|---------|-----------|");
  for (const [name, s] of stats.byModel) {
    if (isAllZero(s)) continue;
    console.log(
      `| ${name} | ${s.requests} | ${s.inputTokens} | ${s.outputTokens} | ${s.toolCalls} | ${s.cacheRead} | ${s.cacheWrite} | ${s.totalTokens} |`,
    );
  }

  // 按项目
  console.log("\n### 按项目\n");
  console.log("| 项目 | 请求数 | 输入Tokens | 输出Tokens | 工具调用 | 缓存读取 | 缓存创建 | 总计Tokens |");
  console.log("|------|--------|-----------|-----------|---------|---------|---------|-----------|");
  for (const [name, s] of stats.byProject) {
    if (isAllZero(s)) continue;
    console.log(
      `| ${name} | ${s.requests} | ${s.inputTokens} | ${s.outputTokens} | ${s.toolCalls} | ${s.cacheRead} | ${s.cacheWrite} | ${s.totalTokens} |`,
    );
  }

  // 按供应商
  console.log("\n### 按供应商\n");
  console.log("| 供应商 | 请求数 | 输入Tokens | 输出Tokens | 工具调用 | 缓存读取 | 缓存创建 | 总计Tokens |");
  console.log("|--------|--------|-----------|-----------|---------|---------|---------|-----------|");
  for (const [name, s] of stats.byProvider) {
    if (isAllZero(s)) continue;
    console.log(
      `| ${name} | ${s.requests} | ${s.inputTokens} | ${s.outputTokens} | ${s.toolCalls} | ${s.cacheRead} | ${s.cacheWrite} | ${s.totalTokens} |`,
    );
  }
}

export function printReport(stats, opts = {}) {
  const format = opts.format || (opts.json ? "json" : "table");

  if (format === "json") {
    const serializeMap = (map) => {
      const obj = {};
      for (const [k, v] of map) {
        if (isAllZero(v)) continue;
        obj[k] = v;
      }
      return obj;
    };
    console.log(
      JSON.stringify(
        {
          date: stats.date,
          total: stats.total,
          byModel: serializeMap(stats.byModel),
          byProject: serializeMap(stats.byProject),
          byProvider: serializeMap(stats.byProvider),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (format === "csv") {
    printCSV(stats);
    return;
  }

  if (format === "markdown") {
    printMarkdown(stats);
    return;
  }

  // table format (default)
  if (stats.total.requests === 0) {
    console.log(chalk.gray(`📭 ${stats.date} 暂无使用记录`));
    return;
  }

  console.log(chalk.bold(`📊 总体数据 (${stats.date})`));
  const t1 = makeTable(COL_HEADERS);
  t1.push([
    formatNumber(stats.total.requests),
    formatNumber(stats.total.inputTokens),
    formatNumber(stats.total.outputTokens),
    formatNumber(stats.total.toolCalls),
    formatNumber(stats.total.cacheRead),
    formatNumber(stats.total.cacheWrite),
    chalk.yellow.bold(formatNumber(stats.total.totalTokens)),
  ]);
  console.log(t1.toString());

  console.log(chalk.bold("\n📊 按模型分组"));
  const t2 = makeTable(GROUP_HEADERS("模型"));
  for (const [model, s] of stats.byModel) {
    if (isAllZero(s)) continue;
    t2.push(statRow(model, s, chalk.cyan));
  }
  console.log(t2.toString());

  console.log(chalk.bold("\n📊 按项目分组"));
  const t3 = makeTable(GROUP_HEADERS("项目"));
  for (const [project, s] of stats.byProject) {
    if (isAllZero(s)) continue;
    t3.push(statRow(project, s, chalk.cyan));
  }
  console.log(t3.toString());

  console.log(chalk.bold("\n📊 按供应商分组"));
  const t4 = makeTable(GROUP_HEADERS("供应商"));
  for (const [provider, s] of stats.byProvider) {
    if (isAllZero(s)) continue;
    t4.push(statRow(provider, s, chalk.cyan));
  }
  console.log(t4.toString());
}
