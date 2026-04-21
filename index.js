import fs from "fs/promises";
import path from "path";

import { loadConfig, getConfig, LOG_FILE, CONTEXT_SESSION_DIR } from './src/config.js';
import { createDebugLogger, debugLog } from './src/utils/debug.js';
import { saveContext } from './src/modules/saveContext.js';
import { initializeIntelligenceLearning } from './src/modules/intelligence.js';
import { getRelevantContexts, formatForInjection } from './src/modules/contextInjector.js';

const logger = createDebugLogger('context-plugin');

// Keep constants for migration backward compatibility
const OLD_CONTEXTOS_DIR = '.opencode/contextos';

// Legacy debugLog for backward compatibility
function debugLogLegacy(message) {
  logger(message);
}

let currentSessionId = null;
let hasInjectedContext = false;
let lastSession = null;

async function loadPreviousContexts(directory, limit = 5) {
  try {
    const ctxDir = path.join(directory, CONTEXT_SESSION_DIR);
    try {
      await fs.access(ctxDir);
    } catch {
      return [];
    }
    
    const files = await fs.readdir(ctxDir);
    const mdFiles = files
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, limit);
    
    const contexts = await Promise.all(
      mdFiles.map(async (file) => {
        const filepath = path.join(ctxDir, file);
        const content = await fs.readFile(filepath, 'utf-8');
        return { file, content };
      })
    );
    
    logger(`[context-plugin] Loaded ${contexts.length} previous contexts`);
    return contexts;
  } catch (error) {
    logger(`[context-plugin] Error loading contexts: ${error.message}`);
    return [];
  }
}

async function migrateContextFiles(directory) {
  const oldDir = path.join(directory, OLD_CONTEXTOS_DIR);
  const newDir = path.join(directory, CONTEXT_SESSION_DIR);
  
  try {
    // Check if old directory exists
    try {
      await fs.access(oldDir);
    } catch {
      // Old directory doesn't exist, no migration needed
      return;
    }
    
    // Check if new directory already exists (migration already done)
    try {
      await fs.access(newDir);
      logger(`[context-plugin] New directory already exists, skipping migration`);
      return;
    } catch {
      // New directory doesn't exist, proceed with migration
    }
    
    logger(`[context-plugin] Starting migration from ${oldDir} to ${newDir}`);
    
    // Create new directory
    await fs.mkdir(newDir, { recursive: true });
    
    // Read old directory contents
    const oldFiles = await fs.readdir(oldDir);
    const mdFiles = oldFiles.filter(f => f.endsWith('.md'));
    
    let migratedCount = 0;
    for (const file of mdFiles) {
      const oldPath = path.join(oldDir, file);
      // Rename saida- to exit-
      const newFileName = file.replace(/^saida-/, 'exit-');
      const newPath = path.join(newDir, newFileName);
      
      try {
        await fs.rename(oldPath, newPath);
        migratedCount++;
        logger(`[context-plugin] Migrated: ${file} → ${newFileName}`);
      } catch (error) {
        logger(`[context-plugin] Failed to migrate ${file}: ${error.message}`);
      }
    }
    
    // Rename old directory to .deprecated
    const deprecatedDir = path.join(directory, '.opencode/.deprecated');
    await fs.rename(oldDir, deprecatedDir);
    
    logger(`[context-plugin] Migration complete: ${migratedCount}/${mdFiles.length} files migrated`);
    console.log(`[context-plugin] Migrated ${migratedCount} context files to new structure`);
  } catch (error) {
    logger(`[context-plugin] Migration error: ${error.message}`);
    // Don't block plugin initialization on migration failure
  }
}

function buildContextInjection(contexts) {
  if (contexts.length === 0) return '';

  let injection = `\n\n---\n## Previous Session Contexts\n\n`;
  injection += `*The following contexts from previous sessions are available for reference:*\n\n`;

  contexts.forEach(ctx => {
    injection += `### From: ${ctx.file}\n`;
    injection += `${ctx.content}\n\n`;
    injection += `---\n\n`;
  });

  return injection;
}

