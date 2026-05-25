# Research Report: OpenCode Context Plugin

## Project Overview

**opencode-context-plugin** is an OpenCode plugin that automatically captures, organizes, and re-injects AI coding session context. It transforms ephemeral chat sessions into a persistent, searchable knowledge base that improves future interactions.

**Version:** 1.6.6
**License:** MIT
**Architecture:** Event-driven plugin for OpenCode, using hierarchical file storage with markdown sessions

---

## Architecture

### Hierarchical Storage Model

```
.opencode/context-session/
├── intelligence-learning.md     ← Cross-session intelligence
├── daily-summary.md             ← Today's session log
├── reports/                     ← Legacy flat reports (deprecated)
└── YYYY/
    └── MM/
        └── WW/
            └── DD/
                ├── compact-{timestamp}.md
                ├── exit-{timestamp}.md
                └── day-summary.md
            └── week-summary.md
        └── monthly-{YYYY-MM}.md
    └── annual-{YYYY}.md
```

**Storage strategy:** Session files live in a YYYY/MM/WW/DD tree (ISO week). Each day contains compact (mid-session) and exit (end-session) markdown files with frontmatter metadata. Summaries aggregate upward: day → week → month → annual → intelligence.

### Key Components

| Module | Responsibility |
|--------|---------------|
| `saveContext.js` | Orchestrates session save, triggers report regeneration pipeline |
| `contentExtractor.js` | Extracts structured sections (Goal, Accomplished, Discoveries, Bugs) from raw markdown |
| `summaries.js` | Generates day/week summaries with theme clustering and deduplication |
| `reportGenerator.js` | Generates week/monthly/annual reports (906 lines, monolithic) |
| `generateIntelligenceLearning.js` | Cross-session pattern analysis, known issues, successful/failed approaches |
| `intelligencePatterns.js` | Pattern definitions for issue detection and low-quality filtering |
| `contextInjector.js` | Auto-injects relevant prior contexts at session start |
| `contextCache.js` | Caches injected contexts with TTL and invalidation |
| `searchIndexer.js` | Full-text search across session context |

---

## Intelligence Learning Analysis

### How It Works

The intelligence system operates in a **5-step pipeline** triggered after every session save:

1. **Session Content Extraction** — Parse markdown for structured sections (Goal, Accomplished, Discoveries)
2. **Reference Schema Transformation** — Convert raw data into: knownIssues, successfulApproaches, failedApproaches, recentPatterns
3. **Pattern Detection** — Use regex-based patterns (`intelligencePatterns.js`) to classify content quality
4. **LLM Enhancement** (optional) — If OpenCode client available, infer missing fields via AI
5. **File Generation** — Write compact ~50-line `intelligence-learning.md` with deduplicated patterns

### Content Quality Filters

The system applies **multi-layer filtering** to avoid garbage intelligence:

- **Greeting filter** — Detects and skips salutations (`isGreeting()`, `isGreetingTitle()`, `isGreetingContent()`)
- **Structured work detection** — Requires `## Goal`, `## Accomplished`, etc. sections
- **Low-quality patterns** — Rejects truncated content, phase numbers, incomplete sentences
- **Issue pattern detection** — Identifies bug descriptions masquerading as accomplishments
- **Deduplication** — Both by ID and fuzzy string matching (first 40 chars)

### Known Issues

| Issue | Severity | Location |
|-------|----------|----------|
| `Decisions Made` section hardcoded empty | Medium | `reportGenerator.js:443` |
| Annual theme hardcoded placeholder | Medium | `reportGenerator.js:596` |
| Truncation without indication | Low | `saveContext.js:133` |
| Week summary period shows `YYYY-MM` instead of date range | Low | `summaries.js:697` |
| `reportGenerator.js` is 906 lines monolithic file | Refactor | Entire file |
| Jest leak (async operations not ending) | Low | Tests |

---

## Strengths

### Excellent
- **Hierarchical storage** — Clean YYYY/MM/WW/DD structure enables efficient aggregation
- **Content extraction** — Smart parsing of markdown sections (Goal, Accomplished, Discoveries, Bugs)
- **Theme clustering** — Synthesizes goals/accomplishments/discoveries by theme for week summaries
- **Multi-layer intelligence filtering** — Greeting detection, quality thresholds, deduplication
- **Atomic writes** — Temp file + rename pattern for crash safety
- **Protected sessions** — Excludes sensitive content from summaries
- **Pattern-based intelligence** — Successful/failed approach tracking across sessions
- **322 tests passing** — Comprehensive test coverage

### Good
- **LLM enhancement** — Optional AI inference for missing structured fields
- **Search indexer** — Full-text search across sessions
- **Context caching** — Performance optimization with TTL
- **Progress feedback** — `[context-plugin] Updating reports...` → `✓` indicator
- **Config scaffolding** — `ocp-agents init-config` command
- **Remote sync** — Cross-machine context synchronization

### Needs Improvement
- **reportGenerator.js** — 906 lines, should be split into generator components
- **Decisions Made** — Always hardcoded empty, never populated from actual session decisions
- **Annual report** — Theme section is a placeholder
- **Week period display** — Shows `YYYY-MM` instead of actual week date range

---

## Intelligence File Format

The `intelligence-learning.md` follows a **compact reference schema** (~50 lines):

```markdown
# Intelligence Learning

## Project State
- **Project:** opencode-context-plugin
- **Last Updated:** 2026-05-02
- **Sessions Tracked:** N
- **Active Phase:** intelligence-learning-reform

## Known Issues
- BUG-{ID}: {description} ({location})

## Successful Approaches
- {pattern} (seen {freq} times) ({location})

## Failed Approaches
- ANTI-PATTERN: {antiPattern} because {reason} ({location})

## Recent Patterns
- {type}: {name} ({frequency} sessions)

---
Generated: {timestamp}
```

This format is designed to be **small, clean, and actionable** — suitable for injection into future AI sessions without bloating context.

---

## Key Design Decisions

### 1. Markdown as Storage Format
Session context is stored as markdown with YAML frontmatter, enabling:
- Human-readable files
- Git versioning
- Obsidian compatibility (wiki-links)
- Easy parsing with `gray-matter`

### 2. Hierarchical Aggregation
Data flows upward: day → week → month → annual → intelligence. Each level summarizes the previous, avoiding raw content duplication.

### 3. Mechanical + LLM Hybrid
Content extraction starts mechanical (regex-based section parsing), then optionally uses LLM for field inference. This ensures reliability even when AI is unavailable.

### 4. Greeting Filtering
Sessions that are just greetings are silently skipped. This prevents noise in intelligence while preserving sessions that have structured work content.

### 5. Theme Clustering
Week summaries group items by extracted themes (e.g., "Bug fixes", "Tests added") rather than listing raw items, providing higher-level insight.

---

## Recommendations

1. **Split reportGenerator.js** into per-report generators (day, week, monthly, annual)
2. **Implement dynamic Decisions Made** by extracting from actual session decisions
3. **Fix week period display** to show actual date range (e.g., "2026-04-21 to 2026-04-27")
4. **Add truncation indicators** in session files when content exceeds limits
5. **Jest cleanup** — resolve async operation leak in tests
