export default {
  totalRequests: "本日リクエスト数",
  inputTokens: "入力トークン",
  outputTokens: "出力トークン",
  toolCalls: "ツール呼出数",
  cacheRead: "キャッシュ読取",
  cacheWrite: "キャッシュ作成",
  totalTokens: "合計トークン",
  requests: "リクエスト数",

  overallData: "📊 全体データ ({date})",
  byModelTitle: "📊 モデル別",
  byProjectTitle: "📊 プロジェクト別",
  byProviderTitle: "📊 プロバイダー別",

  model: "モデル",
  project: "プロジェクト",
  provider: "プロバイダー",

  noData: "📭 {date} 使用記録なし",

  groupTotal: "合計",
  groupModel: "モデル",
  groupProject: "プロジェクト",
  groupProvider: "プロバイダー",
  csvGroup: "グループ",
  csvName: "名前",

  usageReport: "## 📊 使用レポート ({date})",
  mdTotal: "### 合計",
  mdByModel: "### モデル別",
  mdByProject: "### プロジェクト別",
  mdByProvider: "### プロバイダー別",

  compareTitle: "📊 比較: {a} vs {b}",
  diff: "差分",
  changeRate: "変化率",
  invalidPeriod: '期間の形式が無効です: "{value}"、YYYY-MM または YYYY-MM-DD 形式を使用してください',

  // マルチクライアント
  client: "クライアント",
  all: "すべて",
  multiClientTitle: "📊 マルチクライアント使用レポート ({date})",
  clientBreakdown: "クライアント別内訳",
  noClientsDetected: "使用データのあるAIクライアントが検出されませんでした。",
  clientEncrypted: "{name}: データベースが暗号化されており読み取れません。",
  detectedClients: "検出されたクライアント:",

  invalidDateFormat: '日付形式が無効です: "{value}"、YYYY-MM-DD形式を使用してください',
  dateNotExist: '存在しない日付です: "{value}"',
  startAfterEnd: "開始日が終了日より後です: {from} > {to}",
  errorPrefix: "エラー",

  // 設定コマンド
  configTitle: "⚙️  パス設定",
  configListTitle: "現在のクライアントパス設定:",
  configDetectedPath: "検出パス",
  configCustomPath: "カスタムパス",
  configNotDetected: "未検出",
  configPathNotExist: "⚠️  パスが存在しません: {path}",
  configPathSet: "✅ {name} のパスを設定しました: {path}",
  configPathReset: "✅ {name} のカスタムパスを削除しました",
  configSaved: "✅ 設定を保存しました: {path}",
  configResetAll: "✅ すべてのカスタムパス設定を削除しました",
  configNoCustomPaths: "カスタムパス設定なし",
  configDbIgnored: "⚠️  マルチクライアントモードでは --db は無効です。ocusage config でパスを管理してください",

  // 対話式設定（inquirer）
  configSelectClient: "設定するクライアントを選択",
  configClientAction: "{name} 操作",
  configActionInputPath: "カスタムパスを入力",
  configActionResetPath: "自動検出にリセット",
  configActionBack: "戻る",
  configLocaleSkip: "スキップ",
  configExit: "終了",
  configStatusDetected: "検出済み: {path}",
  configStatusCustom: "カスタム: {path}",
  configInputPathPrompt: "カスタムパスを入力してください",

  // 言語設定
  configLocaleTitle: "言語設定",
  configLocaleCurrent: "現在の言語: {locale}",
  configLocaleSet: "✅ 言語を設定しました: {locale}",
};
