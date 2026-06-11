/**
 * Config command — interactive path configuration for AI clients.
 */

import { existsSync } from "node:fs";
import { input, Separator, select } from "@inquirer/prompts";
import { getConfigPath, getCustomPaths, getSavedLocale, loadConfig, saveConfig } from "../config.mjs";
import { detectLocale, SUPPORTED_LOCALES, setLocale, t } from "../i18n.mjs";
import { AVAILABLE_PROVIDERS, detectProviders } from "../providers/index.mjs";

export function registerConfigCommand(program) {
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

      await handleConfigInteractive();
    });
}

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

const LOCALE_LABELS = {
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  en: "English",
  ja: "日本語",
  ko: "한국어",
};

async function handleConfigInteractive() {
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

    const customPath = await input({
      message: t("configInputPathPrompt"),
    });

    const trimmed = customPath.trim();
    if (!trimmed) continue;

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
