# OpenCode Context Plugin

Plugin para OpenCode que salva automaticamente o contexto da sessão em `.opencode/context-session/` após cada compactação e ao sair.

## Funcionalidades

- **Salvamento automático**: Após cada `/compact` ou ao sair do opencode
- **Estrutura hierárquica**: `YYYY/MM/WW/DD/` para organização temporal
- **Fluxo hierárquico de relatórios**: Cada relatório agrega o nível anterior
  - `day-summary.md` (lê todos os arquivos do dia: compact e exit) - **MAIOR**
  - `week-summary.md` (lê `day-summary.md`) - médio
  - `monthly-YYYY-MM.md` (lê `week-summary.md`) - pequeno
  - `annual-YYYY.md` (lê `monthly-*.md`) - **MENOR**
- **Intelligence learning**: `intelligence-learning.md` com histórico e padrões do projeto
- **Injeção de contexto**: Últimas 5 sessões injetadas na primeira mensagem
- **Mensagens completas**: Captura conversas de usuário e assistente
- **Atomic writes**: Previne corrupção de arquivos em caso de crash
- **Agentes @**: 12 agentes para gerenciar contextos via chat
- **Token Counting**: Contagem precisa de tokens por sessão e agregação
- **Budget Limits**: Limites de tamanho por nível de relatório
- **Smart Triggers**: Regeneração inteligente só quando há mudanças significativas
- **Priority Context**: Classificação de sessões por prioridade (high/medium/low)
- **Nested Intelligence**: Padrões persistentes que sobrevivem entre sessões
- **Protected Patterns**: Proteção de conteúdo sensível contra sobrescrita
- **State Persistence**: Resume trabalho após reiniciar o plugin
- **ocp_memory API**: Ferramentas para o agente gerenciar memórias cruzadas

## Integração com Obsidian

Este plugin instala automaticamente o **Show Hidden Files** para você visualizar a pasta `.opencode` no Obsidian.

### Após instalar

Ao executar `npm install`, você verá:

```
▞▀▖         ▞▀▖     ▌     
▌ ▌▛▀▖▞▀▖▛▀▖▌  ▞▀▖▞▀▌▞▀▖  
▌ ▌▙▄▘▛▀ ▌ ▌▌ ▖▌ ▌▌ ▌▛▀   
▝▀ ▌  ▝▀▘▘ ▘▝▀ ▝▀ ▝▀▘▝▀▘  
   ▞▀▖      ▐        ▐    
   ▌  ▞▀▖▛▀▖▜▀ ▞▀▖▚▗▘▜▀   
   ▌ ▖▌ ▌▌ ▌▐ ▖▛▀ ▗▚ ▐ ▖  
   ▝▀ ▝▀ ▘ ▘ ▀ ▝▀▘▘ ▘ ▀   
     ▛▀▖▜       ▗         
     ▙▄▘▐ ▌ ▌▞▀▌▄ ▛▀▖     
     ▌  ▐ ▌ ▌▚▄▌▐ ▌ ▌     
     ▘   ▘▝▀▘▗▄▘▀▘▘ ▘    

✅  Show Hidden Files installed globally
✅  Show Hidden Files copied to project .obsidian

┌────────────────────────────────────────────────────────────┐
│  ⚠️  ACTION REQUIRED - Activate in Obsidian                 │
│                                                             │
│  1. Open Obsidian                                            │
│  2. Settings → Community Plugins                           │
│  3. Find "Show Hidden Files" in the list                   │
│  4. Toggle to ENABLED                                      │
└─────────────────────────────────────────────────────────────┘
```

### Ativar no Obsidian (apenas 1 vez)

1. Abra o Obsidian
2. **Settings** → **Community Plugins**
3. Encontre **"Show Hidden Files"** na lista
4. Ative (toggle)

Após isso, a pasta `.opencode` aparecerá no explorador de arquivos do Obsidian! Isso é necessário apenas **uma vez** - depois funciona em todas as vaults.

## Injection Contract

The context injector uses a specific contract for selecting sessions to inject:

**Only `exit-*` files are injected. `compact-*` files are excluded by design.**

| File Type | Purpose | Injected? | Reason |
|-----------|---------|-----------|--------|
| `exit-*` | Complete session snapshots (saved at session end) | Yes | Full conversation context with natural conclusions |
| `compact-*` | Mid-session snapshots (saved during `/compact`) | No | Incomplete, in-progress work lacking proper context boundaries |

This ensures only complete, well-formed sessions are used for context injection, improving relevance quality and reducing noise.

## Lifecycle Contract

### Initialization
- `init()` loads configuration and registers event handlers
- State is initialized to baseline (no active session)

### Runtime
- Event handlers process `session.created`, `message.*`, `session.end`, `session.idle`
- All operations respect `isDestroyed` flag

### Shutdown
- `destroy()` must be called for cleanup
- Guarantees:
  - State reset to baseline
  - Timers/intervals cleared
  - Late events ignored
  - Idempotent (safe to call multiple times)
