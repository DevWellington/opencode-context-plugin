import { createDebugLogger } from '../../utils/debug.js';

const logger = createDebugLogger('content-extractor');

/**
 * Check if bug content includes a solution/fix
 * Uses word boundaries to avoid false positives like "no solution"
 */
function hasSolution(content) {
  if (!content || content.length === 0) return false;
  
  // Word boundary patterns to avoid false matches like "no solution"
  const positivePatterns = [
    /\bsolution\b/i,
    /\bfix\b/i,
    /\bresolution\b/i,
    /\bresolved\b/i,
    /\bworkaround\b/i,
    /\bprevent/i,
    /\bavoid\b/i
  ];

  // Negative patterns that indicate solution is NOT present
  const negativePatterns = [
    /no\s+(solution|fix|resolution)/i,
    /without\s+(solution|fix)/i,
    /unsolved/i,
    /unresolved/i
  ];

  const contentStr = content.join('\n');
  
  // Check for negative patterns first
  if (negativePatterns.some(pattern => pattern.test(contentStr))) {
    return false;
  }
  
  // Then check for positive patterns
  return positivePatterns.some(pattern => pattern.test(contentStr));
}

/**
 * Parse bug content into structured bug object
 */
function finishBug(bug, content) {
  const contentStr = content.join('\n');
  
  return {
    symptom: bug.symptom,
    cause: extractBugField(content, ['cause', 'reason', 'root cause', 'why']),
    solution: extractBugField(content, ['solution', 'fix', 'resolution', 'resolved by', 'workaround']),
    prevention: extractBugField(content, ['prevention', 'prevent', 'avoid', 'next time'])
  };
}

/**
 * Extract a named field from bug content
 */
function extractBugField(content, fieldNames) {
  const contentStr = content.join('\n');

  for (const fieldName of fieldNames) {
    // Check for **FieldName:** pattern (markdown bold with colons inside asterisks)
    // The colon is BEFORE the closing ** in "**Cause:**"
    const boldPattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, 'i');
    const boldMatch = contentStr.match(boldPattern);
    if (boldMatch) {
      return boldMatch[1].trim();
    }
    
    // Check for plain FieldName: pattern at start of line or after bullet
    const plainPattern = new RegExp(`(?:^|\\n)\\s*[*\\-]?\\s*${fieldName}:\\s*(.+)`, 'i');
    const plainMatch = contentStr.match(plainPattern);
    if (plainMatch) {
      return plainMatch[1].trim();
    }
  }

  return null;
}

/**
 * Validates that a bug symptom is not a malformed fragment or artifact.
 * @param {string} symptom - Candidate bug symptom text
 * @returns {boolean} - True if symptom is valid, false if malformed
 */
export function isValidBugSymptom(symptom) {
  if (!symptom || symptom.length < 10) return false;
  
  // Reject file:line references anywhere in the string (e.g., "js:756", "js:467-468")
  // Matches both at start AND embedded like "...in reportGenerator.js:756"
  if (/^[a-z]+:\d/.test(symptom)) return false;
  if (/\.[a-z]+:\d/.test(symptom)) return false;  // "reportGenerator.js:756"
  if (/[a-z]+:\d{3,}/.test(symptom)) return false;  // "js:756", "ts:1234" anywhere
  
  // Reject truncated fragments ending with "(Revisar tudo)" or similar
  if (/\(Revisar tudo\)$/.test(symptom)) return false;
  if (/\(review\)$/.test(symptom)) return false;
  
  // Reject standalone file/module names (session artifacts)
  if (/^(md|js|ts|contentExtractor|linkBuilder)\b/i.test(symptom)) return false;
  
  // Reject pure numbers or number+paren fragments
  if (/^\d+\s/.test(symptom)) return false;
  if (/^\d+\(/.test(symptom)) return false;  // "2 (Revisar tudo)"
  
  // Reject fragments starting with lowercase letter followed by space
  if (/^[a-z]\s/.test(symptom)) return false;  // "e (Revisar tudo)"
  
  // Reject artifacts like "md itself" or "md)" 
  if (/^md\s/i.test(symptom)) return false;
  if (/^md\)/i.test(symptom)) return false;
  
  return true;
}

/**
 * Extract ONLY bugs that were identified AND treated
 * Looks for "Bug:", "Error:", "Issue:" followed by solution/fix
 * Only returns bugs that have a resolution
 * 
 * @param {string} sessionContent - Raw session file content
 * @returns {Array} [{ symptom, cause, solution, prevention }]
 */
export function extractBugs(sessionContent) {
  if (!sessionContent || typeof sessionContent !== 'string') {
    return [];
  }

  const bugs = [];
  const lines = sessionContent.split('\n');
  
  let currentBug = null;
  let currentBugContent = [];
  let inBugSection = false;
  let sectionDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Detect bug-related headers
    const bugHeaderMatch = trimmedLine.match(/^(?:###\s+)?(?:Bug|Error|Issue):\s*(.*)/i);
    if (bugHeaderMatch) {
      // Save previous bug if complete
      if (currentBug && hasSolution(currentBugContent)) {
        bugs.push(finishBug(currentBug, currentBugContent));
      }
      
      // Extract and validate symptom
      const symptomCandidate = bugHeaderMatch[1] || '';
      if (!isValidBugSymptom(symptomCandidate)) {
        continue;  // Skip malformed bug headers
      }
      
      // Start new bug with validated symptom
      currentBug = { symptom: symptomCandidate, line: i };
      currentBugContent = [];
      inBugSection = true;
      sectionDepth = (trimmedLine.startsWith('###') ? 1 : 0);
      continue;
    }

    // Detect end of bug section (next ## header or significant content change)
    if (inBugSection) {
      const nextSectionMatch = trimmedLine.match(/^##\s+\w+/);
      if (nextSectionMatch) {
        inBugSection = false;
        if (currentBug && hasSolution(currentBugContent)) {
          bugs.push(finishBug(currentBug, currentBugContent));
        }
        currentBug = null;
        currentBugContent = [];
        continue;
      }

      // Also detect if we hit another Bug/Error/Issue
      const anotherBugMatch = trimmedLine.match(/^(?:###\s+)?(?:Bug|Error|Issue):/i);
      if (anotherBugMatch && !trimmedLine.startsWith('###')) {
        // This means we're exiting a sub-section
        if (currentBug && hasSolution(currentBugContent)) {
          bugs.push(finishBug(currentBug, currentBugContent));
        }
        currentBug = { symptom: anotherBugMatch[1] || '', line: i };
        currentBugContent = [];
        continue;
      }

      currentBugContent.push(line);
    }
  }

  // Don't forget last bug
  if (currentBug && hasSolution(currentBugContent)) {
    bugs.push(finishBug(currentBug, currentBugContent));
  }

  return bugs;
}
