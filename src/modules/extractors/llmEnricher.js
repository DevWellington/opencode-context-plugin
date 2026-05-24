import { createDebugLogger } from '../../utils/debug.js';
import { withTimeout } from '../../utils/fileUtils.js';
import { extractSessionContent } from './sectionExtractor.js';

const logger = createDebugLogger('content-extractor');

/**
 * Call OpenCode internal AI using sessions.prompt()
 * @param {Object} client - OpenCode client instance
 * @param {string} sessionContent - Session content to analyze
 * @param {string} prompt - Additional prompt context
 * @returns {Promise<string|null>} JSON response content or null on failure
 */
async function callOpenCodeAI(client, sessionContent, prompt) {
  if (!client?.sessions?.prompt) {
    logger('[infer] No OpenCode client available, skipping LLM inference');
    return null;
  }

  try {
    const response = await withTimeout(
      client.sessions.prompt('context-plugin-inference', {
        messages: [
          {
            role: 'user',
            content: `Analyze this session content and extract structured information.
Return a JSON object with these fields: goal, accomplished, discoveries, confidence.
Each confidence should be 0-1.

Session content:
${sessionContent.slice(0, 2000)}

${prompt}

Return only valid JSON, no markdown formatting.`
          }
        ],
        model: 'auto'
      }),
      30000,
      'callOpenCodeAI'
    );

    return response.content;
  } catch (error) {
    logger(`[infer] OpenCode AI inference failed: ${error.message}`);
    return null;
  }
}

/**
 * Build prompt for LLM inference
 */
function buildInferencePrompt(sessionContent, extracted) {
  let prompt = 'Analyze this session content and extract structured information.\n\n';
  
  // Include first 1500 chars of session
  const preview = sessionContent.slice(0, 1500);
  prompt += `Session content:\n${preview}\n\n`;
  
  // Add hints about what's missing
  if (!extracted.goal) {
    prompt += 'Missing: Goal (what was the session trying to accomplish?)\n';
  }
  if (!extracted.accomplished) {
    prompt += 'Missing: Accomplished (what was successfully completed?)\n';
  }
  if (!extracted.discoveries) {
    prompt += 'Missing: Discoveries (what was learned or found?)\n';
  }
  
  prompt += '\nReturn JSON with goal, accomplished, discoveries, and confidence scores.';
  
  return prompt;
}

/**
 * Use LLM inference to fill missing structured data
 * Only call when structured fields are absent
 * 
 * @param {string} sessionContent - Raw session content
 * @param {Object} opencodeClient - OpenCode client instance (optional)
 * @returns {Promise<Object>} { goal, accomplished, discoveries } with confidence scores
 */
export async function inferMissingFields(sessionContent, opencodeClient = null) {
  // Only infer if we have content
  if (!sessionContent || typeof sessionContent !== 'string') {
    return { goal: null, accomplished: null, discoveries: null, confidence: { goal: 0, accomplished: 0, discoveries: 0 } };
  }

  // First try basic extraction
  const extracted = extractSessionContent(sessionContent);
  
  // Check if we already have structured data
  const hasGoal = extracted.goal && extracted.goal.length > 10;
  const hasAccomplished = extracted.accomplished && extracted.accomplished.length > 10;
  const hasDiscoveries = extracted.discoveries && extracted.discoveries.length > 10;

  // If we have most data, skip LLM inference
  const fieldsPresent = [hasGoal, hasAccomplished, hasDiscoveries].filter(Boolean).length;
  if (fieldsPresent >= 2) {
    return {
      goal: extracted.goal,
      accomplished: extracted.accomplished,
      discoveries: extracted.discoveries,
      confidence: {
        goal: hasGoal ? 0.9 : 0,
        accomplished: hasAccomplished ? 0.9 : 0,
        discoveries: hasDiscoveries ? 0.9 : 0
      }
    };
  }

  // Need LLM inference - check for OpenCode client
  if (!opencodeClient?.sessions?.prompt) {
    logger('[infer] No OpenCode client available, returning partial extraction');
    return {
      goal: extracted.goal,
      accomplished: extracted.accomplished,
      discoveries: extracted.discoveries,
      confidence: {
        goal: hasGoal ? 0.9 : 0,
        accomplished: hasAccomplished ? 0.9 : 0,
        discoveries: hasDiscoveries ? 0.9 : 0
      }
    };
  }

  try {
    // Build prompt for inference
    const prompt = buildInferencePrompt(sessionContent, extracted);
    
    const content = await callOpenCodeAI(opencodeClient, sessionContent, prompt);
    
    if (!content) {
      throw new Error('Empty response from OpenCode AI');
    }

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response');
    }

    const inferred = JSON.parse(jsonMatch[0]);
    
    // Merge with extracted data, preferring LLM inference for missing fields
    return {
      goal: inferred.goal || extracted.goal,
      accomplished: inferred.accomplished || extracted.accomplished,
      discoveries: inferred.discoveries || extracted.discoveries,
      confidence: {
        goal: inferred.confidence?.goal ?? (hasGoal ? 0.9 : 0.5),
        accomplished: inferred.confidence?.accomplished ?? (hasAccomplished ? 0.9 : 0.5),
        discoveries: inferred.confidence?.discoveries ?? (hasDiscoveries ? 0.9 : 0.5)
      }
    };
  } catch (error) {
    logger(`[infer] LLM inference failed: ${error.message}`);
    // Return partial extraction on error
    return {
      goal: extracted.goal,
      accomplished: extracted.accomplished,
      discoveries: extracted.discoveries,
      confidence: {
        goal: hasGoal ? 0.9 : 0,
        accomplished: hasAccomplished ? 0.9 : 0,
        discoveries: hasDiscoveries ? 0.9 : 0
      }
    };
  }
}
