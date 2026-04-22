# Changelog

All notable changes to this project will be documented in this file.

## [1.4.0] - 2026-04-22

### Added
- **Automatic agent installation**: 11 agents installed via `postinstall` hook
- **CLI ocp-agents**: New command for managing agents (`npx ocp-agents install|list|status|update`)
- **Hierarchical report flow**: Each report aggregates from previous level
  - `generateTodaySummary()` → `daily-summary.md` (reads all session files)
  - `generateWeeklySummary()` → `week-summary.md` (reads `day-summary.md`)
  - `generateMonthlySummary()` → `monthly-YYYY-MM.md` (reads `week-summary.md`)
  - `generateAnnualSummary()` → `annual-YYYY.md` (reads `monthly-*.md`)
  - `updateIntelligenceLearning()` → `intelligence-learning.md` (reads all 4 levels)
- **Obsidian-style keyword links**: `[[keyword]]` links and navigation in reports
- **Agents directory**: `.md` agent files included in npm package

### Changed
- **Simplified file structure**: All reports now nested under year/month/week hierarchy
  ```
  context-session/
  ├── daily-summary.md
  ├── intelligence-learning.md
  └── YYYY/
      ├── annual-YYYY.md
      └── MM/
          ├── monthly-YYYY-MM.md
          └── WW/
              └── week-summary.md
  ```
- **Package description**: Updated to reference `context-session/` instead of `contextos/`
- **REPORT_PATHS updated**: All paths now follow hierarchical structure

### Fixed
- Sequential await for report generation (was Promise.all fire-and-forget)
- Regex lookahead bug in parseExistingEntries
- Duplicate session entries in intelligence-learning.md

## [1.3.12] - 2026-04-21

### Fixed
- Proper session parsing and greeting filtering in intelligence module
