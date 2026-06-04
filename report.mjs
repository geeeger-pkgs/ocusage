import chalk from "chalk";
import Table from "cli-table3";
import { t } from "./i18n.mjs";

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

const COL_HEADERS = () => [
  t("totalRequests"),
  t("inputTokens"),
  t("outputTokens"),
  t("toolCalls"),
  t("cacheRead"),
  t("cacheWrite"),
  t("totalTokens"),
];
const GROUP_HEADERS = (first) => [
  first,
  t("requests"),
  t("inputTokens"),
  t("outputTokens"),
  t("toolCalls"),
  t("cacheRead"),
  t("cacheWrite"),
  t("totalTokens"),
];

function csvEscape(val) {
  const s = String(val);
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

function printCSV(stats) {
  const headers = [
    t("csvGroup"),
    t("csvName"),
    t("requests"),
    t("inputTokens"),
    t("outputTokens"),
    t("toolCalls"),
    t("cacheRead"),
    t("cacheWrite"),
    t("totalTokens"),
  ];
  console.log(headers.join(","));
  console.log(
    [
      t("groupTotal"),
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
        t("groupModel"),
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
        t("groupProject"),
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
        t("groupProvider"),
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
  console.log(t("usageReport", { date: stats.date }));
  console.log();
  console.log(t("mdTotal"));
  console.log();
  console.log(
    `| ${t("requests")} | ${t("inputTokens")} | ${t("outputTokens")} | ${t("toolCalls")} | ${t("cacheRead")} | ${t("cacheWrite")} | ${t("totalTokens")} |`,
  );
  console.log("|--------|-----------|-----------|---------|---------|---------|-----------|");
  const tot = stats.total;
  console.log(
    `| ${tot.requests} | ${tot.inputTokens} | ${tot.outputTokens} | ${tot.toolCalls} | ${tot.cacheRead} | ${tot.cacheWrite} | ${tot.totalTokens} |`,
  );

  // 按模型
  console.log(`\n${t("mdByModel")}\n`);
  console.log(
    `| ${t("model")} | ${t("requests")} | ${t("inputTokens")} | ${t("outputTokens")} | ${t("toolCalls")} | ${t("cacheRead")} | ${t("cacheWrite")} | ${t("totalTokens")} |`,
  );
  console.log("|------|--------|-----------|-----------|---------|---------|---------|-----------|");
  for (const [name, s] of stats.byModel) {
    if (isAllZero(s)) continue;
    console.log(
      `| ${name} | ${s.requests} | ${s.inputTokens} | ${s.outputTokens} | ${s.toolCalls} | ${s.cacheRead} | ${s.cacheWrite} | ${s.totalTokens} |`,
    );
  }

  // 按项目
  console.log(`\n${t("mdByProject")}\n`);
  console.log(
    `| ${t("project")} | ${t("requests")} | ${t("inputTokens")} | ${t("outputTokens")} | ${t("toolCalls")} | ${t("cacheRead")} | ${t("cacheWrite")} | ${t("totalTokens")} |`,
  );
  console.log("|------|--------|-----------|-----------|---------|---------|---------|-----------|");
  for (const [name, s] of stats.byProject) {
    if (isAllZero(s)) continue;
    console.log(
      `| ${name} | ${s.requests} | ${s.inputTokens} | ${s.outputTokens} | ${s.toolCalls} | ${s.cacheRead} | ${s.cacheWrite} | ${s.totalTokens} |`,
    );
  }

  // 按供应商
  console.log(`\n${t("mdByProvider")}\n`);
  console.log(
    `| ${t("provider")} | ${t("requests")} | ${t("inputTokens")} | ${t("outputTokens")} | ${t("toolCalls")} | ${t("cacheRead")} | ${t("cacheWrite")} | ${t("totalTokens")} |`,
  );
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
    console.log(chalk.gray(t("noData", { date: stats.date })));
    return;
  }

  console.log(chalk.bold(t("overallData", { date: stats.date })));
  const t1 = makeTable(COL_HEADERS());
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

  console.log(chalk.bold(`\n${t("byModelTitle")}`));
  const t2 = makeTable(GROUP_HEADERS(t("model")));
  for (const [model, s] of stats.byModel) {
    if (isAllZero(s)) continue;
    t2.push(statRow(model, s, chalk.cyan));
  }
  console.log(t2.toString());

  console.log(chalk.bold(`\n${t("byProjectTitle")}`));
  const t3 = makeTable(GROUP_HEADERS(t("project")));
  for (const [project, s] of stats.byProject) {
    if (isAllZero(s)) continue;
    t3.push(statRow(project, s, chalk.cyan));
  }
  console.log(t3.toString());

  console.log(chalk.bold(`\n${t("byProviderTitle")}`));
  const t4 = makeTable(GROUP_HEADERS(t("provider")));
  for (const [provider, s] of stats.byProvider) {
    if (isAllZero(s)) continue;
    t4.push(statRow(provider, s, chalk.cyan));
  }
  console.log(t4.toString());
}