- Background operations: Complete within 5 seconds after destroy or abort

## Estrutura de Arquivos

```
{project}/
└── .opencode/
    └── context-session/
        ├── daily-summary.md              # Resumo diário (lê arquivos do dia)
        ├── intelligence-learning.md      # Base de inteligência
        └── 2026/
            ├── annual-2026.md            # Resumo anual
            └── 04/
                ├── monthly-2026-04.md   # Resumo mensal
                └── W17/
                    ├── 21/
                    │   ├── compact-*.md  # Sessões compactadas
                    │   └── day-summary.md
                    └── week-summary.md  # Resumo semanal
```

## Fluxo Hierárquico

```
compact-*.md + exit-*.md (raw sessions)
    ↓
day-summary.md (MAIOR - extração completa via contentExtractor.js)
    ↓
week-summary.md (médio - agrega day-summary.md)
    ↓
monthly-YYYY-MM.md (pequeno - agrega week-summary.md)
    ↓
annual-YYYY.md (MENOR - agrega monthly-*.md)
    ↓
intelligence-learning.md (lê todos + atualiza base)
```

## Instalação

### Via NPM (Recomendado)

```bash
npm install -g @devwellington/opencode-context-plugin@latest
```

O plugin será carregado automaticamente pelo opencode se estiver instalado globalmente via npm.

## Configuração

O plugin funciona automaticamente após instalação. Para configurar, edite `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["@devwellington/opencode-context-plugin"]
}
```

## Uso

### Uso Normal

- `/compact` → Salva contexto em `compact-*.md`
- Sair da sessão → Salva contexto em `exit-*.md`
- Nova sessão → Injeta últimas 5 sessões na primeira mensagem
- `intelligence-learning.md` → Histórico e aprendizados do projeto

### Agentes Disponíveis

Após instalação, use os agentes no chat com `@`:

| Agente | Descrição |
|--------|-----------|
| `@ocp-help` | Mostra ajuda de todos os agentes |
| `@ocp-generate-today` | Gera resumo do dia |
| `@ocp-read-today` | Lê resumo do dia |
| `@ocp-generate-weekly` | Gera resumo da semana |
| `@ocp-read-weekly` | Lê resumo da semana |
| `@ocp-generate-monthly` | Gera resumo do mês |
| `@ocp-read-monthly` | Lê resumo do mês |
| `@ocp-generate-annual` | Gera resumo do ano |
| `@ocp-read-annual` | Lê resumo do ano |
| `@ocp-generate-intelligence-learning` | Atualiza intelligence learning |
| `@ocp-read-intelligence-learning` | Lê intelligence learning |
| `@ocp-inject` | Injeta contexto manualmente |
| `@ocp-read-*` | Lê vários tipos de contexto |

### Ferramentas ocp_memory

O agente pode usar `ocp_memory` para gerenciar memórias cruzadas entre sessões:

```javascript
// Escrever uma memória
ocp_memory(action="write", category="ARCHITECTURE_DECISIONS", content="Event sourcing for orders.")

// Buscar memórias
ocp_memory(action="search", query="authentication approach")

// Listar todas as memórias
ocp_memory(action="read", category=null)
```

**Exemplos:**
```
@ocp-help
@ocp-generate-today
@ocp-read-today --all
```

### CLI de Agentes

```bash
# Instalar agentes manualmente
npx ocp-agents install

# Listar agentes disponíveis
npx ocp-agents list

# Ver status da instalação
npx ocp-agents status

# Atualizar agentes
npx ocp-agents update
```

## Desenvolvimento

```bash
# Clone o repositório
git clone https://github.com/DevWellington/opencode-context-plugin.git
cd opencode-context-plugin

# Instale dependências
npm install

# Execute testes
npm test

# Validação (compara agentes vs gatilhos de compact/exit)
npm run validate

# Publique
npm version patch && npm publish --access public
```

## Estrutura

```
opencode-context-plugin/
├── index.js              # Plugin principal (ESM com V2 export)
├── package.json          # Configuração npm
├── README.md             # Este arquivo
├── CHANGELOG.md          # Histórico de versões
├── PUBLISH.md            # Guia de publicação
├── agents/               # Arquivos de agentes para opencode
│   └── *.md              # 12 agentes disponíveis
├── scripts/              # Scripts de instalação e CLI
│   ├── install-agents.js # Auto-instalação pós npm install
│   └── ocp-agents.js     # CLI para gerenciar agentes
└── src/
    ├── agents/           # Implementação dos agentes (JS)
    ├── modules/          # Módulos do plugin
    └── cli/              # Comandos CLI
```

## Public API

The following exports are marked `@public` and designed for external use:

### Core Operations

```javascript
import { saveContext, getRelevantContexts, injectContextPrompt } from '@devwellington/opencode-context-plugin';

// Save session context to file
saveContext(directory, session, type = 'compact', opencodeClient = null);

// Get relevant contexts for injection
getRelevantContexts(currentSession, options = {});

// Inject context into prompt
injectContextPrompt(currentSession, baseDir = process.cwd());
```

