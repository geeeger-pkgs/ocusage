#!/usr/bin/env node

import { createRequire } from "node:module";
import { Command } from "commander";
import { registerConfigCommand } from "./commands/config.mjs";
import { getCustomPaths, getSavedLocale } from "./config.mjs";
import { detectLocale, setLocale, t } from "./i18n.mjs";
import { parsePeriod, resolveDateAlias, validateDate } from "./providers/base.mjs";
import { aggregateStats, detectProviders, getAllProviderStats } from "./providers/index.mjs";
import { printCompareReport, printMultiClientReport, printReport } from "./report.mjs";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

const program = new Command();
program.enablePositionalOptions();

program
  .name("ocusage")
  .description("AI client daily token usage report")
  .version(pkg.version)
  .option(
    "-d, --date <date>",
    "date to query (YYYY-MM-DD or alias: today/yesterday/week/month/last-week/last-month)",
    new Date().toISOString().slice(0, 10),
  )
  .option("--from <date>", "range start date (YYYY-MM-DD or date alias)")
  .option("--to <date>", "range end date (YYYY-MM-DD or date alias)")
  .option("--db <path>", "custom database/data path (single client mode only)")
  .option(
    "-c, --client <names>",
    "client filter: opencode,mimocode,qoder,qoder-cli,claude,codewhale,trae,trae-solo or 'all'",
  )
  .option("-f, --format <type>", "output format: table, json, csv, markdown", "table")
  .option("-j, --json", "output as JSON (alias for --format json)")
  .option("-l, --lang <locale>", "output language")
  .action((opts) => {
    initLocale(opts);
    const clientFilter = opts.client || "opencode";
    const format = opts.json ? "json" : opts.format;
    handleMultiClient(opts, clientFilter, format);
  });

function initLocale(opts) {
  const savedLocale = getSavedLocale();
  setLocale(detectLocale(opts.lang || savedLocale));
}

function buildCustomPaths(opts, clientFilter) {
  const customPaths = { ...getCustomPaths() };
  if (opts.db) {
    const clients = clientFilter.split(",").map((s) => s.trim());
    if (clients.length === 1 && clientFilter !== "all") {
      customPaths[clients[0]] = opts.db;
    } else {
      console.warn(t("configDbIgnored"));
    }
  }
  return customPaths;
}

