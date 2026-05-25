import { createDebugLogger } from '../utils/debug.js';
import { getLastSession, setLastSession } from './sessionHandlers.js';
import { sessionState } from './sessionState.js';
import { isDestroyed } from './lifecycle.js';

const logger = createDebugLogger('context-plugin');
const MAX_CONTENT_SIZE = 100000;

export async function handleMessageUpdatedOrCreated(event) {
  if (isDestroyed()) return;
  const msgInfo = event?.properties?.info;
  const msgId = msgInfo?.id;

  if (msgId && msgInfo?.role) {
    const result = await sessionState.addMessage(msgId, msgInfo.role);
    if (result.added) {
      logger(`[context-plugin] Message added: ${result.total} total`);
    }
    if (result.added === false) {
      await sessionState.updateMessage(msgId, msgInfo);
    }
  }
}

export async function handleMessagePartDelta(event) {
  if (isDestroyed()) return;
  const msgId = event?.properties?.messageID;
  const delta = event?.properties?.delta;

  if (msgId && delta) {
    const updated = await sessionState.appendDelta(msgId, delta);
    if (updated) {
      const msg = await sessionState.findMessage(msgId);
      if (msg && msg.content.length > MAX_CONTENT_SIZE) {
        msg.content = msg.content.slice(0, MAX_CONTENT_SIZE);
        logger(`[context-plugin] Message ${msgId} content truncated at ${MAX_CONTENT_SIZE} chars`);
      }
    }
  }
}

export async function handleMessagePartUpdated(event) {
  if (isDestroyed()) return;
  const msgId = event?.properties?.part?.messageID || event?.properties?.messageID;
  const text = event?.properties?.part?.text;

  if (msgId && text) {
    const updated = await sessionState.updateMessageContent(msgId, text);
    if (updated) {
      const msg = await sessionState.findMessage(msgId);
      logger(`[context-plugin] Message content from part.updated: ${msg?.content?.length || 0} chars`);
    }
  }
}
