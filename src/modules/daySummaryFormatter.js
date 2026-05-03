import { isProtectedContent } from '../utils/patternMatcher.js';
import { countSessionTokens } from './tokenLimit.js';
import { getConfig, CONTEXT_SESSION_DIR } from '../config.js';
import { buildKeywords, extractKeywordsFromContent, addRelatedLinks, addKeywordNavigation } from '../agents/utils/linkBuilder.js';

/**
 * Parse session content into messages array with roles
 * Sessions are markdown with ## Goal, ## Accomplished, etc. sections
 * We extract the content between sections as "user" message equivalent
 * @param {string} sessionContent - Raw session content
 * @returns {Array<{content: string, role: string}>}
 */
export function parseSessionToMessages(sessionContent) {
  const messages = [];
  if (!sessionContent) return messages;

  const lines = sessionContent.split('\n');
  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    // Check for section headers (## Goal, ## Accomplished, etc.)
    const sectionMatch = line.match(/^##\s+(\w+)/i);
    if (sectionMatch) {
      // Save previous section content
      if (currentSection && currentContent.length > 0) {
        const content = currentContent.join('\n').trim();
        if (content) {
          messages.push({ content, role: 'user' });
        }
      }
      currentSection = sectionMatch[1].toLowerCase();
      currentContent = [];
      continue;
    }

    currentContent.push(line);
  }

  // Don't forget the last section
  if (currentSection && currentContent.length > 0) {
    const content = currentContent.join('\n').trim();
    if (content) {
      messages.push({ content, role: 'user' });
    }
  }

  return messages;
}

/**
 * Group discoveries by type based on keywords
 * @param {Array} discoveries - Array of {text, source} objects
 * @returns {Object} { typeName: [discoveries] }
 */
export function groupDiscoveriesByType(discoveries) {
  const groups = {
    'Bug Fixes': [],
    'New Features': [],
    'Refactoring': [],
    'Documentation': [],
    'Research': [],
    'Other': []
  };

  for (const disc of discoveries) {
    const text = disc.text.toLowerCase();
    let categorized = false;

    if (text.includes('fix') || text.includes('bug') || text.includes('error') || text.includes('crash')) {
      groups['Bug Fixes'].push(disc);
      categorized = true;
    } else if (text.includes('add') || text.includes('implement') || text.includes('create') || text.includes('new')) {
      groups['New Features'].push(disc);
      categorized = true;
    } else if (text.includes('refactor') || text.includes('improve') || text.includes('optimize') || text.includes('cleanup')) {
      groups['Refactoring'].push(disc);
      categorized = true;
    } else if (text.includes('docs') || text.includes('readme') || text.includes('comment') || text.includes('document')) {
      groups['Documentation'].push(disc);
      categorized = true;
    } else if (text.includes('research') || text.includes('investigate') || text.includes('explore') || text.includes('find')) {
      groups['Research'].push(disc);
      categorized = true;
    }

    if (!categorized) {
      groups['Other'].push(disc);
    }
  }

  Object.keys(groups).forEach(k => {
    if (groups[k].length === 0) delete groups[k];
  });

  return groups;
}

/**
 * Group files by project/module from path
 * @param {Set} files - Set of file paths
 * @returns {Object} { projectName: [files] }
 */
export function groupFilesByProject(files) {
  const groups = {};

  for (const file of files) {
    const parts = file.split('/');
    let project = 'other';

    if (parts.length >= 2) {
      if (parts[0] === 'src') {
        project = parts[1] || 'root';
      } else if (parts[0] === 'tests') {
        project = 'tests';
      } else {
        project = parts[0];
      }
    }

    if (!groups[project]) groups[project] = [];
    groups[project].push(file);
  }

  return groups;
}

/**
 * Extract key decisions from session content
 * @param {Array} sessionsData - Array of session data with extracted content
 * @returns {Array} Array of decision strings
 */
export function extractKeyDecisions(sessionsData) {
  const decisions = [];
  const decisionPatterns = [
    /(?:decided|decision|chose|choice|went with|opted).*/i,
    /(?:implemented|used|adopted).*(?:instead of|rather than|instead)/i,
    /(?:refactored|moved|renamed).*to.*from/i
  ];

  for (const session of sessionsData) {
    const text = session.extracted.accomplished || '';
    const goal = session.extracted.goal || '';

    for (const pattern of decisionPatterns) {
      const match = text.match(pattern) || goal.match(pattern);
      if (match) {
        const decision = match[0].slice(0, 100);
        if (!decisions.includes(decision)) {
          decisions.push(decision);
        }
      }
    }
  }

  return decisions.slice(0, 5);
}

