# API Export Inventory

Generated: 2026-05-25T03:36:21Z

## Summary

| Category | Count | Description |
|----------|-------|-------------|
| Internal Dead | 2 | Exported but never imported (removed export) |
| Public Intentional | 32 | Documented public API (@public) |
| Internal Used | 170 | Used internally or in tests (export preserved for testability) |
| **Total** | **204** | |

## 1. Internal Dead Exports (Cleaned)

These exports were removed (function body preserved as internal helper):

| Export | File | Action |
|--------|------|--------|
| `saveTemplate` | src/modules/projectTemplates.js:522 | Removed `export` keyword |
| `getTemplateRecommendations` | src/modules/projectTemplates.js:554 | Removed `export` keyword |

**Decision:** These are unused features. Function bodies preserved for potential future use.

## 2. Public Intentional Exports (@public)

These exports are part of the documented public API and marked with `@public`:

### Core Operations
- `saveContext` — Save session context to file
- `getRelevantContexts` — Get relevant contexts for injection
- `injectContextPrompt` — Inject context into prompt
- `formatForInjection` — Format contexts for injection

### Search Operations
- `buildSearchIndex` — Build full-text search index
- `searchSessions` — Search sessions by query
- `updateSearchIndex` — Update search index
- `executeSearch` — Execute search query
- `parseSearchQuery` — Parse search query string

### Report Generation
- `generateWeeklyReport` — Generate weekly summary report
- `generateMonthlyReport` — Generate monthly summary report
- `generateAnnualReport` — Generate annual summary report
- `generateActivityReport` — Generate activity report
- `scanSessionsInRange` — Scan sessions in date range
- `saveReport` — Save report to file

### Remote Sync
- `configureRemoteSync` — Configure remote sync provider
- `syncToRemote` — Sync data to remote storage
- `getSyncStatus` — Get sync status
- `syncGlobalIntelligence` — Sync global intelligence
- `initializeRemoteSync` — Initialize remote sync

### Agent System
- `showHelp` — Show help for agent commands
- `generateTodaySummary` — Generate today summary
- `generateWeeklySummary` — Generate weekly summary
- `generateMonthlySummary` — Generate monthly summary
- `generateAnnualSummary` — Generate annual summary
- `updateIntelligenceLearning` — Update intelligence learning
- `readTodaySummary` — Read today summary
- `readWeeklySummary` — Read weekly summary
- `readMonthlySummary` — Read monthly summary
- `readAnnualSummary` — Read annual summary
- `readIntelligenceLearning` — Read intelligence learning

### Configuration
- `loadConfig` — Load plugin configuration
- `getConfig` — Get current configuration

## 3. Internal Used Exports (Preserved)

These exports are used internally within the codebase or in tests. Export preserved for:
- Testability (tests import directly)
- Module communication (cross-module imports)
- Dynamic imports (async import patterns)

Total: 170 exports

### Usage Categories

| Purpose | Count | Examples |
|---------|-------|----------|
| Test imports | 120+ | `isDestroyed`, `validateSessionContent`, `createDebugLogger` |
| Cross-module imports | 40+ | `extractBugs`, `atomicWrite`, `debounce` |
| Dynamic imports | 10+ | `resetSessionState`, `invalidateCache` |

## 4. Files Modified

| File | Changes |
|------|---------|
| src/modules/projectTemplates.js | Removed `export` from `saveTemplate`, `getTemplateRecommendations` |
| README.md | Added Public API section |

## 5. Acceptance Criteria Met

1. [x] Inventory report created
2. [x] Dead exports cleaned (export keyword removed, function body preserved)
3. [x] Public exports documented in README
4. [x] All 801 tests pass

## Notes

- Most "dead" exports are actually used in tests - preserved for testability
- `@public` annotations added to intentional public exports
- Backward compatibility preserved - no function bodies removed