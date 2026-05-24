import { createDebugLogger } from '../utils/debug.js';
import { getLastSession, setLastSession } from './sessionHandlers.js';

const logger = createDebugLogger('context-plugin');
const MAX_CONTENT_SIZE = 100000;

export function handleMessageUpdatedOrCreated(event) {
  const msgInfo = event?.properties?.info;
  const msgId = msgInfo?.id;

  if (msgId && msgInfo?.role) {
    if (!getLastSession()) setLastSession({ messages: [] });
    const session = getLastSession();
    if (!session.messages) session.messages = [];

    const existingIdx = session.messages.findIndex(m => m.id === msgId);
    if (existingIdx === -1) {
      session.messages.push({ ...msgInfo, content: '' });
      logger(`[context-plugin] Message added: ${session.messages.length} total`);
    } else {
      Object.assign(session.messages[existingIdx], msgInfo);
    }
  }
}

export function handleMessagePartDelta(event) {
  const msgId = event?.properties?.messageID;
  const delta = event?.properties?.delta;

  const session = getLastSession();
  if (msgId && delta && session?.messages) {
    const msg = session.messages.find(m => m.id === msgId);
    if (msg) {
      msg.content = (msg.content || '') + delta;
      if (msg.content.length > MAX_CONTENT_SIZE) {
        msg.content = msg.content.slice(0, MAX_CONTENT_SIZE);
        logger(`[context-plugin] Message ${msg.id} content truncated at ${MAX_CONTENT_SIZE} chars`);
      }
    }
  }
}

export function handleMessagePartUpdated(event) {
  const msgId = event?.properties?.part?.messageID || event?.properties?.messageID;
  const text = event?.properties?.part?.text;

  const session = getLastSession();
  if (msgId && text && session?.messages) {
    const msg = session.messages.find(m => m.id === msgId);
    if (msg && !msg.content) {
      msg.content = text;
      logger(`[context-plugin] Message content from part.updated: ${text.length} chars`);
    }
  }
}