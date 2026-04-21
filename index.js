import fs from "fs";
import path from "path";

const LOG_FILE = path.join(process.env.HOME || '', '.opencode-context-plugin.log');
const CONTEXTOS_DIR = '.opencode/contextos';

function debugLog(message) {
  try {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
  } catch (e) {}
}

function ensureContextosDir(directory) {
  const ctxDir = path.join(directory, CONTEXTOS_DIR);
  if (!fs.existsSync(ctxDir)) {
    fs.mkdirSync(ctxDir, { recursive: true });
    debugLog(`[context-plugin] Created directory: ${ctxDir}`);
  }
  return ctxDir;
}

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

function extractSessionSummary(session) {
  if (!session) return null;
  
  const messages = session.messages || [];
  return {
    sessionId: session.id || session.sessionID,
    slug: session.slug,
    title: session.title,
    messageCount: messages.length,
    messages: messages.map((m, i) => ({
      index: i,
      role: m.role,
      type: m.type,
      content: m.content || ''
    }))
  };
}

function saveContext(directory, session, prefix = 'compact') {
  try {
    const ctxDir = ensureContextosDir(directory);
    const timestamp = getTimestamp();
    const filename = `${prefix}-${timestamp}.md`;
    const filepath = path.join(ctxDir, filename);
    
    const summary = extractSessionSummary(session);
    
    let content = `# Session Context - ${prefix.toUpperCase()}\n\n`;
    content += `**Session ID:** ${summary.sessionId}\n`;
    content += `**Slug:** ${summary.slug}\n`;
    content += `**Title:** ${summary.title}\n`;
    content += `**Timestamp:** ${new Date().toISOString()}\n`;
    content += `**Message Count:** ${summary.messageCount}\n\n`;
    content += `---\n\n`;
    content += `## Messages\n\n`;
    
    summary.messages.forEach((msg) => {
      const preview = msg.content.length > 2000 ? msg.content.slice(0, 2000) + '\n\n*(truncated)*' : msg.content;
      content += `### Message ${msg.index} [${msg.role}]\n\n`;
      content += `${preview}\n\n`;
    });
    
    fs.writeFileSync(filepath, content);
    debugLog(`[context-plugin] Saved context to: ${filepath}`);
    console.log(`[context-plugin] Context saved: ${filename}`);
    
    return filepath;
  } catch (error) {
    debugLog(`[context-plugin] Error saving context: ${error.message}`);
    console.error(`[context-plugin] Error saving context: ${error.message}`);
    return null;
  }
}

function loadPreviousContexts(directory, limit = 5) {
  try {
    const ctxDir = path.join(directory, CONTEXTOS_DIR);
    if (!fs.existsSync(ctxDir)) {
      return [];
    }
    
    const files = fs.readdirSync(ctxDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, limit);
    
    const contexts = files.map(file => {
      const filepath = path.join(ctxDir, file);
      const content = fs.readFileSync(filepath, 'utf-8');
      return { file, content };
    });
    
    debugLog(`[context-plugin] Loaded ${contexts.length} previous contexts`);
    return contexts;
  } catch (error) {
    debugLog(`[context-plugin] Error loading contexts: ${error.message}`);
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

let currentSessionId = null;
let hasInjectedContext = false;
let lastSession = null;

export default async (input) => {
  const { directory, client } = input;
  
  debugLog(`[context-plugin] Loaded for: ${directory}`);
  console.log(`[context-plugin] Context Plugin loaded`);
  
  ensureContextosDir(directory);
  
  return {
    "event": async (eventInput) => {
      const event = eventInput?.event || eventInput;
      const eventType = event?.type;
      
      if (!eventType) return;
      
      if (eventType === "session.created") {
        currentSessionId = event?.sessionId || event?.sessionID || event?.session?.id;
        hasInjectedContext = false;
        lastSession = null;
        debugLog(`[context-plugin] Session created: ${currentSessionId}`);
      }
      
      if (eventType === "session.updated") {
        const info = event?.properties?.info;
        if (info) {
          if (!lastSession) lastSession = {};
          Object.assign(lastSession, info);
          debugLog(`[context-plugin] Session metadata updated`);
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
            debugLog(`[context-plugin] Message added: ${lastSession.messages.length} total`);
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
            debugLog(`[context-plugin] Message content from part.updated: ${text.length} chars`);
          }
        }
      }
      
      if (eventType === "command.execute.before") {
        const command = event?.command || event?.properties?.command || event?.properties?.name;
        if (command === '/compact' || command === 'compact') {
          debugLog('[context-plugin] /compact command detected');
        }
      }
      
      if (eventType === "session.compacted" || eventType === "experimental.compaction.autocontinue") {
        debugLog('[context-plugin] session.compacted event received - saving context');
        if (lastSession) {
          saveContext(directory, lastSession, 'compact');
        } else {
          debugLog('[context-plugin] No lastSession available for compact save');
        }
      }
      
      if (eventType === "session.end" || eventType === "server.instance.disposed") {
        debugLog('[context-plugin] Session ending - saving final context');
        if (lastSession) {
          saveContext(directory, lastSession, 'saida');
        }
      }
    },
    
    "experimental.chat.messages.transform": async (transformInput) => {
      const messages = transformInput?.messages || transformInput;
      
      if (!messages || messages.length === 0) {
        return messages;
      }
      
      const isFirstMessage = messages.length === 1 && !hasInjectedContext;
      
      if (isFirstMessage) {
        debugLog('[context-plugin] First message detected - injecting context');
        const contexts = loadPreviousContexts(directory, 5);
        
        if (contexts.length > 0) {
          const injection = buildContextInjection(contexts);
          const firstMsg = messages[0];
          
          if (firstMsg.content) {
            firstMsg.content = firstMsg.content + injection;
            hasInjectedContext = true;
            debugLog(`[context-plugin] Injected ${contexts.length} contexts into first message`);
          }
        }
      }
      
      return messages;
    }
  };
};
