import chalk from "chalk";
import Table from "cli-table3";
import { t } from "./i18n.mjs";
import { EMPTY_STAT, isAllZero } from "./providers/base.mjs";

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

export function formatDiff(a, b) {
  const diff = b - a;
  if (diff === 0) return "+0";
  const prefix = diff > 0 ? "+" : "-";
  return prefix + formatNumber(Math.abs(diff));
}

export function formatChangeRate(a, b) {
  if (a === 0 && b === 0) return "0%";
  if (a === 0) return "N/A";
  const rate = ((b - a) / a) * 100;
  const prefix = rate >= 0 ? "+" : "";
  return `${prefix}${rate.toFixed(1)}%`;
}

const COMPARE_FIELDS = () => [
  ["requests", t("requests")],
  ["inputTokens", t("inputTokens")],
  ["outputTokens", t("outputTokens")],
  ["toolCalls", t("toolCalls")],
  ["cacheRead", t("cacheRead")],
  ["cacheWrite", t("cacheWrite")],
  ["totalTokens", t("totalTokens")],
];

function compareGrouped(mapA, mapB, groupTitle, nameHeader) {
  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);

  console.log(chalk.bold(`\n${groupTitle}`));
  const tbl = makeTable([nameHeader, "A", "B", t("diff"), t("changeRate")]);
  for (const key of allKeys) {
    const sA = mapA.get(key) || EMPTY_STAT();
    const sB = mapB.get(key) || EMPTY_STAT();
    if (isAllZero(sA) && isAllZero(sB)) continue;
    tbl.push([
      chalk.cyan(key),
      formatNumber(sA.totalTokens),
      formatNumber(sB.totalTokens),
      formatDiff(sA.totalTokens, sB.totalTokens),
      formatChangeRate(sA.totalTokens, sB.totalTokens),
    ]);
  }
  console.log(tbl.toString());
}