/**
 * Auto-inject relevant contexts at session start
 * Called from OpenCode plugin lifecycle hook
 */
export async function autoInjectContexts(session) {
  const config = getConfig();

  if (!config.injection?.enabled || !config.injection?.autoInject) {
    return null;
  }

  try {
    const scoredContexts = await getRelevantContexts(session, {
      maxContexts: config.injection.maxContexts,
      maxTokens: config.injection.maxTokens
    });

    if (scoredContexts.length === 0) {
      return null;
    }

    const injected = formatForInjection(scoredContexts);
    logger(`[context-plugin] Auto-injected ${scoredContexts.length} contexts`);

    return injected;
  } catch (error) {
    logger(`[context-plugin] Auto-inject failed: ${error.message}`);
    return null;
  }
}

/**
 * Hook registration for OpenCode plugin API
 * This registers the plugin with OpenCode's lifecycle hooks
 */
export function registerPluginHooks(opencodeApi) {
  // Session start - auto inject if enabled
  opencodeApi.onSessionStart(async (session) => {
    const injected = await autoInjectContexts(session);
    if (injected) {
      opencodeApi.addToPrompt(injected);
    }
  });

  // Session end - save context (existing behavior)
  opencodeApi.onSessionEnd(async (session) => {
    const { saveContext } = await import('./src/modules/saveContext.js');
    await saveContext(session.directory || session.directory, session, 'exit');
  });
}

// V2 Plugin class that opencode will instantiate
class ContextPlugin {
  constructor(input) {
    this.directory = input?.directory;
    this.client = input?.client;
    
    // Load configuration at plugin initialization
    if (this.directory) {
      loadConfig(this.directory).then(config => {
        logger(`[context-plugin] Configuration loaded: debug=${config.debug}, debounceMs=${config.debounceMs}`);
      });
    }
    
    logger(`[context-plugin] ContextPlugin instantiated for: ${this.directory}`);
  }

  async event(eventInput) {
    logger(`[context-plugin] RAW EVENT received: ${JSON.stringify(eventInput)}`);
    const event = eventInput?.event || eventInput;
    const eventType = event?.type;

    logger(`[context-plugin] Parsed eventType: ${eventType}`);
    if (!eventType) return;

    if (eventType === "session.created") {
      currentSessionId = event?.sessionId || event?.sessionID || event?.session?.id;
      hasInjectedContext = false;
      lastSession = null;
      logger(`[context-plugin] Session created: ${currentSessionId}`);
    }

    if (eventType === "session.updated") {
      const info = event?.properties?.info;
      if (info) {
        if (!lastSession) lastSession = {};
        Object.assign(lastSession, info);
        logger(`[context-plugin] Session metadata updated`);
      }
    }

    if (eventType === "message.updated" || eventType === "message.created") {
      const msgInfo = event?.properties?.info;
      const msgId = msgInfo?.id;

      if (msgId && msgInfo?.role) {
        if (!lastSession) lastSession = { messages: [] };
        if (!lastSession.messages) lastSession.messages = [];

        const existingIdx = lastSession.messages.findIndex(m => m.id === msgId);
        if (existingIdx === -1) {
          lastSession.messages.push({ ...msgInfo, content: '' });
          logger(`[context-plugin] Message added: ${lastSession.messages.length} total`);
        } else {
          Object.assign(lastSession.messages[existingIdx], msgInfo);
        }
      }
    }

    if (eventType === "message.part.delta") {
      const msgId = event?.properties?.messageID;
      const delta = event?.properties?.delta;

      if (msgId && delta && lastSession?.messages) {
        const msg = lastSession.messages.find(m => m.id === msgId);
        if (msg) {
          msg.content = (msg.content || '') + delta;
        }
      }
    }

    if (eventType === "message.part.updated") {
      const msgId = event?.properties?.part?.messageID || event?.properties?.messageID;
      const text = event?.properties?.part?.text;

      if (msgId && text && lastSession?.messages) {
        const msg = lastSession.messages.find(m => m.id === msgId);
        if (msg && !msg.content) {
          msg.content = text;
          logger(`[context-plugin] Message content from part.updated: ${text.length} chars`);
        }
      }
    }

    if (eventType === "command.execute.before") {
      const command = event?.command || event?.properties?.command || event?.properties?.name;
      if (command === '/compact' || command === 'compact') {
        logger('[context-plugin] /compact command detected');
      }
    }

    if (eventType === "session.compacted" || eventType === "experimental.compaction.autocontinue") {
      logger('[context-plugin] session.compacted event received - saving context');
      if (lastSession) {
        await saveContext(this.directory, lastSession, 'compact');
      } else {
        logger('[context-plugin] No lastSession available for compact save');
      }
    }

    if (eventType === "session.end" || eventType === "server.instance.disposed") {
      logger(`[context-plugin] Session ending event - lastSession has ${lastSession?.messages?.length || 0} messages, id: ${lastSession?.id || lastSession?.sessionID || 'none'}`);
      if (lastSession) {
        try {
          await saveContext(this.directory, lastSession, 'exit');
          logger(`[context-plugin] Exit context save completed successfully`);
        } catch (err) {
          logger(`[context-plugin] saveContext failed: ${err.message}`);
          console.error(`[context-plugin] saveContext failed: ${err.message}`);
        }
      } else {
        logger(`[context-plugin] No lastSession available for exit save`);
      }
    }

    if (eventType === "session.idle" || eventType === "session.deleted") {
      const sessionId = event?.properties?.sessionID || event?.sessionId || currentSessionId;
      if (sessionId) {
        logger(`[Pre-Exit] Session ${sessionId} ending, triggering compression...`);
        await this.triggerPreExitCompression(sessionId);
      }
    }
  }

