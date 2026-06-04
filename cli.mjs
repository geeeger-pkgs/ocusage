#!/usr/bin/env node

import { createRequire } from "node:module";
import { Command } from "commander";
import { getDailyStats, getDateRangeStats, openDB, parsePeriod, validateDate } from "./db.mjs";
import { detectLocale, setLocale, t } from "./i18n.mjs";
import { printCompareReport, printReport } from "./report.mjs";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

const program = new Command();

program
  .name("ocusage")
  .description("OpenCode daily token usage report")
  .version(pkg.version)
  .option("-d, --date <YYYY-MM-DD>", "date to query", (val) => validateDate(val), new Date().toISOString().slice(0, 10))
  .option("--from <YYYY-MM-DD>", "range start date", (val) => validateDate(val))
  .option("--to <YYYY-MM-DD>", "range end date", (val) => validateDate(val))
  .option("--db <path>", "path to opencode.db")
  .option("-f, --format <type>", "output format: table, json, csv, markdown", "table")
  .option("-j, --json", "output as JSON (alias for --format json)")
  // --lang: choices are SUPPORTED_LOCALES (zh-CN, zh-TW, en, ja, ko)
  .option("-l, --lang <locale>", "output language")
  .action((opts) => {
    setLocale(detectLocale(opts.lang));
    try {
      const db = openDB(opts.db);
      let stats;
      if (opts.from || opts.to) {
        const today = new Date().toISOString().slice(0, 10);
        const from = opts.from || opts.to;
        const to = opts.to || today;
        stats = getDateRangeStats(db, from, to);
      } else {
        stats = getDailyStats(db, opts.date);
      }
      db.close();
      const format = opts.json ? "json" : opts.format;
      printReport(stats, { format });
    } catch (err) {
      console.error(`${t("errorPrefix")}: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("compare")
  .description("Compare token usage between two periods")
  .requiredOption("-a, --a <period>", "period A (YYYY-MM or YYYY-MM-DD)")
  .requiredOption("-b, --b <period>", "period B (YYYY-MM or YYYY-MM-DD)")
  .option("--db <path>", "path to opencode.db")
  .option("-f, --format <type>", "output format: table, json, csv, markdown", "table")
  .option("-j, --json", "output as JSON (alias for --format json)")
  .option("-l, --lang <locale>", "output language")
  .action((opts) => {
    setLocale(detectLocale(opts.lang));
    try {
      const db = openDB(opts.db);
      const rangeA = parsePeriod(opts.a);
      const rangeB = parsePeriod(opts.b);
      const statsA = getDateRangeStats(db, rangeA.from, rangeA.to);
      const statsB = getDateRangeStats(db, rangeB.from, rangeB.to);
      db.close();
      const format = opts.json ? "json" : opts.format;
      printCompareReport(statsA, statsB, { format, labelA: opts.a, labelB: opts.b });
    } catch (err) {
      console.error(`${t("errorPrefix")}: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
