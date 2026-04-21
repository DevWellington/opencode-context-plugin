# OpenCode Context Agent — Specification

## Overview

**Name:** opencode-context-agent
**Type:** Global autonomous agent (GSD-style)
**Based on:** gsd-planner template
**Mode:** `subagent` (spawned by orchestrator, works globally across all projects)

**Problem being solved:**
The current `@devwellington/opencode-context-plugin` fails to load in projects outside its development directory due to OpenCode's plugin system limitations/bugs. This agent-based approach bypasses the plugin system entirely by running from `~/.config/opencode/agents/` where GSD agents work universally.

---

## Architecture

### Files Created

| File | Location | Purpose |
|------|----------|---------|
| `opencode-context-agent.md` | `~/.config/opencode/agents/` | Main agent definition |
| `gsd-context-tools.cjs` | `~/.config/opencode/get-shit-done/bin/` | Context utility functions |

### Directory Structure (per project)

```
{project}/
└── .opencode/
    └── context-session/
        ├── daily-summary.md          # Aggregated daily sessions
        ├── intelligence-learning.md  # Pattern learning across sessions
        └── {year}/
            └── {month}/
                └── W{week}/
                    └── {day}/
                        ├── compact-{timestamp}.md   # On /compact command
                        ├── exit-{timestamp}.md       # On session end
                        ├── day-summary.md            # Day-level summary
                        └── week-summary.md           # Week-level summary
```

---

## Agent Interface

### Session Events Handled

| Event | Trigger | Action |
|-------|---------|--------|
| `session.created` | New session starts | Reset state, track session ID |
| `session.updated` | Session metadata changes | Update lastSession metadata |
| `message.created` | New message sent | Add to messages array |
| `message.updated` | Message modified | Update existing message |
| `message.part.delta` | Streaming token received | Append to message content |
| `command.execute.before` | Command execution | Detect `/compact` command |
| `session.compacted` | Compaction triggered | Save context as `compact` |
| `session.idle` | Session idle timeout | Trigger pre-exit compression |
| `session.deleted` | Session deleted | Trigger pre-exit compression |
| `session.end` | Session ending | Save final context as `exit` |

### Context Saving Behavior

| Trigger | Type | Filename Pattern |
|---------|------|------------------|
| `/compact` or `session.compacted` event | `compact` | `compact-{timestamp}.md` |
| `session.end` or `session.idle` or `session.deleted` | `exit` | `exit-{timestamp}.md` |

---

## Core Features

### 1. saveContext After Each Interaction

- Saves session context to hierarchical directory structure
- Uses atomic writes (temp file + rename) to prevent corruption
- Creates directory structure automatically

### 2. Summaries

| Summary | Location | Update Frequency | Contents |
|---------|----------|------------------|----------|
| `daily-summary.md` | `context-session/` root | Every session | All sessions for current day |
| `day-summary.md` | `YYYY/MM/WW/DD/` | Every session | Sessions for specific day |
| `week-summary.md` | `YYYY/MM/WW/` | Every session | Aggregated from day folders |
| `intelligence-learning.md` | `context-session/` root | Every session | Pattern learning, bug fixes |

### 3. Pre-Exit Compression

- Triggered on `session.idle`, `session.deleted`, or pre-`session.end`
- Uses client from closure to fetch full session data
- Saves with type='exit' before data is lost
- Idempotent (safe to call multiple times)

---

## Context Tools API (gsd-context-tools.cjs)

### Commands

```bash
# Context management
gsd-context-tools.cjs save <directory> <session-json-path> <type>    # Save session context
gsd-context-tools.cjs load <directory> [limit]                      # Load previous contexts
gsd-context-tools.cjs daily-summary <directory>                      # Update daily summary
gsd-context-tools.cjs day-summary <directory>                        # Update day summary
gsd-context-tools.cjs week-summary <directory>                      # Update week summary
gsd-context-tools.cjs intelligence-update <directory> <session-info> # Update learning

# Utilities
gsd-context-tools.cjs timestamp [format]     # Get formatted timestamp
gsd-context-tools.cjs ensure-dir <path>      # Ensure directory exists
gsd-context-tools.cjs atomic-write <path> <content>  # Atomic file write

# Migration
gsd-context-tools.cjs migrate <directory>     # Migrate old contextos to new structure
```

---

## Event Handler Contract

The agent exports a single function that receives `{ directory, client }` and returns an object with event handlers:

```javascript
export default async (input) => {
  const { directory, client } = input;
  return {
    "event": async (eventInput) => { /* handle events */ },
    "experimental.chat.messages.transform": async (messages) => { /* transform */ }
  };
};
```

