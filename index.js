import fs from "fs";
import path from "path";
import { type Plugin, type PluginInput } from "@opencode-ai/plugin";

interface SessionContext {
  timestamp: string;
  sessionID: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  projectPath: string;
}

// Security: Sensitive data patterns to filter
const SENSITIVE_PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[REDACTED_AWS_KEY]' },
  { name: 'GitHub Token', pattern: /ghp_[a-zA-Z0-9]{36}/g, replacement: '[REDACTED_GITHUB_TOKEN]' },
  { name: 'Stripe Key', pattern: /sk_live_[a-zA-Z0-9]{24}/g, replacement: '[REDACTED_STRIPE_KEY]' },
  { name: 'Generic API Key', pattern: /api[_-]?key["']?\s*[:=]\s*["'][a-zA-Z0-9]{16,}["']/gi, replacement: '[REDACTED_API_KEY]' },
  { name: 'Private Tag', pattern: /<private>[\s\S]*?<\/private>/gi, replacement: '[REDACTED_PRIVATE_CONTENT]' }
];

// Security: Maximum context files to retain
const MAX_CONTEXT_FILES = 30;
const RETENTION_DAYS = 30;

function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}`;
}

type ContextType = "compact" | "session_end" | "auto";

function formatFilename(timestamp: string, type: ContextType): string {
  const typePrefix = {
    compact: "compact",
    session_end: "saida",
    auto: "auto"
  };
  return `${typePrefix[type]}-${timestamp}.md`;
}

function getContextosDir(projectDir: string): string {
  return path.join(projectDir, ".opencode", "contextos");
}

// Security: Validate path is within allowed bounds
function validatePath(baseDir: string, targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const resolvedBase = path.resolve(baseDir);
  return resolved.startsWith(resolvedBase + path.sep) || resolved === resolvedBase;
}

// Security: Filter sensitive data from content
function filterSensitiveData(content: string): string {
  let filtered = content;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    filtered = filtered.replace(pattern, replacement);
  }
  return filtered;
}

function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  }
}

function readPreviousContexts(contextosDir: string): string[] {
  const contexts: string[] = [];
  
  if (!fs.existsSync(contextosDir)) {
    return contexts;
  }

  try {
    const allFiles = fs.readdirSync(contextosDir)
      .filter(f => f.endsWith(".md"))
      .filter(f => f.startsWith("compact-") || f.startsWith("saida-") || f.startsWith("auto-"))
      .sort();

    // Prioritize: session_end (saida) > compact > auto
    // Read last 5 contexts with preference for complete sessions
    const priorityFiles = allFiles
      .filter(f => f.startsWith("saida-")) // Session ends first (most complete)
      .slice(-3);
    
    const compactFiles = allFiles
      .filter(f => f.startsWith("compact-"))
      .slice(-2);

    const selectedFiles = [...priorityFiles, ...compactFiles].slice(-5);

    for (const file of selectedFiles) {
      const filepath = path.join(contextosDir, file);
      const content = fs.readFileSync(filepath, "utf-8");
      
      // Truncate if too large
      const truncated = content.length > 5000 ? content.substring(0, 5000) + "\n\n[...resumido...]" : content;
      contexts.push(truncated);
    }
  } catch (error) {
    console.error(`[context-plugin] Error reading previous contexts:`, error);
  }

  return contexts;
}

// Security: Cleanup old context files based on retention policy
function cleanupOldContexts(contextosDir: string): void {
  if (!fs.existsSync(contextosDir)) {
    return;
  }

  try {
    const allFiles = fs.readdirSync(contextosDir)
      .filter(f => f.endsWith(".md"))
      .filter(f => f.startsWith("compact-") || f.startsWith("saida-") || f.startsWith("auto-"))
      .sort();

    const now = new Date();
    const filesToDelete: string[] = [];

    // Delete files older than retention period
    for (const file of allFiles) {
      const filepath = path.join(contextosDir, file);
      const stats = fs.statSync(filepath);
      const ageInDays = (now.getTime() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
      
      if (ageInDays > RETENTION_DAYS) {
        filesToDelete.push(filepath);
      }
    }

    // If still over limit, delete oldest files
    const remainingFiles = allFiles.filter(f => !filesToDelete.includes(path.join(contextosDir, f)));
    if (remainingFiles.length > MAX_CONTEXT_FILES) {
      const toDelete = remainingFiles.slice(0, remainingFiles.length - MAX_CONTEXT_FILES);
      for (const file of toDelete) {
        filesToDelete.push(path.join(contextosDir, file));
      }
    }

    // Delete the files
    for (const filepath of filesToDelete) {
      fs.unlinkSync(filepath);
      console.log(`[context-plugin] Cleaned up old context: ${filepath}`);
    }
  } catch (error) {
    console.error(`[context-plugin] Error during cleanup:`, error);
  }
}

function saveContextToFile(contextosDir: string, sessionID: string, messages: Array<{ info: { role: string }; parts: Array<{ type: string; text?: string }> }>, type: ContextType = "auto"): string | null {
  try {
    const timestamp = formatTimestamp(new Date());
    const filename = formatFilename(timestamp, type);
    const filepath = path.join(contextosDir, filename);

    // Security: Validate path is within allowed directory
    if (!validatePath(contextosDir, filepath)) {
      console.error(`[context-plugin] Path traversal attempt detected: ${filepath}`);
      return null;
    }

    // Filter: Only save user messages and significant assistant responses
    // Skip tool outputs, system messages, and verbose intermediate content
    const significantMessages = messages.filter(msg => {
      const role = msg.info?.role || "unknown";
      
      // Always save user messages
      if (role === "user") return true;
      
      // Save assistant messages that are NOT tool responses
      if (role === "assistant") {
        // Check if this is a tool response (usually has tool_call_ids or specific format)
        const hasToolResponse = msg.parts.some(p => p.type === "tool-result" || p.type === "tool_call");
        return !hasToolResponse;
      }
      
      return false;
    });

    // Type label for display
    const typeLabels = {
      compact: "Compactação",
      session_end: "Fim de Sessão",
      auto: "Automático"
    };

    // Build formatted content - concise summary style
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
          // Security: Filter sensitive data before saving
          let textContent = filterSensitiveData(part.text);
          // Truncate very long messages to save space (keep first 2000 chars)
          content += textContent.length > 2000 ? textContent.substring(0, 2000) + "\n\n[...truncado...]" : textContent;
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

    // Add summary stats at the end
    lines.push(`**Total:** ${significantMessages.length} mensagens significativas`);
    lines.push(`**Original:** ${messages.length} mensagens`);

    const fileContent = lines.join("\n");

    ensureDirectoryExists(contextosDir);
    // Security: Write with restrictive permissions (owner read/write only)
    fs.writeFileSync(filepath, fileContent, { encoding: "utf-8", mode: 0o600 });

    console.log(`[context-plugin] ${typeLabels[type]} salvo: ${filepath} (${significantMessages.length}/${messages.length} msgs)`);
    return filepath;
  } catch (error) {
    console.error(`[context-plugin] Error saving context:`, error);
    return null;
  }
}

function loadPreviousContextsAsText(contextosDir: string): string {
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

export const ContextPlugin: Plugin = async (input: PluginInput) => {
  const { directory, client } = input;
  const contextosDir = getContextosDir(directory);

  return {
    // Hook into compaction completion to save context
    "experimental.compaction.autocontinue": async (compactionInput, output) => {
      const { sessionID, agent, model, provider, message, overflow } = compactionInput;
      
      console.log(`[context-plugin] Compaction triggered for session: ${sessionID}`);

      // Get messages from the session using the client
      try {
        // Use the Opencode client to fetch session messages
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

    // Hook into chat messages to inject previous context ONLY on first message
    "experimental.chat.messages.transform": async (chatInput, output) => {
      const { messages } = chatInput;

      // Only inject context on the VERY first user message of a new session
      // This prevents token waste on every subsequent message
      if (messages.length !== 1) {
        return;
      }

      const previousContexts = loadPreviousContextsAsText(contextosDir);

      if (previousContexts && messages.length > 0) {
        const firstUserIndex = messages.findIndex(m => m.info?.role === "user");
        
        if (firstUserIndex !== -1) {
          const firstMsg = messages[firstUserIndex];
          const currentContent = firstMsg.parts.find(p => p.type === "text")?.text || "";
          
          // Prepend context with clear instructions to be specific
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

    // Also hook into command execution to capture /compact manually
    "command.execute.before": async (cmdInput, output) => {
      if (cmdInput.command === "compact") {
        console.log(`[context-plugin] /compact command detected`);
        // Context will be saved via experimental.compaction.autocontinue hook
      }
    },

    // Hook into session end/exit to save context when leaving opencode
    "session.end": async (sessionInput, output) => {
      const { sessionID } = sessionInput;
      
      console.log(`[context-plugin] Session ending: ${sessionID}`);

      try {
        const session = await client.sessions.get({ sessionID });
        const messages = session.messages || [];

        if (messages.length > 0) {
          const savedPath = saveContextToFile(contextosDir, sessionID, messages, "session_end");
          if (savedPath) {
            console.log(`[context-plugin] Session end context saved: ${savedPath}`);
          }
        }
        
        // Security: Cleanup old contexts based on retention policy
        cleanupOldContexts(contextosDir);
      } catch (error) {
        console.error(`[context-plugin] Error saving context on session end:`, error);
      }
    }
  };
};