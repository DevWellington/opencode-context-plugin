# Contributing

## Quick Start

```bash
git clone <repo>
cd opencode-context-plugin
npm install
npm test
```

## Architecture Overview

The plugin has a layered architecture:

- **`src/utils/`** — Shared utilities (dateUtils, serialQueue, homeDir, debug, etc.)
- **`src/modules/`** — Core modules (saveContext, syncProviders, reportGenerator, etc.)
- **`src/agents/`** — Agent system for intelligence learning and report generation
- **`src/agents/intelligence/`** — Pipeline: sessionTransformer → deduplicator → sanitizer
- **`src/cli/`** — CLI entry points (all export `main(args)` for testability)
- **`src/handlers/`** — OpenCode lifecycle hooks (session, message, command handlers)

## Making Changes

1. **Diagnose first**: Understand the problem before coding
2. **Small patches**: One change per patch, test immediately
3. **Export contracts**: Functions that return null should be checked by callers
4. **CLI pattern**: Always export `main(args)`, use `isMain` guard

## Testing

```bash
npm test              # Full suite
npm test -- --runInBand  # Sequential (avoids concurrency issues)
npm test:coverage     # With coverage report
```

## Pull Request Process

1. Ensure all tests pass
2. Update the PR template checklist
3. Include evidence of test results in the PR description

## Code Style

- ES modules (`import`/`export`)
- No semicolons
- No JSDoc required for internal functions
- Avoid barrel files (`index.js` re-exports) — prefer direct imports
