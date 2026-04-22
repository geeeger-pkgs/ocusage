#!/usr/bin/env node

import { createRequire } from "node:module";
import { Command } from "commander";
import { openDB, getDailyStats } from "./db.mjs";
import { printReport } from "./report.mjs";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

const program = new Command();

program
  .name("ocusage")
  .description("OpenCode daily token usage report")
  .version(pkg.version)
  .option("-d, --date <YYYY-MM-DD>", "date to query", new Date().toISOString().slice(0, 10))
  .option("--db <path>", "path to opencode.db")
  .option("-j, --json", "output as JSON instead of tables")
  .action(async (opts) => {
    const db = await openDB(opts.db);
    const stats = getDailyStats(db, opts.date);
    db.close();
    printReport(stats, { json: opts.json });
  });

program.parse();
