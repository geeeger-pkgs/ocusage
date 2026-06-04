import en from "./locales/en.mjs";
import ja from "./locales/ja.mjs";
import ko from "./locales/ko.mjs";
import zhCN from "./locales/zh-CN.mjs";
import zhTW from "./locales/zh-TW.mjs";

const locales = { "zh-CN": zhCN, "zh-TW": zhTW, en, ja, ko };

let currentLocale = "zh-CN";

export function setLocale(locale) {
  if (locales[locale]) {
    currentLocale = locale;
  } else {
    throw new Error(`Unsupported locale: "${locale}". Available: ${Object.keys(locales).join(", ")}`);
  }
}

export function detectLocale(langOpt) {
  // Priority: --lang param > OCUSAGE_LANG env > LANG/LC_ALL env > default zh-CN
  if (langOpt && locales[langOpt]) return langOpt;

  const envLang = process.env.OCUSAGE_LANG || process.env.LC_ALL || process.env.LANG || "";

  for (const key of Object.keys(locales)) {
    if (envLang.startsWith(key) || envLang.toLowerCase().startsWith(key.toLowerCase())) {
      return key;
    }
  }

  // Try matching language prefix (e.g., "en_US.UTF-8" -> "en")
  const prefix = envLang.split(/[_.-]/)[0]?.toLowerCase();
  if (prefix === "zh") {
    // Check for traditional Chinese indicators
    const full = envLang.toLowerCase();
    if (full.includes("tw") || full.includes("hk") || full.includes("hant")) return "zh-TW";
    return "zh-CN";
  }
  for (const key of Object.keys(locales)) {
    if (key.toLowerCase() === prefix) return key;
  }

  return "zh-CN";
}

export function t(key, params = {}) {
  const locale = locales[currentLocale] || locales["zh-CN"];
  let str = locale[key] ?? locales["zh-CN"][key] ?? key;
  // Simple template replacement: {date}, {value}, etc.
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, "g"), v);
  }
  return str;
}

export function getLocale() {
  return currentLocale;
}

export const SUPPORTED_LOCALES = Object.keys(locales);
