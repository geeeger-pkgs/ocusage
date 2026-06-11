#!/usr/bin/env node

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { input, Separator, select } from "@inquirer/prompts";
import { Command } from "commander";
import { getConfigPath, getCustomPaths, getSavedLocale, loadConfig, saveConfig } from "./config.mjs";
import { detectLocale, SUPPORTED_LOCALES, setLocale, t } from "./i18n.mjs";
import { aggregateStats, detectClients, getAllStats } from "./multi.mjs";
import { parsePeriod, resolveDateAlias, validateDate } from "./providers/base.mjs";
import { AVAILABLE_PROVIDERS, detectProviders } from "./providers/index.mjs";
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
  // --lang: choices are SUPPORTED_LOCALES (zh-CN, zh-TW, en, ja, ko)
  .option("-l, --lang <locale>", "output language")
  .action((opts) => {
    const savedLocale = getSavedLocale();
    setLocale(detectLocale(opts.lang || savedLocale));

    const clientFilter = opts.client || "opencode"; // 默认 opencode
    const format = opts.json ? "json" : opts.format;

    handleMultiClient(opts, clientFilter, format);
  });

function handleMultiClient(opts, clientFilter, format) {
  try {
    const savedPaths = getCustomPaths();
    const customPaths = { ...savedPaths };

    const clients = clientFilter.split(",").map((s) => s.trim());
    if (opts.db) {
      if (clients.length === 1 && clientFilter !== "all") {
        // Single provider: --db overrides that provider's path
        customPaths[clients[0]] = opts.db;
      } else {
        // Multiple providers: ignore --db and warn
        console.warn(t("configDbIgnored"));
      }
    }

    const { dateStr, toDateStr } = resolveDateOptions(opts);

    const results = getAllStats(dateStr, toDateStr, { clientFilter, customPaths });

    // Check if any client was detected
    const validResults = results.filter((r) => r.stats !== null);
    if (validResults.length === 0) {
      console.error(t("noClientsDetected") || "No AI clients detected with usage data.");
      process.exit(1);
    }

    // Handle encrypted Trae database
    const encryptedClients = results.filter((r) => r.stats?.encrypted);
    for (const enc of encryptedClients) {
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
      // Single client — use standard report format
      printReport(validStats[0].stats, { format });
      return;
    }

    // Multiple clients — use multi-client report
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
  // Resolve an alias to a single YYYY-MM-DD value.
  // Range aliases collapse to their `from` date when used as a single endpoint.
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
    const savedLocale = getSavedLocale();
    setLocale(detectLocale(opts.lang || savedLocale));
    const customPaths = getCustomPaths();
    const clients = detectClients(customPaths);
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
    const savedLocale = getSavedLocale();
    setLocale(detectLocale(opts.lang || savedLocale));
    const clientFilter = opts.client || "opencode"; // 默认 opencode
    const format = opts.json ? "json" : opts.format;
    handleMultiClientCompare(opts, clientFilter, format);
  });