---

## Session State Management

### In-Memory State (per agent instance)

```javascript
let currentSessionId = null;    // Track current session
let hasInjectedContext = false;  // Prevent double injection
let lastSession = null;          // Current session data (messages, metadata)
```

### Session Data Structure

```javascript
{
  id: string,           // Session ID
  slug: string,         // URL-safe session name
  title: string,       // Session title
  messages: [
    {
      id: string,
      role: 'user' | 'assistant' | 'system',
      type: string,
      content: string
    }
  ]
}
```

---

## Message Tracking

### Events -> Message Updates

| Event | Handler Action |
|-------|---------------|
| `message.created` | Add new message to `lastSession.messages` |
| `message.updated` | Update existing message by ID |
| `message.part.delta` | Append delta to message content (streaming) |
| `message.part.updated` | Set message content from text field |

### Content Truncation

Messages exceeding 2000 characters are truncated with `*(truncated)*` suffix in saved contexts.

---

## Intelligence Learning

### File Structure

```markdown
# Intelligence Learning - {project}

## Last Updated
- **Timestamp:** {ISO date}
- **Sessions Analyzed:** {count}
- **Last Session Type:** {compact|exit}

## Project Structure Decisions
### Folder Hierarchy
### Naming Conventions
### Event Handling Pattern

## Bug Fix Guidance
### Common issues and solutions

## Session Patterns
### Typical Session Duration
### Common Commands

## Key Learnings from Latest Sessions
### Session N - {TYPE}
- **Date:** {date}
- **Session ID:** {id}
- **Messages:** {count}
- **File:** {filename}
```

### Deduplication

- Sessions tracked by Session ID in Key Learnings
- Duplicate session IDs are skipped
- Maximum 20 session entries (oldest removed when exceeded)

---

## Error Handling

### Fail-Safe Operations

All summary updates (`updateDailySummary`, `updateDaySummary`, etc.) use try/catch and never block session saving on failure.

### Atomic Writes

```javascript
async function atomicWrite(filePath, content) {
  const tempFile = path.join(dir, `.tmp-${Date.now()}-${random}`);
  await fs.writeFile(tempFile, content);
  await fs.rename(tempFile, filePath);  // Atomic on POSIX
}
```

### Write Serialization

Queue-based serialization prevents concurrent write conflicts:

```javascript
let dailySummaryLock = Promise.resolve();
dailySummaryLock = dailySummaryLock.then(async () => { /* write */ });
await dailySummaryLock;
```

---

## Migration Support

### Old Structure (contextos)
```
{project}/.opencode/contextos/
```

### New Structure (context-session)
```
{project}/.opencode/context-session/
```

Migration on agent initialization:
1. Check for old directory
2. If exists and new doesn't → migrate files
3. Rename old directory to `.deprecated`

---

## Dependencies

None (pure Node.js filesystem operations). Uses only built-in modules:
- `fs/promises` for async file operations
- `path` for path manipulation

---

## Configuration

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `HOME` | Used to derive default log location | OS default |

### Log File

`~/.opencode-context-agent.log` — Debug logging for all operations.

---

## Testing Strategy

1. **Unit tests** for each utility function
2. **Integration tests** for event handlers
3. **Multi-project test** to verify global operation
4. **Migration test** to verify backward compatibility

---

## Rollout Plan

1. Create `SPEC.md`
2. Implement `gsd-context-tools.cjs`
3. Implement `opencode-context-agent.md`
4. Create test scripts
5. Test in multiple projects
6. Document usage

---

## Comparison with Plugin

| Aspect | Plugin | Agent |
|--------|--------|-------|
| Loading | Requires OpenCode plugin system | Automatic via agents folder |
| Per-project | No (fails outside dev dir) | Yes (global + per-project storage) |
| Configuration | Per-project | Global (agent config) |
| Updates | Requires plugin reinstall | Agent file update |
| Event handling | Plugin API | Agent event system |

---

## Key Design Decisions

1. **Agent over Plugin** — Bypasses OpenCode plugin system limitations
2. **Hierarchical Storage** — `YYYY/MM/WW/DD` enables temporal navigation
3. **Atomic Writes** — Prevents data corruption on crashes
4. **Write Serialization** — Prevents race conditions on summary updates
5. **Queue-based Updates** — Non-blocking, sequential writes
6. **Pre-exit Compression** — Captures data before session end events
7. **Intelligence Learning** — Accumulates patterns across sessions