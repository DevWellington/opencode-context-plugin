# OpenCode Context Plugin

Plugin para OpenCode que salva automaticamente o contexto da sessão em `.opencode/context-session/` após cada compactação e ao sair.

## Funcionalidades

- **Salvamento automático**: Após cada `/compact` ou ao sair do opencode
- **Estrutura hierárquica**: `YYYY/MM/WW/DD/` para organização temporal
- **Sumários automáticos**: `daily-summary.md`, `day-summary.md`, `week-summary.md`
- **Intelligence learning**: `intelligence-learning.md` com histórico de sessões
- **Injeção de contexto**: Últimas 5 sessões injetadas na primeira mensagem
- **Mensagens completas**: Captura conversas de usuário e assistente
- **Atomic writes**: Previne corrupção de arquivos em caso de crash
- **Migração automática**: De `.opencode/contextos/` para nova estrutura

## Estrutura de Arquivos

```
{project}/
└── .opencode/
    └── context-session/
        ├── daily-summary.md          # Resumo de todas as sessões do dia
        ├── intelligence-learning.md   # Histórico e aprendizados
        ├── 2026/
        │   └── 04/
        │       └── W17/
        │           └── 21/
        │               ├── exit-2026-04-21T16-04-00.md     # Fim de sessão
        │               ├── compact-2026-04-21T16-10-10.md  # Compactação
        │               ├── day-summary.md                   # Resumo do dia
        │               └── week-summary.md                  # Resumo da semana
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

1. **Instale o plugin**: `npm install -g @devwellington/opencode-context-plugin@latest`

2. **Reinicie o OpenCode**: `opencode`

3. **Use normalmente**:
   - `/compact` → Salva contexto em `compact-*.md`
   - Sair da sessão → Salva contexto em `exit-*.md`
   - Nova sessão → Injeta últimas 5 sessões na primeira mensagem

4. **Visualize contextos**: `{projeto}/.opencode/context-session/`

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
├── index.js        # Plugin principal (ESM com V2 export)
├── package.json    # Configuração npm
├── README.md       # Este arquivo
└── AGENTS.md      # Instruções para agentes
```

## Changelog

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
