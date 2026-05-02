import { loadState, saveState } from './state.js';
import { createDebugLogger } from '../utils/debug.js';
import { readIntelligenceLearning } from '../agents/readIntelligenceLearning.js';

const logger = createDebugLogger('session-guidance');

const SESSION_GUIDANCE_KEY = 'sessionGuidanceShown';

/**
 * Check if guidance was already shown for this session
 */
export async function wasGuidanceShown(baseDir, sessionId) {
  const state = await loadState(baseDir);
  return state.sessionGuidanceShown === sessionId;
}

/**
 * Mark guidance as shown for this session
 */
export async function markGuidanceShown(baseDir, sessionId) {
  const state = await loadState(baseDir);
  state.sessionGuidanceShown = sessionId;
  await saveState(baseDir, state);
  logger(`[session-guidance] Marked guidance as shown for session: ${sessionId}`);
}

/**
 * Generate guidance message for session start
 * Format: "Today I will work on [goal]. Previous: [context]. Blockers: [if any]"
 */
export async function generateSessionGuidance(baseDir, session) {
  const sessionId = session?.id || session?.sessionID;

  if (!sessionId) {
    logger('[session-guidance] No session ID, skipping guidance');
    return null;
  }

  if (await wasGuidanceShown(baseDir, sessionId)) {
    logger(`[session-guidance] Guidance already shown for session: ${sessionId}`);
    return null;
  }

  const config = await import('../config.js').then(m => m.getConfig());

  let goal = '';
  let previous = '';
  let blockers = '';

  if (session?.goal) {
    goal = session.goal;
  } else if (session?.messages?.length > 0) {
    const userMessages = session.messages.filter(m => m.role === 'user');
    if (userMessages.length > 0) {
      const firstMsg = userMessages[0].content || '';
      goal = firstMsg.slice(0, 100);
      if (firstMsg.length > 100) goal += '...';
    }
  }

  try {
    const intelligence = await readIntelligenceLearning(baseDir, { summary: true, maxLines: 50 });
    if (intelligence && typeof intelligence === 'string') {
      const lines = intelligence.split('\n').filter(l => l.trim());
      const recentSection = lines.find(l => l.includes('Recent') || l.includes('Sessions'));
      if (recentSection) {
        const idx = lines.indexOf(recentSection);
        const relevantLines = lines.slice(idx, idx + 5).join(' ');
        previous = relevantLines.slice(0, 150);
        if (relevantLines.length > 150) previous += '...';
      }
    }
  } catch {
    previous = 'No previous context available';
  }

  if (session?.blockers && session.blockers.length > 0) {
    blockers = session.blockers.join(', ');
  } else if (session?.properties?.blockers) {
    blockers = session.properties.blockers;
  }

  let guidance = `Today I will work on ${goal || 'unspecified goal'}.`;
  if (previous) {
    guidance += ` Previous: ${previous}.`;
  }
  if (blockers) {
    guidance += ` Blockers: ${blockers}.`;
  }

  await markGuidanceShown(baseDir, sessionId);

  logger(`[session-guidance] Generated guidance for session ${sessionId}: ${guidance.slice(0, 80)}...`);

  return guidance;
}

/**
 * Get guidance for session.created event
 * Returns the guidance string to inject into the prompt
 */
export async function getSessionGuidance(baseDir, session) {
  return generateSessionGuidance(baseDir, session);
}