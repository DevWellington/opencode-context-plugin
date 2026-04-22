# Changelog

All notable changes to this project will be documented in this file.

## [1.5.0] - 2026-04-22

### Added
- **Token Counting Enhancement**: `countTokens()` with type-aware estimation (3 chars/token for code, 4 for prose), `countSessionTokens()` for session analysis by role and message
- **Summary Budget Limits**: Configurable character limits per summary level (day: 5000, week: 3000, month: 2000, annual: 1000 chars)
- **Smart Generation Triggers**: `shouldRegenerate()` detects meaningful changes (>5%) to skip unnecessary regeneration
- **Priority-Based Context**: `classifySessionPriority()` classifies sessions as high/medium/low with configurable retention
- **Nested Intelligence**: `extractPersistentPatterns()` pins patterns after 3+ sessions, deduplication across summaries
- **Protected Patterns**: `isProtected()` with glob/regex pattern matching, protects content from being overwritten
- **State Persistence**: `state.js` module tracks summarized content, enables resume after plugin restart
- **ocp_memory API**: Agent tool for cross-session memory management (write/read/search actions)

### Changed
- **Budget enforcement**: All generators now respect budget limits configured in `config.js`
- **Token transparency**: Summary reports now include token breakdown statistics by role

## [1.4.1] - 2026-04-22

### Fixed
- **Hierarchical flow paths**: `generateIntelligenceLearning.js` now reads from correct hierarchical paths (`YYYY/MM/WW/week-summary.md`)
- **Emoji duplication**: `extractSection` regex fixed to properly strip emojis before re-adding
- **formatDayContent**: Now strips existing bullet markers before adding emojis
- **Test suite**: Fixed hardcoded date in `saveContext.test.js` - now uses dynamic date

### Changed
- **Report generation**: All 5 generators run sequentially (today → weekly → monthly → annual → intelligence)
- **Content extraction**: Each level only reads from its scope (same day/week/month/year)

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
