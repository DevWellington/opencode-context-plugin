import { listAvailableContexts, formatContextPreview, interactiveInject } from './injectPrompt.js';
import { INJECT } from '../constants.js';

const INJECT_REGEX = /(?<=^|\s)\/inject\b\s*((\d+)|--all|help|-h|--help)?\s*/;

/**
 * Parses an /inject command from user message content.
 * Extracts index, --all flag, help flags, and clean content without the command.
 * @param {string} content - Raw message content
 * @returns {{ index: number|null, isAll: boolean, isHelp: boolean, cleanContent: string }}
 */
export function parseInjectCommand(content) {
  const match = content.match(INJECT_REGEX);
  if (!match) return { index: null, isAll: false, isHelp: false, cleanContent: content };

  const arg = match[1];
  const index = match[2] ? parseInt(match[2], 10) : null;
  const isAll = arg === '--all';
  const isHelp = arg === 'help' || arg === '-h' || arg === '--help';
  const cleanContent = content.replace(INJECT_REGEX, '').trim();

  return { index, isAll, isHelp, cleanContent };
}

/**
 * Handles an /inject command: displays help, injects specific/all contexts, or shows preview.
 * Returns early with help text before calling listAvailableContexts when isHelp is true.
 * @param {{ content: string }} lastMsg - The last user message object (mutated in place)
 * @param {string} directory - Base directory for context lookup
 * @returns {Promise<{ content: string }>} The updated message object
 */
export async function handleInjectCommand(lastMsg, directory) {
  const { index, isAll, isHelp, cleanContent } = parseInjectCommand(lastMsg.content);

  lastMsg.content = cleanContent;

  if (isHelp) {
    lastMsg.content += '\n\n' +
      '## /inject Help\n\n' +
      '- `/inject` - Show available contexts with scores\n' +
      '- `/inject N` - Inject context #N from the list\n' +
      '- `/inject --all` - Inject all available contexts\n' +
      '- `/inject help` - Show this help message\n';
    return lastMsg;
  }

  const contexts = await listAvailableContexts({ messages: [lastMsg] }, {
    maxContexts: INJECT.MAX_CONTEXTS,
    maxTokens: INJECT.MAX_TOKENS,
    baseDir: directory
  });

  if (contexts.length === 0) {
    lastMsg.content += '\n\nNo relevant contexts found.';
    return lastMsg;
  }

  if (isAll) {
    const indices = contexts.map((_, i) => i);
    const injection = await interactiveInject({ messages: [lastMsg] }, indices, directory);
    lastMsg.content += '\n\n' + injection;
  } else if (index !== null) {
    const parsedIndex = parseInt(index, 10);
    if (!Number.isInteger(parsedIndex) || parsedIndex < 1 || parsedIndex > contexts.length) {
      lastMsg.content += '\n\nInvalid context index. Available: 1-' + contexts.length;
      return lastMsg;
    }
    const idx = parsedIndex - 1;
    if (idx >= 0 && idx < contexts.length) {
      const injection = await interactiveInject({ messages: [lastMsg] }, [idx], directory);
      lastMsg.content += '\n\n' + injection;
    } else {
      lastMsg.content += '\n\nInvalid context index. Available: 1-' + contexts.length;
    }
  } else {
    const preview = formatContextPreview(contexts);
    lastMsg.content += '\n\n' + preview + '\n\nUse `/inject N` to inject context #N, or `/inject --all` to get all';
  }

  return lastMsg;
}
