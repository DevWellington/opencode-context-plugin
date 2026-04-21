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
- [ ] 01-context-session-improvements-03-PLAN.md — Create daily summary routine at context-session root
- [ ] 01-context-session-improvements-04-PLAN.md — Implement pre-exit compression and intelligence learning file

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

## Future Phases (TBD)

- Phase 2: Context injection optimization
- Phase 3: Advanced search and retrieval
- Phase 4: Multi-project support
