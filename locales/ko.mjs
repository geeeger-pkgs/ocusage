export default {
  totalRequests: "오늘 총 요청수",
  inputTokens: "입력 토큰",
  outputTokens: "출력 토큰",
  toolCalls: "도구 호출수",
  cacheRead: "캐시 읽기",
  cacheWrite: "캐시 생성",
  totalTokens: "총 토큰",
  requests: "요청수",

  overallData: "📊 전체 데이터 ({date})",
  byModelTitle: "📊 모델별",
  byProjectTitle: "📊 프로젝트별",
  byProviderTitle: "📊 제공자별",

  model: "모델",
  project: "프로젝트",
  provider: "제공자",

  noData: "📭 {date} 사용 기록 없음",

  groupTotal: "합계",
  groupModel: "모델",
  groupProject: "프로젝트",
  groupProvider: "제공자",
  csvGroup: "그룹",
  csvName: "이름",

  usageReport: "## 📊 사용 보고서 ({date})",
  mdTotal: "### 합계",
  mdByModel: "### 모델별",
  mdByProject: "### 프로젝트별",
  mdByProvider: "### 제공자별",

  compareTitle: "📊 비교: {a} vs {b}",
  diff: "차이",
  changeRate: "변화율",
  invalidPeriod: '기간 형식이 잘못되었습니다: "{value}", YYYY-MM 또는 YYYY-MM-DD 형식을 사용하세요',

  // 멀티 클라이언트
  client: "클라이언트",
  all: "전체",
  multiClientTitle: "📊 멀티 클라이언트 사용 보고서 ({date})",
  clientBreakdown: "클라이언트별 내역",
  noClientsDetected: "사용 데이터가 있는 AI 클라이언트가 감지되지 않았습니다.",
  clientEncrypted: "{name}: 데이터베이스가 암호화되어 읽을 수 없습니다.",
  detectedClients: "감지된 클라이언트:",

  invalidDateFormat: '날짜 형식이 잘못되었습니다: "{value}", YYYY-MM-DD 형식을 사용하세요',
  dateNotExist: '존재하지 않는 날짜입니다: "{value}"',
  startAfterEnd: "시작 날짜가 종료 날짜보다 늦습니다: {from} > {to}",
  errorPrefix: "오류",

  // 설정 명령
  configTitle: "⚙️  경로 설정",
  configListTitle: "현재 클라이언트 경로 설정:",
  configDetectedPath: "감지 경로",
  configCustomPath: "사용자 정의 경로",
  configNotDetected: "감지되지 않음",
  configPathNotExist: "⚠️  경로가 존재하지 않습니다: {path}",
  configPathSet: "✅ {name} 경로 설정 완료: {path}",
  configPathReset: "✅ {name}의 사용자 정의 경로를 삭제했습니다",
  configSaved: "✅ 설정이 저장되었습니다: {path}",
  configResetAll: "✅ 모든 사용자 정의 경로 설정이 삭제되었습니다",
  configNoCustomPaths: "사용자 정의 경로 설정 없음",
  configDbIgnored: "⚠️  멀티 클라이언트 모드에서는 --db가 무시됩니다. ocusage config로 경로를 관리하세요",

  // 대화식 설정（inquirer）
  configSelectClient: "설정할 클라이언트 선택",
  configClientAction: "{name} 작업",
  configActionInputPath: "사용자 정의 경로 입력",
  configActionResetPath: "자동 감지로 재설정",
  configActionBack: "뒤로",
  configLocaleSkip: "건너뛰기",
  configExit: "완료 및 종료",
  configStatusDetected: "감지됨: {path}",
  configStatusCustom: "사용자 정의: {path}",
  configInputPathPrompt: "사용자 정의 경로를 입력하세요",

  // 언어 설정
  configLocaleTitle: "언어 설정",
  configLocaleCurrent: "현재 언어: {locale}",
  configLocaleSet: "✅ 언어가 설정되었습니다: {locale}",
};
