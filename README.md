# OpenCode Context Plugin

Plugin para OpenCode que salva automaticamente o contexto da sessão em `.opencode/contextos/` após cada compactação e ao sair.

## Funcionalidades

- ✅ **Salvamento automático**: Após cada `/compact` ou ao sair do opencode
- ✅ **Separação por tipo**: Arquivos prefixados por `compact-`, `saida-`
- ✅ **Injeção de contexto**: Últimas 5 sessões injetadas na primeira mensagem
- ✅ **Mensagens completas**: Captura conversas de usuário e assistente
- ✅ **Economia de tokens**: Trunca mensagens longas (>2000 chars)
- ✅ **Diretório automático**: Cria `.opencode/contextos/` automaticamente

## Estrutura de Arquivos

```
{project}/
└── .opencode/
    └── contextos/
        ├── saida-2026-04-21T02-15-29.md    # Fim de sessão (completo)
        ├── compact-2026-04-21T02-10-46.md  # Compactação via /compact
        └── ...
```

**Prefixos:**
- `saida-` = Sessão completa ao sair do opencode
- `compact-` = Compactação manual ou automática via `/compact`

## Instalação

### 📦 Via NPM (Recomendado)

```bash
# Instalação global
npm install -g @devwellington/opencode-context-plugin@latest

# Ou instale direto no opencode
opencode plugin @devwellington/opencode-context-plugin@latest --global
```

### ⚡ Via Script

```bash
curl -fsSL https://raw.githubusercontent.com/DevWellington/opencode-context-plugin/main/install.sh | bash
```

### 🔧 Manual (Git)

```bash
# Clone para a pasta de plugins
git clone https://github.com/DevWellington/opencode-context-plugin.git \
  ~/.config/opencode/plugins/opencode-context-plugin

# Adicione ao ~/.config/opencode/opencode.json:
{
  "plugin": ["opencode-context-plugin"]
}
```

### 🖥️ Por Projeto

```bash
# Dentro do diretório do projeto
mkdir -p .opencode/plugins
git clone https://github.com/DevWellington/opencode-context-plugin.git \
  .opencode/plugins/opencode-context-plugin
```

## Configuração

Adicione ao `~/.config/opencode/opencode.json` (global) ou `.opencode/opencode.json` (projeto):

```json
{
  "plugin": ["opencode-context-plugin"]
}
```

## Uso

1. **Instale o plugin** (veja acima)

2. **Reinicie o OpenCode**: `opencode`

3. **Use normalmente**:
   - `/compact` → Salva contexto em `compact-*.md`
   - Sair da sessão → Salva contexto em `saida-*.md`
   - Nova sessão → Injeta últimas 5 sessões na primeira mensagem

4. **Visualize contextos**: `{projeto}/.opencode/contextos/`

## API de Hooks

| Hook | Função |
|------|--------|
| `session.compacted` | Salva contexto após compactação |
| `session.end` / `server.instance.disposed` | Salva contexto ao sair |
| `experimental.chat.messages.transform` | Injeta contextos na 1ª mensagem |
| `message.updated` / `message.part.delta` / `message.part.updated` | Captura mensagens | |

## Solução de Problemas

### Plugin não carrega
```bash
# Verifique instalação
ls -la ~/.config/opencode/plugins/opencode-context-plugin/

# Veja logs
tail -50 ~/.opencode-context-plugin.log
```

### Contexto não é salvo
1. Execute `/compact` manualmente
2. Verifique `.opencode/contextos/`
3. Confira logs: `tail -f ~/.opencode-context-plugin.log`

### Desinstalar
```bash
# Remova do config
# ~/.config/opencode/opencode.json: remova "opencode-context-plugin"

# Remova plugin
rm -rf ~/.config/opencode/plugins/opencode-context-plugin
```

## Desenvolvimento

```bash
cd /path/to/opencode-context-plugin

# Teste local
cp index.js ~/.config/opencode/plugins/opencode-context-plugin/index.js

# Reinicie opencode para recarregar
```

## Estrutura

```
opencode-context-plugin/
├── package.json    # Configuração npm
├── index.js        # Plugin principal
├── install.sh      # Script de instalação
├── README.md       # Documentação
└── PUBLISH.md      # Guia de publicação
```

## Changelog

### v1.1.1 (2026-04-21) - Current
- ✅ Estrutura hierárquica `YYYY/MM/WW/DD/`
- ✅ Sumários automáticos (dia, semana, daily-summary.md)
- ✅ Intelligence learning file (`intelligence-learning.md`)
- ✅ Pre-exit compression (salva antes de sair)
- ✅ Async fs/promises para todas operações
- ✅ Atomic writes previnem corrupção de arquivos
- ✅ Migração automática de versões anteriores

### v1.1.0 (2026-04-21)
- ✅ Captura completa de mensagens (usuário + assistente)
- ✅ Suporte a `message.part.delta` e `message.part.updated`
- ✅ Injeção de contexto de 5 sessões anteriores
- ✅ Truncamento de mensagens longas (2000 chars)

### v1.0.x
- Versões iniciais de teste

## Licença

MIT