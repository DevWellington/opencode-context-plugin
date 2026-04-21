---
status: investigating
trigger: "Migration from .opencode/contextos to .opencode/context-session didn't work"
created: 2026-04-21T12:35:00Z
updated: 2026-04-21T12:35:00Z
---

## Current Focus

hypothesis: Installed plugin in ~/.config/opencode/plugins/opencode-context-plugin/ has old code (254 lines) while source has new code (833 lines) with hierarchical structure and migration logic. The install script clones from git but may have been run before the new code was pushed, or npm package wasn't updated.
test: Compare installed vs source code, check npm package version, verify when code was last deployed
expecting: Confirm that installed version is outdated and needs to be reinstalled
next_action: Document root cause and provide fix steps

## Symptoms

expected: Files should be created in .opencode/context-session/YYYY/MM/WW/DD/ hierarchical structure, old files should be migrated
actual: Files are still being created in .opencode/contextos/ (old flat structure), no migration occurred
errors: None - plugin works but uses old path
reproduction: Use opencode with context-plugin, files save to wrong directory
started: Since Phase 1 Plan 01 and 02 were marked complete but code wasn't properly deployed

## Eliminated

- hypothesis: Code is buggy and failing silently
  evidence: Logs show plugin working correctly, just using old path constant
  timestamp: 2026-04-21T12:35:00Z

## Evidence

- timestamp: 2026-04-21T12:35:00Z
  checked: Installed plugin at ~/.config/opencode/plugins/opencode-context-plugin/index.js
  found: 254 lines, uses CONTEXTOS_DIR = '.opencode/contextos' (line 5), no migration logic
  implication: Installed version is OLD code without hierarchical structure

- timestamp: 2026-04-21T12:35:00Z
  checked: Source code at /Users/wellingtonribeiro/projects/opencode-context-plugin/index.js
  found: 833 lines, uses CONTEXT_SESSION_DIR = '.opencode/context-session' (line 6), has migrateContextFiles() function (line 611), calls migration on load (line 696)
  implication: Source code has correct implementation with migration

- timestamp: 2026-04-21T12:35:00Z
  checked: Log file ~/.opencode-context-plugin.log
  found: Recent entries (12:23-12:32) show "Saved context to: /Users/wellingtonribeiro/projects/opencode-context-plugin/.opencode/contextos/..." 
  implication: Running plugin is definitely using old path

- timestamp: 2026-04-21T12:35:00Z
  checked: package.json version
  found: Version 1.1.1 claims to be published but installed version doesn't match source
  implication: Either npm package wasn't updated, or install script pulled old git commit

- timestamp: 2026-04-21T12:35:00Z
  checked: Install script install.sh
  found: Clones from git with --depth 1 (latest commit), line 82 says "📚 Contextos salvos em: {projeto}/.opencode/contextos/" (old path!)
  implication: Install script itself still references old path in user-facing message

## Resolution

root_cause: **VERSION MISMATCH - Code was committed but never published/deployed.** The source code has v1.2.0 committed locally (commit f3c7362) with hierarchical structure and migration logic (833 lines), but: (1) package.json still says 1.1.1, (2) npm registry has 1.1.1 published, (3) install script clones from git but user installed before latest commit, (4) install.sh still references old path in user message. The installed plugin (254 lines) is from the old 1.1.1 codebase without any migration logic.
fix: 1) Update package.json to 1.2.0 or higher, 2) Publish to npm with npm publish, 3) Update install.sh line 75 to reference new path, 4) User must reinstall plugin to get updated code, 5) Migration will run automatically on first load after reinstall
verification: After reinstall, check that new files go to .opencode/context-session/YYYY/MM/WW/DD/ and old files are migrated
files_changed: [package.json (version bump), install.sh (path reference), ~/.config/opencode/plugins/opencode-context-plugin/index.js (reinstall)]
