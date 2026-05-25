import fs from "fs/promises";
import path from "path";

import { loadConfig, getConfig, LOG_FILE, CONTEXT_SESSION_DIR } from './src/config.js';
import { createDebugLogger } from './src/utils/debug.js';
import { saveContext } from './src/modules/saveContext.js';
import { initializeIntelligenceLearning } from './src/modules/intelligence.js';
import { getSessionGuidance } from './src/modules/sessionGuidance.js';
import { initializeGlobalIntelligence } from './src/utils/globalIntelligence.js';
import { getRelevantContexts, formatForInjection } from './src/modules/contextInjector.js';
import { listAvailableContexts, formatContextPreview, interactiveInject } from './src/modules/injectPrompt.js';
import { syncToRemote, getSyncStatus, initializeRemoteSync } from './src/modules/remoteSync.js';
import { setDestroyed, init as initLifecycle } from './src/handlers/lifecycle.js';
import {
  getCurrentSessionId,
  setCurrentSessionId,
  getHasInjectedContext,
  setHasInjectedContext,
  getLastSession,
  setLastSession,
  handleSessionCreated,
  handleSessionUpdated,
  handleSessionEnd,
  handleSessionIdle,
  handleSessionCompacted
} from './src/handlers/sessionHandlers.js';
import {
  handleMessageUpdatedOrCreated,
  handleMessagePartDelta,
  handleMessagePartUpdated
} from './src/handlers/messageHandlers.js';
import { handleCommandExecuteBefore } from './src/handlers/commandHandlers.js';

const logger = createDebugLogger('context-plugin');

