# OpenCode Context Plugin — Specification

## Overview

**Name:** @devwellington/opencode-context-plugin
**Type:** OpenCode Plugin (npm package)
**Version:** 1.3.5
**Published:** https://www.npmjs.com/package/@devwellington/opencode-context-plugin

**Core functionality:**
Saves session context to `.opencode/context-session/` after compaction and session end. Enables intelligent context organization, retrieval via search, and learning through historical pattern tracking.

---

## Architecture

### Module Structure

```
src/
├── config.js              # Configuration loading from opencode.json
├── index.js               # Main plugin entry ({ id, server })
├── cli/
│   ├── inject.js          # Manual context injection CLI
│   ├── search.js          # Search CLI (--type, --from, --to, --json)
│   └── report.js          # Report CLI (weekly, monthly, range)
├── modules/
│   ├── saveContext.js     # Context saving with atomic writes
│   ├── summaries.js       # Daily/week/day summary generation
│   ├── intelligence.js    # Intelligence learning file
│   ├── relevanceScoring.js # LLM-based relevance scoring
│   ├── contextCache.js    # Disk-persistent cache (24h TTL)
│   ├── tokenLimit.js      # Token estimation (chars/4)
│   ├── contextInjector.js # Context injection orchestration
│   ├── searchIndexer.js   # Full-text search index
│   ├── searchQuery.js     # Search query parsing
│   └── reportGenerator.js # Report generation
└── utils/
    ├── debug.js           # Debug logging with rotation
    └── debounce.js        # Debounce utility (500ms default)
```

### Configuration Schema (opencode.json)

```json
{
  "contextPlugin": {
    "maxContexts": 5,
    "enableLearning": true,
    "logLevel": "info",
    "debug": false,
    "debounceMs": 500,
    "logRotation": {
      "enabled": true,
      "maxSizeBytes": 10485760,
      "maxFiles": 5
    }
  },
  "injection": {
    "enabled": false,
    "autoInject": false,
    "maxContexts": 5,
    "maxTokens": 8000,
    "relevanceScoring": {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "apiKeyEnv": "OPENAI_API_KEY"
    },
    "cache": {
      "enabled": true,
      "ttlHours": 24,
      "maxSizeMB": 50
    }
  },
  "search": {
    "enabled": true,
    "indexOnStartup": false,
    "maxResults": 20,
    "snippetLength": 200
  },
  "report": {
    "enabled": true,
    "autoGenerate": true,
    "weeklyDay": 0,
    "outputDir": ".opencode/context-session/reports",
    "includeStats": true
  }
}
```

---

## Context Storage Structure

```
{project}/.opencode/context-session/
├── cache/
│   └── index.json              # Cache of scored contexts
├── reports/
│   ├── weekly-YYYY-WW.md       # Weekly activity report
│   └── monthly-YYYY-MM.md      # Monthly activity report
├── .index/
│   └── .search-index.json      # Full-text search index
├── daily-summary.md            # All sessions for current day
├── intelligence-learning.md    # Pattern learning across sessions
└── {year}/
    └── {month}/
        └── W{week}/
            └── {day}/
                ├── compact-{timestamp}.md   # On /compact
                ├── exit-{timestamp}.md       # On session end
                ├── day-summary.md            # Day-level summary
                └── week-summary.md           # Week-level summary
```

---

## Plugin Interface

### Main Export

```javascript
export default {
  id: "@devwellington/opencode-context-plugin",
  server: (input) => new ContextPlugin(input)
};
```

### Event Handlers

| Event | Action |
|-------|--------|
| `session.created` | Reset state, track session ID |
| `session.updated` | Update lastSession metadata |
| `message.created` | Add to messages array |
| `message.updated` | Update existing message |
| `message.part.delta` | Append delta to message content |
| `session.compacted` | Save context as `compact` |
| `session.idle` | Trigger pre-exit compression |
| `session.deleted` | Trigger pre-exit compression |
| `session.end` | Save final context as `exit` |

### Context Saving Behavior

| Trigger | Type | Filename Pattern |
|---------|------|------------------|
| `session.compacted` | `compact` | `compact-{timestamp}.md` |
| `session.end/idle/deleted` | `exit` | `exit-{timestamp}.md` |

---

## Core Features

### 1. Context Saving

- Hierarchical storage (YYYY/MM/WW/DD)
- Atomic writes (temp file + rename)
- Automatic directory creation
- Message truncation (>2000 chars)

### 2. Summaries

| Summary | Location | Update Frequency |
|---------|----------|------------------|
| `daily-summary.md` | context-session/ root | Every session |
| `day-summary.md` | YYYY/MM/WW/DD/ | Every session |
| `week-summary.md` | YYYY/MM/WW/ | Every session |
| `intelligence-learning.md` | context-session/ root | Every session |

### 3. Pre-Exit Compression

- Triggered on `session.idle`, `session.deleted`, `session.end`
- Uses OpenCode client to fetch full session data
- Idempotent (safe to call multiple times)

### 4. Context Injection

- LLM-based relevance scoring (OpenAI/Anthropic)
- Token budget distribution (80% historical, 20% current)
- Disk-persistent cache with 24h TTL
- Manual injection via `injectContextPrompt()`
- Auto-injection on session start (configurable)

### 5. Search & Retrieval

- Full-text search with inverted index
- Filter by type (exit/compact), date range, keywords
- CLI tool: `node src/cli/search.js`
- Report generation: weekly/monthly/activity

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| date-fns | ^3.6.0 | Date formatting |

---

## Testing

**79 tests across 7 test suites:**
- config.test.js
- debug.test.js
- debounce.test.js
- saveContext.test.js
- summaries.test.js
- intelligence.test.js
- event-handlers.test.js

Run with: `npm test`

---

## CLI Commands

```bash
# Context injection
node src/cli/inject.js [--limit N] [--tokens N]

# Search
npm run search -- "query" [--type exit|compact] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--json]

# Reports
node src/cli/report.js weekly [date]
node src/cli/report.js monthly [month]
node src/cli/report.js range <start> <end> [--save]
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Plugin over Agent | Works within OpenCode plugin system |
| Hierarchical Storage | Temporal navigation and organization |
| Atomic Writes | Prevents data corruption |
| Queue-based Serialization | Non-blocking concurrent writes |
| LLM-based Scoring | Intelligent relevance filtering |
| chars/4 Token Estimation | Simple approximation without tokenizer |
| 20% Token Budget Reserved | Space for current session context |

---

## v1.3.x Changelog

### v1.3.5 (2026-04-21)
- Added .npmignore to exclude .planning/ and old/
- Clean package contents (6 files, 10KB)

### v1.3.4 (2026-04-21)
- Initial modular structure release
- Phase 2-4 features included

### v1.0 - v1.2
- Core context saving functionality
- Phase 1 features (hierarchical storage, summaries)