export function printCompareReport(statsA, statsB, opts = {}) {
  const format = opts.format || "table";
  const labelA = opts.labelA || statsA.date;
  const labelB = opts.labelB || statsB.date;

  if (format === "json") {
    const diff = {};
    const changeRate = {};
    for (const [field] of COMPARE_FIELDS()) {
      diff[field] = statsB.total[field] - statsA.total[field];
      changeRate[field] =
        statsA.total[field] === 0 && statsB.total[field] === 0
          ? "0%"
          : statsA.total[field] === 0
            ? "N/A"
            : `${(((statsB.total[field] - statsA.total[field]) / statsA.total[field]) * 100).toFixed(1)}%`;
    }
    console.log(
      JSON.stringify(
        {
          labelA,
          labelB,
          statsA: statsA.total,
          statsB: statsB.total,
          diff,
          changeRate,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (format === "csv") {
    console.log(["metric", labelA, labelB, t("diff"), t("changeRate")].join(","));
    for (const [field, label] of COMPARE_FIELDS()) {
      const a = statsA.total[field];
      const b = statsB.total[field];
      console.log([label, a, b, b - a, formatChangeRate(a, b)].join(","));
    }
    return;
  }

  if (format === "markdown") {
    console.log(t("compareTitle", { a: labelA, b: labelB }));
    console.log();
    console.log(`| | ${labelA} | ${labelB} | ${t("diff")} | ${t("changeRate")} |`);
    console.log("|---|---|---|---|---|");
    for (const [field, label] of COMPARE_FIELDS()) {
      const a = statsA.total[field];
      const b = statsB.total[field];
      console.log(
        `| ${label} | ${formatNumber(a)} | ${formatNumber(b)} | ${formatDiff(a, b)} | ${formatChangeRate(a, b)} |`,
      );
    }
    return;
  }

  // table format (default)
  console.log(chalk.bold(t("compareTitle", { a: labelA, b: labelB })));

  const tbl = makeTable(["", labelA, labelB, t("diff"), t("changeRate")]);
  for (const [field, label] of COMPARE_FIELDS()) {
    const a = statsA.total[field];
    const b = statsB.total[field];
    tbl.push([chalk.cyan(label), formatNumber(a), formatNumber(b), formatDiff(a, b), formatChangeRate(a, b)]);
  }
  console.log(tbl.toString());

  // Grouped comparisons
  compareGrouped(statsA.byModel, statsB.byModel, `📊 ${t("byModelTitle")}`.replace("📊 ", ""), t("model"));
  compareGrouped(statsA.byProject, statsB.byProject, `📊 ${t("byProjectTitle")}`.replace("📊 ", ""), t("project"));
  compareGrouped(statsA.byProvider, statsB.byProvider, `📊 ${t("byProviderTitle")}`.replace("📊 ", ""), t("provider"));
}

/**
 * Multi-client report — shows combined stats with per-client breakdown.
 */
export function printMultiClientReport(combinedStats, clientResults, opts = {}) {
  const format = opts.format || "table";
  const dateLabel = opts.dateLabel || combinedStats.date;

  if (format === "json") {
    const output = {
      date: dateLabel,
      combined: {
        total: combinedStats.total,
        byModel: serializeMap(combinedStats.byModel),
        byProject: serializeMap(combinedStats.byProject),
        byProvider: serializeMap(combinedStats.byProvider),
      },
      clients: {},
    };
    for (const { id, name, stats } of clientResults) {
      if (isAllZero(stats.total)) continue;
      output.clients[id] = {
        name,
        total: stats.total,
        byModel: serializeMap(stats.byModel),
        byProject: serializeMap(stats.byProject),
        byProvider: serializeMap(stats.byProvider),
      };
    }
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (format === "csv") {
    // CSV header with client column
    console.log(
      [
        t("client"),
        t("csvGroup"),
        t("csvName"),
        t("requests"),
        t("inputTokens"),
        t("outputTokens"),
        t("toolCalls"),
        t("cacheRead"),
        t("cacheWrite"),
        t("totalTokens"),
      ].join(","),
    );
    for (const { name, stats } of clientResults) {
      if (isAllZero(stats.total)) continue;
      console.log(
        [
          name,
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
      for (const [mname, s] of stats.byModel) {
        if (isAllZero(s)) continue;
        console.log(
          [
            name,
            t("groupModel"),
            csvEscape(mname),
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
    // Combined total
    console.log(
      [
        t("all"),
        t("groupTotal"),
        "-",
        combinedStats.total.requests,
        combinedStats.total.inputTokens,
        combinedStats.total.outputTokens,
        combinedStats.total.toolCalls,
        combinedStats.total.cacheRead,
        combinedStats.total.cacheWrite,
        combinedStats.total.totalTokens,
      ].join(","),
    );
    return;
  }

  // Table format (default) — show per-client breakdown then combined
  console.log(chalk.bold(t("multiClientTitle", { date: dateLabel })));

  // Per-client totals summary table
  console.log(chalk.bold(`\n${t("clientBreakdown")}`));
  const summaryHeaders = [t("client"), ...COL_HEADERS()];
  const summaryTable = makeTable(summaryHeaders);
  for (const { id, name, stats } of clientResults) {
    const s = stats.total;
    if (isAllZero(s)) continue;
    const clientColor =
      id === "opencode"
        ? chalk.green
        : id === "qoder"
          ? chalk.blue
          : id === "qoder-cli"
            ? chalk.blueBright
            : id === "claude"
              ? chalk.magenta
              : chalk.yellow;
    summaryTable.push([
      clientColor.bold(name),
      formatNumber(s.requests),
      formatNumber(s.inputTokens),
      formatNumber(s.outputTokens),
      formatNumber(s.toolCalls),
      formatNumber(s.cacheRead),
      formatNumber(s.cacheWrite),
      chalk.yellow.bold(formatNumber(s.totalTokens)),
    ]);
  }
  // Grand total row
  summaryTable.push([
    chalk.bold(t("all")),
    formatNumber(combinedStats.total.requests),
    formatNumber(combinedStats.total.inputTokens),
    formatNumber(combinedStats.total.outputTokens),
    formatNumber(combinedStats.total.toolCalls),
    formatNumber(combinedStats.total.cacheRead),
    formatNumber(combinedStats.total.cacheWrite),
    chalk.yellow.bold(formatNumber(combinedStats.total.totalTokens)),
  ]);
  console.log(summaryTable.toString());

  // Combined by-model table
  if (combinedStats.byModel.size > 0) {
    console.log(chalk.bold(`\n${t("byModelTitle")} (${t("all")})`));
    const modelTable = makeTable(GROUP_HEADERS(t("model")));
    for (const [model, s] of combinedStats.byModel) {
      if (isAllZero(s)) continue;
      modelTable.push(statRow(model, s, chalk.cyan));
    }
    console.log(modelTable.toString());
  }

  // Combined by-project table
  if (combinedStats.byProject.size > 0) {
    console.log(chalk.bold(`\n${t("byProjectTitle")} (${t("all")})`));
    const projTable = makeTable(GROUP_HEADERS(t("project")));
    for (const [project, s] of combinedStats.byProject) {
      if (isAllZero(s)) continue;
      projTable.push(statRow(project, s, chalk.cyan));
    }
    console.log(projTable.toString());
  }

  // Combined by-provider table
  if (combinedStats.byProvider.size > 0) {
    console.log(chalk.bold(`\n${t("byProviderTitle")} (${t("all")})`));
    const provTable = makeTable(GROUP_HEADERS(t("provider")));
    for (const [provider, s] of combinedStats.byProvider) {
      if (isAllZero(s)) continue;
      provTable.push(statRow(provider, s, chalk.cyan));
    }
    console.log(provTable.toString());
  }
}

function serializeMap(map) {
  const obj = {};
  for (const [k, v] of map) {
    if (isAllZero(v)) continue;
    obj[k] = v;
  }
  return obj;
}
