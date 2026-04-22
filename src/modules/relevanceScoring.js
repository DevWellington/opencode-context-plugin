import { createDebugLogger } from '../utils/debug.js';

const logger = createDebugLogger('relevance-scoring');

/**
 * Score a context's relevance to current session using HEURISTICS
 * No external AI API calls - all processing goes through OpenCode
 * 
 * Scoring factors:
 * - Recency (40%): newer = more relevant
 * - Keyword match (35%): shared technical terms
 * - Session affinity (25%): similar project/session patterns
 */
export async function scoreContextRelevance(contextPath, currentSession) {
  const contextContent = await readContextFile(contextPath);
  const currentContent = currentSession.content || currentSession.title || '';
  
  const scores = {
    recency: calculateRecencyScore(contextPath),
    keywords: calculateKeywordScore(contextContent, currentContent),
    affinity: calculateAffinityScore(contextContent, currentSession)
  };
  
  const totalScore = (scores.recency * 0.40) + (scores.keywords * 0.35) + (scores.affinity * 0.25);
  
  logger(`[relevance] Path: ${contextPath} | Recency: ${scores.recency.toFixed(2)} | Keywords: ${scores.keywords.toFixed(2)} | Affinity: ${scores.affinity.toFixed(2)} | Total: ${totalScore.toFixed(2)}`);
  
  return Math.max(0, Math.min(1, totalScore));
}

/**
 * Recency scoring based on file naming pattern: exit-YYYY-MM-DDTHH-MM-SS.md
 * Recent files score higher
 */
function calculateRecencyScore(contextPath) {
  const filename = contextPath.split('/').pop();
  const match = filename.match(/exit-(\d{4}-\d{2}-\d{2})T(\d{2}-\d{2}-\d{2})/);
  
  if (!match) return 0.3;
  
  const [, dateStr, timeStr] = match;
  const fileDate = new Date(`${dateStr}T${timeStr.replace(/-/g, ':')}`);
  const now = new Date();
  const ageInHours = (now - fileDate) / (1000 * 60 * 60);
  
  if (ageInHours < 1) return 1.0;      // < 1 hour: 1.0
  if (ageInHours < 6) return 0.9;      // < 6 hours: 0.9
  if (ageInHours < 24) return 0.8;     // < 24 hours: 0.8
  if (ageInHours < 72) return 0.6;     // < 3 days: 0.6
  if (ageInHours < 168) return 0.4;    // < 7 days: 0.4
  if (ageInHours < 720) return 0.2;    // < 30 days: 0.2
  return 0.1;                           // older: 0.1
}

/**
 * Keyword matching based on technical terms
 * Count shared programming terms, frameworks, file extensions
 */
function calculateKeywordScore(contextContent, currentContent) {
  const technicalKeywords = extractTechnicalKeywords(contextContent + ' ' + currentContent);
  const contextWords = new Set(extractTechnicalKeywords(contextContent));
  const currentWords = new Set(extractTechnicalKeywords(currentContent));
  
  let matchCount = 0;
  for (const word of currentWords) {
    if (contextWords.has(word)) matchCount++;
  }
  
  if (currentWords.size === 0) return 0.5;
  return Math.min(1.0, matchCount / Math.max(5, currentWords.size));
}

/**
 * Session affinity based on project name and session patterns
 */
function calculateAffinityScore(contextContent, currentSession) {
  let score = 0.5;
  
  const projectName = currentSession.projectName || currentSession.slug || '';
  if (projectName && contextContent.includes(projectName)) {
    score += 0.3;
  }
  
  const sessionId = currentSession.sessionId || '';
  if (sessionId && contextContent.includes(sessionId)) {
    score += 0.2;
  }
  
  return Math.min(1.0, score);
}

/**
 * Extract technical keywords from text
 */
function extractTechnicalTerms(text) {
  const patterns = [
    /\b(?:import|export|const|let|var|function|class|interface|type|async|await|return|if|else|for|while)\b/g,
    /\b(?:react|vue|angular|svelte|nextjs|nuxt|express|fastify|koa)\b/gi,
    /\b(?:typescript|javascript|python|rust|go|java|cpp|csharp|ruby|php)\b/gi,
    /\b(?:postgres|mysql|mongodb|redis|elasticsearch|sqlite)\b/gi,
    /\b(?:\.js|\.ts|\.jsx|\.tsx|\.py|\.rs|\.go|\.java|\.cpp|\.cs)\b/g,
    /\b(?:api|cli|db|sql|http|websocket|grpc|rest)\b/gi,
    /\b(?:git|github|gitlab|bitbucket|cicd|docker|kubernetes|aws|azure|gcp)\b/gi,
  ];
  
  const terms = new Set();
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(m => terms.add(m.toLowerCase()));
    }
  }
  
  return terms;
}

function extractTechnicalKeywords(text) {
  const terms = extractTechnicalTerms(text);
  
  const folderMatch = text.match(/\.(\w{2,4})\//g);
  if (folderMatch) {
    folderMatch.forEach(m => {
      const ext = m.replace(/\\\//g, '').replace('.', '');
      if (['js', 'ts', 'jsx', 'tsx', 'py', 'rs', 'go', 'java', 'cpp', 'cs', 'md'].includes(ext)) {
        terms.add(ext);
      }
    });
  }
  
  return terms;
}

async function readContextFile(contextPath) {
  const fs = await import('fs/promises');
  return await fs.readFile(contextPath, 'utf-8');
}
