# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.7.0](https://github.com/geeeger-pkgs/ocusage/compare/v3.6.1...v3.7.0) (2026-07-01)


### Features

* add WorkBuddy provider for AI client usage tracking ([4aca1da](https://github.com/geeeger-pkgs/ocusage/commit/4aca1daf1190c77b0d39261c09e3e0e783ebe2dd))


### Bug Fixes

* resolve lint errors in WorkBuddy provider ([c5cfc17](https://github.com/geeeger-pkgs/ocusage/commit/c5cfc171f4c4d4ece54e54d44059ce0818525720))

## [3.6.1](https://github.com/geeeger-pkgs/ocusage/compare/v3.6.0...v3.6.1) (2026-06-23)


### Bug Fixes

* include cache read/write in totalTokens for Claude Code, Qoder, Qoder CLI, and Trae ([68ba539](https://github.com/geeeger-pkgs/ocusage/commit/68ba5393194633d5ed86f1905901057490d03d15))

## [3.6.0](https://github.com/geeeger-pkgs/ocusage/compare/v3.5.0...v3.6.0) (2026-06-11)


### Features

* add SQLCipher decryption support to Trae Solo provider ([c2af6c0](https://github.com/geeeger-pkgs/ocusage/commit/c2af6c06245106799c47ec0341b139af759d552a))


### Bug Fixes

* add byProject/byProvider to multi-client CSV output ([d3fba56](https://github.com/geeeger-pkgs/ocusage/commit/d3fba566c713a1553aa4fcce096a7697b843adb6))
* revert Trae Solo decryption — key is not extractable per research ([5588a9e](https://github.com/geeeger-pkgs/ocusage/commit/5588a9e933004986a4072c1c49a9c3f671ad3cc8))
* skip integration tests requiring DB when no AI clients installed ([3b11910](https://github.com/geeeger-pkgs/ocusage/commit/3b11910619f41a87864ba91a4a5ad1846a544f07))
* use literal key access in integration test ([d5a3c1c](https://github.com/geeeger-pkgs/ocusage/commit/d5a3c1c305d18657a3e00f5be91cadb5e9b734af))

## [3.5.0](https://github.com/geeeger-pkgs/ocusage/compare/v3.4.0...v3.5.0) (2026-06-11)


### Features

* add byModel/byProject/byProvider comparison to compare JSON output ([e05f576](https://github.com/geeeger-pkgs/ocusage/commit/e05f576a705bffd6097cffcec8ec45ae1448ff81))

## [3.4.0](https://github.com/geeeger-pkgs/ocusage/compare/v3.3.0...v3.4.0) (2026-06-11)


### Features

* add MiMoCode provider ([afff9b1](https://github.com/geeeger-pkgs/ocusage/commit/afff9b140546200be8a6713e87c1db82fdb28442))

## [3.3.0](https://github.com/geeeger-pkgs/ocusage/compare/v3.2.1...v3.3.0) (2026-06-10)


### Features

* trae sqlcipher 解密支持 ([ac68387](https://github.com/geeeger-pkgs/ocusage/commit/ac68387cba307a5e83caeb9351b7b579b3741456))


### Bug Fixes

* 移除未使用的 encrypted 变量，修复 lint 问题 ([21c031d](https://github.com/geeeger-pkgs/ocusage/commit/21c031d0242bbe8c6d2425ae0c382eb61f9a2935))

## [3.2.1](https://github.com/geeeger-pkgs/ocusage/compare/v3.2.0...v3.2.1) (2026-06-10)


### Bug Fixes

* 多客户端汇总中筛除零用量客户端 ([55a5c56](https://github.com/geeeger-pkgs/ocusage/commit/55a5c5663861917201c0e179be02fa16ba0b075c))

## [3.2.0](https://github.com/geeeger-pkgs/ocusage/compare/v3.1.0...v3.2.0) (2026-06-09)


### Features

* 支持 CodeWhale 客户端 token 用量查询 ([f4a65db](https://github.com/geeeger-pkgs/ocusage/commit/f4a65db389d1ac4baa25af00e7e85afd0bac0e9f))


### Bug Fixes

* **qoder:** count tool calls from role=tool messages and tool.requested events ([7881cd8](https://github.com/geeeger-pkgs/ocusage/commit/7881cd8b2fa4146a2571240ace39e2a5be26da00))

## [3.1.0](https://github.com/geeeger-pkgs/ocusage/compare/v3.0.1...v3.1.0) (2026-06-05)


### Features

* 支持快捷日期别名 ([ccbf02d](https://github.com/geeeger-pkgs/ocusage/commit/ccbf02d92820d722a582c22132359bb91020e14c))


### Bug Fixes

* config --reset 保留 locale 设置 ([f472e59](https://github.com/geeeger-pkgs/ocusage/commit/f472e59de0f6101224e6655ae9c661b67f2377be))

## [3.0.1](https://github.com/geeeger-pkgs/ocusage/compare/v3.0.0...v3.0.1) (2026-06-05)


### Bug Fixes

* 修复compare命令-c参数被父命令抢占导致始终查询opencode的问题 ([fc98d6a](https://github.com/geeeger-pkgs/ocusage/commit/fc98d6a1af52f57f44ad619d532663db1a524c8d))

## [3.0.0](https://github.com/geeeger-pkgs/ocusage/compare/v2.3.0...v3.0.0) (2026-06-05)


### ⚠ BREAKING CHANGES

* 移除 db.mjs，CLI 默认行为改为 -c opencode

### Features

* 多客户端 provider 架构重构 ([3f0dd98](https://github.com/geeeger-pkgs/ocusage/commit/3f0dd98f5bb9b0e4857b1fc51ba13a05f4635093))

## [2.3.0](https://github.com/geeeger-pkgs/ocusage/compare/v2.2.0...v2.3.0) (2026-06-04)


### Features

* 新增 compare 子命令支持时段对比分析 ([3b38679](https://github.com/geeeger-pkgs/ocusage/commit/3b3867912fc51ac34ae0d4e840241b527a722d24))

## [2.2.0](https://github.com/geeeger-pkgs/ocusage/compare/v2.1.0...v2.2.0) (2026-06-04)


### Features

* 新增 i18n 国际化支持 ([3887a6a](https://github.com/geeeger-pkgs/ocusage/commit/3887a6a39187a32dcbd2a6bde46f75d046aa9e48))

## [2.1.0](https://github.com/geeeger-pkgs/ocusage/compare/v2.0.0...v2.1.0) (2026-06-04)


### Features

* 新增日期范围查询、多格式导出、错误处理及CI ([5003c2b](https://github.com/geeeger-pkgs/ocusage/commit/5003c2b3e839c8a08fbf469be2f69effc20087a7))

## [2.0.0](https://github.com/geeeger-pkgs/ocusage/compare/v1.3.2...v2.0.0) (2026-04-29)


### ⚠ BREAKING CHANGES

* requires Node.js >= 22.5.0 (was >= 20.0.0)

### Features

* replace sql.js with node:sqlite for WAL mode support ([18d33a6](https://github.com/geeeger-pkgs/ocusage/commit/18d33a6f87c99b704653a62de8447735cf4a03b6))

## [1.3.2](https://github.com/geeeger-pkgs/ocusage/compare/v1.3.1...v1.3.2) (2026-04-22)


### Bug Fixes

* include LICENSE in npm files and update README deps description ([a9911c2](https://github.com/geeeger-pkgs/ocusage/commit/a9911c2e8e11eeb68ee999584992c5468430b683))

## [1.3.1](https://github.com/geeeger-pkgs/ocusage/compare/v1.3.0...v1.3.1) (2026-04-22)


### Bug Fixes

* auto-publish to npm on release by combining into release-please workflow ([84cc973](https://github.com/geeeger-pkgs/ocusage/commit/84cc973a96465840b6461f4a440870e0ef3128ba))

## [1.3.0](https://github.com/geeeger-pkgs/ocusage/compare/v1.2.0...v1.3.0) (2026-04-22)


### Features

* replace better-sqlite3 with sql.js for cross-platform compatibility ([#11](https://github.com/geeeger-pkgs/ocusage/issues/11)) ([b1e1ec9](https://github.com/geeeger-pkgs/ocusage/commit/b1e1ec924d03a62e16d1973a5badee637a950ec9))

## [1.2.0](https://github.com/geeeger-pkgs/ocusage/compare/v1.1.0...v1.2.0) (2026-04-22)


### Features

* 增加手动触发publish ([1980dc0](https://github.com/geeeger-pkgs/ocusage/commit/1980dc0342aa5bb030a9703a33868e6f5f86d4f1))

## [1.1.0](https://github.com/geeeger-pkgs/ocusage/compare/v1.0.0...v1.1.0) (2026-04-22)


### Features

* 移除node 18支持 ([e77b93a](https://github.com/geeeger-pkgs/ocusage/commit/e77b93af382d6c3b27fc30aa01c0f10050ef0ae3))

## 1.0.0 (2026-04-22)


### Features

* initial release v0.9.0 ([672ae6f](https://github.com/geeeger-pkgs/ocusage/commit/672ae6f07391ac45cc42072485cd535f14c9fa65))

## [1.0.0] - 2026-04-22

### Added

- Initial release: daily token usage report from OpenCode SQLite DB
- Grouping by model, project, and provider
- Cache read/write token tracking
- `--json` output mode
- Date and DB path options
