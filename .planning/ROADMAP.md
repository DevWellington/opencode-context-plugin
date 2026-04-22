# Roadmap: @devwellington/opencode-context-plugin

## Overview

Transform the context-saving plugin into a production-ready session management system with intelligent organization, context compression, and continuous learning capabilities. Phase 1 restructured context storage with hierarchical folders and summaries. Phases 2-4 added code quality, context injection, and search functionality. Phase 5 introduces the agent system with Obsidian-style linking for intelligent file generation and reading.

## Milestones

- ✅ **v1.0 Core** - Phase 1 (shipped 2026-04-21)
- ✅ **v1.1 Quality** - Phase 2 (shipped 2026-04-21)
- ✅ **v1.2 Injection** - Phase 3 (shipped 2026-04-21)
- ✅ **v2.0 Search** - Phase 4 (shipped 2026-04-21)
- ✅ **v1.3 Agent System** - Phase 5 (shipped 2026-04-21)
- 📋 **v2.1 Multi-Project** - Phase 6 (planned)
- 📋 **Future** - Phases 7-8 (vision)

## Phases

<details>
<summary>✅ v1.0 Core (Phase 1) - SHIPPED 2026-04-21</summary>

### Phase 1: Context Session Restructuring
**Goal**: Reorganize context storage with hierarchical folder structure, rename "saida" to "exit", implement pre-exit context compression, and create daily summary system

Plans:
- [x] 01-01: Migrate to async fs/promises, rename contextos→context-session and saida→exit
- [x] 01-02: Implement hierarchical folder structure (YYYY/MM/WW/DD) with auto-summaries
- [x] 01-03: Create daily summary routine at context-session root
- [x] 01-04: Implement pre-exit compression and intelligence learning file

</details>

<details>
<summary>✅ v1.1 Quality (Phase 2) - SHIPPED 2026-04-21</summary>

### Phase 2: Code Quality & Performance
**Goal**: Refactor monolithic index.js into modular structure, add configuration options, and establish testing foundation.

Plans:
- [x] 02-01: Extract saveContext logic into separate module
- [x] 02-02: Add testing infrastructure with mock client API
- [x] 02-03: Add configuration support via opencode.json
- [x] 02-04: Performance optimization (log rotation)

</details>

<details>
<summary>✅ v1.2 Injection (Phase 3) - SHIPPED 2026-04-21</summary>

### Phase 3: Context Injection Optimization
**Goal**: Smart context injection based on relevance, not just recency

Plans:
- [x] 03-01: Implement relevance-based context filtering (LLM scoring + cache)
- [x] 03-02: Add token-based content limiting (chars/4 approximation)
- [x] 03-03: Add manual context injection prompt and caching

</details>

<details>
<summary>✅ v2.0 Search (Phase 4) - SHIPPED 2026-04-21</summary>

### Phase 4: Advanced Search & Retrieval
**Goal**: Make it easy to find specific sessions and content

Plans:
- [x] 04-01: Full-text search infrastructure (searchIndexer + searchQuery modules)
- [x] 04-02: CLI search tool with filter support (type, date, keywords)
- [x] 04-03: Report generation (weekly/monthly reports)

</details>

### 🚧 v1.3 Agent System (Phase 5) - COMPLETED but FLAWED
⚠️ **REMEDIATION IN PROGRESS** - Implementation verified but produces wrong output (counts instead of content)

**Original Goal:** Create agents for reading and generating contextual files with Obsidian-style linking

**Problem Found:** Phase 5 was completed and verified (7/7 must-haves), but research revealed reports generate:
- ❌ Counts ("12 sessions, 847 messages") instead of accomplishments
- ❌ Word frequency ("context, plugin, session") instead of actual topics
- ❌ Fake bug tracking (keyword detection) instead of real bug history

**Remediation:** New phase 05 (Content-Focused Reports) will fix content extraction and output formats

---

### 📋 v1.4 Content-Focused Reports (Phase 05) - REMEDIATION

