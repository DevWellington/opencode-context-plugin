---
phase: 01-context-session-improvements
plan: 03
type: execute
wave: 2
depends_on: ["01-02"]
files_modified: [index.js]
autonomous: true
requirements: [SESSION-05]
user_setup: []

must_haves:
  truths:
    - "Daily summary exists at root of context-session folder"
    - "Daily summary updated on every compact/exit event"
    - "Daily summary contains list of all session files for the day"
  artifacts:
    - path: "index.js"
      provides: "Daily summary update function"
      exports: ["updateDailySummary"]
    - path: ".opencode/context-session/daily-summary.md"
      provides: "Aggregated daily session list"
      min_lines: 5
  key_links:
    - from: "saveContext"
      to: "updateDailySummary"
      via: "function call after file save"
      pattern: "updateDailySummary\\(.*sessionInfo\\)"
---

<objective>
Implement daily summary routine that maintains a summary file at the root of context-session folder, aggregating all compact and exit sessions for the day.

Purpose: Provide quick overview of daily activity without reading individual session files.
Output: daily-summary.md at root, updated on every session event.
</objective>

<execution_context>
@$HOME/.config/opencode/get-shit-done/workflows/execute-plan.md
@$HOME/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-context-session-improvements/01-CONTEXT.md
@.planning/phases/01-context-session-improvements/01-DISCOVERY.md
@.planning/phases/01-context-session-improvements/01-SUMMARY.md
@.planning/phases/01-context-session-improvements/02-SUMMARY.md

<interfaces>
<!-- From Plan 02 output -->
```javascript
// Hierarchical directory function
async function ensureHierarchicalDir(baseDir) // Returns {dirPath, year, month, week, day}

// Save context with hierarchical structure
async function saveContext(directory, session, type) // Returns savedFilePath

// Summary updates
async function updateDaySummary(dirPath, sessionInfo) // Updates YYYY/MM/WW/DD/summary.md
async function updateWeekSummary(baseDir, year, month, week) // Updates YYYY/MM/WW/summary.md
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement daily summary update function</name>
  <files>index.js</files>
  <behavior>
    - Test 1: daily-summary.md created at .opencode/context-session/ root
    - Test 2: Each session adds one line entry with timestamp and type
    - Test 3: Entries are idempotent (same session doesn't duplicate)
    - Test 4: File uses atomic write (no corruption risk)
    - Test 5: Format: `- [timestamp] {type}: filename`
  </behavior>
  <action>
    1. Create `updateDailySummary(baseDir, sessionInfo)` async function (from DISCOVERY.md section 5):
       - baseDir: project root directory
       - sessionInfo: {type, filename, timestamp}
    2. Summary file path: `path.join(baseDir, '.opencode/context-session', 'daily-summary.md')`
    3. Read existing content or initialize with header `# Daily Summary\n\n`
    4. Format entry: `- [${timestamp}] ${type === 'compact' ? '📦 Compact' : '🚪 Exit'}: ${filename}\n`
    5. Check if filename already exists in content (idempotency)
    6. Append entry if new, then atomicWrite
    7. Handle errors gracefully (log but don't fail session save)
  </action>
  <verify>
    <automated>node -c index.js</automated>
  </verify>
  <done>Daily summary function implemented with atomic writes and idempotency</done>
</task>

<task type="auto">
  <name>Task 2: Integrate daily summary into saveContext flow</name>
  <files>index.js</files>
  <action>
    1. Update saveContext function to call updateDailySummary after successful file save
    2. Pass sessionInfo object: {type, filename, timestamp}
    3. Use Promise.all to update daily summary and day summary in parallel (performance optimization)
    4. Wrap in try/catch to prevent summary failures from breaking session save
    5. Add debug logging: `[Daily Summary] Updated with ${filename}`
    6. Return enhanced result object: {savedFilePath, summariesUpdated: boolean}
  </action>
  <verify>
    <automated>node -c index.js</automated>
  </verify>
  <done>Daily summary updated automatically on every session save</done>
</task>

<task type="auto">
  <name>Task 3: Add daily summary header with date and statistics</name>
  <files>index.js</files>
  <action>
    1. Enhance daily-summary.md format to include:
       - Date header: `## ${today's date in YYYY-MM-DD format}`
       - Session count: `**Total Sessions:** ${count}`
       - Breakdown: `**Compacts:** ${compactCount} | **Exits:** ${exitCount}`
    2. Update header section when date changes (detect new day)
    3. Parse existing entries to calculate statistics
    4. Maintain chronological order (newest at bottom or top - choose top for visibility)
    5. Example format:
       ```markdown
       # Daily Summary

       ## 2026-04-21
       **Total Sessions:** 5
       **Compacts:** 3 | **Exits:** 2

       - [2026-04-21T10:30:00Z] 📦 Compact: compact-2026-04-21T10-30-00.md
       - [2026-04-21T11:15:00Z] 🚪 Exit: exit-2026-04-21T11-15-00.md
       ...
       ```
    6. Update updateDailySummary function to maintain this format
  </action>
  <verify>
    <automated>node -c index.js</automated>
  </verify>
  <done>Daily summary includes date header and session statistics</done>
</task>

</tasks>

<verification>
- daily-summary.md exists at .opencode/context-session/ root
- File updated on every compact/exit event
- Entries are idempotent (no duplicates)
- Statistics accurate (count matches actual entries)
- Atomic writes prevent corruption
</verification>

<success_criteria>
- Daily summary maintained automatically
- Format includes date, statistics, and session list
- Performance impact minimal (< 100ms)
- Error handling prevents session save failures
</success_criteria>

<output>
After completion, create `.planning/phases/01-context-session-improvements/03-SUMMARY.md`
</output>