/**
 * Format day content with structured sections
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {Array} sessionsData - Array from readDaySessions
 * @param {number} year - Year
 * @param {number} month - Month
 * @param {number} week - Week number
 * @param {string} allContent - Optional concatenated content for keyword extraction
 * @returns {string} Formatted day summary content
 */
export function formatDayContent(dateStr, sessionsData, year, month, week, allContent = '') {
  // Collect goals, accomplishments, discoveries, bugs, files
  const goals = [];
  const accomplishments = [];
  const discoveries = [];
  const bugs = [];
  const relevantFiles = new Set();

  for (const session of sessionsData) {
    // Filter protected content (mode: 'content')
    if (session.extracted.goal && session.extracted.goal.length > 5) {
      if (!isProtectedContent(session.extracted.goal)) {
        goals.push({ text: session.extracted.goal, source: session.filename });
      }
    }
    if (session.extracted.accomplished && session.extracted.accomplished.length > 5) {
      if (!isProtectedContent(session.extracted.accomplished)) {
        accomplishments.push({ text: session.extracted.accomplished, source: session.filename });
      }
    }
    if (session.extracted.discoveries && session.extracted.discoveries.length > 5) {
      if (!isProtectedContent(session.extracted.discoveries)) {
        discoveries.push({ text: session.extracted.discoveries, source: session.filename });
      }
    }
    // Bugs are checked for solution before adding, but also filter protected
    for (const bug of session.bugs) {
      if (bug.solution) {
        // Check if bug symptom or solution is protected
        const isBugProtected = isProtectedContent(bug.symptom) ||
                               (bug.solution && isProtectedContent(bug.solution));
        if (!isBugProtected) {
          bugs.push({ ...bug, source: session.filename });
        }
      }
    }
    // Relevant files - check each file path
    for (const file of session.extracted.relevantFiles || []) {
      if (file && !isProtectedContent(file)) {
        relevantFiles.add(file);
      }
    }
  }

  // Deduplicate by first 50 chars
  const seenGoals = new Set();
  const uniqueGoals = goals.filter(g => {
    const key = g.text.slice(0, 50).toLowerCase().trim();
    if (seenGoals.has(key) || key.length < 5) return false;
    seenGoals.add(key);
    return true;
  });

  const seenAccomplishments = new Set();
  const uniqueAccomplishments = accomplishments.filter(a => {
    const key = a.text.slice(0, 50).toLowerCase().trim();
    if (seenAccomplishments.has(key) || key.length < 5) return false;
    seenAccomplishments.add(key);
    return true;
  });

  const seenDiscoveries = new Set();
  const uniqueDiscoveries = discoveries.filter(d => {
    const key = d.text.slice(0, 50).toLowerCase().trim();
    if (seenDiscoveries.has(key) || key.length < 5) return false;
    seenDiscoveries.add(key);
    return true;
  });

  // Build content with frontmatter
  let content = `---
title: Day Summary - ${dateStr}
date: ${dateStr}
---

`;
  content += `# Day Summary\n\n`;
  content += `**Date:** ${dateStr}\n\n`;

  // Sessions overview
  const compactCount = sessionsData.filter(s => s.filename.startsWith('compact-')).length;
  const exitCount = sessionsData.filter(s => s.filename.startsWith('exit-')).length;
  content += `**Sessions:** ${sessionsData.length} (Compacts: ${compactCount}, Exits: ${exitCount})\n\n`;

  // Calculate token statistics for all sessions
  let totalTokens = 0;
  let userTokens = 0;
  let assistantTokens = 0;
  let systemTokens = 0;

  for (const session of sessionsData) {
    const messages = parseSessionToMessages(session.content);
    const sessionTokens = countSessionTokens(messages);
    totalTokens += sessionTokens.total;
    userTokens += sessionTokens.byRole.user;
    assistantTokens += sessionTokens.byRole.assistant;
    systemTokens += sessionTokens.byRole.system;
  }

  // Token Statistics section
  if (sessionsData.length > 0) {
    content += `### Session Statistics\n\n`;
    content += `- **Total tokens:** ${totalTokens}\n`;
    content += `- **User tokens:** ${userTokens} | **Assistant tokens:** ${assistantTokens} | **System tokens:** ${systemTokens}\n\n`;
  }

  // Goals section
  if (uniqueGoals.length > 0) {
    content += `## Goals\n\n`;
    for (const goal of uniqueGoals) {
      content += `- ${goal.text}\n`;
    }
    content += '\n';
  }

  // Accomplishments section
  if (uniqueAccomplishments.length > 0) {
    content += `## Accomplishments\n\n`;
    for (const acc of uniqueAccomplishments) {
      // Handle multiline content
      const lines = acc.text.split('\n').filter(l => l.trim());
      for (const line of lines) {
        // Strip existing bullet marker and any emoji
        let cleanLine = line.replace(/^[-*]\s*/, '').trim();
        cleanLine = cleanLine.replace(/^[✅💡🐛🔧📝🔍📦🚪]\s*/u, '');
        if (cleanLine.length > 0) {
          content += `- ${cleanLine}\n`;
        }
      }
    }
    content += '\n';
  }

  // Discoveries section
  if (uniqueDiscoveries.length > 0) {
    const groupedDiscoveries = groupDiscoveriesByType(uniqueDiscoveries);
    content += `## Discoveries\n\n`;
    for (const [type, items] of Object.entries(groupedDiscoveries)) {
      if (items.length > 0) {
        content += `### ${type}\n`;
        for (const disc of items) {
          let cleanText = disc.text.replace(/^[-*]\s*/, '').trim();
          cleanText = cleanText.replace(/^[✅💡🐛🔧📝🔍📦🚪]\s*/u, '');
          if (cleanText.length > 0) {
            content += `- ${cleanText}\n`;
          }
        }
        content += '\n';
      }
    }
  }

  // Bugs Fixed section
  if (bugs.length > 0) {
    content += `## Bugs Fixed\n\n`;
    for (const bug of bugs) {
      content += `- **${bug.symptom}:** ${bug.solution}\n`;
      if (bug.cause) {
        content += `  - Cause: ${bug.cause}\n`;
      }
    }
    content += '\n';
  }

  // Relevant Files section
  if (relevantFiles.size > 0) {
    const groupedFiles = groupFilesByProject(relevantFiles);
    content += `## Relevant Files\n\n`;
    for (const [project, files] of Object.entries(groupedFiles)) {
      content += `### ${project}\n`;
      for (const file of files) {
        content += `- ${file}\n`;
      }
      content += '\n';
    }
  }

  // Key Decisions section
  const keyDecisions = extractKeyDecisions(sessionsData);
  if (keyDecisions.length > 0) {
    content += `## Key Decisions\n\n`;
    for (const decision of keyDecisions) {
      content += `- ${decision}\n`;
    }
    content += '\n';
  }

  // Trend Note
  if (sessionsData.length >= 3) {
    const hasIncreasingGoals = uniqueGoals.length >= sessionsData.length * 0.5;
    const hasGoodQuality = uniqueAccomplishments.length >= sessionsData.length * 0.5;
    if (hasIncreasingGoals || hasGoodQuality) {
      content += `## Trend Note\n\n`;
      if (hasIncreasingGoals) {
        content += `- **Goal-setting trend:** This session shows active goal-setting behavior\n`;
      }
      if (hasGoodQuality) {
        content += `- **Productivity trend:** Good balance of accomplishments recorded\n`;
      }
      content += '\n';
    }
  }

  // Add Keywords (Obsidian) section with wiki-links
  if (allContent && year && month && week) {
    const contentKeywords = extractKeywordsFromContent(allContent, 15).filter(k =>
      !['summary', 'summaries', 'sessions', 'total', 'date', 'week', 'month', 'year',
        'context', 'report', 'reports', 'daily', 'weekly', 'monthly', 'annual', 'intelligence',
        'compact', 'exit', 'file', 'files', 'day', 'days', 'related', 'navigation',
        'keywords', 'obsidian', 'created', 'title', 'generated', 'section',
        'messages', 'user', 'assistant', 'content', 'session', 'sessions'].includes(k.toLowerCase())
    );

    if (contentKeywords.length > 0) {
      const config = getConfig();
      const keywords = buildKeywords({
        projectName: config.projectName || 'opencode-context-plugin',
        module: 'daySummary',
        keywords: contentKeywords
      });
      content += `## Keywords (Obsidian)\n\n`;
      content += `${keywords}\n\n`;
    }

    // Add Related section
    // Links are now relative to Vault Root for Obsidian compatibility
    content += addRelatedLinks([
      `${CONTEXT_SESSION_DIR}/intelligence-learning.md`,
      `${CONTEXT_SESSION_DIR}/${year}/${month}/${week}/week-summary.md`,
      `${CONTEXT_SESSION_DIR}/${year}/${month}/monthly-${year}-${month}.md`
    ]);

    // Add Navigation section
    content += addKeywordNavigation({ type: 'daily', year, month, week });
  }

  return content;
}