**Milestone Goal:** Generate meaningful reports that extract structured content from sessions

**Why:** Current Phase 5 produces technically correct but practically useless output

**Depends on:** Phase 5 (original)
**Requirements:** CONTENT-01, CONTENT-02, CONTENT-03, CONTENT-04, CONTENT-05

**Success Criteria (what must be TRUE):**
  1. Monthly reports show Major Accomplishments, not counts
  2. Annual reports show Quarterly Themes, not just statistics table
  3. Intelligence learning tracks bugs with symptom/cause/solution/prevention
  4. Reports extract structured fields (Goal, Accomplished, Discoveries)
  5. Cross-session pattern detection works

**Plans:** 4 plans (created)
- [x] 05-01-PLAN.md: Create contentExtractor.js module
- [x] 05-02-PLAN.md: Redesign reportGenerator for content distillation
- [x] 05-03-PLAN.md: Redesign intelligence learning
- [x] 05-04-PLAN.md: Update agents to use new content extraction

**Research:** See `.planning/research/REMEDIATION.md` for full remediation plan

---

### 📋 v1.5 OpenCode Internal AI (Phase 6)

**Milestone Goal:** Replace external OpenAI API calls with OpenCode's internal AI inference

**Why:** User requested "rodar internamente" (run internally) - use OpenCode's built-in AI instead of external OpenAI API calls

**Depends on**: Phase 05 (Content-Focused Reports)
**Requirements**: AI-01, AI-02

**Success Criteria (what must be TRUE):**
1. contentExtractor.js uses OpenCode AI via client.sessions.prompt()
2. No external API calls (no fetch to api.openai.com)
3. inferMissingFields accepts optional opencodeClient parameter
4. Tests mock OpenCode client, not global.fetch

**Plans:** 2 plans (created)
- [x] 06-01-PLAN.md: Replace callOpenAI with callOpenCodeAI using client.sessions.prompt()
- [x] 06-02-PLAN.md: Update callers to pass OpenCode client through the module chain

---

### 📋 v2.1 Multi-Project (Phase 7)

**Milestone Goal:** Enable finding specific sessions and sharing learnings across projects.

#### Phase 7: Multi-Project Support
**Goal**: Share learnings and contexts across projects
**Depends on**: Phase 6
**Requirements**: MULTI-01, MULTI-02, MULTI-03, MULTI-04
**Success Criteria** (what must be TRUE):
  1. Global intelligence learning file aggregates patterns across all projects
  2. Contexts can link to related sessions in other projects
  3. Project templates can be created based on accumulated learnings
  4. Contexts can optionally sync to remote storage

Plans:
- [x] 07-01-PLAN.md: Create global intelligence learning file (completed)
- [x] 07-02-PLAN.md: Implement cross-project context linking (completed)
- [x] 07-03-PLAN.md: Add project templates from learnings (completed)
- [x] 07-04-PLAN.md: Add remote storage sync (optional) (completed)

#### Phase 7.3: Smart Generation Triggers
**Goal**: Only regenerate summaries when content exceeds threshold or meaningful changes occurred
**Depends on**: Phase 7
**Requirements**: SMART-01, SMART-02, SMART-03
**Success Criteria** (what must be TRUE):
  1. Skips regeneration when change < 5%
  2. Only regenerates if new session added
  3. Maintains backward compatibility

Plans:
- [x] 07.3-01-PLAN.md: Add shouldRegenerate() change detection (planned)
- [x] 07.3-02-PLAN.md: Skip generation when no meaningful change (planned)
- [x] 07.3-03-PLAN.md: Verify existing tests pass (planned)

---

### 📋 v1.2.1 Manual Context Injection (Phase 8)

**Milestone Goal:** Add user-triggered manual context injection via /inject command and @ocp-inject agent

**Why:** Currently context injection only happens automatically on session start. Users need a way to manually request context injection at any time during a session.

**Depends on**: Phase 3 (Context Injection)
**Requirements**: INJECT-03

