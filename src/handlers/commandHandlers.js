import { createDebugLogger } from '../utils/debug.js';

const logger = createDebugLogger('context-plugin');

export function handleCommandExecuteBefore(event) {
  const command = event?.command || event?.properties?.command || event?.properties?.name;
  if (command === '/compact' || command === 'compact') {
    logger('[context-plugin] /compact command detected');
  }
}