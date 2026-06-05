import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setLocale } from "../i18n.mjs";
import { resolveDateAlias } from "../providers/base.mjs";

setLocale("zh-CN");

// Helpers ------------------------------------------------------------
function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("resolveDateAlias", () => {
  // 固定一个已知日期方便断言：2025-04-23 是星期三
  const FIXED = new Date(2025, 3, 23);

  it("returns single date for 'today'", () => {
    const result = resolveDateAlias("today", FIXED);
    assert.deepEqual(result, { type: "single", date: "2025-04-23" });
  });

  it("returns yesterday for 'yesterday'", () => {
    const result = resolveDateAlias("yesterday", FIXED);
    assert.deepEqual(result, { type: "single", date: "2025-04-22" });
  });

  it("'week' returns Monday-to-today range", () => {
    const result = resolveDateAlias("week", FIXED);
    // 2025-04-21 (Mon) ~ 2025-04-23 (Wed)
    assert.deepEqual(result, { type: "range", from: "2025-04-21", to: "2025-04-23" });
  });

  it("'week' on a Sunday returns previous Monday-to-today", () => {
    const sunday = new Date(2025, 3, 27); // 2025-04-27 Sunday
    const result = resolveDateAlias("week", sunday);
    assert.deepEqual(result, { type: "range", from: "2025-04-21", to: "2025-04-27" });
  });

  it("'month' returns first-of-month to today", () => {
    const result = resolveDateAlias("month", FIXED);
    assert.deepEqual(result, { type: "range", from: "2025-04-01", to: "2025-04-23" });
  });

  it("'last-week' returns previous Monday-to-Sunday", () => {
    const result = resolveDateAlias("last-week", FIXED);
    // 上周一 2025-04-14, 上周日 2025-04-20
    assert.deepEqual(result, { type: "range", from: "2025-04-14", to: "2025-04-20" });
  });

  it("'last-month' returns full previous month", () => {
    const result = resolveDateAlias("last-month", FIXED);
    assert.deepEqual(result, { type: "range", from: "2025-03-01", to: "2025-03-31" });
  });

  it("'last-month' handles year boundary (January)", () => {
    const jan = new Date(2025, 0, 15);
    const result = resolveDateAlias("last-month", jan);
    assert.deepEqual(result, { type: "range", from: "2024-12-01", to: "2024-12-31" });
  });

  it("'last-month' handles month with 28 days (Feb non-leap)", () => {
    const mar = new Date(2025, 2, 10); // 2025-03-10
    const result = resolveDateAlias("last-month", mar);
    assert.deepEqual(result, { type: "range", from: "2025-02-01", to: "2025-02-28" });
  });

  it("'last-month' handles leap February", () => {
    const mar = new Date(2024, 2, 10); // 2024-03-10
    const result = resolveDateAlias("last-month", mar);
    assert.deepEqual(result, { type: "range", from: "2024-02-01", to: "2024-02-29" });
  });

  it("aliases are case-insensitive", () => {
    const a = resolveDateAlias("TODAY", FIXED);
    const b = resolveDateAlias("Today", FIXED);
    const c = resolveDateAlias("Last-Month", FIXED);
    assert.deepEqual(a, { type: "single", date: "2025-04-23" });
    assert.deepEqual(b, { type: "single", date: "2025-04-23" });
    assert.deepEqual(c, { type: "range", from: "2025-03-01", to: "2025-03-31" });
  });

  it("returns null for non-alias inputs", () => {
    assert.equal(resolveDateAlias("2025-04-20", FIXED), null);
    assert.equal(resolveDateAlias("2025-04", FIXED), null);
    assert.equal(resolveDateAlias("not-a-thing", FIXED), null);
    assert.equal(resolveDateAlias("", FIXED), null);
    assert.equal(resolveDateAlias(undefined, FIXED), null);
    assert.equal(resolveDateAlias(null, FIXED), null);
  });

  it("trims surrounding whitespace", () => {
    const result = resolveDateAlias("  today  ", FIXED);
    assert.deepEqual(result, { type: "single", date: "2025-04-23" });
  });

  it("uses current date when 'now' is not supplied", () => {
    const result = resolveDateAlias("today");
    assert.equal(result.type, "single");
    assert.equal(result.date, fmt(new Date()));
  });
});
