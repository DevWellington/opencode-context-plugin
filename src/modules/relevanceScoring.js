import { getConfig } from '../config.js';
import { createDebugLogger } from '../utils/debug.js';

const logger = createDebugLogger('relevance-scoring');

// Scoring providers supported
const PROVIDERS = {
  openai: { model: 'gpt-4o-mini', apiKeyEnv: 'OPENAI_API_KEY' },
  anthropic: { model: 'claude-3-haiku', apiKeyEnv: 'ANTHROPIC_API_KEY' }
};

/**
 * Score a context's relevance to current session using LLM
 * @param {string} contextPath - Path to context file
 * @param {object} currentSession - Current session summary
 * @returns {Promise<number>} - Relevance score 0.0 to 1.0
 */
export async function scoreContextRelevance(contextPath, currentSession) {
  const config = getConfig();
  const { provider, model, apiKeyEnv } = config.injection.relevanceScoring;
  
  const apiKey = process.env[apiKeyEnv];
  if (!apiKey) {
    logger('[relevance] No API key found, returning 0.5 default');
    return 0.5;
  }

  const contextContent = await readContextFile(contextPath);
  const scoringPrompt = `Rate this context's relevance to the current session from 0.0 to 1.0.
Only respond with a number. 0.0 = completely irrelevant, 1.0 = highly relevant.

Current session: ${currentSession.slug} - ${currentSession.title}

Context to score: ${contextContent.slice(0, 2000)}`;

  // Call LLM API based on provider
  if (provider === 'openai') {
    return await scoreWithOpenAI(apiKey, model, scoringPrompt);
  } else if (provider === 'anthropic') {
    return await scoreWithAnthropic(apiKey, model, scoringPrompt);
  }
  
  return 0.5;
}

async function scoreWithOpenAI(apiKey, model, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 10,
      temperature: 0
    })
  });
  
  const data = await response.json();
  const score = parseFloat(data.choices[0].message.content.trim());
  return Math.max(0, Math.min(1, score));
}

async function scoreWithAnthropic(apiKey, model, prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 10,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  
  const data = await response.json();
  const score = parseFloat(data.content[0].text.trim());
  return Math.max(0, Math.min(1, score));
}

async function readContextFile(contextPath) {
  const fs = await import('fs/promises');
  return await fs.readFile(contextPath, 'utf-8');
}
