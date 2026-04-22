# OpenCode Context Plugin

Plugin para OpenCode que salva automaticamente o contexto da sessão em `.opencode/context-session/` após cada compactação e ao sair.

## Funcionalidades

- **Salvamento automático**: Após cada `/compact` ou ao sair do opencode
- **Estrutura hierárquica**: `YYYY/MM/WW/DD/` para organização temporal
- **Fluxo hierárquico de relatórios**: Cada relatório agrega o nível anterior
  - `generateTodaySummary()` → `daily-summary.md` (lê todos os arquivos do dia: compact e exit)
  - `generateWeeklySummary()` → `week-summary.md` (lê `day-summary.md`)
  - `generateMonthlySummary()` → `monthly-YYYY-MM.md` (lê `week-summary.md`)
  - `generateAnnualSummary()` → `annual-YYYY.md` (lê `monthly-*.md`)
  - `updateIntelligenceLearning()` → `intelligence-learning.md` (lê todos os 4 níveis)
- **Intelligence learning**: `intelligence-learning.md` com histórico e padrões do projeto
- **Injeção de contexto**: Últimas 5 sessões injetadas na primeira mensagem
- **Mensagens completas**: Captura conversas de usuário e assistente
- **Atomic writes**: Previne corrupção de arquivos em caso de crash
- **Migração automática**: De `.opencode/contextos/` para nova estrutura
- **Agentes @**: 11 agentes para gerenciar contextos via chat (instalação automática)

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
                ├── monthly-2026-04.md    # Resumo mensal
                └── W17/
                    ├── 21/
                    │   ├── compact-*.md  # Sessões compactadas
                    │   └── day-summary.md
                    └── week-summary.md   # Resumo semanal
```

**Fluxo Hierárquico:**
```
Session files (compact-*.md, exit-*.md)
    ↓
day-summary.md (dentro do dia)
    ↓
week-summary.md (dentro da semana)
    ↓
monthly-YYYY-MM.md (dentro do mês)
    ↓
annual-YYYY.md (dentro do ano)
    ↓
intelligence-learning.md (lê todos + atualiza base)
```
{project}/
└── .opencode/
    └── context-session/
        ├── daily-summary.md              # Resumo diário (lê todos os arquivos do dia)
        ├── intelligence-learning.md      # Histórico e aprendizados do projeto
        ├── monthly/
        │   └── 2026/
        │       └── 04/
        │           └── monthly-2026-04.md  # Resumo mensal (agrega week-summary.md)
        ├── annual/
        │   └── 2026/
        │       └── annual-2026.md           # Resumo anual (agrega monthly-*.md)
        └── 2026/
            └── 04/
                └── W17/
                    ├── 21/
                    │   ├── compact-2026-04-21T16-10-10.md  # Compactação
                    │   └── day-summary.md                  # Resumo do dia
                    └── week-summary.md                     # Resumo semanal (agrega day-summary.md)
```

**Fluxo Hierárquico:**
```
Session files (compact-*.md, exit-*.md)
    ↓
day-summary.md (lê todos os arquivos do dia)
    ↓
week-summary.md (agrega day-summary.md)
    ↓
monthly/YYYY/MM/monthly-YYYY-MM.md (agrega week-summary.md)
    ↓
annual/YYYY/annual-YYYY.md (agrega monthly-*.md)
    ↓
intelligence-learning.md (lê todos os 4 níveis + atualiza base de inteligência)
```

**Prefixos:**
- `exit-` = Sessão completa ao sair do opencode
- `compact-` = Compactação manual ou automática via `/compact`

## Instalação

### Via NPM (Recomendado)

```bash
# Instalação global
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

### Instalação

1. **Instale o plugin**: `npm install -g @devwellington/opencode-context-plugin@latest`
   - Os agentes são instalados automaticamente em `~/.config/opencode/agents/`

2. **Reinicie o OpenCode**: `opencode`

3. **Use normalmente**:
   - `/compact` → Salva contexto em `compact-*.md`
   - Sair da sessão → Salva contexto em `exit-*.md`
   - Nova sessão → Injeta últimas 5 sessões na primeira mensagem

4. **Visualize contextos**: `{projeto}/.opencode/context-session/`

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

**Exemplos:**
```
@ocp-help
@ocp-generate-today
@ocp-read-today --all
```

### CLI de Agentes

Gerencie agentes via terminal:

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

## API de Hooks

| Hook | Função |
|------|--------|
| `session.compacted` | Salva contexto após compactação |
| `session.end` / `server.instance.disposed` | Salva contexto ao sair |
| `experimental.chat.messages.transform` | Injeta contextos na 1ª mensagem |
| `message.updated` / `message.part.delta` | Captura mensagens |

## Solução de Problemas

### Plugin não carrega
```bash
# Verifique instalação
npm list -g @devwellington/opencode-context-plugin

# Veja logs
tail -50 ~/.opencode-context-plugin.log
```

### Contexto não é salvo
1. Execute `/compact` manualmente
2. Verifique `.opencode/context-session/`
3. Confira logs: `tail -f ~/.opencode-context-plugin.log`

## Desenvolvimento

```bash
# Clone o repositório
git clone https://github.com/DevWellington/opencode-context-plugin.git
cd opencode-context-plugin

# Edite index.js e publique
npm version patch && npm publish

# Para testar localmente, atualize a instalação global
npm install -g @devwellington/opencode-context-plugin@latest
```

## Estrutura

```
opencode-context-plugin/
├── index.js              # Plugin principal (ESM com V2 export)
├── package.json          # Configuração npm
├── README.md             # Este arquivo
├── agents/               # Arquivos de agentes para opencode
│   └── *.md              # 11 agentes disponíveis
├── scripts/              # Scripts de instalação e CLI
│   ├── install-agents.js # Auto-instalação pós npm install
│   └── ocp-agents.js     # CLI para gerenciar agentes
└── src/
    ├── agents/           # Implementação dos agentes (JS)
    ├── modules/          # Módulos do plugin
    └── cli/              # Comandos CLI
```

## Changelog

### v1.4.0 (2026-04-21)
- **Agentes automáticos**: Instalação automática de 11 agentes via `postinstall`
- **CLI ocp-agents**: Novo comando para gerenciar agentes (`npx ocp-agents install|list|status|update`)
- **Agents directory**: Arquivos `.md` dos agentes incluídos no pacote npm

### v1.3.4 (2026-04-21)
- Limpeza do pacote npm
- Improved error handling e debug logging

### v1.3.3 (2026-04-21)
- Enhanced atomic write logging
- Error handling em session.end handler

### v1.3.0+ (2026-04-21)
- Estrutura hierárquica `YYYY/MM/WW/DD/`
- Sumários automáticos (day, week, daily)
- Intelligence learning file
- V2 export format para opencode 1.14+

## Licença

MIT
