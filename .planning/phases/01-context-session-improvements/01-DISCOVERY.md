# Technical Discovery: File System Operations for Context Session

**Researched:** April 21, 2026  
**Purpose:** Identify best practices for atomic file writes, ISO week calculation, and file locking in Node.js for the context-session plugin improvements.

---

## 1. Atomic File Writes in Node.js

### Problem
Current implementation uses `fs.writeFileSync()` which can corrupt files if interrupted mid-write. Need atomic writes for:
- Daily summary updates
- Intelligence-learning.md updates
- Summary file generation

### Solution: Write-to-temp-then-rename Pattern

**Pattern:**
```javascript
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

async function atomicWrite(filePath, content) {
  const dir = path.dirname(filePath);
  const tempFile = path.join(dir, `.tmp-${randomUUID()}`);
  
  try {
    // Write to temporary file
    await fs.writeFile(tempFile, content, 'utf8');
    // Atomic rename (POSIX guarantees atomicity)
    await fs.rename(tempFile, filePath);
  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.unlink(tempFile);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw error;
  }
}
```

**Why This Works:**
- `fs.rename()` is atomic on POSIX systems (macOS, Linux)
- If process crashes mid-write, temp file is orphaned (safe)
- If rename fails, original file unchanged (safe)
- No file locking needed

**Libraries:**
- Built-in `fs/promises` (Node.js 14+)
- No external dependencies needed

**Reference:** Node.js fs documentation, common pattern in production systems

---

## 2. ISO Week Number Calculation

### Problem
Need to organize folders by ISO week number (W01-W53) for hierarchical structure.

### Solution: Use `date-fns` or Native Calculation

**Option A: date-fns (Recommended)**
```javascript
import { getWeek, getWeekYear } from 'date-fns';

const now = new Date();
const weekNumber = getWeek(now); // 1-53
const weekYear = getWeekYear(now); // ISO week year

// Format: W01, W02, ..., W53
const weekFolder = `W${weekNumber.toString().padStart(2, '0')}`;
```

**Pros:**
- Battle-tested library
- Handles edge cases (year boundaries)
- Small bundle size (~2KB tree-shaken)
- Already widely used in Node.js ecosystem

**Cons:**
- External dependency (package.json update needed)

**Option B: Native Calculation**
```javascript
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNum;
}

const weekFolder = `W${getISOWeek(new Date()).toString().padStart(2, '0')}`;
```

**Pros:**
- No dependencies
- Self-contained

**Cons:**
- More code to maintain
- Edge cases harder to test
- ISO week year vs calendar year complexity

**Recommendation:** Use `date-fns` for reliability and maintainability.

---

## 3. File Locking (Not Needed with Atomic Writes)

### Analysis
With the write-to-temp-then-rename pattern, file locking is **NOT necessary** because:
- Rename is atomic
- Readers always see complete file (old or new, never partial)
- No race conditions

**Exception:** If multiple processes need to read-modify-write (e.g., appending to intelligence-learning.md), use one of:

**Option A: Proper-lockfile**
```javascript
import lockfile from 'proper-lockfile';

async function safeAppend(filePath, content) {
  const release = await lockfile.lock(filePath);
  try {
    const existing = await fs.readFile(filePath, 'utf8');
    const updated = existing + content;
    await atomicWrite(filePath, updated);
  } finally {
    await release();
  }
}
```

**Option B: Queue-based Serialization (Simpler)**
```javascript
const writeQueue = Promise.resolve();

async function queuedWrite(filePath, content) {
  writeQueue = writeQueue.then(() => atomicWrite(filePath, content));
  await writeQueue;
}
```

**Recommendation:** Use queue-based serialization for simplicity (single process, no external dependencies).

---

## 4. Directory Structure Creation

### Problem
Need to create year/month/week/day hierarchy efficiently.

### Solution: Use `fs.mkdir` with `recursive: true`

```javascript
import fs from 'fs/promises';
import path from 'path';
import { getWeek, getWeekYear } from 'date-fns';

async function ensureHierarchicalDir(baseDir) {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const week = `W${getWeek(now).toString().padStart(2, '0')}`;
  const day = now.getDate().toString().padStart(2, '0');
  
  const dirPath = path.join(baseDir, year, month, week, day);
  
  // Create entire hierarchy in one call
  await fs.mkdir(dirPath, { recursive: true });
  
  return { dirPath, year, month, week, day };
}
```

**Why This Works:**
- `recursive: true` creates all intermediate directories
- Idempotent (safe to call multiple times)
- Returns created path components for summary file placement

---

## 5. Summary File Generation Algorithm

### Requirements
- Daily summary at root: `.opencode/context-session/daily-summary.md`
- Week summary: `.opencode/context-session/YYYY/MM/WW/summary.md`
- Day summary: `.opencode/context-session/YYYY/MM/WW/DD/summary.md`