function handleMultiClientCompare(opts, clientFilter, format) {
  try {
    const savedPaths = getCustomPaths();
    const customPaths = { ...savedPaths };

    const clients = clientFilter.split(",").map((s) => s.trim());
    if (opts.db) {
      if (clients.length === 1 && clientFilter !== "all") {
        customPaths[clients[0]] = opts.db;
      } else {
        console.warn(t("configDbIgnored"));
      }
    }

    const rangeA = resolvePeriodInput(opts.a);
    const rangeB = resolvePeriodInput(opts.b);

    const resultsA = getAllStats(rangeA.from, rangeA.to, { clientFilter, customPaths });
    const resultsB = getAllStats(rangeB.from, rangeB.to, { clientFilter, customPaths });

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

program
  .command("config")
  .description("Interactive path configuration for AI clients")
  .option("--list", "list current path configuration (non-interactive)")
  .option("--reset", "clear all custom path configurations")
  .option("-l, --lang <locale>", "output language")
  .action(async (opts) => {
    const savedLocale = getSavedLocale();
    setLocale(detectLocale(opts.lang || savedLocale));

    if (opts.reset) {
      const config = loadConfig();
      saveConfig({ locale: config.locale, customPaths: {} });
      console.log(t("configResetAll"));
      return;
    }

    if (opts.list) {
      handleConfigList();
      return;
    }

    // Interactive mode
    await handleConfigInteractive();
  });

function handleConfigList() {
  const config = loadConfig();
  const savedPaths = config.customPaths;
  const savedLocale = config.locale;
  const detectedMap = new Map(detectProviders().map((d) => [d.id, d.path]));
  console.log(t("configTitle"));
  console.log(`  ${t("configLocaleCurrent", { locale: savedLocale || t("configNotDetected") })}`);
  for (const [index, provider] of AVAILABLE_PROVIDERS.entries()) {
    const num = index + 1;
    const detectedPath = detectedMap.get(provider.id) || t("configNotDetected");
    const customPath = savedPaths[provider.id] || "(—)";
    console.log(`  ${num}. ${provider.name} (${provider.id})`);
    console.log(`     ${t("configDetectedPath")}: ${detectedPath}`);
    console.log(`     ${t("configCustomPath")}: ${customPath}`);
  }
}

async function handleConfigInteractive() {
  // 语言名称本身是多语言的，硬编码显示名
  const LOCALE_LABELS = {
    "zh-CN": "简体中文",
    "zh-TW": "繁體中文",
    en: "English",
    ja: "日本語",
    ko: "한국어",
  };

  // ---- 1. 语言配置 ----
  const localeChoice = await select({
    message: t("configLocaleTitle"),
    choices: [
      ...SUPPORTED_LOCALES.map((loc) => ({
        name: `${loc} (${LOCALE_LABELS[loc]})`,
        value: loc,
      })),
      { name: t("configLocaleSkip"), value: "__skip__" },
    ],
  });

  if (localeChoice !== "__skip__") {
    const config = loadConfig();
    config.locale = localeChoice;
    saveConfig(config);
    setLocale(localeChoice);
    console.log(t("configLocaleSet", { locale: localeChoice }));
  }

  // ---- 2. Provider 路径配置循环 ----
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const savedPaths = getCustomPaths();
    const detectedMap = new Map(detectProviders().map((d) => [d.id, d.path]));

    const providerChoice = await select({
      message: t("configSelectClient"),
      choices: [
        ...AVAILABLE_PROVIDERS.map((provider) => {
          const detected = detectedMap.get(provider.id);
          const custom = savedPaths[provider.id];
          let description;
          if (custom) {
            description = t("configStatusCustom", { path: custom });
          } else if (detected) {
            description = t("configStatusDetected", { path: detected });
          } else {
            description = t("configNotDetected");
          }
          return {
            name: `${provider.name} (${provider.id})`,
            value: provider.id,
            description,
          };
        }),
        new Separator(),
        { name: t("configExit"), value: "__exit__" },
      ],
    });

    if (providerChoice === "__exit__") break;

    // ---- 3. Provider 操作 ----
    const provider = AVAILABLE_PROVIDERS.find((p) => p.id === providerChoice);
    const actionChoice = await select({
      message: t("configClientAction", { name: provider.name }),
      choices: [
        { name: t("configActionInputPath"), value: "input" },
        { name: t("configActionResetPath"), value: "reset" },
        { name: t("configActionBack"), value: "back" },
      ],
    });

    if (actionChoice === "back") continue;

    if (actionChoice === "reset") {
      const config = loadConfig();
      delete config.customPaths[provider.id];
      saveConfig(config);
      console.log(t("configPathReset", { name: provider.name }));
      console.log(t("configSaved", { path: getConfigPath() }));
      continue;
    }

    // ---- 4. 输入自定义路径 ----
    const customPath = await input({
      message: t("configInputPathPrompt"),
    });

    const trimmed = customPath.trim();
    if (!trimmed) continue;

    // 路径不存在仅警告，不阻止
    if (!existsSync(trimmed)) {
      console.log(t("configPathNotExist", { path: trimmed }));
    }

    const config = loadConfig();
    config.customPaths[provider.id] = trimmed;
    saveConfig(config);
    console.log(t("configPathSet", { name: provider.name, path: trimmed }));
    console.log(t("configSaved", { path: getConfigPath() }));
  }
}

program.parse();
