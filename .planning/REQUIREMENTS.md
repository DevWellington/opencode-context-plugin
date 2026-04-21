# Requirements: @devwellington/opencode-context-plugin

**Defined:** 2026-04-21
**Core Value:** OpenCode plugin that saves session context to .opencode/context-session/ after compaction and session end

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Session Management

- [x] **SESSION-01**: Pre-exit compression trigger - Generate context compression before session ends to preserve session data
- [x] **SESSION-02**: Rename "saida" to "exit" - Update all references from "saida" prefix to "exit" for consistency
- [x] **SESSION-03**: Hierarchical folder structure - Organize contexts by year/month/week/day with summary files at week/day levels
- [x] **SESSION-04**: Rename "contextos" to "context-session" - Update directory naming for clarity
- [x] **SESSION-05**: Daily summary routine - Aggregate compression and exit files into daily summary at root of context-session folder
- [x] **SESSION-06**: Week and day summary files - Auto-generate summary.md files for week and day folders

### Learning System

- [x] **LEARN-01**: Intelligence learning file - Generate updated intelligence-learning.md on each trigger (compression or exit) containing project decisions, structure understanding, and bug fix guidance

### Code Quality

- [x] **MODULAR-01**: Extract saveContext logic into separate module
- [x] **MODULAR-02**: Extract summary generation into separate module
- [x] **MODULAR-03**: Extract intelligence learning into separate module
- [ ] **PERF-01**: Implement debouncing for summary updates
- [x] **PERF-02**: Add log rotation or debug flag
- [x] **CONFIG-01**: Allow configuration via opencode.json (maxSessions, enableLearning, logLevel)
- [x] **TEST-01**: Mock client API for integration tests

### Context Injection

- [ ] **INJECT-01**: Filter contexts by relevance score
- [x] **INJECT-02**: Limit injected content by tokens, not just file count
- [ ] **INJECT-03**: Add user prompt to manually request context injection
- [ ] **INJECT-04**: Cache injected context to avoid re-reading files

### Search & Retrieval

- [x] **SEARCH-01**: Full-text search across all sessions
- [x] **SEARCH-02**: Filter by date range, type (compact/exit), keywords
- [x] **SEARCH-03**: CLI tool for searching from terminal
- [x] **SEARCH-04**: Generate weekly/monthly reports

### Multi-Project

- [ ] **MULTI-01**: Global intelligence learning file
- [ ] **MULTI-02**: Cross-project context linking
- [ ] **MULTI-03**: Project templates based on learnings
- [ ] **MULTI-04**: Sync contexts to remote storage (optional)

## v2 Requirements (Future)

### UI/UX

- **UI-01**: Web-based or TUI dashboard for session history
- **UI-02**: Visual browsing, search, and session detail viewing

### AI/Predictive

- **AI-01**: AI identifies recurring patterns across sessions
- **AI-02**: Proactive recommendations based on history

### Collaboration

- **COLLAB-01**: Export and share sessions
- **COLLAB-02**: Team annotations and comments on sessions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time sync | Complexity too high for v1-v2 |
| Plugin configuration UI | CLI/config file sufficient |
| OAuth/authentication | Plugin is local to user's opencode instance |
| Cloud storage (required) | Local storage is core value; sync is optional v2 |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SESSION-01 | Phase 1 | Complete |
| SESSION-02 | Phase 1 | Complete |
| SESSION-03 | Phase 1 | Complete |
| SESSION-04 | Phase 1 | Complete |
| SESSION-05 | Phase 1 | Complete |
| SESSION-06 | Phase 1 | Complete |
| LEARN-01 | Phase 1 | Complete |
| MODULAR-01 | Phase 2 | Complete |
| MODULAR-02 | Phase 2 | Complete |
| MODULAR-03 | Phase 2 | Complete |
| PERF-01 | Phase 2 | Pending |
| PERF-02 | Phase 2 | Complete |
| CONFIG-01 | Phase 2 | Complete |
| TEST-01 | Phase 2 | Complete |
| INJECT-01 | Phase 3 | Pending |
| INJECT-02 | Phase 3 | Complete |
| INJECT-03 | Phase 3 | Pending |
| INJECT-04 | Phase 3 | Pending |
| SEARCH-01 | Phase 4 | Complete |
| SEARCH-02 | Phase 4 | Complete |
| SEARCH-03 | Phase 4 | Complete |
| SEARCH-04 | Phase 4 | Complete |
| MULTI-01 | Phase 5 | Pending |
| MULTI-02 | Phase 5 | Pending |
| MULTI-03 | Phase 5 | Pending |
| MULTI-04 | Phase 5 | Pending |
| UI-01 | Phase 6 | Future |
| UI-02 | Phase 6 | Future |
| AI-01 | Phase 7 | Future |
| AI-02 | Phase 7 | Future |
| COLLAB-01 | Phase 8 | Future |
| COLLAB-02 | Phase 8 | Future |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓
- Complete: 7 (SESSION-01 through LEARN-01)
- Pending: 14 (Phases 2-5)
- Future: 8 (Phases 6-8)

---
*Requirements defined: 2026-04-21*
*Last updated: 2026-04-21 after roadmap creation*
