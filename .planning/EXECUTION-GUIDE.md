# Execution Guide for v1.3 Roadmap

## Branch Strategy
- One branch per phase: `codex/v1.3-phase-30.x`
- Small PR per objective (max ~400 lines changed)
- Merge order: P0 -> P1 -> P2 -> P3

## Validation Protocol per PR
1. Run focused tests for phase: `npm test -- --testPathPattern=<pattern>`
2. Run full suite: `npm test`
3. Validate lint/format (if applicable)
4. Update CHANGELOG.md
5. Update phase checklist

## Agent/Script Usage
- Use CLI `ocp-agents list/status` to check agent availability
- Use read agents (`ocp-read-*`) for context verification
- Always validate with deterministic tests

---

## Validation Protocol

### Mandatory Steps
1. **Test focused** → `npm test -- --testPathPattern=<pattern>`
2. **Test full** → `npm test`
3. **Lint** → `npm run lint` (if applicable)
4. **CHANGELOG** → Update with phase changes
5. **Checklist** → Mark phase requirements complete

### Evidence Template per Phase

After completing a phase, provide:

```markdown
### Phase 30.X - [Name]

**Objective:** [Goal of phase]

**Changes:**
| File | Function | Change Type |
|------|----------|-------------|
| path | funcName | Added/Modified/Removed |

**Tests:**
- Added: X tests
- Modified: Y tests
- Total passing: Z tests

**Acceptance Criteria:**
| Criterion | Status |
|-----------|--------|
| Criterion 1 | ✅ |
| Criterion 2 | ✅ |

**Risks/Pending:**
- [List any remaining issues]
```

---

## Operational Agent Usage

### CLI Commands Available
```bash
ocp-agents list          # List all available agents
ocp-agents status        # Check current agent availability
```

### Read Agents
```bash
ocp-read-today           # Read today's context
ocp-read-weekly          # Read weekly summary
ocp-read-monthly         # Read monthly summary
ocp-read-intelligence    # Read intelligence-learning.md
```

### Help Agent
```bash
ocp-help                 # Get help and usage information
```

---

## Prompt Template for Executor Model

When executing a phase, use this prompt:

```
Execute ONLY Phase 30.X from v1.3-QUALITY-ROADMAP.
Constraints:
1) Do not alter behavior outside phase scope.
2) Create/update corresponding tests.
3) Deliver evidence: files changed, acceptance criteria met, remaining risks.
4) If blocker detected, stop and report with options A/B.
```

---

## Evidence Template

After completing a phase, provide:

### Phase 30.X - [Name]

**Objective:** [Goal of phase]

**Changes:**
| File | Function | Change Type |
|------|----------|-------------|
| path | funcName | Added/Modified/Removed |

**Tests:**
- Added: X tests
- Modified: Y tests
- Total passing: Z tests

**Acceptance Criteria:**
| Criterion | Status |
|-----------|--------|
| Criterion 1 | ✅ |
| Criterion 2 | ✅ |

**Risks/Pending:**
- [List any remaining issues]