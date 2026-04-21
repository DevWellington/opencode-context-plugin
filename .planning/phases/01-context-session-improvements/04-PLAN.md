---
phase: 01-context-session-improvements
plan: 04
type: execute
wave: 2
depends_on: ["01-02"]
files_modified: [index.js]
autonomous: true
requirements: [SESSION-01, LEARN-01]
user_setup: []

must_haves:
  truths:
    - "Pre-exit compression triggers automatically before session ends"
    - "intelligence-learning.md updated on every compact/exit trigger"
    - "Learning file contains decisions, structure, and bug fix guidance"
  artifacts:
    - path: "index.js"
      provides: "Pre-exit trigger and intelligence learning update"
      exports: ["triggerPreExitCompression", "updateIntelligenceLearning"]
    - path: ".opencode/context-session/intelligence-learning.md"
      provides: "Living document with project knowledge"
      min_lines: 30
  key_links:
    - from: "event handler"
      to: "triggerPreExitCompression"
      via: "session.idle/session.deleted detection"
      pattern: "session\\.(idle|deleted)"
    - from: "saveContext"
      to: "updateIntelligenceLearning"
      via: "function call after save"
      pattern: "updateIntelligenceLearning\\("
---

<objective>
Implement pre-exit context compression trigger and intelligence learning file that updates on every trigger with project decisions, structure understanding, and bug fix guidance.

Purpose: Prevent data loss on exit and create continuous learning system.
Output: Auto-compression before exit, intelligence-learning.md updated with each session.
</objective>

<execution_context>
@$HOME/.config/opencode/get-shit-done/workflows/execute-plan.md
@$HOME/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-context-session-improvements/01-CONTEXT.md
@.planning/phases/01-context-session-improvements/01-DISCOVERY.md
@.planning/phases/01-context-session-improvements/01-SUMMARY.md
@.planning/phases/01-context-session-improvements/02-SUMMARY.md
@.planning/phases/01-context-session-improvements/03-SUMMARY.md

<interfaces>
<!-- From Plan 01 & 02 output -->
```javascript
// Async context saving
async function saveContext(directory, session, type) // type: 'compact' | 'exit'

// Atomic write helper
async function atomicWrite(filePath, content)

// Session info structure
interface SessionInfo {
  type: 'compact' | 'exit';
  filename: string;
  timestamp: string;
  sessionId?: string;
}
```

