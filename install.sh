#!/bin/bash

set -e

echo "🚀 Instalando opencode-context-plugin..."

# Detectar sistema operacional
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  PLUGIN_DIR="$HOME/.config/opencode/plugins/context-plugin"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # Linux
  PLUGIN_DIR="$HOME/.config/opencode/plugins/context-plugin"
else
  echo "❌ Sistema operacional não suportado: $OSTYPE"
  exit 1
fi

# Verificar se opencode está instalado
if ! command -v opencode &> /dev/null; then
  echo "❌ OpenCode não encontrado. Instale primeiro: https://opencode.ai"
  exit 1
fi

# Criar diretório de plugins se não existir
mkdir -p "$(dirname "$PLUGIN_DIR")"

# Remover instalação anterior se existir
if [ -d "$PLUGIN_DIR" ]; then
  echo "🗑️  Removendo instalação anterior..."
  rm -rf "$PLUGIN_DIR"
fi

# Clonar repositório
echo "📦 Clonando repositório..."
git clone https://github.com/DevWellington/opencode-context-plugin.git "$PLUGIN_DIR"

# Verificar se o config do opencode existe
CONFIG_FILE="$HOME/.config/opencode/opencode.json"
BACKUP_FILE="$HOME/.config/opencode/opencode.json.bak"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "⚠️  Config do OpenCode não encontrado. Criando..."
  mkdir -p "$(dirname "$CONFIG_FILE")"
  echo '{}' > "$CONFIG_FILE"
fi

# Backup do config original
cp "$CONFIG_FILE" "$BACKUP_FILE"

# Adicionar plugin ao config (usando jq se disponível, senão fallback)
if command -v jq &> /dev/null; then
  # Usar jq para manipulação JSON segura
  if jq -e '.plugins' "$CONFIG_FILE" > /dev/null 2>&1; then
    # Array plugins já existe, adicionar se não existir
    if ! jq -e '.plugins | index("context-plugin")' "$CONFIG_FILE" > /dev/null 2>&1; then
      jq '.plugins += ["context-plugin"]' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
      echo "✅ Plugin adicionado ao config"
    else
      echo "⚠️  Plugin já está no config"
    fi
  else
    # Array plugins não existe, criar
    jq '. + {plugins: ["context-plugin"]}' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
    echo "✅ Plugin adicionado ao config"
  fi
else
  # Fallback sem jq - instrução manual
  echo "⚠️  jq não encontrado. Adicione manualmente ao $CONFIG_FILE:"
  echo ""
  echo '  "plugins": ["context-plugin"]'
  echo ""
fi

echo ""
echo "✅ Instalação completa!"
echo ""
echo "📁 Plugin instalado em: $PLUGIN_DIR"
echo "📝 Config: $CONFIG_FILE"
echo ""
echo "🔄 Reinicie o OpenCode:"
echo "   opencode"
echo ""
echo "📚 Ver arquivos de contexto em:"
echo "   {seu-projeto}/.opencode/contextos/"
echo ""
