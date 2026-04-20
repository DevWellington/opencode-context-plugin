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

function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
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

function saveContextToFile(contextosDir: string, sessionID: string, messages: Array<{ info: { role: string }; parts: Array<{ type: string; text?: string }> }>, type: ContextType = "auto"): string | null {
  try {
    const timestamp = formatTimestamp(new Date());
    const filename = formatFilename(timestamp, type);
    const filepath = path.join(contextosDir, filename);

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
          // Truncate very long messages to save space (keep first 2000 chars)
          content += part.text.length > 2000 ? part.text.substring(0, 2000) + "\n\n[...truncado...]" : part.text;
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
    fs.writeFileSync(filepath, fileContent, "utf-8");

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
      } catch (error) {
        console.error(`[context-plugin] Error saving context on session end:`, error);
      }
    }
  };
};