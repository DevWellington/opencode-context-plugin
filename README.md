# OpenCode Context Plugin

Plugin para OpenCode que salva o contexto da sessão em `.opencode/contextos/` após cada compactação e ao sair do opencode.

## Funcionalidades

- **Salvamento automático**: Após cada `/compact` ou ao sair do opencode
- **Separação por tipo**: Arquivos prefixados por `compact-`, `saida-`, `auto-`
- **Injeção de contexto**: Contexto de sessões anteriores é injetado APENAS na primeira mensagem
- **Economia de tokens**: Filtra tool outputs, trunca mensagens longas, limita a 5 sessões anteriores
- **Priorização**: Sessões completas (saida) têm prioridade sobre compactações
- **Diretório automático**: Cria a estrutura de diretórios necessária

## Estrutura de Arquivos

```
{project}/
└── .opencode/
    └── contextos/
        ├── saida-20250420-1430.md    # Fim de sessão (completo)
        ├── compact-20250420-1515.md  # Compactação manual
        ├── auto-20250420-1600.md     # Auto-save (se habilitado)
        └── ...
```

**Prefixos:**
- `saida-` = Sessão completa ao sair (prioridade máxima)
- `compact-` = Compactação via `/compact`
- `auto-` = Auto-save periódico (futuro)

## Instalação

### ⚡ Método Rápido (Recomendado)

```bash
curl -fsSL https://raw.githubusercontent.com/wellingtonribeiro/opencode-context-plugin/main/install.sh | bash
```

### 📦 Via NPM (Em breve)

```bash
npm install -g @wellingtonribeiro/opencode-context-plugin
opencode plugin @wellingtonribeiro/opencode-context-plugin@latest --global
```

### 🔧 Manual

```bash
# Clone para a pasta de plugins
git clone https://github.com/DevWellington/opencode-context-plugin.git \
  ~/.config/opencode/plugins/opencode-context-plugin

# Adicione ao ~/.config/opencode/opencode.json:
{
  "plugins": ["opencode-context-plugin"]
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

### No `config.json` do projeto ou global:

Adicione o plugin ao array de plugins:

```json
{
  "plugins": [
    "opencode-context-plugin"
  ]
}
```

Ou com opções:

```json
{
  "plugins": [
    ["opencode-context-plugin", { /* opções futuras */ }]
  ]
}
```

## Uso

1. **Instale o plugin** conforme as instruções acima

2. **Reinicie o OpenCode** ou abra uma nova sessão

3. **Use normalmente** - o contexto será salvo automaticamente ao usar `/compact` ou ao sair do opencode

4. **Contexto é injetado** apenas na 1ª mensagem (últimas 5 sessões, filtrado)

## API de Hooks

O plugin utiliza os seguintes hooks:

| Hook | Função |
|------|--------|
| `experimental.compaction.autocontinue` | Captura contexto após compactação |
| `experimental.chat.messages.transform` | Injeta contextos anteriores na sessão |
| `command.execute.before` | Detecta comando `/compact` |
| `session.end` | Salva contexto ao sair do opencode |

## Solução de Problemas

### Plugin não carrega

1. Verifique se o caminho está correto em `~/.config/opencode/`
2. Verifique se o `package.json` está na raiz do plugin
3. Verifique os logs do OpenCode

### Contexto não é salvo

1. Verifique se o diretório `.opencode/contextos/` existe
2. Verifique permissões de escrita
3. Execute `/compact` manualmente para acionar o salvamento

### Verificar instalação

```bash
ls -la ~/.config/opencode/plugins/opencode-context-plugin/
ls -la .opencode/plugins/opencode-context-plugin/  # se instalado por projeto
```

## Desenvolvimento

```bash
# Navegue até o diretório do plugin
cd /path/to/opencode-context-plugin

# Adicione como dependência de desenvolvimento (opcional)
npm link
```

## Estrutura do Plugin

```
opencode-context-plugin/
├── package.json    # Configuração npm
├── index.js        # Código principal do plugin
└── README.md       # Este arquivo
```

## Licença

MIT