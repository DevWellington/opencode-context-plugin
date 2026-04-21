import fs from "fs";
import path from "path";
// Plugin export is the function itself;

// Debug logging
const LOG_FILE = path.join(process.env.HOME || '', '.opencode-context-plugin.log');
function debugLog(message) {
  try {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
  } catch (e) {
    // Ignore log errors
  }
}

// Security: Sensitive data patterns to filter
const SENSITIVE_PATTERNS = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[REDACTED_AWS_KEY]' },
  { name: 'GitHub Token', pattern: /ghp_[a-zA-Z0-9]{36}/g, replacement: '[REDACTED_GITHUB_TOKEN]' },
  { name: 'Stripe Key', pattern: /sk_live_[a-zA-Z0-9]{24}/g, replacement: '[REDACTED_STRIPE_KEY]' },
  { name: 'Generic API Key', pattern: /api[_-]?key["']?\s*[:=]\s*["'][a-zA-Z0-9]{16,}["']/gi, replacement: '[REDACTED_API_KEY]' },
  { name: 'Private Tag', pattern: /<private>[\s\S]*?<\/private>/gi, replacement: '[REDACTED_PRIVATE_CONTENT]' }
];

// Security: Maximum context files to retain
const MAX_CONTEXT_FILES = 30;
const RETENTION_DAYS = 30;

function formatTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}`;
}

function formatFilename(timestamp, type) {
  const typePrefix = {
    compact: "compact",
    session_end: "saida",
    auto: "auto"
  };
  return `${typePrefix[type]}-${timestamp}.md`;
}

function getContextosDir(projectDir) {
  return path.join(projectDir, ".opencode", "contextos");
}

// Security: Validate path is within allowed bounds
function validatePath(baseDir, targetPath) {
  const resolved = path.resolve(targetPath);
  const resolvedBase = path.resolve(baseDir);
  return resolved.startsWith(resolvedBase + path.sep) || resolved === resolvedBase;
}

// Security: Filter sensitive data from content
function filterSensitiveData(content) {
  let filtered = content;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    filtered = filtered.replace(pattern, replacement);
  }
  return filtered;
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  }
}

function readPreviousContexts(contextosDir) {
  const contexts = [];
  
  if (!fs.existsSync(contextosDir)) {
    return contexts;
  }

  try {
    const allFiles = fs.readdirSync(contextosDir)
      .filter(f => f.endsWith(".md"))
      .filter(f => f.startsWith("compact-") || f.startsWith("saida-") || f.startsWith("auto-"))
      .sort();

    // Prioritize: session_end (saida) > compact > auto
    const priorityFiles = allFiles
      .filter(f => f.startsWith("saida-"))
      .slice(-3);
    
    const compactFiles = allFiles
      .filter(f => f.startsWith("compact-"))
      .slice(-2);

    const selectedFiles = [...priorityFiles, ...compactFiles].slice(-5);

    for (const file of selectedFiles) {
      const filepath = path.join(contextosDir, file);
      const content = fs.readFileSync(filepath, "utf-8");
      
      const truncated = content.length > 5000 ? content.substring(0, 5000) + "\n\n[...resumido...]" : content;
      contexts.push(truncated);
    }
  } catch (error) {
    console.error(`[context-plugin] Error reading previous contexts:`, error);
  }

  return contexts;
}

function cleanupOldContexts(contextosDir) {
  if (!fs.existsSync(contextosDir)) {
    return;
  }

  try {
    const allFiles = fs.readdirSync(contextosDir)
      .filter(f => f.endsWith(".md"))
      .map(f => {
        const filepath = path.join(contextosDir, f);
        const stats = fs.statSync(filepath);
        return { name: f, path: filepath, mtime: stats.mtime };
      });

    // Delete files older than RETENTION_DAYS
    const now = Date.now();
    const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;
    
    const filesToDelete = allFiles.filter(file => {
      const age = now - file.mtime.getTime();
      return age > retentionMs;
    });

    // If still too many files, delete oldest
    if (allFiles.length - filesToDelete.length > MAX_CONTEXT_FILES) {
      const sortedByAge = allFiles
        .filter(f => !filesToDelete.find(d => d.name === f.name))
        .sort((a, b) => a.mtime - b.mtime);
      
      const additionalToDelete = sortedByAge.slice(0, sortedByAge.length - MAX_CONTEXT_FILES);
      filesToDelete.push(...additionalToDelete);
    }

    for (const file of filesToDelete) {
      fs.unlinkSync(file.path);
      debugLog(`[context-plugin] Deleted old context: ${file.name}`);
    }
  } catch (error) {
    console.error(`[context-plugin] Error cleaning up old contexts:`, error);
  }
}

function saveContextToFile(contextosDir, sessionID, messages, type = "auto") {
  try {
    const timestamp = formatTimestamp(new Date());
    const filename = formatFilename(timestamp, type);
    const filepath = path.join(contextosDir, filename);

    // Security: Validate path before writing
    if (!validatePath(contextosDir, filepath)) {
      console.error(`[context-plugin] Invalid path detected: ${filepath}`);
      return null;
    }

    // Security: Filter sensitive data
    const significantMessages = messages.filter(msg => {
      const role = msg.info?.role || "unknown";
      if (role === "user") return true;
      if (role === "assistant") {
        const hasToolResponse = msg.parts.some(p => p.type === "tool-result" || p.type === "tool_call");
        return !hasToolResponse;
      }
      return false;
    });

    const typeLabels = {
      compact: "Compactação",
      session_end: "Fim de Sessão",
      auto: "Automático"
    };

    const lines = [
      `# ${typeLabels[type]} - ${timestamp}`,
      "",
      `**Tipo:** ${typeLabels[type]}`,
      `**ID:** ${sessionID.substring(0, 8)}...`,
      `**Data:** ${new Date().toLocaleString("pt-BR")}`,
      "",
      "## Histórico (apenas mensagens relevantes)",
      ""
    ];

    for (const msg of significantMessages) {
      const role = msg.info?.role || "unknown";
      let content = "";

      for (const part of msg.parts) {
        if (part.type === "text" && part.text) {
          const filtered = filterSensitiveData(part.text);
          content += filtered.length > 2000 ? filtered.substring(0, 2000) + "\n\n[...truncado...]" : filtered;
        }
      }

      if (content) {
        lines.push(`### ${role.charAt(0).toUpperCase() + role.slice(1)}`);
        lines.push("");
        lines.push(content.trim());
        lines.push("");
        lines.push("---");
        lines.push("");
      }
    }

    lines.push(`**Total:** ${significantMessages.length} mensagens significativas`);
    lines.push(`**Original:** ${messages.length} mensagens`);

    const fileContent = lines.join("\n");

    ensureDirectoryExists(contextosDir);
    fs.writeFileSync(filepath, fileContent, { encoding: "utf-8", mode: 0o600 });

    debugLog(`[context-plugin] ${typeLabels[type]} salvo: ${filepath} (${significantMessages.length}/${messages.length} msgs)`);
    return filepath;
  } catch (error) {
    console.error(`[context-plugin] Error saving context:`, error);
    debugLog(`[context-plugin] Error saving context: ${error.message}`);
    return null;
  }
}

function loadPreviousContextsAsText(contextosDir) {
  const contexts = readPreviousContexts(contextosDir);
  
  if (contexts.length === 0) {
    return "";
  }

  const header = [
    "",
    "---",
    "## Contextos Anteriores (resumo das últimas sessões)",
    "",
    "> **Nota:** Use este contexto para continuar de onde parou. Seja específico nas respostas.",
    "",
  ];

  const footer = ["", "---", ""];

  return header.join("\n") + contexts.join("\n\n") + footer.join("\n");
}

