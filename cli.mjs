#!/usr/bin/env node

import { createRequire } from "node:module";
import { Command } from "commander";
import { openDB, getDailyStats, getDateRangeStats, validateDate } from "./db.mjs";
import { printReport } from "./report.mjs";

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
  .action((opts) => {
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
      console.error(`错误: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
