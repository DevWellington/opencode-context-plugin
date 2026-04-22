/**
 * Constants for file paths - ensures consistency across all agents
 */
export const REPORTS_DIR = '.opencode/context-session/reports';
export const CONTEXT_SESSION_DIR = '.opencode/context-session';

export const REPORT_PATHS = {
  today: `${CONTEXT_SESSION_DIR}/daily-summary.md`,
  week: `${CONTEXT_SESSION_DIR}/YYYY/MM/WW/week-summary.md`,
  month: `${CONTEXT_SESSION_DIR}/YYYY/MM/monthly-YYYY-MM.md`,
  year: `${CONTEXT_SESSION_DIR}/YYYY/annual-YYYY.md`,
  intelligence: `${CONTEXT_SESSION_DIR}/intelligence-learning.md`
};

/**
 * Known report files for keyword linking
 */
export const KNOWN_REPORTS = {
  daily: 'daily-summary.md',
  week: (year, week) => `${CONTEXT_SESSION_DIR}/${year}/MM/${week}/week-summary.md`,
  monthly: (year, month) => `${REPORTS_DIR}/monthly-${year}-${month}.md`,
  annual: (year) => `${REPORTS_DIR}/annual-${year}.md`,
  intelligence: 'intelligence-learning.md'
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
    'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'it',
    'my', 'your', 'his', 'her', 'its', 'our', 'their', 'what', 'which', 'who',
    'whom', 'when', 'where', 'how', 'why', 'if', 'then', 'else', 'because'
  ]);

  // Extract words
  const words = content
    .toLowerCase()
    .replace(/[#*`\[\]]/g, ' ')
    .replace(/\d{4}-\d{2}-\d{2}/g, ' ')
    .replace(/\d{2}:\d{2}:\d{2}/g, ' ')
    .replace(/t\.\d{3,4}z/gi, ' ')
    .replace(/\|/g, ' ')
    .replace(/\.md$/g, ' ')
    .replace(/compact-/g, 'compact ')
    .replace(/exit-/g, 'exit ')
    .replace(/\(\)/g, ' ')
    .split(/\s+/)
    .filter(w => {
      if (w.length < 4) return false;
      if (stopWords.has(w)) return false;
      if (/^\d+$/.test(w)) return false;
      if (/[0-9]/.test(w)) return false;
      if (w === 'exit' || w === 'compact') return false;
      return true;
    });

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

/**
 * Generate keyword-based links section for Obsidian
 * Creates links based on meaningful keywords between reports
 * @param {object} options - { keywords, currentFile, year, month, week }
 * @returns {string} - Formatted keywords section with links
 */
export function generateKeywordLinks(options) {
  const { keywords = [], currentFile, year, month, week, maxLinks = 6 } = options;

  if (!keywords.length) return '';

  // Filter keywords - only include meaningful terms (not generic labels)
  const meaningfulKeywords = keywords.filter(k => {
    const lower = k.toLowerCase();
    // Exclude generic labels and noise
    const exclude = [
      'summary', 'summaries', 'sessions', 'total', 'date', 'week', 'month', 'year',
      'context', 'report', 'reports', 'daily', 'weekly', 'monthly', 'annual', 'intelligence',
      'compact:', 'exit:', 'file:', 'files:', 'day', 'days', 'related', 'navigation',
      'keywords', 'obsidian', 'created', 'title', 'generated', 'section',
      'messages', 'user', 'assistant', 'content', 'session', 'sessions',
      'total', 'exit', 'compact', 'with', 'from', 'were', 'been', 'have', 'has', 'had'
    ];
    return !exclude.includes(lower) && !lower.includes(':') && lower.length > 4;
  }).slice(0, maxLinks);

  if (meaningfulKeywords.length === 0) return '';

  const currentYear = year || new Date().getFullYear();
  const currentMonth = month || String(new Date().getMonth() + 1).padStart(2, '0');

  // Define target files with correct paths
  const targets = [
    { file: 'intelligence-learning.md', label: 'Intelligence' },
    { file: 'daily-summary.md', label: 'Daily' },
    { file: `${CONTEXT_SESSION_DIR}/${currentYear}/${currentMonth}/monthly-${currentYear}-${currentMonth}.md`, label: 'Monthly' },
    { file: `${CONTEXT_SESSION_DIR}/${currentYear}/annual-${currentYear}.md`, label: 'Annual' }
  ];

  // Filter out current file
  const validTargets = targets.filter(t => !currentFile || !t.file.includes(currentFile));

  // Create links for each meaningful keyword
  const links = meaningfulKeywords.flatMap(keyword =>
    validTargets.map(t => `[[${t.file}|${keyword}]]`)
  );

  return `\n## Keywords (Obsidian)\n${links.slice(0, maxLinks * 3).map(l => `  - ${l}`).join('\n')}\n`;
}

/**
 * Add keyword-based navigation links between reports
 * Creates bidirectional links based on hierarchical relationship
 * @param {object} context - { type, year, month, week }
 * @returns {string} - Navigation links section
 */
export function addKeywordNavigation(context) {
  const { type, year, month, week } = context;
  const links = [];
  const y = year || new Date().getFullYear();
  const m = month || String(new Date().getMonth() + 1).padStart(2, '0');
  const w = week || 'W17';

  // Hierarchical navigation based on current report type
  switch (type) {
    case 'daily':
      links.push({ text: 'Today', file: 'daily-summary.md' });
      links.push({ text: 'This Week', file: `${CONTEXT_SESSION_DIR}/${y}/${m}/${w}/week-summary.md` });
      links.push({ text: 'Intelligence', file: 'intelligence-learning.md' });
      break;
    case 'weekly':
      links.push({ text: 'Daily Summary', file: 'daily-summary.md' });
      links.push({ text: 'This Month', file: `${CONTEXT_SESSION_DIR}/${y}/${m}/monthly-${y}-${m}.md` });
      links.push({ text: 'Intelligence', file: 'intelligence-learning.md' });
      break;
    case 'monthly':
      links.push({ text: 'Weekly Summaries', file: `${CONTEXT_SESSION_DIR}/${y}/${m}/${w}/week-summary.md` });
      links.push({ text: 'Annual', file: `${CONTEXT_SESSION_DIR}/${y}/annual-${y}.md` });
      links.push({ text: 'Intelligence', file: 'intelligence-learning.md' });
      break;
    case 'annual':
      links.push({ text: 'January', file: `${CONTEXT_SESSION_DIR}/${y}/01/monthly-${y}-01.md` });
      links.push({ text: 'Intelligence', file: 'intelligence-learning.md' });
      break;
    case 'intelligence':
      links.push({ text: 'Daily', file: 'daily-summary.md' });
      links.push({ text: 'This Week', file: `${CONTEXT_SESSION_DIR}/${y}/${m}/${w}/week-summary.md` });
      links.push({ text: 'This Month', file: `${CONTEXT_SESSION_DIR}/${y}/${m}/monthly-${y}-${m}.md` });
      links.push({ text: 'Annual', file: `${CONTEXT_SESSION_DIR}/${y}/annual-${y}.md` });
      break;
  }

  if (links.length === 0) return '';

  const navLinks = links.map(l => `[[${l.file}|${l.text}]]`).join(' | ');
  return `\n## Navigation\n${navLinks}\n`;
}