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
- **Agentes @**: 13 agentes para gerenciar contextos via chat
- **Token Counting**: Contagem precisa de tokens por sessão e agregação
- **Budget Limits**: Limites de tamanho por nível de relatório
- **Smart Triggers**: Regeneração inteligente só quando há mudanças significativas
- **Priority Context**: Classificação de sessões por prioridade (high/medium/low)
- **Nested Intelligence**: Padrões persistentes que sobrevivem entre sessões
- **Protected Patterns**: Proteção de conteúdo sensível contra sobrescrita
- **State Persistence**: Resume trabalho após reiniciar o plugin
- **ocp_memory API**: Ferramentas para o agente gerenciar memórias cruzadas

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
│   └── *.md              # 13 agentes disponíveis
├── scripts/              # Scripts de instalação e CLI
│   ├── install-agents.js # Auto-instalação pós npm install
│   └── ocp-agents.js     # CLI para gerenciar agentes
└── src/
    ├── agents/           # Implementação dos agentes (JS)
    ├── modules/          # Módulos do plugin
    └── cli/              # Comandos CLI
```

## Changelog

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