async function loadPreviousContexts(directory, limit = 5) {
  try {
    const ctxDir = path.join(directory, CONTEXT_SESSION_DIR);
    try {
      await fs.access(ctxDir);
    } catch {
      return [];
    }

    const skipNames = new Set([
      'daily-summary.md',
      'day-summary.md',
      'week-summary.md',
      'monthly-summary.md',
      'annual-summary.md',
      'intelligence-learning.md'
    ]);

    const contexts = [];

    async function scan(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'cache' || entry.name === 'reports') continue;
          await scan(fullPath);
          continue;
        }

        if (!entry.name.endsWith('.md')) continue;
        if (skipNames.has(entry.name)) continue;
        if (!/^(exit|compact)-/.test(entry.name)) continue;

        const stat = await fs.stat(fullPath);
        contexts.push({
          file: path.relative(ctxDir, fullPath),
          filepath: fullPath,
          mtimeMs: stat.mtimeMs
        });
      }
    }

    await scan(ctxDir);

    const recentContexts = contexts
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, limit);

    const loaded = await Promise.all(
      recentContexts.map(async (ctx) => {
        const content = await fs.readFile(ctx.filepath, 'utf-8');
        return { file: ctx.file, content };
      })
    );

    logger(`[context-plugin] Loaded ${loaded.length} previous contexts`);
    return loaded;
  } catch (error) {
    logger(`[context-plugin] Error loading contexts: ${error.message}`);
    return [];
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
      maxTokens: config.injection.maxTokens,
      baseDir: session.directory
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
 * @param {Object} opencodeApi - OpenCode plugin API
 * @param {Object} client - OpenCode client instance for LLM access
 */
export async function registerPluginHooks(opencodeApi, client = null) {
  // Session start - auto inject if enabled
  opencodeApi.onSessionStart(async (session) => {
    await loadConfig(session.directory);

    if (client) {
      logger(`[context-plugin] Client available for session start: ${!!client.sessions}`);
    }

    const { readIntelligenceLearning } = await import('./src/agents/readIntelligenceLearning.js');
    const intelligence = await readIntelligenceLearning(session.directory, { summary: true });
    if (intelligence && typeof intelligence === 'string') {
      opencodeApi.addToPrompt(`\n\n## Intelligence Learning\n\n${intelligence}\n`);
    }

    const injected = await autoInjectContexts(session);
    if (injected) {
      opencodeApi.addToPrompt(injected);
    }
  });

  // Session end - save context with client for LLM analysis
  opencodeApi.onSessionEnd(async (session) => {
    await loadConfig(session.directory);
    const { saveContext } = await import('./src/modules/saveContext.js');
    await saveContext(session.directory, session, 'exit', client);
  });
}

// V2 Plugin class that opencode will instantiate
class ContextPlugin {
  constructor(input) {
    this.directory = input?.directory;
    this.client = input?.client;

    this._initPromise = null;
    this._config = null;
    this._intelligenceInitialized = false;
    this._globalIntelligenceInitialized = false;
    this._remoteSyncInitialized = false;
    this._isDestroyed = false;
    initLifecycle();

    logger(`[context-plugin] ContextPlugin instantiated for: ${this.directory}`);
  }

  async _ensureInitialized() {
    if (!this.directory) return;

    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      try {
        const [config] = await Promise.all([
          loadConfig(this.directory),
          this._initIntelligence(),
          this._initGlobalIntelligence(),
          this._initRemoteSync()
        ]);
        this._config = config;
        logger(`[context-plugin] Initialization complete: debug=${config.debug}, debounceMs=${config.debounceMs}`);
      } catch (err) {
        logger(`[context-plugin] Initialization failed: ${err.message}`);
      }
    })();

    return this._initPromise;
  }

  async _initIntelligence() {
    if (this._intelligenceInitialized) return;
    this._intelligenceInitialized = true;
    return initializeIntelligenceLearning(this.directory).catch(err => {
      logger(`[context-plugin] Intelligence learning init failed: ${err.message}`);
    });
  }

  async _initGlobalIntelligence() {
    if (this._globalIntelligenceInitialized) return;
    this._globalIntelligenceInitialized = true;
    return initializeGlobalIntelligence().catch(err => {
      logger(`[context-plugin] Global intelligence init failed: ${err.message}`);
    });
  }

  async _initRemoteSync() {
    if (this._remoteSyncInitialized) return;
    this._remoteSyncInitialized = true;
    return initializeRemoteSync().catch(err => {
      logger(`[context-plugin] Remote sync init failed: ${err.message}`);
    });
  }

  getConfig() {
    return this._config || getConfig();
  }

  isDestroyed() {
    return this._isDestroyed;
  }

  async destroy() {
    if (this._isDestroyed) {
      return;
    }

    this._isDestroyed = true;
    setDestroyed(true);

    try {
      const { resetSessionState } = await import('./src/handlers/sessionHandlers.js');
      await resetSessionState();
      logger(`[context-plugin] Session state reset on destroy`);
    } catch (err) {
      logger(`[context-plugin] Error resetting session state on destroy: ${err.message}`);
    }

    this._initPromise = null;
    this._config = null;
    this._intelligenceInitialized = false;
    this._globalIntelligenceInitialized = false;
    this._remoteSyncInitialized = false;

    logger(`[context-plugin] ContextPlugin destroyed`);
  }

  async event(eventInput) {
    if (this._isDestroyed) {
      logger(`[context-plugin] Ignoring event - plugin destroyed`);
      return;
    }

    await this._ensureInitialized();
    logger(`[context-plugin] RAW EVENT received: ${JSON.stringify(eventInput)}`);
    const event = eventInput?.event || eventInput;
    const eventType = event?.type;

    logger(`[context-plugin] Parsed eventType: ${eventType}`);
    if (!eventType) return;

    const eventHandlers = {
      'session.created': () => handleSessionCreated(event, this.directory),
      'session.updated': () => handleSessionUpdated(event),
      'session.end': () => this.getConfig() && handleSessionEnd(this.directory, this.client, this.getConfig()),
      'session.compacted': () => handleSessionCompacted(this.directory, this.client),
      'experimental.compaction.autocontinue': () => handleSessionCompacted(this.directory, this.client),
      'session.idle': () => {
        const sessionId = event?.properties?.sessionID || event?.sessionId || getCurrentSessionId();
        if (sessionId) handleSessionIdle(this.directory, this.client, sessionId);
      },
      'session.deleted': () => {
        const sessionId = event?.properties?.sessionID || event?.sessionId || getCurrentSessionId();
        if (sessionId) handleSessionIdle(this.directory, this.client, sessionId);
      },
      'message.updated': () => handleMessageUpdatedOrCreated(event),
      'message.created': () => handleMessageUpdatedOrCreated(event),
      'message.part.delta': () => handleMessagePartDelta(event),
      'message.part.updated': () => handleMessagePartUpdated(event),
      'command.execute.before': () => handleCommandExecuteBefore(event),
    };

    const handler = eventHandlers[eventType];
    if (handler) {
      await handler();
    }
  }

  async "experimental.chat.messages.transform"(transformInput) {
    if (this._isDestroyed) {
      return transformInput?.messages || transformInput;
    }

    await this._ensureInitialized();
    const messages = transformInput?.messages || transformInput;

    if (!messages || messages.length === 0) {
      return messages;
    }

    // Check if user message contains /inject command
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'user' && lastMsg?.content?.includes('/inject')) {
      logger('[context-plugin] /inject command detected');

      // Parse /inject arguments: /inject N or /inject --all or /inject help
      const injectMatch = lastMsg.content.match(/\/inject(?:\s+(\d+))?(?:\s+--all)?/);
      const isAllFlag = /\/inject\s+--all/.test(lastMsg.content);
      const isHelp = /\/inject\s+(?:help|-h|--help)/.test(lastMsg.content);

      const contexts = await listAvailableContexts({ messages }, {
        maxContexts: 50,
        maxTokens: 32000,
        baseDir: this.directory
      });

      if (contexts.length > 0) {
        // Replace /inject command with empty string first
        lastMsg.content = lastMsg.content.replace(/\/inject(?:\s+\d+)?(?:\s+--all)?(?:\s+help|-h|--help)?/, '').trim();

        if (isHelp) {
          lastMsg.content += '\n\n' +
            '## /inject Help\n\n' +
            '- `/inject` - Show available contexts with scores\n' +
            '- `/inject N` - Inject context #N from the list\n' +
            '- `/inject --all` - Inject all available contexts\n' +
            '- `/inject help` - Show this help message\n';
        } else if (isAllFlag) {
          const indices = contexts.map((_, i) => i);
          const injection = await interactiveInject({ messages }, indices, this.directory);
          lastMsg.content += '\n\n' + injection;
          logger(`[context-plugin] Injected all ${contexts.length} contexts`);
        } else if (injectMatch?.[1]) {
          const idx = parseInt(injectMatch[1]) - 1;
          if (idx >= 0 && idx < contexts.length) {
            const injection = await interactiveInject({ messages }, [idx], this.directory);
            lastMsg.content += '\n\n' + injection;
            logger(`[context-plugin] Injected context #${injectMatch[1]}`);
          } else {
            lastMsg.content += '\n\nInvalid context index. Available: 1-' + contexts.length;
          }
        } else {
          // Show context list for selection
          const preview = formatContextPreview(contexts);
          lastMsg.content += '\n\n' + preview + '\n\nUse `/inject N` to inject context #N, or `/inject --all` to get all';
        }
      } else {
        lastMsg.content = lastMsg.content.replace(/\/inject(?:\s+\d+)?(?:\s+--all)?(?:\s+help|-h|--help)?/, '').trim();
        lastMsg.content += '\n\nNo relevant contexts found.';
      }

      return messages;
    }

    const isFirstMessage = messages.length === 1 && !getHasInjectedContext();

    if (isFirstMessage) {
      logger('[context-plugin] First message detected - injecting context');
      const contexts = await loadPreviousContexts(this.directory, 5);

      if (contexts.length > 0) {
        const injection = buildContextInjection(contexts);
        const firstMsg = messages[0];

        if (firstMsg.content) {
          const ctxNames = contexts.map(c => path.basename(c.file).replace(/-[0-9]{4}-[0-9]{2}-[0-9]{2}T.*/, '')).join(', ');
          const notification = `\n\n> 📌 **Context Plugin**: Injected ${contexts.length} prior session contexts: ${ctxNames}\n`;
          firstMsg.content = notification + firstMsg.content + injection;
          await setHasInjectedContext(true);
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

// Search functionality exports
export { buildSearchIndex, searchSessions, updateSearchIndex } from './src/modules/searchIndexer.js';
export { executeSearch, parseSearchQuery } from './src/modules/searchQuery.js';

// Report generation exports
export { generateWeeklyReport, generateMonthlyReport, generateActivityReport, saveReport } from './src/modules/reportGenerator.js';

// Remote sync exports
export { configureRemoteSync, syncToRemote, getSyncStatus, syncGlobalIntelligence, initializeRemoteSync } from './src/modules/remoteSync.js';

// Agent system exports
export { showHelp } from './src/agents/ocpHelp.js';
export {
  // Generate agents
  generateTodaySummary,
  generateWeeklySummary,
  generateMonthlySummary,
  generateAnnualSummary,
  updateIntelligenceLearning,
  // Read agents
  readTodaySummary,
  readWeeklySummary,
  readMonthlySummary,
  readAnnualSummary,
  readIntelligenceLearning,
  // Constants
  REPORT_PATHS
} from './src/agents/index.js';

// V2 Export format - { id, server } - server must be instantiable with `new`
export default {
  id: "@devwellington/opencode-context-plugin",
  server: (input) => new ContextPlugin(input)
};