function handleMultiClient(opts, clientFilter, format) {
  try {
    const customPaths = buildCustomPaths(opts, clientFilter);
    const { dateStr, toDateStr } = resolveDateOptions(opts);

    const results = getAllProviderStats(dateStr, toDateStr, customPaths, clientFilter);

    const validResults = results.filter((r) => r.stats !== null);
    if (validResults.length === 0) {
      console.error(t("noClientsDetected") || "No AI clients detected with usage data.");
      process.exit(1);
    }

    for (const enc of results.filter((r) => r.stats?.encrypted)) {
      console.warn(
        `${t("clientEncrypted", { name: enc.name }) || `${enc.name}: database is encrypted and cannot be read.`}`,
      );
    }

    const validStats = validResults.filter((r) => !r.stats?.encrypted);

    if (format === "json") {
      const output = {};
      for (const { id, stats } of validStats) {
        output[id] = serializeStats(stats);
      }
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    if (validStats.length === 1) {
      printReport(validStats[0].stats, { format });
      return;
    }

    const dateLabel = toDateStr ? `${dateStr} ~ ${toDateStr}` : dateStr;
    const combined = aggregateStats(validStats, dateLabel);
    combined.client = "all";
    printMultiClientReport(combined, validStats, { format, dateLabel });
  } catch (err) {
    console.error(`${t("errorPrefix")}: ${err.message}`);
    process.exit(1);
  }
}

function resolveSingleAlias(input) {
  if (!input) return null;
  const alias = resolveDateAlias(input);
  if (!alias) return null;
  return alias.type === "single" ? alias.date : alias.from;
}

function resolveDateOptions(opts) {
  if (opts.from || opts.to) {
    const fromResolved = opts.from ? resolveSingleAlias(opts.from) || opts.from : null;
    const toResolved = opts.to ? resolveSingleAlias(opts.to) || opts.to : null;
    if (fromResolved) validateDate(fromResolved);
    if (toResolved) validateDate(toResolved);
    const dateStr = fromResolved || toResolved;
    const toDateStr = toResolved || new Date().toISOString().slice(0, 10);
    return { dateStr, toDateStr };
  }

  const alias = resolveDateAlias(opts.date);
  if (alias?.type === "range") {
    return { dateStr: alias.from, toDateStr: alias.to };
  }
  if (alias?.type === "single") {
    return { dateStr: alias.date, toDateStr: null };
  }
  validateDate(opts.date);
  return { dateStr: opts.date, toDateStr: null };
}

function serializeStats(stats) {
  const serializeMap = (map) => {
    const obj = {};
    for (const [k, v] of map) {
      if (v.requests === 0 && v.inputTokens === 0 && v.outputTokens === 0 && v.totalTokens === 0) continue;
      obj[k] = v;
    }
    return obj;
  };
  return {
    date: stats.date,
    total: stats.total,
    byModel: serializeMap(stats.byModel),
    byProject: serializeMap(stats.byProject),
    byProvider: serializeMap(stats.byProvider),
  };
}

program
  .command("detect")
  .description("Detect installed AI clients with usage data")
  .option("-l, --lang <locale>", "output language")
  .action((opts) => {
    initLocale(opts);
    const customPaths = getCustomPaths();
    const clients = detectProviders(customPaths);
    if (clients.length === 0) {
      console.log(t("noClientsDetected") || "No AI clients detected.");
      return;
    }
    console.log(t("detectedClients") || "Detected clients:");
    for (const client of clients) {
      console.log(`  ${client.name} (${client.id}): ${client.path}`);
    }
  });

program
  .command("compare")
  .description("Compare token usage between two periods")
  .requiredOption("-a, --a <period>", "period A (YYYY-MM or YYYY-MM-DD)")
  .requiredOption("-b, --b <period>", "period B (YYYY-MM or YYYY-MM-DD)")
  .option("--db <path>", "custom database/data path (single client mode only)")
  .option(
    "-c, --client <names>",
    "client filter: opencode,mimocode,qoder,qoder-cli,claude,codewhale,trae,trae-solo or 'all'",
  )
  .option("-f, --format <type>", "output format: table, json, csv, markdown", "table")
  .option("-j, --json", "output as JSON (alias for --format json)")
  .option("-l, --lang <locale>", "output language")
  .action((opts) => {
    initLocale(opts);
    const clientFilter = opts.client || "opencode";
    const format = opts.json ? "json" : opts.format;
    handleMultiClientCompare(opts, clientFilter, format);
  });

function handleMultiClientCompare(opts, clientFilter, format) {
  try {
    const customPaths = buildCustomPaths(opts, clientFilter);
    const rangeA = resolvePeriodInput(opts.a);
    const rangeB = resolvePeriodInput(opts.b);

    const resultsA = getAllProviderStats(rangeA.from, rangeA.to, customPaths, clientFilter);
    const resultsB = getAllProviderStats(rangeB.from, rangeB.to, customPaths, clientFilter);

    const validA = resultsA.filter((r) => r.stats && !r.stats.encrypted);
    const validB = resultsB.filter((r) => r.stats && !r.stats.encrypted);

    if (validA.length === 0 && validB.length === 0) {
      console.error(t("noClientsDetected") || "No AI clients detected with usage data.");
      process.exit(1);
    }

    const statsA = validA.length === 1 ? validA[0].stats : aggregateStats(validA, opts.a);
    const statsB = validB.length === 1 ? validB[0].stats : aggregateStats(validB, opts.b);

    printCompareReport(statsA, statsB, { format, labelA: opts.a, labelB: opts.b });
  } catch (err) {
    console.error(`${t("errorPrefix")}: ${err.message}`);
    process.exit(1);
  }
}

function resolvePeriodInput(input) {
  const alias = resolveDateAlias(input);
  if (alias?.type === "range") {
    return { from: alias.from, to: alias.to };
  }
  if (alias?.type === "single") {
    return { from: alias.date, to: alias.date };
  }
  return parsePeriod(input);
}

registerConfigCommand(program);
program.parse();
