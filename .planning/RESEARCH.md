# Research: Intelligence-Learning.md Generation Improvements

**Researched:** 2026-05-03
**Domain:** Content extraction and intelligence pattern generation for session summaries
**Confidence:** HIGH (based on source code analysis of 4 key files + actual generated output)

## Summary

The intelligence-learning.md file generation has three main quality issues:

1. **Known Issues Section** contains noise from malformed bug fragments (e.g., "js:756", "md itself", "(Revisar tudo)" suffixes)
2. **Successful Approaches Section** truncates multiline accomplishments, losing context from bullet lists
3. **Recent Patterns Section** produces generic patterns ("generation", "validation") without specific context

**Root causes identified:**
- Bug extraction regex captures file:line references as bug symptoms without validation
- Accomplishment handling flattens multiline content then truncates at 120 chars
- Pattern extraction uses single-word keyword fallback without session context enrichment

**Primary recommendation:** Implement three targeted fixes in `intelligenceDeduplicator.js` and `contentExtractor.js` to filter malformed bugs, preserve multiline accomplishment structure, and enrich patterns with goal/accomplishment context.

---

## Problem Analysis

### 1. Known Issues Filtering - Noise from Malformed Bug Descriptions

#### Current State (intelligence-learning.md lines 14-25)

```markdown
- Critical Crash: extractSectionFromContent didn't exist in reportGenerator (Revisar tudo)
- js:756 - would crash annual report generation
2 (Revisar tudo)
- ISO Week Bug: Multiple files used Math (Revisar tudo)
- md itself, causing self-inclusion
generateIntelligenceLearning (Revisar tudo)
- js were not stripping residual  patterns (e (Revisar tudo)
```

#### Root Cause Analysis

**Location:** `intelligenceDeduplicator.js` lines 100-136 + `contentExtractor.js` lines 280-295

**Problem flow:**
1. `extractBugs()` in `contentExtractor.js` (line 282) uses regex:
   ```javascript
   const bugHeaderMatch = trimmedLine.match(/^(?:###\s+)?(?:Bug|Error|Issue):\s*(.*)/i);
   ```
2. This captures ANYTHING after "Bug|Error|Issue:", including:
   - File:line references: "Bug: js:756 - would crash..." → symptom = "js:756 - would crash..."
   - Session artifacts: "Bug: md itself, causing self-inclusion" → symptom = "md itself, causing..."
   - Truncated notes: "Bug: ... (Revisar tudo)" → symptom = "... (Revisar tudo)"

3. `intelligenceDeduplicator.js` (lines 120-125) attempts filtering:
   ```javascript
   if (/\(Revisar tudo\)$/.test(symptom)) continue;
   if (/^\d+\s*\(/.test(symptom)) continue;  // "2 (Revisar tudo)" fragments
   if (/^md\)/.test(symptom)) continue;
   if (/^js\)/.test(symptom)) continue;  // NOTE: This regex is WRONG!
   ```

**The bug:** The regex `/^js\)/` requires a closing parenthesis, but actual data has "js:756" (colon, no closing paren). Should be `/^js[:)]/`.

**Additional gaps:**
- No filter for file:line patterns like "js:756", "js:467-468"
- No filter for truncated fragments like "e (Revisar tudo)" (line starting with letter + parenthetical)
- No filter for session artifacts like "md itself", "contentExtractor" appearing as standalone words

#### Proposed Solution

**Option A: Pre-filter in extractBugs() (Recommended)**

Add validation in `contentExtractor.js` `extractBugs()` function to reject malformed bug symptoms BEFORE they're extracted:

