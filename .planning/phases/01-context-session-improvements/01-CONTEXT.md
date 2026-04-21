# Phase 1 Context: Context Session Improvements

## User Requirements

### 1. Pre-Exit Context Compression

**Requirement:** Create a trigger before session exit that generates context compression similar to what happens during `/compact`, ensuring the session data is not lost when exiting.

**Purpose:** Prevent data loss when user exits without manual compaction.

**Details:**
- Hook into session exit flow (before `session.idle` or `session.deleted`)
- Trigger automatic context compression
- Save compressed context with appropriate timestamp
- Ensure all conversation history is preserved

### 2. Rename "saida" to "exit"

**Requirement:** Change all references from "saida" (Portuguese) to "exit" (English) throughout the codebase.

**Purpose:** Internationalization and consistency with English-based development standards.

**Scope:**
- File prefixes: `saida-*.md` → `exit-*.md`
- Variable names containing "saida"
- Comments and documentation
- Log messages

### 3. Hierarchical Folder Structure

**Requirement:** Create organized folder structure for contexts separated by year, month, week, and day. Week and day folders must contain summary files.

**Purpose:** Enable temporal navigation and quick overview of sessions at different time scales.

**Structure:**
```
.opencode/context-session/
├── intelligence-learning.md  # Root learning file
├── daily-summary.md          # Today's summary
├── 2026/
│   └── 04/                   # April
│       ├── summary.md        # Month summary
│       ├── W17/              # Week 17 (ISO week number)
│       │   ├── summary.md    # Week summary
│       │   └── 21/           # Day 21
│       │       ├── summary.md
│       │       ├── compact-2026-04-21T02-10-46.md
│       │       └── exit-2026-04-21T02-15-29.md
│       └── W18/
│           └── ...
```

**Details:**
- Year: 4-digit year (2026)
- Month: 2-digit month (01-12)
- Week: ISO week number (W01-W53)
- Day: 2-digit day (01-31)
- Summary files: `summary.md` at week and day levels
- Daily summary at root: Aggregates all compact/exit files of the day

### 4. Rename "contextos" to "context-session"

**Requirement:** Change directory name from "contextos" to "context-session".

**Purpose:** More descriptive naming that reflects the purpose (session context management).

**Scope:**
- Directory creation paths
- Configuration references
- Documentation
- Migration of existing `.opencode/contextos/` to `.opencode/context-session/`

### 5. Daily Summary Routine

**Requirement:** Run a routine to maintain a summary file of compression and exit files. This file stays at the root of context-session folder and summarizes the day's compression and exit sessions.

**Purpose:** Quick overview of daily activity without reading individual session files.

**Details:**
- File location: `.opencode/context-session/daily-summary.md`
- Updated on every compact or exit event
- Contains:
  - Date header
  - List of compact sessions with timestamps
  - List of exit sessions with timestamps
  - Key topics/themes (if extractable)
  - Total session count
- Atomic writes to prevent corruption

### 6. Intelligence Learning File

**Requirement:** Generate an updated `intelligence-learning.md` file based on the project on every trigger execution (compact or exit). File must contain information that enables learning about decisions made, improves understanding of structure, and provides guidance for bug fixes.

**Purpose:** Create a living document that captures project knowledge, decisions, and troubleshooting guidance for continuous learning.

**Content Structure:**
```markdown
# Intelligence Learning - {project-name}

## Project Structure Decisions
- Why folder hierarchy was chosen
- Naming conventions rationale
- File organization principles

## Architectural Decisions
- Hook selection reasoning
- Event handling patterns
- Data flow design

## Bug Fix Guidance
- Common issues and solutions
- Debugging strategies
- Known pitfalls

## Session Patterns
- Typical session duration
- Common commands/tools used
- Recurring topics/themes

## Last Updated
- Timestamp
- Session count analyzed
- Key learnings from latest sessions
```

**Update Strategy:**
- Append new learnings (don't overwrite)
- Deduplicate information
- Summarize patterns from latest sessions
- Handle concurrent writes safely (file locking or atomic operations)

## Technical Constraints

1. **Non-breaking for existing users:** Migration path for existing `.opencode/contextos/` files
2. **Performance:** Minimal impact on session exit time (< 500ms)
3. **Reliability:** Atomic file writes, error handling, graceful degradation
4. **Backwards compatibility:** Support reading old format while writing new format

## Success Criteria

- [ ] Pre-exit compression triggers automatically
- [ ] No "saida" references remain in code
- [ ] Context files organized in year/month/week/day hierarchy
- [ ] Summary files auto-generated at week/day levels
- [ ] Daily summary maintained at root
- [ ] Intelligence-learning.md updated on every trigger
- [ ] Existing context files migrated or accessible
- [ ] All operations complete within performance budget
