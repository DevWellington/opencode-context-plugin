---
phase: 01-context-session-improvements
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [index.js, package.json]
autonomous: true
requirements: [SESSION-02, SESSION-04]
user_setup: []

must_haves:
  truths:
    - "No 'saida' references remain in codebase"
    - "Directory name changed to 'context-session'"
    - "All file operations use async fs/promises"
  artifacts:
    - path: "index.js"
      provides: "Updated plugin with renamed references"
      exports: ["default"]
    - path: "package.json"
      provides: "Dependency declarations"
      contains: "date-fns"
  key_links:
    - from: "index.js"
      to: "fs/promises"
      via: "import statement"
      pattern: "import.*from.*['\"]fs/promises['\"]"
    - from: "index.js"
      to: "date-fns"
      via: "import for week calculation"
      pattern: "import.*from.*['\"]date-fns['\"]"
---

<objective>
Refactor codebase to use "exit" instead of "saida" and "context-session" instead of "contextos", while migrating to async fs/promises API.

Purpose: Foundation for hierarchical structure improvements and internationalization.
Output: Refactored index.js with async operations and updated naming.
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

<interfaces>
<!-- Current code structure from index.js -->
```javascript
// Current imports (line 1-2)
import fs from "fs";
import path from "path";

// Current functions
function ensureContextosDir(directory) // Creates .opencode/contextos
function saveContext(directory, session, prefix = 'compact') // Saves context files
function getTimestamp() // Returns ISO timestamp string
```

<!-- Required interfaces after refactoring -->
```javascript
// New imports
import fs from 'fs/promises';
import path from 'path';
import { getWeek, getWeekYear } from 'date-fns';

// New/updated functions
async function ensureContextSessionDir(directory) // Creates .opencode/context-session/YYYY/MM/WW/DD
async function atomicWrite(filePath, content) // Atomic file write via temp-rename
async function saveContext(directory, session, type) // Async context save with hierarchical structure
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Migrate to async fs/promises and add date-fns dependency</name>
  <files>package.json, index.js</files>
  <behavior>
    - Test 1: package.json contains date-fns dependency
    - Test 2: index.js imports fs/promises instead of fs
    - Test 3: All fs operations are async/await (no sync methods)
    - Test 4: date-fns getWeek and getWeekYear are imported
  </behavior>
  <action>
    1. Update package.json to add date-fns ^3.0.0 to dependencies
    2. Change index.js imports:
       - `import fs from "fs"` → `import fs from 'fs/promises'`
       - Add `import { getWeek, getWeekYear } from 'date-fns'`
    3. Convert all fs methods to async:
       - `fs.existsSync()` → `await fs.access()` with try/catch
       - `fs.mkdirSync()` → `await fs.mkdir()`
       - `fs.writeFileSync()` → `await fs.writeFile()`
       - `fs.appendFileSync()` → `await fs.appendFile()` or atomic write
       - `fs.readdirSync()` → `await fs.readdir()`
    4. Make all functions async and update callers
    5. Implement atomicWrite helper function (from DISCOVERY.md section 1)
  </action>
  <verify>
    <automated>node -c index.js && npm install</automated>
  </verify>
  <done>Code compiles, dependencies installed, all fs operations are async</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Rename "contextos" to "context-session" and "saida" to "exit"</name>
  <files>index.js</files>
  <behavior>
    - Test 1: No "contextos" string in index.js (case-insensitive)
    - Test 2: No "saida" string in index.js (case-insensitive)
    - Test 3: CONTEXTOS_DIR constant renamed to CONTEXT_SESSION_DIR
    - Test 4: Value changed to '.opencode/context-session'
    - Test 5: All prefix='compact' and prefix='saida' changed to type='compact' and type='exit'
  </behavior>
  <action>
    1. Replace all occurrences:
       - `CONTEXTOS_DIR` → `CONTEXT_SESSION_DIR`
       - `'.opencode/contextos'` → `'.opencode/context-session'`
       - `ensureContextosDir` → `ensureContextSessionDir`
       - `prefix='saida'` → `type='exit'`
       - `prefix='compact'` → `type='compact'`
    2. Update file naming logic:
       - `${prefix}-${timestamp}.md` → `${type}-${timestamp}.md`
    3. Update all comments and debug log messages
    4. Update function signatures to use `type` parameter instead of `prefix`
    5. Ensure function logic handles both 'compact' and 'exit' types correctly
  </action>
  <verify>
    <automated>! grep -qi "contextos\|saida" index.js</automated>
  </verify>
  <done>No "contextos" or "saida" references, all renamed to new terminology</done>
</task>

<task type="auto">
  <name>Task 3: Implement migration function for existing users</name>
  <files>index.js</files>
  <action>
    1. Create `migrateContextFiles(oldDir, newDir)` async function (from DISCOVERY.md section 7)
    2. Function should:
       - Check if old `.opencode/contextos` exists
       - Check if new `.opencode/context-session` doesn't exist yet
       - Create new directory structure with today's date hierarchy
       - Move all .md files, renaming `saida-` to `exit-`
       - Rename old directory to `.deprecated`
       - Log migration progress
    3. Call migration function during plugin initialization
    4. Handle errors gracefully (don't block plugin if migration fails)
    5. Add debug logging for troubleshooting
  </action>
  <verify>
    <automated>node -c index.js</automated>
  </verify>
  <done>Migration function implemented and called on plugin init</done>
</task>

</tasks>

<verification>
- All fs operations use async/await (no sync methods remain)
- No "contextos" or "saida" strings in codebase
- package.json includes date-fns dependency
- Migration function exists and is called
- Code passes syntax check
</verification>

<success_criteria>
- index.js uses fs/promises exclusively
- All references updated to "context-session" and "exit"
- date-fns installed and imported
- Migration path ready for existing users
- Code is async throughout
</success_criteria>

<output>
After completion, create `.planning/phases/01-context-session-improvements/01-SUMMARY.md`
</output>