### Configuration

```javascript
import { loadConfig, getConfig } from '@devwellington/opencode-context-plugin';

// Load plugin configuration from directory
loadConfig(directory);

// Get current configuration object
getConfig();
```

### Search Operations

```javascript
import { buildSearchIndex, searchSessions, updateSearchIndex } from '@devwellington/opencode-context-plugin';

// Build full-text search index
buildSearchIndex(directory = process.cwd());

// Search sessions by query
searchSessions(directory, query, options = {});

// Update search index with new session
updateSearchIndex(directory, sessionFilePath);
```

### Report Generation

```javascript
import { generateWeeklyReport, generateMonthlyReport, generateAnnualReport } from '@devwellington/opencode-context-plugin';

// Generate weekly summary report
generateWeeklyReport(directory, weekStart, opencodeClient = null);

// Generate monthly summary report
generateMonthlyReport(directory, monthYear, opencodeClient = null);

// Generate annual summary report
generateAnnualReport(directory, year, opencodeClient = null);

// Scan sessions in date range
scanSessionsInRange(directory, startDate, endDate, opencodeClient = null);
```

### Remote Sync

```javascript
import { syncToRemote, getSyncStatus, initializeRemoteSync } from '@devwellington/opencode-context-plugin';

// Sync data to remote storage
syncToRemote(directory);

// Get sync status
getSyncStatus();

// Initialize remote sync
initializeRemoteSync();
```

### Agent System

```javascript
import { showHelp, generateTodaySummary, readTodaySummary } from '@devwellington/opencode-context-plugin';

// Show agent help
showHelp(agentName = null);

// Generate today's summary
generateTodaySummary(directory);

// Read today's summary
readTodaySummary(directory, options = { summary: true });
```

All public exports are documented with `@public` annotation in source code.

## Changelog

### v1.6.3 (2026-05-02)
- **Documentation fixes**: Fixed version mismatch in PUBLISH.md, removed garbled keyword 'door' from keyword filters
- **CHANGELOG updates**: Added missing entries for version consistency
- **322 tests passing** - comprehensive test coverage maintained

### v1.6.6 (2026-05-25)
- **Sync State Module**: `syncState.js` for cross-machine context synchronization
- **Extractors Module**: New `src/modules/extractors/` with sectionExtractor, patternDetector, bugExtractor, llmEnricher
- **Intelligence Reform**: Complete refactor with deduplicator and sanitizer
- **Project Count**: Real names now displayed in project tracking

### v1.6.0 (2026-04-23)
- **Source Code Link Intelligence**: `intelligence-learning.md` now links to actual source code locations (`[[src/file.js:line|symptom]]`) instead of summary files
- **extractSourceCodeReferences()**: Extracts `file:line` patterns from session content
- **extractBugCrossReferences()**: Enhances bugs with `sourceRef` pointing to fixes
- **buildCrossReferenceIndex()**: Builds keyword→file:line mapping for O(1) lookup
- **inferSourceLocation()**: Infers source locations when not explicitly mentioned
- **Feature Locations Section**: Intelligence learning tracks where features are implemented
- **Search Terms**: Bug entries include search-friendly terms for finding similar issues
- **Atomic Write Recovery**: `recoverOrphanedTempFiles()` auto-recovers `.tmp-*` orphaned files
- **Test**: 291 testes passando

### v1.5.0 (2026-04-22)
- **Token Counting Enhancement**: `countTokens()`, `countSessionTokens()` para contagem precisa
- **Summary Budget Limits**: Limites por nível (day: 5000, week: 3000, month: 2000, annual: 1000 chars)
- **Smart Generation Triggers**: `shouldRegenerate()` - pula regeneração se mudança < 5%
- **Priority-Based Context**: `classifySessionPriority()` - high/medium/low para sessões
- **Nested Intelligence**: `extractPersistentPatterns()` - padrões fixados após 3+ sessões
- **Protected Patterns**: `isProtected()` - conteúdo sensível protegido
- **State Persistence**: `state.js` para resume após restart
- **ocp_memory API**: Ferramentas inspiradas no magic-context para gerenciar memórias cruzadas
- **Test**: 263 testes passando

### v1.4.1 (2026-04-22)
- **Fix**: Hierarchical flow paths corrigidos em `generateIntelligenceLearning.js`
- **Fix**: Emoji duplicação arrumada em `extractSection`
- **Fix**: formatDayContent agora limpa marcadores antes de adicionar emojis
- **Test**: 223 testes passando

### v1.4.0 (2026-04-22)
- **Agentes automáticos**: Instalação automática de 13 agentes via `postinstall`
- **CLI ocp-agents**: Novo comando para gerenciar agentes
- **Agents directory**: Arquivos `.md` dos agentes incluídos no pacote npm

## Licença

MIT
