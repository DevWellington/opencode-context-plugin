import { createDebugLogger } from '../utils/debug.js';
import { getSessionGuidance } from '../modules/sessionGuidance.js';
import { saveContext } from '../modules/saveContext.js';
import { syncToRemote } from '../modules/remoteSync.js';
import { getConfig } from '../config.js';
import { sessionState } from './sessionState.js';
import { isDestroyed } from './lifecycle.js';

const logger = createDebugLogger('context-plugin');

export function getCurrentSessionId() { return sessionState.getCurrentSessionId(); }
export function getHasInjectedContext() { return sessionState.getHasInjectedContext(); }
export async function setCurrentSessionId(v) { await sessionState.setCurrentSessionId(v); }
export async function setHasInjectedContext(v) { await sessionState.setHasInjectedContext(v); }
export function getLastSession() { return sessionState.getLastSession(); }
export async function setLastSession(v) { await sessionState.setLastSession(v); }

export async function resetSessionState() {
  await sessionState.reset();
}

export async function handleSessionCreated(event, directory) {
  if (isDestroyed()) return;
  await sessionState.createSession(event);
  const currentSessionId = sessionState.getCurrentSessionId();
  logger(`[context-plugin] Session created: ${currentSessionId}`);

  return getSessionGuidance(directory, event?.session || { id: currentSessionId, ...event });
}

export async function handleSessionUpdated(event) {
  if (isDestroyed()) return;
  const info = event?.properties?.info;
  if (info) {
    await sessionState.updateSession(info);
    logger(`[context-plugin] Session metadata updated`);
  }
}

export async function handleSessionEnd(directory, client, config) {
  if (isDestroyed()) return;
  const clonedSession = await sessionState.getClonedSession();
  logger(`[context-plugin] Session ending event - lastSession has ${clonedSession?.messages?.length || 0} messages, id: ${clonedSession?.id || clonedSession?.sessionID || 'none'}`);
  if (clonedSession) {
    try {
      const saveResult = await saveContext(directory, clonedSession, 'exit', client);
      if (saveResult) {
        logger(`[context-plugin] Exit context save completed successfully`);
      } else {
        logger(`[context-plugin] Exit context save returned null`);
      }
    } catch (err) {
      logger(`[context-plugin] saveContext failed: ${err.message}`);
    }
  } else {
    logger(`[context-plugin] No lastSession available for exit save`);
  }

  if (config.remoteSync?.enabled) {
    syncToRemote(directory).catch(err => {
      logger(`[context-plugin] Remote sync failed (non-blocking): ${err.message}`);
    });
  }
}

export async function handleSessionIdle(directory, client, sessionId) {
  if (isDestroyed()) return;
  await triggerPreExitCompression(directory, client, sessionId);
}

async function triggerPreExitCompression(directory, client, sessionId) {
  try {
    logger(`[Pre-Exit] Triggering compression for session ${sessionId}`);
    logger(`[Pre-Exit] client type: ${typeof client}`);

    if (!client || !client.sessions) {
      logger(`[Pre-Exit] Client not available (client=${client}, client.sessions=${client?.sessions}), skipping compression`);
      return null;
    }

    let session;
    try {
      logger(`[Pre-Exit] Attempting to call client.sessions.get(${sessionId})`);
      session = await client.sessions.get(sessionId);
      logger(`[Pre-Exit] Session fetched successfully`);
    } catch (error) {
      logger(`[Pre-Exit] Failed to fetch session ${sessionId}: ${error.message}`);
      return null;
    }

    if (!session) {
      logger(`[Pre-Exit] Session ${sessionId} not found, skipping compression`);
      return null;
    }

    logger(`[Pre-Exit] Session fetched successfully, ${session.messages?.length || 0} messages`);

    const result = await saveContext(directory, session, 'exit', client);

    if (result) {
      logger(`[Pre-Exit] Compression completed: ${result}`);
    }

    return result;
  } catch (error) {
    logger(`[Pre-Exit] Error during compression: ${error.message}`);
    return null;
  }
}

export async function handleSessionCompacted(directory, client) {
  if (isDestroyed()) return;
  const session = await sessionState.getClonedSession();
  if (session) {
    const compactResult = await saveContext(directory, session, 'compact', client);
    if (compactResult) {
      logger(`[context-plugin] Compact save completed`);
    } else {
      logger(`[context-plugin] Compact save returned null`);
    }
  } else {
    logger('[context-plugin] No lastSession available for compact save');
  }

  const config = getConfig();
  if (config.remoteSync?.enabled) {
    syncToRemote(directory).catch(err => {
      logger(`[context-plugin] Remote sync failed (non-blocking): ${err.message}`);
    });
  }
}