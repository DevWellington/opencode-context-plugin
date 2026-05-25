export function stripFieldHeader(value, header) {
  if (!value || typeof value !== 'string') return value || '';
  if (!header || typeof header !== 'string') return value;
  const pattern = new RegExp(`^##\\s+${header}\\s*\\n`, 'i');
  return value.replace(pattern, '');
}

export function cleanOldLinks(content) {
  if (!content) return '';
  return content
    .replace(/\[\[reports\/[^\]]+\]\]/g, '')
    .replace(/\[\[\.opencode\/context-session\/reports\/[^\]]+\]\]/g, '')
    .replace(/\*\(truncated\)\*/g, '')
    .replace(/\[truncated\]/g, '')
    .trim();
}

export function cleanAccomplishmentText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\n+/g, ' ')
    .replace(/[#*`\[\]]/g, '')
    .replace(/\d+\.\d+:/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