**Success Criteria** (what must be TRUE):
1. User can type /inject in OpenCode to see available contexts with scores
2. User can type /inject N to inject specific context
3. @ocp-inject agent is installed and functional
4. Existing auto-injection on session start is not broken
5. Manual injection works at any point during session

Plans:
- [ ] 08-01-PLAN.md: Add /inject command and @ocp-inject agent for manual injection

---

### 📋 v1.6 Enhanced Summaries (Phase 09)

**Milestone Goal:** Make summary files content-rich, not just counts and file references

**Why:** Current summaries (daily-summary.md, week-summary.md, monthly-*.md, annual-*.md) only track file counts and timestamps. User wants summaries to extract: goals, accomplishments, discoveries, bugs, decisions.

**Depends on**: Phase 05 (Content-Focused Reports) - uses contentExtractor.js
**Requirements**: SUMM-01, SUMM-02, SUMM-03, SUMM-04, SUMM-05

**Success Criteria (what must be TRUE):**
1. Day summary shows Goals, Accomplishments, Discoveries, Bugs Fixed, Relevant Files
2. Week summary aggregates all days with deduplication
3. Monthly report has Major Accomplishments, Issues Resolved, Decisions Made
4. Annual report has Annual Theme, Quarterly Themes, Project Evolution, Bug History
5. All summaries use contentExtractor.js for extraction

**Plans:** 4 plans (created)
- [x] 09-01-PLAN.md: Enhance day summary with content extraction
- [x] 09-02-PLAN.md: Enhance week summary with content aggregation
- [x] 09-03-PLAN.md: Enhance monthly report (follow reportGenerator structure)
- [x] 09-04-PLAN.md: Enhance annual report (follow reportGenerator structure)

---

### 📋 Future Vision (Phases 10-11)

#### Phase 10: Dashboard & UI
**Goal**: Visual interface for browsing and managing sessions

#### Phase 11: AI-Powered Insights
**Goal**: Automatic pattern detection and recommendations

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Context Session Restructuring | v1.0 | 4/4 | Complete | 2026-04-21 |
| 2. Code Quality & Performance | v1.1 | 3/3 | Complete | 2026-04-21 |
| 3. Context Injection Optimization | v1.2 | 3/3 | Complete | 2026-04-21 |
| 4. Advanced Search & Retrieval | v2.0 | 3/3 | Complete | 2026-04-21 |
| 5. Agent System & Obsidian Integration | v1.3 | 6/6 | Complete | 2026-04-21 |
| 5. Content-Focused Reports | v1.4 | 4/4 | Complete | 2026-04-21 |
| 6. OpenCode Internal AI | v1.5 | 2/2 | Complete | 2026-04-21 |
| 7. Multi-Project Support | v2.1 | 2/4 | In Progress | 2026-04-21 |
| 8. Manual Context Injection | v1.2.1 | 0/1 | Planned | - |
| 9. Enhanced Summaries | v1.6 | 5/4 | Complete   | 2026-04-22 |
| 10. Dashboard & UI | Future | 0/TBD | Not started | - |
| 11. AI-Powered Insights | Future | 0/TBD | Not started | - |

## Design Principles

### Obsidian-Style Keyword Linking
For every generated file, use keywords to create effective cross-linking:
- Project name (codigo)
- Method names or functionality
- Variable names and environment variables
- Names that help quickly find what the user requested

This enables effective graph views in Obsidian and meaningful relationships between files.

### SOLID Principles
All plugin actions use the same methods for hooks and agents:
- Single Responsibility: Each method does one thing
- Open/Closed: Open for extension, closed for modification
- Liskov Substitution: Methods can be substituted
- Interface Segregation: Small, specific interfaces
- Dependency Inversion: Depend on abstractions

### Intelligence Learning
The intelligence-learning file follows specific guidelines:
- Updated on every file generation
- Tracks historical bugs to prevent recurring failures
- Maps user intelligence with LLM models in OpenCode
- Reads all reference files before generating updates
- Generates only summaries to avoid information overload