```javascript
// In contentExtractor.js, line 290-295, after extracting symptom:
const bugHeaderMatch = trimmedLine.match(/^(?:###\s+)?(?:Bug|Error|Issue):\s*(.*)/i);
if (bugHeaderMatch) {
  const symptomCandidate = bugHeaderMatch[1] || '';
  
  // NEW: Validate symptom is not a fragment/artifact
  if (!isValidBugSymptom(symptomCandidate)) {
    continue; // Skip malformed bug headers
  }
  
  currentBug = { symptom: symptomCandidate, line: i };
  // ... rest of extraction
}

// NEW function:
function isValidBugSymptom(symptom) {
  if (!symptom || symptom.length < 10) return false;
  
  // Reject file:line references (e.g., "js:756", "js:467-468")
  if (/^[a-z]+:\d+/.test(symptom)) return false;
  
  // Reject truncated fragments ending with "(Revisar tudo)" or similar
  if (/\(Revisar tudo\)$/.test(symptom)) return false;
  if (/\(review\)$/.test(symptom)) return false;
  
  // Reject standalone file/module names (session artifacts)
  if (/^(md|js|ts|contentExtractor|linkBuilder)\b/i.test(symptom)) return false;
  
  // Reject pure numbers or number fragments
  if (/^\d+\s/.test(symptom)) return false;
  
  // Reject fragments starting with lowercase letter followed by space (truncated mid-word)
  if (/^[a-z]\s/.test(symptom)) return false;
  
  return true;
}
```

**Option B: Post-filter in intelligenceDeduplicator.js (Current approach, needs fixing)**

Fix the regex patterns in `intelligenceDeduplicator.js` lines 120-125:

```javascript
// CURRENT (broken):
if (/^js\)/.test(symptom)) continue;

// FIXED:
if (/^js[:)]/.test(symptom)) continue;  // Matches "js:" OR "js)"
if (/^[a-z]+:\d/.test(symptom)) continue;  // Matches "js:756", "ts:123", etc.

// ADD additional filters:
if (/^[a-z]\s/.test(symptom)) continue;  // "e (Revisar tudo)" - single letter + space
if (/^contentExtractor|^linkBuilder/i.test(symptom)) continue;  // Module names
```

**Trade-off analysis:**

| Aspect | Option A (Pre-filter) | Option B (Post-filter) |
|--------|------------------------|------------------------|
| Location | contentExtractor.js | intelligenceDeduplicator.js |
| Prevention | Stops malformed bugs from entering system | Filters after extraction |
| Test impact | Tests for extractBugs need updates | No test changes needed |
| Maintenance | Single source of truth | Multiple filter locations |
| Recommendation | **Preferred** - cleaner, prevents propagation | Acceptable as quick fix |

**Recommended: Option A** - filter at extraction source to prevent malformed bugs from propagating through the entire intelligence pipeline.

---

### 2. Accomplishment Formatting - Truncated Multiline Content

#### Current State (intelligence-learning.md lines 26-34)

```markdown
- v1.6.0 Published: @devwellington/opencode-context-plugin@1.6.0
Obsidian Integration:
Bundled show-hidden-files plugin in (seen 1 times)
```

This appears to be from an original accomplishment like:
```
✅ v1.6.0 Published: @devwellington/opencode-context-plugin@1.6.0
✅ Obsidian Integration: Bundled show-hidden-files plugin
✅ ... more items
```

#### Root Cause Analysis

**Location:** `intelligenceDeduplicator.js` lines 198-258 + `contentExtractor.js` lines 167

**Problem flow:**
1. `extractSessionContent()` in `contentExtractor.js` joins multiline content:
   ```javascript
   // Line 167
   const joined = content.join('\n').trim();
   ```
   This preserves newlines but the downstream processing treats it as a single string.

