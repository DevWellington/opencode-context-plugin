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
  
  const typeConfig = [
    { key: 'goal_theme', label: 'Pinned Goal Themes' },
    { key: 'bug_pattern', label: 'Pinned Bug Patterns' },
    { key: 'file_pattern', label: 'Pinned File Patterns' },
    { key: 'general', label: 'Other Pinned Patterns', fallback: true }
  ];
  
  let content = '';
  
  for (const config of typeConfig) {
    const filtered = config.fallback
      ? patterns.filter(p => !['goal_theme', 'bug_pattern', 'file_pattern'].includes(p.type))
      : patterns.filter(p => p.type === config.key);
    
    if (filtered.length > 0) {
      content += `### ${config.label}\n`;
      for (const p of filtered) {
        content += `- ${p.pattern} (Sessions: ${p.sessionCount}, Last: ${p.lastSeen})\n`;
      }
      content += '\n';
    }
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
