# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