### Algorithm

```javascript
async function updateDailySummary(baseDir, sessionInfo) {
  const today = new Date().toISOString().split('T')[0];
  const summaryPath = path.join(baseDir, 'daily-summary.md');
  
  // Read existing summary or create new
  let content = '';
  try {
    content = await fs.readFile(summaryPath, 'utf8');
  } catch (e) {
    // File doesn't exist yet
    content = `# Daily Summary\n\n`;
  }
  
  // Append new session info
  const timestamp = new Date().toISOString();
  const type = sessionInfo.type === 'compact' ? '📦 Compact' : '🚪 Exit';
  const entry = `- [${timestamp}] ${type}: ${sessionInfo.filename}\n`;
  
  // Check if already recorded (idempotency)
  if (!content.includes(sessionInfo.filename)) {
    content += entry;
    await atomicWrite(summaryPath, content);
  }
}

async function updateWeekSummary(baseDir, year, month, week, sessionInfo) {
  const summaryPath = path.join(baseDir, year, month, week, 'summary.md');
  
  // Generate week summary from day folders
  const weekDir = path.join(baseDir, year, month, week);
  const days = await fs.readdir(weekDir, { withFileTypes: true });
  const dayDirs = days.filter(d => d.isDirectory() && !d.name.startsWith('W'));
  
  let content = `# Week ${week} Summary\n\n`;
  content += `**Period:** ${year}-${month}\n\n`;
  content += `## Days\n\n`;
  
  for (const dayDir of dayDirs.sort()) {
    const dayPath = path.join(weekDir, dayDir.name);
    const files = await fs.readdir(dayPath);
    const compacts = files.filter(f => f.startsWith('compact-')).length;
    const exits = files.filter(f => f.startsWith('exit-')).length;
    
    content += `- **Day ${dayDir.name}**: ${compacts} compacts, ${exits} exits\n`;
  }
  
  await atomicWrite(summaryPath, content);
}
```

**Key Points:**
- Idempotent (safe to call multiple times)
- Atomic writes prevent corruption
- Summaries generated from actual file system state

---

## 6. Intelligence Learning File Schema

### Structure

```markdown
# Intelligence Learning - {project-name}

## Last Updated
- **Timestamp:** 2026-04-21T08:30:00Z
- **Sessions Analyzed:** 47
- **Last Session Type:** exit

## Project Structure Decisions

### Folder Hierarchy
- **Why:** Temporal organization enables quick navigation by date
- **Structure:** YYYY/MM/WW/DD with summaries at each level
- **Tradeoff:** More directories vs. flat structure with search

### Naming Conventions
- **exit-***: Session end (replaced "saida-" for i18n)
- **compact-***: Manual or auto compaction
- **summary.md**: Auto-generated summaries

## Architectural Decisions

### Hook Selection
- **session.compacted**: For manual/auto compaction
- **session.idle**: For automatic session end detection
- **session.deleted**: For explicit session deletion
- **Pre-exit trigger**: Custom hook before session ends

### Event Handling Pattern
- Use closure to access `client` object (not from event handler params)
- Queue-based write serialization (no file locking needed)
- Atomic writes via temp-file-rename pattern

## Bug Fix Guidance

### Common Issue: "client is undefined"
**Symptom:** Error "undefined is not an object (evaluating 'client.sessions.get')"  
**Cause:** Event handler doesn't receive client parameter  
**Fix:** Use client from closure (outer plugin function scope)  
**Example:**
```javascript
export default async (input) => {
  const { client, directory } = input;
  
  return {
    event: async ({ event }) => {
      // Use client from closure, NOT from event params
      const session = await client.sessions.get(sessionId);
    }
  };
};
```

### Common Issue: File corruption on crash
**Symptom:** Truncated or malformed summary files  
**Cause:** Synchronous writes interrupted mid-operation  
**Fix:** Use atomic write pattern (temp file + rename)  

### Common Issue: Concurrent write conflicts
**Symptom:** Lost updates when multiple events fire simultaneously  
**Cause:** Race conditions in read-modify-write  
**Fix:** Queue-based serialization  

## Session Patterns

### Typical Session Duration
- Average: 15-45 minutes
- Peak hours: 9am-12pm, 2pm-6pm

### Common Commands
- `/compact` - Manual context compaction
- `/edit` - File editing
- `/test` - Test running

### Recurring Topics
- [Auto-populated from session analysis]

## Key Learnings from Latest Sessions

[Appended on each trigger execution]

