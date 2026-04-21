---
phase: 01-context-session-improvements
plan: 02
type: execute
wave: 1
depends_on: []
files_modified: [index.js]
autonomous: true
requirements: [SESSION-03, SESSION-06]
user_setup: []

must_haves:
  truths:
    - "Context files saved in year/month/week/day hierarchy"
    - "Summary files auto-generated at day and week levels"
    - "Directory structure created automatically"
  artifacts:
    - path: "index.js"
      provides: "Hierarchical directory creation and summary generation"
      exports: ["default", "ensureHierarchicalDir", "updateDaySummary", "updateWeekSummary"]
  key_links:
    - from: "saveContext"
      to: "ensureHierarchicalDir"
      via: "function call"
      pattern: "ensureHierarchicalDir\\(directory\\)"
    - from: "updateDaySummary"
      to: "atomicWrite"
      via: "atomic file write"
      pattern: "atomicWrite\\(.*summary\\.md"
---

<objective>
Implement hierarchical folder structure (year/month/week/day) with auto-generated summary files at day and week levels.

Purpose: Enable temporal navigation and quick session overview at multiple time scales.
Output: Context files organized in YYYY/MM/WW/DD structure with summary.md files.
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

<interfaces>
<!-- From Plan 01 output -->
```javascript
// Updated imports
import fs from 'fs/promises';
import path from 'path';
import { getWeek, getWeekYear } from 'date-fns';

// Updated constants
const CONTEXT_SESSION_DIR = '.opencode/context-session';

// Updated function signatures
async function ensureContextSessionDir(directory) // Creates base directory
async function atomicWrite(filePath, content) // Atomic write helper
async function saveContext(directory, session, type) // type: 'compact' | 'exit'
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create hierarchical directory structure function</name>
  <files>index.js</files>
  <behavior>
    - Test 1: ensureHierarchicalDir creates YYYY/MM/WW/DD structure
    - Test 2: Week number uses ISO week (W01-W53 format)
    - Test 3: Month and day are zero-padded (01-12, 01-31)
    - Test 4: Function returns path components {dirPath, year, month, week, day}
    - Test 5: Directory creation is idempotent (safe to call multiple times)
  </behavior>
  <action>
    1. Create `ensureHierarchicalDir(baseDir)` async function (from DISCOVERY.md section 4)
    2. Use date-fns getWeek() for ISO week calculation
    3. Format components:
       - year: full 4-digit year
       - month: 2-digit with leading zero
       - week: `W` prefix + 2-digit week number
       - day: 2-digit with leading zero
    4. Use `await fs.mkdir(path, { recursive: true })` to create entire hierarchy
    5. Return object with all path components for use in summary generation
    6. Update `ensureContextSessionDir` to call this function
  </action>
  <verify>
    <automated>node -e "const {getWeek} = require('date-fns'); console.log(getWeek(new Date()))"</automated>
  </verify>
  <done>Hierarchical directory function works, returns correct path components</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Update saveContext to use hierarchical structure</name>
  <files>index.js</files>
  <behavior>
    - Test 1: Files saved in YYYY/MM/WW/DD subdirectory
    - Test 2: Filename format: {type}-{timestamp}.md (type = 'compact' or 'exit')
    - Test 3: Full path: .opencode/context-session/YYYY/MM/WW/DD/{type}-{timestamp}.md
    - Test 4: Directory created before file write
    - Test 5: Atomic write used for file save
  </behavior>
  <action>
    1. Update saveContext function signature: `async function saveContext(directory, session, type)`
    2. Call `ensureHierarchicalDir(directory)` to get path components
    3. Construct full file path: `path.join(dirPath, `${type}-${timestamp}.md`)`
    4. Use atomicWrite instead of writeFileSync
    5. Generate session content (existing logic, preserved)
    6. Update debug logging to show full hierarchical path
    7. Return saved file path for summary updates
  </action>
  <verify>
    <automated>node -c index.js</automated>
  </verify>
  <done>Context files saved in hierarchical structure with atomic writes</done>
</task>

<task type="auto">
  <name>Task 3: Implement day and week summary generation</name>
  <files>index.js</files>
  <action>
    1. Create `updateDaySummary(dirPath, sessionInfo)` async function:
       - Read or create summary.md in day directory
       - Append session entry with timestamp and type
       - Check for duplicates (idempotent)
       - Use atomicWrite
    2. Create `updateWeekSummary(baseDir, year, month, week)` async function (from DISCOVERY.md section 5):
       - Scan day directories in week
       - Count compact and exit files per day
       - Generate summary with day-by-day breakdown
       - Use atomicWrite
    3. Call updateDaySummary after each saveContext
    4. Call updateWeekSummary only when day changes (optimize to avoid redundant writes)
    5. Add error handling (don't fail session save if summary update fails)
    6. Add debug logging for troubleshooting
  </action>
  <verify>
    <automated>node -c index.js</automated>
  </verify>
  <done>Day and week summaries auto-generated and updated on session save</done>
</task>

</tasks>

<verification>
- Context files saved in YYYY/MM/WW/DD structure
- Day summary.md exists in each day folder
- Week summary.md exists in each week folder
- Summaries updated atomically
- Error handling prevents summary failures from breaking session save
</verification>

<success_criteria>
- Hierarchical structure implemented and working
- Summary files auto-generated
- Atomic writes used throughout
- Performance within budget (< 500ms for session exit)
</success_criteria>

<output>
After completion, create `.planning/phases/01-context-session-improvements/02-SUMMARY.md`
</output>