<!-- OpenCode hooks available (from RESEARCH.md) -->
```typescript
// Event hook catches session lifecycle
event: async ({ event }) => {
  if (event.type === "session.idle") { /* session timeout */ }
  if (event.type === "session.deleted") { /* session deletion */ }
  if (event.type === "session.compacted") { /* compaction complete */ }
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement pre-exit compression trigger</name>
  <files>index.js</files>
  <behavior>
    - Test 1: Detects session.idle event
    - Test 2: Detects session.deleted event
    - Test 3: Triggers automatic context compression before session data lost
    - Test 4: Calls saveContext with type='exit'
    - Test 5: Logs compression trigger for debugging
  </behavior>
  <action>
    1. Update event handler in plugin initialization:
       ```javascript
       event: async ({ event }) => {
         if (event.type === "session.idle" || event.type === "session.deleted") {
           const sessionId = event.properties?.sessionID;
           debugLog(`[Pre-Exit] Session ${sessionId} ending, triggering compression...`);
           await triggerPreExitCompression(sessionId, directory, client);
         }
       }
       ```
    2. Create `triggerPreExitCompression(sessionId, directory, client)` async function:
       - Fetch session data using `client.sessions.get(sessionId)`
       - Extract messages and context (use existing extractSessionSummary logic)
       - Call saveContext with type='exit'
       - Handle errors gracefully (log but don't crash)
    3. Ensure client is accessed from closure (fix from debug/plugin-not-working.md)
    4. Add timeout protection (don't block indefinitely if client unresponsive)
    5. Add debug logging at each step for troubleshooting
  </action>
  <verify>
    <automated>node -c index.js</automated>
  </verify>
  <done>Pre-exit compression triggers automatically on session.idle or session.deleted</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create intelligence learning file structure</name>
  <files>index.js</files>
  <behavior>
    - Test 1: intelligence-learning.md created at context-session root
    - Test 2: Initial structure includes all required sections
    - Test 3: Sections: Last Updated, Project Structure Decisions, Architectural Decisions, Bug Fix Guidance, Session Patterns, Key Learnings
    - Test 4: File initialized only once (not overwritten on subsequent runs)
    - Test 5: Uses atomic write
  </behavior>
  <action>
    1. Create `initializeIntelligenceLearning(baseDir)` async function:
       - File path: `path.join(baseDir, '.opencode/context-session', 'intelligence-learning.md')`
       - Check if file exists (don't overwrite)
       - If not exists, create with template structure (from DISCOVERY.md section 6)
    2. Template structure:
       ```markdown
       # Intelligence Learning - {project-name}

       ## Last Updated
       - **Timestamp:** {ISO timestamp}
       - **Sessions Analyzed:** 0
       - **Last Session Type:** none

       ## Project Structure Decisions

       ### Folder Hierarchy
       - **Why:** Temporal organization enables quick navigation by date
       - **Structure:** YYYY/MM/WW/DD with summaries at each level
       - **Tradeoff:** More directories vs. flat structure with search

       ### Naming Conventions
       - **exit-***: Session end (replaced "saida-" for i18n)
       - **compact-***: Manual or auto compaction
       - **summary.md**: Auto-generated summaries

       ## Architectural Decisions

       ### Hook Selection
       - **session.compacted**: For manual/auto compaction
       - **session.idle**: For automatic session end detection
       - **session.deleted**: For explicit session deletion
       - **Pre-exit trigger**: Custom hook before session ends

       ### Event Handling Pattern
       - Use closure to access `client` object (not from event handler params)
       - Queue-based write serialization (no file locking needed)
       - Atomic writes via temp-file-rename pattern

       ## Bug Fix Guidance

       ### Common Issue: "client is undefined"
       **Symptom:** Error "undefined is not an object (evaluating 'client.sessions.get')"  
       **Cause:** Event handler doesn't receive client parameter  
       **Fix:** Use client from closure (outer plugin function scope)  

       ### Common Issue: File corruption on crash
       **Symptom:** Truncated or malformed summary files  
       **Cause:** Synchronous writes interrupted mid-operation  
       **Fix:** Use atomic write pattern (temp file + rename)  

       ## Session Patterns

       ### Typical Session Duration
       - [Auto-populated from session analysis]

       ### Common Commands
       - [Auto-populated from session analysis]

       ## Key Learnings from Latest Sessions

       [Appended on each trigger execution]

       ---
       *Auto-generated by OpenCode Context Plugin*
       ```
    3. Call initialization during plugin setup (after migration)
    4. Use atomicWrite for file creation
  </action>
  <verify>
    <automated>node -c index.js</automated>
  </verify>
  <done>Intelligence learning file initialized with complete structure</done>
</task>

<task type="auto">
  <name>Task 3: Implement intelligence learning update function</name>
  <files>index.js</files>
  <action>
    1. Create `updateIntelligenceLearning(baseDir, sessionInfo)` async function (from DISCOVERY.md section 6):
       - Read existing file
       - Update "Last Updated" section (timestamp, session count, last type)
       - Extract learnings from session (topics, commands, decisions)
       - Append to "Key Learnings from Latest Sessions" section
       - Deduplicate information
       - Atomic write
    2. Learning extraction logic:
       - Count messages to estimate session duration
       - Extract tool usage from session data
       - Identify recurring patterns (if analyzable)
       - Keep it simple: timestamp, type, message count, basic stats
    3. Update strategy:
       - Parse existing content to find section boundaries
       - Update metadata section
       - Append new learning entry with timestamp
       - Limit "Key Learnings" section to last 20 entries (prevent unbounded growth)
    4. Call after each saveContext (parallel with summary updates)
    5. Add queue-based serialization to prevent concurrent write conflicts:
       ```javascript
       let learningWriteQueue = Promise.resolve();
       
       async function queuedUpdateIntelligenceLearning(...) {
         learningWriteQueue = learningWriteQueue.then(() => updateIntelligenceLearning(...));
         await learningWriteQueue;
       }
       ```
    6. Handle errors gracefully (log but don't fail session save)
  </action>
  <verify>
    <automated>node -c index.js</automated>
  </verify>
  <done>Intelligence learning file updated on every trigger with session data</done>
</task>

</tasks>

<verification>
- Pre-exit compression triggers on session.idle and session.deleted
- intelligence-learning.md exists at context-session root
- File updated on every compact/exit event
- Session count increments correctly
- New learnings appended without duplicating old content
- Queue-based serialization prevents write conflicts
</verification>

<success_criteria>
- Automatic compression before session exit (no data loss)
- Intelligence learning file maintained automatically
- Content includes decisions, architecture, and bug fixes
- Performance impact minimal (< 100ms per update)
- Error handling prevents session save failures
</success_criteria>

<output>
After completion, create `.planning/phases/01-context-session-improvements/04-SUMMARY.md`
</output>
