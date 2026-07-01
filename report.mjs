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
    style: { head: ["cyan", "bold"], border: ["gray"], compact: true },
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

const STAT_FIELDS = ["requests", "inputTokens", "outputTokens", "toolCalls", "cacheRead", "cacheWrite", "totalTokens"];

function csvEscape(val) {
  const s = String(val);
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

function serializeMap(map) {
  const obj = {};
  for (const [k, v] of map) {
    if (isAllZero(v)) continue;
    obj[k] = v;
  }
  return obj;
}

// --- CSV helpers ---

const CSV_HEADERS = () => [t("csvGroup"), t("csvName"), ...STAT_FIELDS.map((f) => t(f))];

function csvStatFields(s) {
  return STAT_FIELDS.map((f) => s[f]);
}

function csvGroupMapRows(groupLabel, map) {
  const rows = [];
  for (const [name, s] of map) {
    if (isAllZero(s)) continue;
    rows.push([groupLabel, csvEscape(name), ...csvStatFields(s)].join(","));
  }
  return rows;
}

function printCSV(stats) {
  console.log(CSV_HEADERS().join(","));
  console.log([t("groupTotal"), "-", ...csvStatFields(stats.total)].join(","));
  console.log(csvGroupMapRows(t("groupModel"), stats.byModel).join("\n"));
  console.log(csvGroupMapRows(t("groupProject"), stats.byProject).join("\n"));
  console.log(csvGroupMapRows(t("groupProvider"), stats.byProvider).join("\n"));
}

// --- Markdown helpers ---

const MD_SEP = "|------|--------|-----------|-----------|---------|---------|---------|-----------|";

function mdGroupHeader(nameHeader) {
  return `| ${nameHeader} | ${t("requests")} | ${t("inputTokens")} | ${t("outputTokens")} | ${t("toolCalls")} | ${t("cacheRead")} | ${t("cacheWrite")} | ${t("totalTokens")} |`;
}

function mdGroupRows(map) {
  const rows = [];
  for (const [name, s] of map) {
    if (isAllZero(s)) continue;
    rows.push(
      `| ${name} | ${s.requests} | ${s.inputTokens} | ${s.outputTokens} | ${s.toolCalls} | ${s.cacheRead} | ${s.cacheWrite} | ${s.totalTokens} |`,
    );
  }
  return rows.join("\n");
}

function printMarkdown(stats) {
  console.log(t("usageReport", { date: stats.date }));
  console.log();
  console.log(t("mdTotal"));
  console.log();
  const tot = stats.total;
  console.log(mdGroupHeader(t("requests")));
  console.log(MD_SEP);
  console.log(
    `| ${tot.requests} | ${tot.inputTokens} | ${tot.outputTokens} | ${tot.toolCalls} | ${tot.cacheRead} | ${tot.cacheWrite} | ${tot.totalTokens} |`,
  );

  for (const [label, map] of [
    [t("mdByModel"), stats.byModel],
    [t("mdByProject"), stats.byProject],
    [t("mdByProvider"), stats.byProvider],
  ]) {
    console.log(`\n${label}\n`);
    console.log(mdGroupHeader(t("model")));
    console.log(MD_SEP);
    console.log(mdGroupRows(map));
  }
}

// --- Compare helpers ---

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

// --- Client colors (data-driven) ---

const CLIENT_COLORS = {
  opencode: chalk.green,
  mimocode: chalk.greenBright,
  qoder: chalk.blue,
  "qoder-cli": chalk.blueBright,
  claude: chalk.magenta,
  codewhale: chalk.hex("#FFA500"),
  trae: chalk.red,
  "trae-solo": chalk.redBright,
  workbuddy: chalk.cyan,
};
const DEFAULT_CLIENT_COLOR = chalk.yellow;

function getClientColor(id) {
  return CLIENT_COLORS[id] || DEFAULT_CLIENT_COLOR;
}

// --- Public API ---

export function printReport(stats, opts = {}) {
  const format = opts.format || (opts.json ? "json" : "table");

  if (format === "json") {
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

  for (const [label, map] of [
    [t("byModelTitle"), stats.byModel],
    [t("byProjectTitle"), stats.byProject],
    [t("byProviderTitle"), stats.byProvider],
  ]) {
    console.log(chalk.bold(`\n${label}`));
    const tbl = makeTable(
      GROUP_HEADERS(label.includes("Model") ? t("model") : label.includes("Project") ? t("project") : t("provider")),
    );
    for (const [name, s] of map) {
      if (isAllZero(s)) continue;
      tbl.push(statRow(name, s, chalk.cyan));
    }
    console.log(tbl.toString());
  }
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

    const compareGroupedJSON = (mapA, mapB) => {
      const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
      const result = {};
      for (const key of allKeys) {
        const a = mapA.get(key) || EMPTY_STAT();
        const b = mapB.get(key) || EMPTY_STAT();
        if (isAllZero(a) && isAllZero(b)) continue;
        result[key] = {
          a: a.totalTokens,
          b: b.totalTokens,
          diff: b.totalTokens - a.totalTokens,
          changeRate: formatChangeRate(a.totalTokens, b.totalTokens),
        };
      }
      return result;
    };

    console.log(
      JSON.stringify(
        {
          labelA,
          labelB,
          statsA: statsA.total,
          statsB: statsB.total,
          diff,
          changeRate,
          byModel: compareGroupedJSON(statsA.byModel, statsB.byModel),
          byProject: compareGroupedJSON(statsA.byProject, statsB.byProject),
          byProvider: compareGroupedJSON(statsA.byProvider, statsB.byProvider),
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
      const a = statsA.total[field],
        b = statsB.total[field];
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
      const a = statsA.total[field],
        b = statsB.total[field];
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
    const a = statsA.total[field],
      b = statsB.total[field];
    tbl.push([chalk.cyan(label), formatNumber(a), formatNumber(b), formatDiff(a, b), formatChangeRate(a, b)]);
  }
  console.log(tbl.toString());

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
    console.log([t("client"), ...CSV_HEADERS()].join(","));
    for (const { name, stats } of clientResults) {
      if (isAllZero(stats.total)) continue;
      console.log([name, t("groupTotal"), "-", ...csvStatFields(stats.total)].join(","));
      console.log(
        csvGroupMapRows(t("groupModel"), stats.byModel)
          .map((r) => `${name},${r}`)
          .join("\n"),
      );
      console.log(
        csvGroupMapRows(t("groupProject"), stats.byProject)
          .map((r) => `${name},${r}`)
          .join("\n"),
      );
      console.log(
        csvGroupMapRows(t("groupProvider"), stats.byProvider)
          .map((r) => `${name},${r}`)
          .join("\n"),
      );
    }
    console.log([t("all"), t("groupTotal"), "-", ...csvStatFields(combinedStats.total)].join(","));
    return;
  }

  // Table format (default)
  console.log(chalk.bold(t("multiClientTitle", { date: dateLabel })));

  console.log(chalk.bold(`\n${t("clientBreakdown")}`));
  const summaryTable = makeTable([t("client"), ...COL_HEADERS()]);
  for (const { id, name, stats } of clientResults) {
    const s = stats.total;
    if (isAllZero(s)) continue;
    summaryTable.push([
      getClientColor(id).bold(name),
      formatNumber(s.requests),
      formatNumber(s.inputTokens),
      formatNumber(s.outputTokens),
      formatNumber(s.toolCalls),
      formatNumber(s.cacheRead),
      formatNumber(s.cacheWrite),
      chalk.yellow.bold(formatNumber(s.totalTokens)),
    ]);
  }
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

  for (const [label, titleKey, map] of [
    [t("model"), t("byModelTitle"), combinedStats.byModel],
    [t("project"), t("byProjectTitle"), combinedStats.byProject],
    [t("provider"), t("byProviderTitle"), combinedStats.byProvider],
  ]) {
    if (map.size === 0) continue;
    console.log(chalk.bold(`\n${titleKey} (${t("all")})`));
    const tbl = makeTable(GROUP_HEADERS(label));
    for (const [name, s] of map) {
      if (isAllZero(s)) continue;
      tbl.push(statRow(name, s, chalk.cyan));
    }
    console.log(tbl.toString());
  }
}