export default async (input) => {
  const { directory, client } = input;
  const contextosDir = getContextosDir(directory);

  const logMsg = `[context-plugin] Plugin loaded for directory: ${directory}`;
  console.log(logMsg);
  debugLog(logMsg);

  return {
    "experimental.compaction.autocontinue": async (compactionInput, output) => {
      const { sessionID } = compactionInput;
      
      console.log(`[context-plugin] Compaction triggered for session: ${sessionID}`);

      try {
        const session = await client.sessions.get({ sessionID });
        const messages = session.messages || [];

        if (messages.length > 0) {
          const savedPath = saveContextToFile(contextosDir, sessionID, messages, "compact");
          if (savedPath) {
            console.log(`[context-plugin] Compact context saved successfully`);
          }
        }
      } catch (error) {
        console.error(`[context-plugin] Error fetching session messages:`, error);
      }
    },

    "experimental.chat.messages.transform": async (chatInput, output) => {
      const { messages } = chatInput;

      console.log(`[context-plugin] [HOOK FIRED] experimental.chat.messages.transform (msg count: ${messages.length})`);

      if (messages.length !== 1) {
        console.log(`[context-plugin] Skipping context injection: ${messages.length} messages`);
        return;
      }

      const previousContexts = loadPreviousContextsAsText(contextosDir);

      if (previousContexts && messages.length > 0) {
        const firstUserIndex = messages.findIndex(m => m.info?.role === "user");
        
        if (firstUserIndex !== -1) {
          const firstMsg = messages[firstUserIndex];
          const currentContent = firstMsg.parts.find(p => p.type === "text")?.text || "";
          
          const contextPart = firstMsg.parts.find(p => p.type === "text");
          if (contextPart) {
            contextPart.text = `## Contexto de Sessões Anteriores (RESUMO)

${previousContexts}

---

### Instruções:
- **NÃO** leia todo o código do projeto
- **NÃO** liste arquivos desnecessários
- Use o contexto acima APENAS como referência histórica
- Seja específico e direto nas respostas
- Peça esclarecimentos se necessário

---

## Sua Mensagem Atual:

${currentContent}`;
          }
        }
      }
    },

    "command.execute.before": async (cmdInput, output) => {
      if (cmdInput.command === "compact" || cmdInput.command === "save-context") {
        console.log(`[context-plugin] ${cmdInput.command} command detected - context will be saved`);
      }
    },

    "event": async ({ event }) => {
      const eventLog = `[context-plugin] Event received: ${event.type}`;
      console.log(eventLog);
      debugLog(eventLog);
      
      if (event.type === "session.created") {
        const logMsg = `[context-plugin] Session created: ${event.sessionId}`;
        console.log(logMsg);
        debugLog(logMsg);
      }
      
      if (event.type === "session.deleted") {
        const logMsg = `[context-plugin] Session deleted: ${event.sessionId}`;
        console.log(logMsg);
        debugLog(logMsg);
        
        try {
          const session = await client.sessions.get({ sessionID: event.sessionId });
          const messages = session.messages || [];

          if (messages.length > 0) {
            const savedPath = saveContextToFile(contextosDir, event.sessionId, messages, "session_end");
            if (savedPath) {
              const saveLog = `[context-plugin] Session end context saved: ${savedPath}`;
              console.log(saveLog);
              debugLog(saveLog);
            }
          }
          
          cleanupOldContexts(contextosDir);
        } catch (error) {
          const errorLog = `[context-plugin] Error saving context on session deleted: ${error.message}`;
          console.error(errorLog);
          debugLog(errorLog);
        }
      }
      
      if (event.type === "session.idle") {
        const logMsg = `[context-plugin] Session idle: ${event.sessionId}`;
        console.log(logMsg);
        debugLog(logMsg);
        
        try {
          const session = await client.sessions.get({ sessionID: event.sessionId });
          const messages = session.messages || [];

          if (messages.length > 0) {
            const savedPath = saveContextToFile(contextosDir, event.sessionId, messages, "auto");
            if (savedPath) {
              const saveLog = `[context-plugin] Idle session context saved: ${savedPath}`;
              console.log(saveLog);
              debugLog(saveLog);
            }
          }
        } catch (error) {
          const errorLog = `[context-plugin] Error saving context on session idle: ${error.message}`;
          console.error(errorLog);
          debugLog(errorLog);
        }
      }
    }
  };
};
