/**
 * Extract section content from summary files
 * Strips emojis and bullet markers to get clean text
 * Only captures lines that are "meaningful" content (not fragments)
 *
 * @param {string} content - File content to parse
 * @param {string} sectionHeading - Section header to look for (e.g., '## Goals')
 * @returns {string[]} Array of extracted text items
 */
export function extractSection(content, sectionHeading) {
  const lines = content.split('\n');
  const results = [];
  let inSection = false;

  // Stop-words to filter out fragments (single words, articles, prepositions)
  // Note: Keep 'note' as acceptable content in summaries (it's a valid technical term)
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'it', 'its', 'be', 'being', 'been', 'being',
    // REMOVED 'note', 'notes', 'note:' - these are valid content in summaries
    'no', 'not', 'none', 'any', 'all', 'each', 'every',
    'such', 'own', 'same', 'so', 'than', 'too', 'very',
    'just', 'also', 'now', 'then', 'here', 'there', 'when', 'where', 'why', 'how',
  ]);

  // Additional words that appear in "No files or directories are currently relevant" message
  const relevantFilesGarbageWords = new Set([
    'no', 'files', 'or', 'directories', 'are', 'currently', 'relevant', 
    'note', 'this', 'appears', 'to', 'be', 'the', 'start', 'of', 'a', 'new', 'conversation'
  ]);

  /**
   * Checks if a line is a valid file reference for Relevant Files section
   * @param {string} text - The text to check
   * @returns {boolean} - True if it looks like a legitimate file reference
   */
  function isRelevantFileLine(text) {
    // Return false if the line looks like fragments of the "No files..." message
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    
    // If it's a single word that's part of the garbage message, reject it
    if (words.length === 1 && relevantFilesGarbageWords.has(words[0])) {
      return false;
    }
    
    // If it's a short phrase that's likely part of the garbage message, reject it
    if (words.length <= 3 && words.every(w => relevantFilesGarbageWords.has(w))) {
      return false;
    }
    
    // Return true ONLY if the line contains actual file path patterns
    const hasFilePathPattern = /[\/\\]/.test(text) ||           // Contains path separators
                               /\.[a-zA-Z]{1,4}$/.test(text) ||  // Ends with file extension
                               /\*\.[a-zA-Z]{1,4}/.test(text) || // Contains wildcard pattern
                               /src\/|test\/|lib\/|dist\/|build\//.test(text) || // Common directories
                               /index\.|main\.|app\./.test(text); // Common file names
    
    // For longer content (20+ chars), be more lenient but still check for mixed content
    if (text.length >= 20) {
      // Must not be just natural language fragments
      const hasNaturalLanguagePattern = /\b(appears?|currently|relevant|conversation|start|new)\b/i.test(text);
      if (hasNaturalLanguagePattern) return false;
      
      // Should have some technical content indicators
      const hasTechnicalContent = /\b(src|test|config|index|main|app|component|util|service|api|js|ts|json|md|css|html)\b/i.test(text);
      return hasTechnicalContent;
    }
    
    return hasFilePathPattern;
  }

  function isMeaningful(text, isRelevantFiles = false) {
    // Must have at least 3 characters
    if (text.length < 3) return false;

    // Special handling for Relevant Files section
    if (isRelevantFiles) {
      return isRelevantFileLine(text);
    }

    // Split into words
    const words = text.split(/\s+/).filter(w => w.length > 0);

    // For single words, accept any word 3+ chars that's not a stop-word
    // (Short technical terms like "bug", "fix", "api" are meaningful in context)
    if (words.length === 1) {
      const word = words[0].toLowerCase();
      if (stopWords.has(word)) return false;
      return word.length >= 3;
    }

    // Multi-word content - must not be just a path
    if (text.match(/^[./\w-]+$/) && text.length < 20) return false;

    // Must have at least 1 content word that's not a stop-word
    const contentWords = words.filter(w => !stopWords.has(w.toLowerCase()));
    return contentWords.length >= 1;
  }

  // Determine if this is a Relevant Files section
  const isRelevantFiles = sectionHeading.toLowerCase().includes('relevant files');

  for (const line of lines) {
    if (line.startsWith(sectionHeading)) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (line.startsWith('## ') || line.startsWith('# ') || line.startsWith('### ')) {
        break;
      }
      if (line.trim().startsWith('- ')) {
        let text = line.trim().substring(2).trim();
        text = text.replace(/^#+\s*/, '');                 // Strip markdown headers
        text = text.replace(/^[✅💡🐛🔧📝🔍📦🚪][\s\u2013\-]*/u, ''); // Strip emoji
        text = text.replace(/^[-*]\s*/, '');
        text = text.replace(/\*\*/g, '');                   // Remove residual **
        text = text.replace(/\*\((truncated)\)\*/g, '');   // Strip truncation markers
        text = text.replace(/\(truncated\)/g, '');         // Strip remaining truncation
        text = text.replace(/\[\(truncated\)\]/g, '');     // Strip wiki-style truncation
        text = text.replace(/\btruncated\b/gi, '');        // Strip any remaining truncated

        // Only add if content is meaningful
        if (text.length > 0 && isMeaningful(text, isRelevantFiles)) {
          results.push(text);
        }
      }
    }
  }

  return results;
}
