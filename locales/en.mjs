export default {
  totalRequests: "Total Requests",
  inputTokens: "Input Tokens",
  outputTokens: "Output Tokens",
  toolCalls: "Tool Calls",
  cacheRead: "Cache Read",
  cacheWrite: "Cache Write",
  totalTokens: "Total Tokens",
  requests: "Requests",

  overallData: "📊 Overall ({date})",
  byModelTitle: "📊 By Model",
  byProjectTitle: "📊 By Project",
  byProviderTitle: "📊 By Provider",

  model: "Model",
  project: "Project",
  provider: "Provider",

  noData: "📭 {date} No usage data",

  groupTotal: "Total",
  groupModel: "Model",
  groupProject: "Project",
  groupProvider: "Provider",
  csvGroup: "Group",
  csvName: "Name",

  usageReport: "## 📊 Usage Report ({date})",
  mdTotal: "### Total",
  mdByModel: "### By Model",
  mdByProject: "### By Project",
  mdByProvider: "### By Provider",

  compareTitle: "📊 Compare: {a} vs {b}",
  diff: "Diff",
  changeRate: "Change",
  invalidPeriod: 'Invalid period format: "{value}", please use YYYY-MM or YYYY-MM-DD',

  // Multi-client
  client: "Client",
  all: "All",
  multiClientTitle: "📊 Multi-Client Usage Report ({date})",
  clientBreakdown: "Client Breakdown",
  noClientsDetected: "No AI clients detected with usage data.",
  clientEncrypted: "{name}: database is encrypted and cannot be read.",
  detectedClients: "Detected clients:",

  invalidDateFormat: 'Invalid date format: "{value}", please use YYYY-MM-DD',
  dateNotExist: 'Date does not exist: "{value}"',
  startAfterEnd: "Start date cannot be after end date: {from} > {to}",
  errorPrefix: "Error",

  // Config command
  configTitle: "⚙️  Path Configuration",
  configListTitle: "Current client path configuration:",
  configDetectedPath: "Detected",
  configCustomPath: "Custom",
  configNotDetected: "Not detected",
  configPathNotExist: "⚠️  Path does not exist: {path}",
  configPathSet: "✅ Set {name} path: {path}",
  configPathReset: "✅ Cleared custom path for {name}",
  configSaved: "✅ Config saved to: {path}",
  configResetAll: "✅ All custom path configurations cleared",
  configNoCustomPaths: "No custom paths configured",
  configDbIgnored: "⚠️  --db is ignored in multi-client mode, use ocusage config to manage paths",

  // 交互式配置（inquirer）
  configSelectClient: "Select client to configure",
  configClientAction: "{name} Action",
  configActionInputPath: "Enter custom path",
  configActionResetPath: "Reset to auto-detect",
  configActionBack: "Back",
  configLocaleSkip: "Skip",
  configExit: "Done & Exit",
  configStatusDetected: "Detected: {path}",
  configStatusCustom: "Custom: {path}",
  configInputPathPrompt: "Enter custom path",

  // Language setting
  configLocaleTitle: "Language Setting",
  configLocaleCurrent: "Current language: {locale}",
  configLocaleSet: "✅ Language set to: {locale}",
};