2. `intelligenceDeduplicator.js` (line 230) cleans but doesn't parse structure:
   ```javascript
   const cleanAcc = acc.replace(/[#*`\[\]]/g, '').replace(/\d+\.\d+:/g, '').trim();
   if (cleanAcc.length < 20) continue;
   ```

3. Line 246 truncates to 120 chars:
   ```javascript
   patternText = cleanAcc.slice(0, 120);
   ```

4. `intelligenceTemplate.js` (line 51) outputs as single line:
   ```javascript
   lines.push(`- ${approach.pattern}${freq}${loc}`);
   ```

**The issue:** Multiline accomplishments with bullet structure are:
1. Joined into one string with `\n` preserved
2. Cleaned of bullets/emojis but structure remains as newlines
3. Truncated at 120 chars (cuts mid-sentence across newlines)
4. Output as single line (newlines become space-like or break markdown)

#### Proposed Solution

**Option A: Extract first bullet only (Recommended for simplicity)**

Modify `intelligenceDeduplicator.js` to extract only the first substantive bullet:

```javascript
// In intelligenceDeduplicator.js, lines 198-258, replace processing:

for (const session of allSessions) {
  const acc = session.accomplished;
  if (!acc || acc.length < 15) continue;
  
  // NEW: Parse multiline accomplishments
  const bullets = parseAccomplishmentBullets(acc);
  if (bullets.length === 0) continue;
  
  // Use first bullet as primary accomplishment
  const primaryBullet = bullets[0];
  
  // Skip if low quality
  if (isLowQualityAccomplishment(primaryBullet)) continue;
  if (containsIssuePattern(primaryBullet)) continue;
  
  // Create pattern from primary bullet with full context
  const cleanBullet = primaryBullet.replace(/[#*`\[\]]/g, '').trim();
  if (cleanBullet.length < 20) continue;
  
  const patternText = session.goal && session.goal.length > 3
    ? `when ${session.goal.slice(0, 40)}, do ${cleanBullet.slice(0, 80)}`
    : cleanBullet.slice(0, 120);
  
  successfulApproaches.push({
    pattern: patternText,
    context: session.title || '',
    frequency: 1,
    location: session.relevantFiles?.[0] || ''
  });
}

// NEW function:
function parseAccomplishmentBullets(text) {
  if (!text) return [];
  
  const lines = text.split('\n');
  const bullets = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Match bullet patterns: "- text", "✅ text", "- ✅ text"
    const bulletMatch = trimmed.match(/^[-*]\s*(?:✅\s*)?(.+)$/);
    if (bulletMatch && bulletMatch[1]) {
      const content = bulletMatch[1].trim();
      if (content.length >= 15) {
        bullets.push(content);
      }
    }
    
    // Also match lines that are just content (not bullets)
    // These are continuation lines within a bullet
    if (!bulletMatch && trimmed.length >= 15 && !trimmed.startsWith('#')) {
      // Append to previous bullet if exists
      if (bullets.length > 0) {
        bullets[bullets.length - 1] += ' ' + trimmed;
      }
    }
  }
  
  return bullets;
}
```

**Option B: Combine all bullets into summary paragraph**

More sophisticated approach that synthesizes multiple bullets:

```javascript
function synthesizeAccomplishmentSummary(bullets) {
  if (bullets.length === 0) return '';
  if (bullets.length === 1) return bullets[0];
  
  // Combine first 3 bullets with "and" connector
  const topBullets = bullets.slice(0, 3);
  if (topBullets.length === 2) {
    return `${topBullets[0]} and ${topBullets[1]}`;
  }
  if (topBullets.length >= 3) {
    return `${topBullets[0]}, ${topBullets[1]}, and ${topBullets.slice(2).join(', ')}`;
  }
  
  return topBullets.join(', ');
}
```

**Option C: Format as multiple lines in output**

Change `intelligenceTemplate.js` to handle multiline patterns:

```javascript
// In intelligenceTemplate.js, lines 47-55:
for (const approach of patternData.successfulApproaches.slice(0, 10)) {
  const freq = approach.frequency ? ` (seen ${approach.frequency} times)` : '';
  const loc = approach.location ? ` (${approach.location})` : '';
  
  // NEW: Handle multiline patterns
  const patternLines = approach.pattern.split('\n');
  if (patternLines.length === 1) {
    lines.push(`- ${approach.pattern}${freq}${loc}`);
  } else {
    // First line as bullet, subsequent as indented
    lines.push(`- ${patternLines[0]}${freq}${loc}`);
    for (const contLine of patternLines.slice(1).slice(0, 2)) {
      lines.push(`  - ${contLine.slice(0, 80)}`);
    }
  }
}
```

**Trade-off analysis:**

| Aspect | Option A (First bullet) | Option B (Combine) | Option C (Multiline output) |
|--------|-------------------------|--------------------|-----------------------------|
| Complexity | LOW | MEDIUM | MEDIUM |
| Information preserved | Partial (first bullet only) | Synthesized summary | Full structure |
| Output length | Compact (~100 chars) | Medium (~150 chars) | Long (multiple lines) |
| Readability | HIGH - focused | MEDIUM - may be dense | LOW - verbose |
| Recommendation | **Preferred** - clear, actionable | Good for synthesis | Avoid - verbose |

**Recommended: Option A** - extract first substantive bullet. Most accomplishments have a primary achievement as the first bullet, with supporting details following. The first bullet captures the essence.

---

### 3. Pattern Extraction - Too Generic Without Context

#### Current State (intelligence-learning.md lines 42-47)

```markdown
- accomplishment theme: generation (16 sessions)
- goal theme: validation (15 sessions)
- goal theme: comparing (15 sessions)
- goal theme: agent (15 sessions)
- goal theme: trigger (15 sessions)
```

These patterns lose all semantic context. "generation" could be generation of reports, code, summaries, etc.

#### Root Cause Analysis

**Location:** `contentExtractor.js` lines 727-829 + `intelligenceDeduplicator.js` line 326

**Problem flow:**
1. `findRecurringThemes()` in `contentExtractor.js` creates patterns:
   - Line 732: `const themeKey = patternType + ': ' + theme.name;`
   - Semantic themes (lines 617-718) like "startup optimization" are specific
   - Keyword fallback (lines 774-829) extracts single words like "generation", "validation"

2. `intelligenceDeduplicator.js` (line 326) strips the prefix:
   ```javascript
   name: p.pattern.split(':').slice(1).join(':').trim() || p.pattern
   ```
   This turns "goal theme: startup optimization" into just "startup optimization"

3. `intelligenceTemplate.js` (lines 74-98) attempts to add context:
   ```javascript
   const words = pattern.name.split(/[\s\-_:]+/);
   const concreteParts = words.filter(w => w.length > 3 && ...);
   ```
   But for single-word patterns like "generation", this just returns "generation"

**The issue:**
1. Semantic themes are specific but keyword fallback produces generic words
2. Session context (goal, accomplishment) is available but not used to enrich generic terms
3. The template tries to extract context from the pattern name itself, not from source sessions

#### Proposed Solution

**Option A: Enrich patterns with session context during extraction**

Modify `contentExtractor.js` `findRecurringThemes()` to attach context:

```javascript
// In contentExtractor.js, line 770-771, when building organic patterns:
for (const [phrase, data] of phraseCount) {
  if (data.sessions.size >= 2) {
    // NEW: Extract context from first matching session
    const firstSessionId = data.sessions.values().next().value;
    const firstSession = sessions.find(s => s.sessionId === firstSessionId);
    
    // Extract nouns/objects from goal/accomplishment to enrich pattern
    const enrichments = extractEnrichmentContext(firstSession, phrase);
    
    const enrichedPattern = enrichments.length > 0
      ? `${phrase} of ${enrichments[0]}`  // e.g., "generation of monthly reports"
      : phrase;
    
    const pattern = patternType + ': ' + enrichedPattern;
    results.push({
      pattern,
      sessions: Array.from(data.sessions),
      frequency: data.sessions.size,
      context: enrichments[0] || ''  // Store for later use
    });
  }
}

// NEW function:
function extractEnrichmentContext(session, baseWord) {
  if (!session) return [];
  
  const goal = session.extracted?.goal || '';
  const acc = session.extracted?.accomplished || '';
  
  const contexts = [];
  
  // Extract nouns/objects that the baseWord acts upon
  // e.g., "generation" + "monthly reports" → "generation of monthly reports"
  // Pattern: baseWord followed by action objects
  
  const goalWords = goal.toLowerCase().split(/\s+/);
  const accWords = acc.toLowerCase().split(/\s+/);
  
  // Look for 2-3 word phrases that could be objects
  const phrases = [];
  for (let i = 0; i < goalWords.length - 1; i++) {
    const phrase2 = goalWords.slice(i, i + 2).join(' ');
    if (phrase2.length >= 5 && !stopWords.has(goalWords[i])) {
      phrases.push(phrase2);
    }
  }
  for (let i = 0; i < accWords.length - 1; i++) {
    const phrase2 = accWords.slice(i, i + 2).join(' ');
    if (phrase2.length >= 5 && !stopWords.has(accWords[i])) {
      phrases.push(phrase2);
    }
  }
  
  // Find phrases that semantically connect to baseWord
  // e.g., "generation" + "reports" → "generation of reports"
  const connectedPhrases = phrases.filter(p => 
    isSemanticallyConnected(baseWord, p)
  );
  
  return connectedPhrases.slice(0, 2);
}

// Helper to determine semantic connection
function isSemanticallyConnected(action, object) {
  // Common action-object pairs
  const connections = {
    'generation': ['reports', 'summaries', 'files', 'output', 'content'],
    'validation': ['schema', 'config', 'tests', 'data', 'input'],
    'comparing': ['files', 'versions', 'paths', 'approaches'],
    'agent': ['execution', 'workflow', 'trigger', 'system'],
    'trigger': ['execution', 'agent', 'workflow', 'process']
  };
  
  const actionConnections = connections[action.toLowerCase()] || [];
  return actionConnections.some(conn => object.includes(conn));
}
```

**Option B: Add context in intelligenceDeduplicator during pattern mapping**

Keep pattern extraction simple, enrich during mapping:

```javascript
// In intelligenceDeduplicator.js, lines 316-328:
const patternSessions = allSessions
  .filter(s => s.goal || s.accomplished || s.discoveries)
  .map((s, i) => ({
    sessionId: s.sessionId || `session-${i}`,
    content: `## Goal\n${s.goal || ''}\n\n## Accomplished\n${s.accomplished || ''}\n\n## Discoveries\n${s.discoveries || ''}`
  }));

const patterns = patternSessions.length >= 2 ? findPatterns(patternSessions) : [];

// NEW: Enrich generic patterns
const enrichedPatterns = patterns.map(p => {
  const name = p.pattern.split(':').slice(1).join(':').trim() || p.pattern;
  const type = p.pattern.split(':')[0] || 'general';
  
  // If name is generic single word, enrich with session context
  if (isGenericPattern(name)) {
    const firstSession = patternSessions.find(s => p.sessions.includes(s.sessionId));
    const enrichment = extractContextFromSession(firstSession, name);
    return {
      ...p,
      enrichedName: enrichment || name
    };
  }
  
  return { ...p, enrichedName: name };
});

const recentPatterns = enrichedPatterns.slice(0, 5).map(p => ({
  type: p.pattern.split(':')[0] || 'general',
  name: p.enrichedName,  // Use enriched name
  frequency: p.frequency
}));
```

**Option C: Restrict keyword fallback to 2-3 word phrases only**

Simplest change - stop extracting single words:

```javascript
// In contentExtractor.js, lines 785-808:
// REMOVE single word extraction entirely

// Only extract 2-word and 3-word phrases
for (let i = 0; i < words.length - 1; i++) {
  const phrase2 = words.slice(i, i + 2).join(' ');
  if (!phraseCount.has(phrase2)) phraseCount.set(phrase2, { count: 0, sessions: new Set() });
  phraseCount.get(phrase2).count++;
  phraseCount.get(phrase2).sessions.add(id);
}

for (let i = 0; i < words.length - 2; i++) {
  const phrase3 = words.slice(i, i + 3).join(' ');
  if (!phraseCount.has(phrase3)) phraseCount.set(phrase3, { count: 0, sessions: new Set() });
  phraseCount.get(phrase3).count++;
  phraseCount.get(phrase3).sessions.add(id);
}

// Skip single word loop entirely
```

**Trade-off analysis:**

| Aspect | Option A (Enrich at extraction) | Option B (Enrich at mapping) | Option C (Restrict phrases) |
|--------|--------------------------------|------------------------------|-----------------------------|
| Complexity | HIGH - semantic matching | MEDIUM - context lookup | LOW - simple filter |
| Information quality | HIGH - specific context | MEDIUM - may miss some | MEDIUM - natural phrases |
| Maintainability | Needs semantic rules table | Straightforward | Very simple |
| Coverage | All patterns enriched | Only generic enriched | No single words |
| Recommendation | Good but complex | **Preferred** - targeted fix | Good as baseline |

**Recommended: Option B** - enrich only generic patterns during mapping. This targets the specific problem (single-word patterns) without changing the entire extraction pipeline. Simpler to implement and test.

---

## Implementation Approach

### Recommended Fix Sequence

1. **Fix Known Issues filtering first** (contentExtractor.js)
   - Add `isValidBugSymptom()` validation function
   - Update `extractBugs()` to filter malformed symptoms at source
   - Tests: Add unit tests for bug symptom validation

2. **Fix Accomplishment formatting second** (intelligenceDeduplicator.js)
   - Add `parseAccomplishmentBullets()` function
   - Update successful approaches extraction to use first bullet only
   - Tests: Add unit tests for bullet parsing

3. **Fix Pattern extraction third** (intelligenceDeduplicator.js)
   - Add `isGenericPattern()` helper
   - Add `extractContextFromSession()` helper
   - Update pattern mapping to enrich generic patterns
   - Tests: Add unit tests for pattern enrichment

### Files to Modify

| File | Changes | LOC Impact |
|------|---------|------------|
| `contentExtractor.js` | Add `isValidBugSymptom()` validation | +25 lines |
| `intelligenceDeduplicator.js` | Add bullet parsing + pattern enrichment | +80 lines |
| `intelligenceTemplate.js` | Minor - use enriched pattern name | +5 lines |
| `test/contentExtractor.test.js` | Add validation tests | +30 lines |
| `test/intelligenceDeduplicator.test.js` | Add bullet + enrichment tests | +40 lines |

### Risk Assessment

| Risk | Probability | Mitigation |
|------|-------------|------------|
| Filter too aggressive - misses real bugs | LOW | Unit tests with known bug patterns |
| Bullet parsing breaks on edge cases | MEDIUM | Handle multiple bullet formats, continuation lines |
| Pattern enrichment produces verbose output | LOW | Cap enrichment length at 80 chars |
| Performance impact from context lookup | LOW | Sessions already in memory, O(n) lookup |

---

## Test Cases

### Known Issues Filtering Tests

```javascript
describe('isValidBugSymptom', () => {
  it('rejects file:line references', () => {
    expect(isValidBugSymptom('js:756 - would crash')).toBe(false);
    expect(isValidBugSymptom('js:467-468 was not deduplicating')).toBe(false);
  });
  
  it('rejects truncated fragments', () => {
    expect(isValidBugSymptom('content (Revisar tudo)')).toBe(false);
    expect(isValidBugSymptom('e (Revisar tudo)')).toBe(false);
  });
  
  it('rejects standalone module names', () => {
    expect(isValidBugSymptom('md itself')).toBe(false);
    expect(isValidBugSymptom('contentExtractor')).toBe(false);
  });
  
  it('accepts valid bug descriptions', () => {
    expect(isValidBugSymptom('ISO Week calculation used Math.ceil incorrectly')).toBe(true);
    expect(isValidBugSymptom('Wiki-link prefix bug: full paths leaked into content')).toBe(true);
  });
});
```

### Accomplishment Parsing Tests

```javascript
describe('parseAccomplishmentBullets', () => {
  it('extracts first bullet from multiline', () => {
    const text = '✅ v1.6.0 Published: @devwellington/opencode-context-plugin@1.6.0\n✅ Obsidian Integration: Bundled plugin';
    const bullets = parseAccomplishmentBullets(text);
    expect(bullets[0]).toBe('v1.6.0 Published: @devwellington/opencode-context-plugin@1.6.0');
  });
  
  it('handles continuation lines', () => {
    const text = '- Fix token propagation\n  Stats from day now propagate to week';
    const bullets = parseAccomplishmentBullets(text);
    expect(bullets[0]).toContain('Fix token propagation');
    expect(bullets[0]).toContain('Stats from day');
  });
  
  it('skips low-quality bullets', () => {
    const text = '✅ TODO\n✅ Minor cleanup';
    const bullets = parseAccomplishmentBullets(text);
    expect(bullets.length).toBe(0);
  });
});
```

### Pattern Enrichment Tests

```javascript
describe('extractContextFromSession', () => {
  it('enriches "generation" with specific object', () => {
    const session = { extracted: { goal: 'Generate monthly reports from session data' } };
    const result = extractContextFromSession(session, 'generation');
    expect(result).toBe('generation of monthly reports');
  });
  
  it('enriches "validation" with schema context', () => {
    const session = { extracted: { accomplished: 'Validate config schema before processing' } };
    const result = extractContextFromSession(session, 'validation');
    expect(result).toBe('validation of config schema');
  });
  
  it('returns original if no enrichment found', () => {
    const session = { extracted: { goal: 'Run agent workflow' } };
    const result = extractContextFromSession(session, 'generation');
    expect(result).toBe('generation'); // No connection
  });
});
```

---

## Open Questions

1. **Should we preserve multiple bullets per session?**
   - Current recommendation: Use first bullet only
   - Alternative: Store top 3 bullets, display as sub-bullets
   - Decision needed: What level of detail is useful for intelligence?

2. **Should pattern enrichment use NLP?**
   - Current recommendation: Simple semantic mapping table
   - Alternative: Use LLM to extract context (more accurate but slower)
   - Decision needed: Is accuracy worth the latency?

3. **Should we track pattern evolution over time?**
   - Current: Pattern frequency only
   - Alternative: Track when patterns first appeared, last seen, context changes
   - Decision needed: Is temporal tracking valuable?

---

## Sources

### Primary (HIGH confidence)
- `src/agents/intelligenceDeduplicator.js` - Full code analysis (339 lines)
- `src/agents/intelligenceTemplate.js` - Template generation logic (240 lines)
- `src/modules/contentExtractor.js` - Extraction functions (1236 lines)
- `src/agents/intelligencePatterns.js` - Pattern definitions (113 lines)
- `.opencode/context-session/intelligence-learning.md` - Actual generated output (50 lines)

### Secondary (MEDIUM confidence)
- Session file analysis: `compact-2026-04-29T*.md` - Real session data structure
- Pattern matching observed in actual output

---

## Metadata

**Confidence breakdown:**
- Known Issues filtering: HIGH - root cause traced to specific regex bugs
- Accomplishment formatting: HIGH - truncation logic clearly identified
- Pattern extraction: MEDIUM - semantic enrichment approach needs validation

**Research date:** 2026-05-03
**Valid until:** 30 days (stable codebase, no pending refactors)