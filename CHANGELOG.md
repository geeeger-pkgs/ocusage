# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