---
*Auto-generated by OpenCode Context Plugin*
```

### Update Strategy

```javascript
async function updateIntelligenceLearning(baseDir, sessionInfo) {
  const filePath = path.join(baseDir, 'intelligence-learning.md');
  
  let content = '';
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (e) {
    // Initialize with template
    content = `# Intelligence Learning - ${path.basename(baseDir)}\n\n`;
    content += `## Last Updated\n`;
  }
  
  // Update timestamp and count
  const sessionCount = (content.match(/Sessions Analyzed:\s*(\d+)/)?.[1] || 0) + 1;
  const timestamp = new Date().toISOString();
  
  // Find and update "Last Updated" section
  const lastUpdatedSection = `## Last Updated\n- **Timestamp:** ${timestamp}\n- **Sessions Analyzed:** ${sessionCount}\n- **Last Session Type:** ${sessionInfo.type}\n`;
  
  content = content.replace(/## Last Updated[\s\S]*?(?=\n##)/, lastUpdatedSection);
  
  // Append new learning if extractable
  const newLearning = extractLearningFromSession(sessionInfo);
  if (newLearning) {
    content += `\n## Key Learnings from Latest Sessions\n\n- ${newLearning}\n`;
  }
  
  await atomicWrite(filePath, content);
}
```

---

## 7. Migration Strategy for Existing Files

### Problem
Existing users have `.opencode/contextos/` with `saida-*.md` and `compact-*.md` files.

### Solution: Graceful Migration

```javascript
async function migrateContextFiles(oldDir, newDir) {
  const oldPath = path.join(oldDir, 'contextos');
  const newPath = path.join(newDir, 'context-session');
  
  if (!fs.existsSync(oldPath)) {
    return; // Nothing to migrate
  }
  
  if (fs.existsSync(newPath)) {
    return; // Already migrated
  }
  
  debugLog('[Migration] Starting context file migration...');
  
  // Create new directory
  await fs.mkdir(newPath, { recursive: true });
  
  // Get today's date for migration
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const week = `W${getWeek(now).toString().padStart(2, '0')}`;
  const day = now.getDate().toString().padStart(2, '0');
  
  const targetDir = path.join(newPath, year, month, week, day);
  await fs.mkdir(targetDir, { recursive: true });
  
  // Move files (rename prefix as we go)
  const files = await fs.readdir(oldPath);
  for (const file of files) {
    if (file.endsWith('.md')) {
      const oldFile = path.join(oldPath, file);
      const newFile = path.join(targetDir, file.replace('saida-', 'exit-'));
      await fs.rename(oldFile, newFile);
      debugLog(`[Migration] Moved ${file} to ${newFile}`);
    }
  }
  
  // Rename old directory (backup)
  await fs.rename(oldPath, oldPath + '.deprecated');
  
  debugLog('[Migration] Complete');
}
```

**User Experience:**
- First run after update: Automatic migration
- Old files moved to new structure with today's date
- Old directory renamed to `.deprecated` (user can delete manually)
- No data loss

---

## 8. Performance Considerations

### Budget
- Session exit: < 500ms total
- Context save: < 200ms
- Summary update: < 100ms
- Learning file update: < 100ms

### Optimization Strategies

1. **Non-blocking I/O:** Use async fs operations throughout
2. **Parallel writes:** Update daily summary and learning file in parallel
3. **Lazy summary generation:** Don't regenerate week summary on every event (only on day change)
4. **Debouncing:** If multiple events fire rapidly, batch writes

```javascript
// Debounce example
const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

const debouncedUpdateSummary = debounce(updateDailySummary, 100);
```

---

## 9. Dependencies Summary

### Required
- `date-fns` (^3.0.0 or later) - ISO week calculation
- Built-in `fs/promises` - Async file operations
- Built-in `path` - Path manipulation
- Built-in `crypto` - UUID generation for atomic writes

### Optional
- None (queue-based serialization avoids need for lockfile libraries)

### package.json Update
```json
{
  "dependencies": {
    "date-fns": "^3.0.0"
  }
}
```

---

## 10. Testing Strategy

### Unit Tests
- ISO week calculation (edge cases: year boundaries)
- Atomic write function (simulate crash mid-write)
- Summary generation algorithm
- Migration function

### Integration Tests
- Full session lifecycle (create → compact → exit)
- Verify directory structure created correctly
- Verify summary files updated
- Verify learning file updated

### Manual Testing
- Install plugin
- Run multiple sessions
- Verify folder structure
- Check summary content accuracy

---

## Recommendations

### DO
- ✅ Use `fs/promises` for all file operations
- ✅ Implement atomic writes via temp-file-rename
- ✅ Use `date-fns` for ISO week calculation
- ✅ Queue-based write serialization
- ✅ Graceful migration for existing users
- ✅ Comprehensive error handling with debug logging

### DON'T
- ❌ Use synchronous fs operations in event handlers
- ❌ Implement custom file locking (use queue instead)
- ❌ Overwrite files (always append or atomic replace)
- ❌ Block session exit on file operations (use non-blocking I/O)

---

**Confidence Level:** HIGH  
**Implementation Complexity:** MEDIUM  
**Estimated Effort:** 2-3 hours for full implementation
