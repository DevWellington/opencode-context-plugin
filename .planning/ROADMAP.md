# Roadmap: @devwellington/opencode-context-plugin

## Overview

Transform the context-saving plugin into a production-ready session management system with intelligent organization, context compression, and continuous learning capabilities. Phase 1 restructured context storage with hierarchical folders and summaries. Phase 2 focuses on code quality and modularity. Phases 3-5 enhance context injection, search, and multi-project support. Phases 6-8 are future vision items.

## Milestones

- ✅ **v1.0 Core** - Phases 1-1.4 (shipped 2026-04-21)
- 🚧 **v1.1 Quality** - Phase 2 (ready to plan)
- 📋 **v1.2 Injection** - Phase 3 (planned)
- 📋 **v2.0 Search & Multi-Project** - Phases 4-5 (planned)
- 📋 **Future** - Phases 6-8 (vision)

## Phases

<details>
<summary>✅ v1.0 Core (Phases 1-1.4) - SHIPPED 2026-04-21</summary>

### Phase 1: Context Session Restructuring
**Goal**: Reorganize context storage with hierarchical folder structure, rename "saida" to "exit", implement pre-exit context compression, and create daily summary system
**Plans**: 4 plans

Plans:
- [x] 01-01: Migrate to async fs/promises, rename contextos→context-session and saida→exit
- [x] 01-02: Implement hierarchical folder structure (YYYY/MM/WW/DD) with auto-summaries
- [x] 01-03: Create daily summary routine at context-session root
- [x] 01-04: Implement pre-exit compression and intelligence learning file

</details>

### 🚧 v1.1 Quality (In Progress)

**Milestone Goal:** Refactor monolithic index.js into modular structure, add configuration options, and establish testing foundation.

#### Phase 2: Code Quality & Performance
**Goal**: Refactor monolithic index.js into modular structure, optimize context injection, and add configuration options
**Depends on**: Phase 1
**Requirements**: MODULAR-01, MODULAR-02, MODULAR-03, PERF-01, PERF-02, CONFIG-01, TEST-01
**Success Criteria** (what must be TRUE):
  1. Codebase is organized into distinct modules (saveContext, summaries, intelligence)
  2. Plugin accepts configuration via opencode.json (maxSessions, enableLearning, logLevel)
  3. Summary updates are debounced to prevent excessive I/O
  4. Debug logging can be enabled/disabled via configuration
  5. Integration tests can run with mock OpenCode client API
**Plans**: 3-4 plans (TBD during planning)

Plans:
- [x] 02-01: Extract saveContext logic into separate module
- [x] 02-02: Add testing infrastructure with mock client API
- [ ] 02-03: Add configuration support via opencode.json
- [ ] 02-04: Performance optimization

### 📋 v1.2 Injection (Planned)

**Milestone Goal:** Smart context injection based on relevance, not just recency.

#### Phase 3: Context Injection Optimization
**Goal**: Smart context injection based on relevance, not just recency
**Depends on**: Phase 2
**Requirements**: INJECT-01, INJECT-02, INJECT-03, INJECT-04
**Success Criteria** (what must be TRUE):
  1. Contexts can be filtered by relevance score before injection
  2. Injected content respects token limits, not just file count
  3. User can manually request context injection via prompt
  4. Injected context is cached to avoid repeated file reads
**Plans**: 3 plans (TBD during planning)

Plans:
- [ ] 03-01: Implement relevance-based context filtering
- [ ] 03-02: Add token-based content limiting
- [ ] 03-03: Add manual context injection prompt and caching

### 📋 v2.0 Search & Multi-Project (Planned)

**Milestone Goal:** Enable finding specific sessions and sharing learnings across projects.

#### Phase 4: Advanced Search & Retrieval
**Goal**: Make it easy to find specific sessions and content
**Depends on**: Phase 3
**Requirements**: SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04
**Success Criteria** (what must be TRUE):
  1. Full-text search works across all saved session files
  2. Search can be filtered by date range, type (compact/exit), and keywords
  3. CLI tool allows searching contexts from terminal
  4. Weekly/monthly reports can be generated automatically
**Plans**: 3-4 plans (TBD during planning)

Plans:
- [ ] 04-01: Implement full-text search across sessions
- [ ] 04-02: Add filter support (date, type, keywords)
- [ ] 04-03: Create CLI search tool
- [ ] 04-04: Implement report generation

#### Phase 5: Multi-Project Support
**Goal**: Share learnings and contexts across projects
**Depends on**: Phase 4
**Requirements**: MULTI-01, MULTI-02, MULTI-03, MULTI-04
**Success Criteria** (what must be TRUE):
  1. Global intelligence learning file aggregates patterns across all projects
  2. Contexts can link to related sessions in other projects
  3. Project templates can be created based on accumulated learnings
  4. Contexts can optionally sync to remote storage
**Plans**: 3-4 plans (TBD during planning)

Plans:
- [ ] 05-01: Create global intelligence learning file
- [ ] 05-02: Implement cross-project context linking
- [ ] 05-03: Add project templates from learnings
- [ ] 05-04: Add remote storage sync (optional)

### 📋 Future Vision (Phases 6-8)

#### Phase 6: Dashboard & UI
**Goal**: Visual interface for browsing and managing sessions
**Depends on**: Phase 5
**Requirements**: UI-01, UI-02
**Success Criteria** (what must be TRUE):
  1. Web-based or TUI dashboard displays session history
  2. Users can browse, search, and view session details visually
**Plans**: TBD

#### Phase 7: AI-Powered Insights
**Goal**: Automatic pattern detection and recommendations
**Depends on**: Phase 6
**Requirements**: AI-01, AI-02
**Success Criteria** (what must be TRUE):
  1. AI identifies recurring patterns across sessions
  2. System provides proactive recommendations based on history
**Plans**: TBD

#### Phase 8: Collaboration Features
**Goal**: Share sessions with team members
**Depends on**: Phase 7
**Requirements**: COLLAB-01, COLLAB-02
**Success Criteria** (what must be TRUE):
  1. Sessions can be exported and shared
  2. Team members can annotate and comment on sessions
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 1.1 → 1.2 → 1.3 → 1.4 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Context Session Restructuring | v1.0 | 4/4 | Complete | 2026-04-21 |
| 2. Code Quality & Performance | v1.1 | 2/4 | In Progress | - |
| 3. Context Injection Optimization | v1.2 | 0/3 | Not started | - |
| 4. Advanced Search & Retrieval | v2.0 | 0/4 | Not started | - |
| 5. Multi-Project Support | v2.0 | 0/4 | Not started | - |
| 6. Dashboard & UI | Future | 0/TBD | Not started | - |
| 7. AI-Powered Insights | Future | 0/TBD | Not started | - |
| 8. Collaboration Features | Future | 0/TBD | Not started | - |
