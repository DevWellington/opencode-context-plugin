/**
 * Tests for summaryUtils.js extractSection function
 */

import { extractSection } from '../src/utils/summaryUtils.js';

describe('extractSection', () => {
  const sampleContent = `# Day Summary

**Date:** 2026-04-29

## Goals

- Goal one
- Goal two

## Accomplishments

- ✅ Fix bug in auth
- 💡 Discovery about caching

## Discoveries

- 💡 New pattern for error handling

## Bugs Fixed

- **Auth bug:** Fixed by adding validation
  - Cause: Missing null check

## Relevant Files

- src/auth.js
- src/utils.js

## Keywords (Obsidian)

[[auth]] | [[cache]]

## Related

- [[intelligence-learning.md]]
`;

  it('should extract Goals section', () => {
    const results = extractSection(sampleContent, '## Goals');
    expect(results).toEqual([
      'Goal one',
      'Goal two'
    ]);
  });

  it('should extract Accomplishments with emojis stripped', () => {
    const results = extractSection(sampleContent, '## Accomplishments');
    expect(results).toEqual([
      'Fix bug in auth',
      'Discovery about caching'
    ]);
  });

  it('should extract Discoveries section', () => {
    const results = extractSection(sampleContent, '## Discoveries');
    expect(results).toEqual([
      'New pattern for error handling'
    ]);
  });

  it('should extract Relevant Files section', () => {
    const results = extractSection(sampleContent, '## Relevant Files');
    expect(results).toEqual([
      'src/auth.js',
      'src/utils.js'
    ]);
  });

  it('should return empty array for non-existent section', () => {
    const results = extractSection(sampleContent, '## NonExistent');
    expect(results).toEqual([]);
  });

  it('should stop at next ## section', () => {
    const results = extractSection(sampleContent, '## Goals');
    // Should not include accomplishments
    expect(results).not.toContain('Fix bug in auth');
    expect(results.length).toBe(2);
  });

  it('should stop at # section (h1)', () => {
    const h1Content = `# Title

## Section A
- Item 1

# Another Title
- Should not include
`;
    const results = extractSection(h1Content, '## Section A');
    expect(results).toEqual(['Item 1']);
  });

  it('should stop at ### sub-header and exclude it from results', () => {
    const h3Content = `## Discoveries
- First discovery
### Architecture
- Sub point
## Next Section
`;
    const results = extractSection(h3Content, '## Discoveries');
    expect(results).toContain('First discovery');
    expect(results).not.toContain('Architecture');
    expect(results).not.toContain('Sub point');
  });

  it('should strip various emojis', () => {
    const emojiContent = `## Test
- ✅ Done
- 💡 Idea
- 🐛 Bug
- 🔧 Fix
- 📝 Note
- 🔍 Search
- 📦 Package
- 🚪 Door
`;
    const results = extractSection(emojiContent, '## Test');
    expect(results).toEqual([
      'Done',
      'Idea',
      'Bug',
      'Fix',
      'Note',
      'Search',
      'Package',
      'Door'
    ]);
  });

  it('should handle emojis with dashes', () => {
    const dashContent = `## Test
- ✅ - Item with dash
- 💡– Another item
`;
    const results = extractSection(dashContent, '## Test');
    expect(results).toEqual([
      'Item with dash',
      'Another item'
    ]);
  });

  it('should handle empty content', () => {
    const results = extractSection('', '## Goals');
    expect(results).toEqual([]);
  });

  it('should ignore lines without bullet markers', () => {
    const mixedContent = `## Test
- First item
Some prose text
- Second item
`;
    const results = extractSection(mixedContent, '## Test');
    expect(results).toEqual([
      'First item',
      'Second item'
    ]);
  });

  it('should not include empty items', () => {
    const emptyContent = `## Test
- 
- Valid item
-   
`;
    const results = extractSection(emptyContent, '## Test');
    expect(results).toEqual(['Valid item']);
  });

  it('should handle content with no sections', () => {
    const noSections = 'Just plain text\nwithout any sections\n';
    const results = extractSection(noSections, '## Goals');
    expect(results).toEqual([]);
  });

  it('should filter out garbage from Relevant Files section', () => {
    const garbageContent = `## Relevant Files

- No
- files
- or
- directories
- are
- currently
- relevant
- Note
- This
- appears
- to
- be
- the
- start
- of
- a
- new
- conversation
- src/auth.js
- test/utils.test.js
- *.config.js
`;
    const results = extractSection(garbageContent, '## Relevant Files');
    expect(results).toEqual([
      'src/auth.js',
      'test/utils.test.js',
      '.config.js'
    ]);
    // Should NOT contain garbage words
    expect(results).not.toContain('No');
    expect(results).not.toContain('files');
    expect(results).not.toContain('directories');
    expect(results).not.toContain('Note');
    expect(results).not.toContain('This');
    expect(results).not.toContain('appears');
    expect(results).not.toContain('conversation');
  });

  it('should still allow meaningful content in non-Relevant Files sections', () => {
    const generalContent = `## Goals

- No
- This
- Fix authentication bug
- Add new feature
`;
    const results = extractSection(generalContent, '## Goals');
    expect(results).toContain('Fix authentication bug');
    expect(results).toContain('Add new feature');
    // In non-file sections, single meaningful words should still be allowed
    // (but stop-words should be filtered out)
    expect(results).not.toContain('No'); // stop-word
  });
});
