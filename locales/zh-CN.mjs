export default {
  // 表头
  totalRequests: "今日总请求数",
  inputTokens: "输入Tokens",
  outputTokens: "输出Tokens",
  toolCalls: "工具调用数量",
  cacheRead: "缓存读取",
  cacheWrite: "缓存创建",
  totalTokens: "总计Tokens",
  requests: "请求数",

  // 分组标题
  overallData: "📊 总体数据 ({date})",
  byModelTitle: "📊 按模型分组",
  byProjectTitle: "📊 按项目分组",
  byProviderTitle: "📊 按供应商分组",

  // 分组首列
  model: "模型",
  project: "项目",
  provider: "供应商",

  // 空数据提示
  noData: "📭 {date} 暂无使用记录",

  // CSV 分组标签
  groupTotal: "总计",
  groupModel: "模型",
  groupProject: "项目",
  groupProvider: "供应商",
  csvGroup: "分组",
  csvName: "名称",

  // Markdown
  usageReport: "## 📊 使用报告 ({date})",
  mdTotal: "### 总计",
  mdByModel: "### 按模型",
  mdByProject: "### 按项目",
  mdByProvider: "### 按供应商",

  // 对比功能
  compareTitle: "📊 对比: {a} vs {b}",
  diff: "差值",
  changeRate: "变化率",
  invalidPeriod: '时段格式无效: "{value}"，请使用 YYYY-MM 或 YYYY-MM-DD 格式',

  // 多客户端
  client: "客户端",
  all: "全部",
  multiClientTitle: "📊 多客户端使用报告 ({date})",
  clientBreakdown: "各客户端汇总",
  noClientsDetected: "未检测到有使用数据的 AI 客户端",
  clientEncrypted: "{name}: 数据库已加密，暂时无法读取",
  detectedClients: "检测到的客户端:",

  // 错误信息
  invalidDateFormat: '日期格式无效: "{value}"，请使用 YYYY-MM-DD 格式',
  dateNotExist: '日期不存在: "{value}"',
  startAfterEnd: "起始日期不能晚于结束日期: {from} > {to}",
  errorPrefix: "错误",

  // 配置命令
  configTitle: "⚙️  路径配置",
  configListTitle: "当前各客户端路径配置:",
  configDetectedPath: "检测路径",
  configCustomPath: "自定义路径",
  configNotDetected: "未检测到",
  configPathNotExist: "⚠️  路径不存在: {path}",
  configPathSet: "✅ 已设置 {name} 路径: {path}",
  configPathReset: "✅ 已清除 {name} 的自定义路径",
  configSaved: "✅ 配置已保存到: {path}",
  configResetAll: "✅ 已清除所有自定义路径配置",
  configNoCustomPaths: "暂无自定义路径配置",
  configDbIgnored: "⚠️  多客户端模式下 --db 参数无效，请使用 ocusage config 管理路径",

  // 交互式配置（inquirer）
  configSelectClient: "选择要配置的客户端",
  configClientAction: "{name} 操作",
  configActionInputPath: "输入自定义路径",
  configActionResetPath: "重置为自动检测",
  configActionBack: "返回",
  configLocaleSkip: "跳过",
  configExit: "完成退出",
  configStatusDetected: "已检测: {path}",
  configStatusCustom: "自定义: {path}",
  configInputPathPrompt: "请输入自定义路径",

  // 语言设置
  configLocaleTitle: "语言设置",
  configLocaleCurrent: "当前语言: {locale}",
  configLocaleSet: "✅ 语言已设置为: {locale}",
};