  async triggerPreExitCompression(sessionId) {
    try {
      logger(`[Pre-Exit] Triggering compression for session ${sessionId}`);
      
      // Fetch session data using client from closure
      let session;
      try {
        session = await this.client.sessions.get(sessionId);
      } catch (error) {
        logger(`[Pre-Exit] Failed to fetch session ${sessionId}: ${error.message}`);
        console.error(`[context-plugin] Pre-exit compression failed: ${error.message}`);
        return null;
      }
      
      if (!session) {
        logger(`[Pre-Exit] Session ${sessionId} not found, skipping compression`);
        return null;
      }
      
      logger(`[Pre-Exit] Session fetched successfully, ${session.messages?.length || 0} messages`);
      
      // Save context with type='exit'
      const result = await saveContext(this.directory, session, 'exit');
      
      if (result) {
        logger(`[Pre-Exit] Compression completed: ${result}`);
        console.log(`[context-plugin] Pre-exit compression completed: ${path.basename(result)}`);
      }
      
      return result;
    } catch (error) {
      logger(`[Pre-Exit] Error during compression: ${error.message}`);
      console.error(`[context-plugin] Pre-exit compression error: ${error.message}`);
      return null;
    }
  }

  async "experimental.chat.messages.transform"(transformInput) {
    const messages = transformInput?.messages || transformInput;

    if (!messages || messages.length === 0) {
      return messages;
    }

    const isFirstMessage = messages.length === 1 && !hasInjectedContext;

    if (isFirstMessage) {
      logger('[context-plugin] First message detected - injecting context');
      const contexts = await loadPreviousContexts(this.directory, 5);

      if (contexts.length > 0) {
        const injection = buildContextInjection(contexts);
        const firstMsg = messages[0];

        if (firstMsg.content) {
          firstMsg.content = firstMsg.content + injection;
          hasInjectedContext = true;
          logger(`[context-plugin] Injected ${contexts.length} contexts into first message`);
        }
      }
    }

    return messages;
  }
}

// Main plugin entry point
export { saveContext } from './src/modules/saveContext.js';
export { getRelevantContexts, formatForInjection, injectContextPrompt } from './src/modules/contextInjector.js';

// V2 Export format - { id, server } - server must be instantiable with `new`
export default {
  id: "@devwellington/opencode-context-plugin",
  server: (input) => new ContextPlugin(input)
};
