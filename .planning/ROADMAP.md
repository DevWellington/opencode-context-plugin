# Roadmap: @devwellington/opencode-context-plugin

## Overview

Transform the context-saving plugin into a production-ready session management system with intelligent organization, context compression, and continuous learning capabilities. Phase 1 restructured context storage with hierarchical folders and summaries. Phases 2-4 added code quality, context injection, and search functionality. Phase 5 introduces the agent system with Obsidian-style linking for intelligent file generation and reading.

## Milestones

- ✅ **v1.0 Core** - Phase 1 (shipped 2026-04-21)
- ✅ **v1.1 Quality** - Phase 2 (shipped 2026-04-21)
- ✅ **v1.2 Injection** - Phase 3 (shipped 2026-04-21)
- ✅ **v2.0 Search** - Phase 4 (shipped 2026-04-21)
- 🚧 **v1.3 Agent System** - Phase 5 (planned)
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

### 🚧 v1.3 Agent System (Phase 5)

**Milestone Goal:** Create an agent system for file generation and reading with Obsidian-style linking. Enable intelligent context aggregation across time periods and maintain project intelligence through historical bug tracking.

#### Phase 5: Agent System & Obsidian Integration
**Goal**: Create agents for reading and generating contextual files with Obsidian-style linking
**Depends on**: Phase 4
**Requirements**: AGENT-01, AGENT-02, AGENT-03, AGENT-04, AGENT-05, INTEL-01, INTEL-02
**Success Criteria** (what must be TRUE):
  1. Agents generate files using Obsidian-style keywords for cross-linking
  2. Agents can read generated files with customizable output (summary/all)
  3. Intelligence-learning file updates automatically on context generation
  4. All file operations follow SOLID principles
  5. @ocp-help provides comprehensive agent documentation

**Plans:**
4/4 plans complete
- [x] 05-02: Create @ocp-read-* agents with --summary/--all parameters
- [x] 05-03: Implement @ocp-generate-intelligence-learning with historical tracking
- [x] 05-04: Implement @ocp-read-intelligence-learning agent
- [ ] 05-05: Add @ocp-help agent with full documentation

**Agent Commands:**
| Agent | Description |
|-------|-------------|
| `@ocp-generate-today` | Generate today's context summary |
| `@ocp-read-today [--summary\|--all]` | Read today's summary (default: --summary) |
| `@ocp-generate-weekly` | Generate weekly summary |
| `@ocp-read-weekly [--summary\|--all]` | Read weekly summary |
| `@ocp-generate-monthly` | Generate monthly summary |
| `@ocp-read-monthly [--summary\|--all]` | Read monthly summary |
| `@ocp-generate-annual` | Generate annual summary |
| `@ocp-read-annual [--summary\|--all]` | Read annual summary |
| `@ocp-generate-intelligence-learning` | Update intelligence-learning with new context |
| `@ocp-read-intelligence-learning [--summary\|--all]` | Read intelligence learning file |
| `@ocp-help` | Display help for all agents and functionalities |

**Intelligence Learning Rules:**
- Read all reference files (today, weekly, etc.) before generating updates
- Generate only summary content to avoid information overload
- Update intelligence-learning on every file generation
- Track historical bugs and patterns to prevent recurring failures
- Use keywords: project name, methods, variables, environment variables

---

### 📋 v2.1 Multi-Project (Phase 6)

**Milestone Goal:** Enable finding specific sessions and sharing learnings across projects.

#### Phase 6: Multi-Project Support
**Goal**: Share learnings and contexts across projects
**Depends on**: Phase 5
**Requirements**: MULTI-01, MULTI-02, MULTI-03, MULTI-04
**Success Criteria** (what must be TRUE):
  1. Global intelligence learning file aggregates patterns across all projects
  2. Contexts can link to related sessions in other projects
  3. Project templates can be created based on accumulated learnings
  4. Contexts can optionally sync to remote storage

Plans:
- [ ] 06-01: Create global intelligence learning file
- [ ] 06-02: Implement cross-project context linking
- [ ] 06-03: Add project templates from learnings
- [ ] 06-04: Add remote storage sync (optional)

---

### 📋 Future Vision (Phases 7-8)

#### Phase 7: Dashboard & UI
**Goal**: Visual interface for browsing and managing sessions

#### Phase 8: AI-Powered Insights
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
| 5. Agent System & Obsidian Integration | v1.3 | 4/4 | Complete   | 2026-04-21 |
| 6. Multi-Project Support | v2.1 | 0/4 | Not started | - |
| 7. Dashboard & UI | Future | 0/TBD | Not started | - |
| 8. AI-Powered Insights | Future | 0/TBD | Not started | - |

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