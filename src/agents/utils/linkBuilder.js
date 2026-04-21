/**
 * Constants for file paths - ensures consistency across all agents
 */
export const REPORTS_DIR = '.opencode/context-session/reports';
export const CONTEXT_SESSION_DIR = '.opencode/context-session';

export const REPORT_PATHS = {
  today: `${CONTEXT_SESSION_DIR}/daily-summary.md`,
  weekly: `${REPORTS_DIR}/weekly-YYYY-WW.md`,
  monthly: `${REPORTS_DIR}/monthly-YYYY-MM.md`,
  annual: `${REPORTS_DIR}/annual-YYYY.md`,
  intelligence: `${CONTEXT_SESSION_DIR}/intelligence-learning.md`
};

/**
 * Extract keywords from session content (dynamic, not hardcoded)
 * Uses word frequency analysis to find meaningful terms
 * @param {string} content - Session content to analyze
 * @param {number} maxKeywords - Maximum keywords to extract
 * @returns {string[]} - Array of meaningful keywords
 */
export function extractKeywordsFromContent(content, maxKeywords = 20) {
  // Remove markdown syntax and common words
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'it'
  ]);

  // Extract words
  const words = content
    .toLowerCase()
    .replace(/[#*`\[\]]/g, '') // Remove markdown chars
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));

  // Count frequency
  const freq = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }

  // Get top keywords
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

/**
 * Build Obsidian-style wiki links and keywords
 * @param {object} context - { projectName, module, method, keywords: string[] }
 * @returns {string} - Formatted keyword string
 */
export function buildKeywords(context) {
  const { projectName, module, method, keywords = [] } = context;
  const allKeywords = [projectName, module, method, ...keywords];
  return [...new Set(allKeywords.filter(Boolean))].join(' | ');
}

/**
 * Format file header with keywords for Obsidian linking
 */
export function formatFileHeader(title, keywords) {
  return `---
title: ${title}
keywords: ${keywords}
created: ${new Date().toISOString()}
---

# ${title}

`;
}

/**
 * Add cross-links to related files
 */
export function addRelatedLinks(relatedFiles) {
  if (!relatedFiles?.length) return '';
  return `\n## Related\n${relatedFiles.map(f => `  - [[${f}]]`).join('\n')}\n`;
}