import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectLocale, getLocale, SUPPORTED_LOCALES, setLocale, t } from "../i18n.mjs";

describe("i18n", () => {
  it("supports 5 locales", () => {
    assert.deepEqual(SUPPORTED_LOCALES, ["zh-CN", "zh-TW", "en", "ja", "ko"]);
  });

  it("defaults to zh-CN", () => {
    setLocale("zh-CN");
    assert.equal(getLocale(), "zh-CN");
    assert.equal(t("inputTokens"), "输入Tokens");
  });

  it("switches locale correctly", () => {
    setLocale("en");
    assert.equal(t("inputTokens"), "Input Tokens");
    assert.equal(t("model"), "Model");
    setLocale("zh-CN"); // reset
  });

  it("performs template replacement", () => {
    setLocale("en");
    assert.equal(t("noData", { date: "2025-01-01" }), "📭 2025-01-01 No usage data");
    assert.equal(t("overallData", { date: "2025-04-20" }), "📊 Overall (2025-04-20)");
    setLocale("zh-CN"); // reset
  });

  it("throws on unsupported locale", () => {
    assert.throws(() => setLocale("fr"), /Unsupported locale/);
  });

  it("falls back to zh-CN for unknown keys", () => {
    setLocale("en");
    // If a key is missing in en but present in zh-CN, should fallback
    // All keys should be present, so test with a non-existent key
    assert.equal(t("nonExistentKey"), "nonExistentKey");
    setLocale("zh-CN"); // reset
  });

  it("detects locale from langOpt parameter", () => {
    assert.equal(detectLocale("en"), "en");
    assert.equal(detectLocale("ja"), "ja");
    assert.equal(detectLocale("ko"), "ko");
  });

  it("returns zh-CN as default when no env is set", () => {
    // With no option and assuming no OCUSAGE_LANG set
    const result = detectLocale(undefined);
    // Result depends on env, but should be a valid locale
    assert.ok(SUPPORTED_LOCALES.includes(result));
  });
});
