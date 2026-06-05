export default {
  totalRequests: "今日總請求數",
  inputTokens: "輸入Tokens",
  outputTokens: "輸出Tokens",
  toolCalls: "工具調用數量",
  cacheRead: "快取讀取",
  cacheWrite: "快取建立",
  totalTokens: "總計Tokens",
  requests: "請求數",

  overallData: "📊 總體數據 ({date})",
  byModelTitle: "📊 按模型分組",
  byProjectTitle: "📊 按專案分組",
  byProviderTitle: "📊 按供應商分組",

  model: "模型",
  project: "專案",
  provider: "供應商",

  noData: "📭 {date} 暫無使用記錄",

  groupTotal: "總計",
  groupModel: "模型",
  groupProject: "專案",
  groupProvider: "供應商",
  csvGroup: "分組",
  csvName: "名稱",

  usageReport: "## 📊 使用報告 ({date})",
  mdTotal: "### 總計",
  mdByModel: "### 按模型",
  mdByProject: "### 按專案",
  mdByProvider: "### 按供應商",

  compareTitle: "📊 對比: {a} vs {b}",
  diff: "差值",
  changeRate: "變化率",
  invalidPeriod: '時段格式無效: "{value}"，請使用 YYYY-MM 或 YYYY-MM-DD 格式',

  // 多用戶端
  client: "用戶端",
  all: "全部",
  multiClientTitle: "📊 多用戶端使用報告 ({date})",
  clientBreakdown: "各用戶端彙整",
  noClientsDetected: "未偵測到有使用資料的 AI 用戶端",
  clientEncrypted: "{name}: 資料庫已加密，暫時無法讀取",
  detectedClients: "偵測到的用戶端:",

  invalidDateFormat: '日期格式無效: "{value}"，請使用 YYYY-MM-DD 格式',
  dateNotExist: '日期不存在: "{value}"',
  startAfterEnd: "起始日期不能晚於結束日期: {from} > {to}",
  errorPrefix: "錯誤",

  // 設定命令
  configTitle: "⚙️  路徑設定",
  configListTitle: "目前各用戶端路徑設定:",
  configDetectedPath: "偵測路徑",
  configCustomPath: "自訂路徑",
  configNotDetected: "未偵測到",
  configPathNotExist: "⚠️  路徑不存在: {path}",
  configPathSet: "✅ 已設定 {name} 路徑: {path}",
  configPathReset: "✅ 已清除 {name} 的自訂路徑",
  configSaved: "✅ 設定已儲存至: {path}",
  configResetAll: "✅ 已清除所有自訂路徑設定",
  configNoCustomPaths: "暫無自訂路徑設定",
  configDbIgnored: "⚠️  多用戶端模式下 --db 參數無效，請使用 ocusage config 管理路徑",

  // 互動式設定（inquirer）
  configSelectClient: "選擇要設定的用戶端",
  configClientAction: "{name} 操作",
  configActionInputPath: "輸入自訂路徑",
  configActionResetPath: "重設為自動偵測",
  configActionBack: "返回",
  configLocaleSkip: "跳過",
  configExit: "完成退出",
  configStatusDetected: "已偵測: {path}",
  configStatusCustom: "自訂: {path}",
  configInputPathPrompt: "請輸入自訂路徑",

  // 語言設定
  configLocaleTitle: "語言設定",
  configLocaleCurrent: "目前語言: {locale}",
  configLocaleSet: "✅ 語言已設定為: {locale}",
};
