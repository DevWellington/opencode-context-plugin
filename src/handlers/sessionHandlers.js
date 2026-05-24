import { createDebugLogger } from '../utils/debug.js';
import { getSessionGuidance } from '../modules/sessionGuidance.js';
import { saveContext } from '../modules/saveContext.js';
import { syncToRemote } from '../modules/remoteSync.js';
import { getConfig } from '../config.js';

const logger = createDebugLogger('context-plugin');

let _currentSessionId = null;
let _hasInjectedContext = false;
let _lastSession = null;

export function getCurrentSessionId() { return _currentSessionId; }
export function setCurrentSessionId(v) { _currentSessionId = v; }
export function getHasInjectedContext() { return _hasInjectedContext; }
export function setHasInjectedContext(v) { _hasInjectedContext = v; }
export function getLastSession() { return _lastSession; }
export function setLastSession(v) { _lastSession = v; }

export function resetSessionState() {
  _currentSessionId = null;
  _hasInjectedContext = false;
  _lastSession = null;
}

export function handleSessionCreated(event, directory) {
  _currentSessionId = event?.sessionId || event?.sessionID || event?.session?.id;
  _hasInjectedContext = false;
  _lastSession = null;
  logger(`[context-plugin] Session created: ${_currentSessionId}`);

  return getSessionGuidance(directory, event?.session || { id: _currentSessionId, ...event });
}

export function handleSessionUpdated(event) {
  const info = event?.properties?.info;
  if (info) {
    if (!_lastSession) _lastSession = {};
    Object.assign(_lastSession, info);
    logger(`[context-plugin] Session metadata updated`);
  }
}

export async function handleSessionEnd(directory, client, config) {
  logger(`[context-plugin] Session ending event - lastSession has ${_lastSession?.messages?.length || 0} messages, id: ${_lastSession?.id || _lastSession?.sessionID || 'none'}`);
  if (_lastSession) {
    try {
      await saveContext(directory, _lastSession, 'exit', client);
      logger(`[context-plugin] Exit context save completed successfully`);
    } catch (err) {
      logger(`[context-plugin] saveContext failed: ${err.message}`);
      console.error(`[context-plugin] saveContext failed: ${err.message}`);
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
      logger(`[Pre-Exit] Error stack: ${error.stack}`);
      console.error(`[context-plugin] Pre-exit compression failed: ${error.message}`);
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
      console.log(`[context-plugin] Pre-exit compression completed: ${result}`);
    }

    return result;
  } catch (error) {
    logger(`[Pre-Exit] Error during compression: ${error.message}`);
    console.error(`[context-plugin] Pre-exit compression error: ${error.message}`);
    return null;
  }
}

export async function handleSessionCompacted(directory, client) {
  const session = getLastSession();
  if (session) {
    await saveContext(directory, session, 'compact', client);
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