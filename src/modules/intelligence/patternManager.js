import { extractPersistentPatterns } from '../contentExtractor.js';

export function preservePersistentPatterns(existingContent, newPatterns) {
  if (!existingContent || typeof existingContent !== 'string') {
    return {
      pinnedContent: formatPinnedPatterns([]),
      recentContent: formatRecentPatterns(newPatterns || [])
    };
  }

  const existingPatterns = extractPersistentPatterns(existingContent);
  const pinnedPatterns = existingPatterns.filter(p => p.pinned);
  const recentPatterns = newPatterns || [];
  const mergedPinned = mergePatterns(pinnedPatterns, recentPatterns);
  
  return {
    pinnedContent: formatPinnedPatterns(mergedPinned),
    recentContent: formatRecentPatterns(recentPatterns)
  };
}

export function mergePatterns(pinned, newPatterns) {
  if (!Array.isArray(pinned) || !Array.isArray(newPatterns)) {
    return Array.isArray(pinned) ? [...pinned] : [];
  }

  const result = [...pinned];
  
  for (const newPat of newPatterns) {
    if (!newPat || !newPat.pattern) continue;

    const matchIdx = result.findIndex(p => 
      p.pattern.toLowerCase() === newPat.pattern.toLowerCase()
    );
    if (matchIdx >= 0) {
      result[matchIdx].sessions.push(...(newPat.sessions || []));
      result[matchIdx].sessionCount = result[matchIdx].sessions.length;
      result[matchIdx].lastSeen = new Date().toISOString().split('T')[0];
      result[matchIdx].pinned = result[matchIdx].sessionCount >= 2;
    }
  }
  
  return result;
}

export function formatPinnedPatterns(patterns) {
  if (!patterns || patterns.length === 0) {
    return 'No pinned patterns yet (appear in 2+ sessions to pin)\n';
  }
  
  const byType = {
    goal_theme: patterns.filter(p => p.type === 'goal_theme'),
    bug_pattern: patterns.filter(p => p.type === 'bug_pattern'),
    file_pattern: patterns.filter(p => p.type === 'file_pattern'),
    general: patterns.filter(p => !['goal_theme', 'bug_pattern', 'file_pattern'].includes(p.type))
  };
  
  let content = '';
  
  if (byType.goal_theme.length > 0) {
    content += '### Pinned Goal Themes\n';
    for (const p of byType.goal_theme) {
      content += `- ${p.pattern} (Sessions: ${p.sessionCount}, Last: ${p.lastSeen})\n`;
    }
    content += '\n';
  }
  
  if (byType.bug_pattern.length > 0) {
    content += '### Pinned Bug Patterns\n';
    for (const p of byType.bug_pattern) {
      content += `- ${p.pattern} (Sessions: ${p.sessionCount}, Last: ${p.lastSeen})\n`;
    }
    content += '\n';
  }
  
  if (byType.file_pattern.length > 0) {
    content += '### Pinned File Patterns\n';
    for (const p of byType.file_pattern) {
      content += `- ${p.pattern} (Sessions: ${p.sessionCount}, Last: ${p.lastSeen})\n`;
    }
    content += '\n';
  }
  
  if (byType.general.length > 0) {
    content += '### Other Pinned Patterns\n';
    for (const p of byType.general) {
      content += `- ${p.pattern} (Sessions: ${p.sessionCount}, Last: ${p.lastSeen})\n`;
    }
    content += '\n';
  }
  
  return content;
}

export function formatRecentPatterns(patterns) {
  if (!patterns || patterns.length === 0) {
    return 'No recent patterns\n';
  }

  let content = '';
  for (const p of patterns.slice(0, 10)) {
    content += `- ${p.pattern} (Sessions: ${p.sessionCount})\n`;
  }

  return content;
}
