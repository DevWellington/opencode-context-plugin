# OpenCode Context Plugin - Roadmap

## Vision

Transform the context saving plugin into a production-ready session management system with intelligent organization, context compression, and continuous learning capabilities.

---

## Phase 1: Context Session Restructuring

**Goal:** Reorganize context storage with hierarchical folder structure, rename "saida" to "exit", implement pre-exit context compression, and create daily summary system.

**Requirements:** [SESSION-01, SESSION-02, SESSION-03, SESSION-04, SESSION-05, SESSION-06, LEARN-01]

**Plans:** 4 plans

**Status:** Ready to execute

**Plans:**
- [x] 01-context-session-improvements-01-PLAN.md — Migrate to async fs/promises, rename contextos→context-session and saida→exit
- [x] 01-context-session-improvements-02-PLAN.md — Implement hierarchical folder structure (YYYY/MM/WW/DD) with auto-summaries
- [x] 01-context-session-improvements-03-PLAN.md — Create daily summary routine at context-session root
- [x] 01-context-session-improvements-04-PLAN.md — Implement pre-exit compression and intelligence learning file

---

## Requirements

### Session Management

- **[SESSION-01]** Pre-exit compression trigger - Generate context compression before session ends to preserve session data
- **[SESSION-02]** Rename "saida" to "exit" - Update all references from "saida" prefix to "exit" for consistency
- **[SESSION-03]** Hierarchical folder structure - Organize contexts by year/month/week/day with summary files at week/day levels
- **[SESSION-04]** Rename "contextos" to "context-session" - Update directory naming for clarity
- **[SESSION-05]** Daily summary routine - Aggregate compression and exit files into daily summary at root of context-session folder
- **[SESSION-06]** Week and day summary files - Auto-generate summary.md files for week and day folders

### Learning System

- **[LEARN-01]** Intelligence learning file - Generate updated intelligence-learning.md on each trigger (compression or exit) containing project decisions, structure understanding, and bug fix guidance

---

---

## Phase 2: Code Quality & Performance

**Goal:** Refactor monolithic index.js into modular structure, optimize context injection, and add configuration options.

**Status:** 🟡 Ready to plan

**Requirements:**
- **[MODULAR-01]** Extract saveContext logic into separate module
- **[MODULAR-02]** Extract summary generation into separate module
- **[MODULAR-03]** Extract intelligence learning into separate module
- **[PERF-01]** Implement debouncing for summary updates
- **[PERF-02]** Add log rotation or debug flag
- **[CONFIG-01]** Allow configuration via opencode.json (maxSessions, enableLearning, logLevel)
- **[TEST-01]** Mock client API for integration tests

**Estimated Plans:** 3-4

---

## Phase 3: Context Injection Optimization

**Goal:** Smart context injection based on relevance, not just recency.

**Status:** ⚪ TBD

**Requirements:**
- **[INJECT-01]** Filter contexts by relevance score
- **[INJECT-02]** Limit injected content by tokens, not just file count
- **[INJECT-03]** Add user prompt to manually request context injection
- **[INJECT-04]** Cache injected context to avoid re-reading files

**Estimated Plans:** 3

---

## Phase 4: Advanced Search & Retrieval

**Goal:** Make it easy to find specific sessions and content.

**Status:** ⚪ TBD

**Requirements:**
- **[SEARCH-01]** Full-text search across all sessions
- **[SEARCH-02]** Filter by date range, type (compact/exit), keywords
- **[SEARCH-03]** CLI tool for searching from terminal
- **[SEARCH-04]** Generate weekly/monthly reports

**Estimated Plans:** 4

---

## Phase 5: Multi-Project Support

**Goal:** Share learnings and contexts across projects.

**Status:** ⚪ TBD

**Requirements:**
- **[MULTI-01]** Global intelligence learning file
- **[MULTI-02]** Cross-project context linking
- **[MULTI-03]** Project templates based on learnings
- **[MULTI-04]** Sync contexts to remote storage (optional)

**Estimated Plans:** 3-4

---

## Long-term Vision

- **Phase 6:** Dashboard/UI for browsing sessions
- **Phase 7:** AI-powered insights and patterns
- **Phase 8:** Collaboration features (share sessions with team)
