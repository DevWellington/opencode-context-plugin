#!/bin/bash

set -e

echo "🚀 Instalando @devwellington/opencode-context-plugin..."

# Detectar sistema operacional
if [[ "$OSTYPE" == "darwin"* ]]; then
  PLUGIN_DIR="$HOME/.config/opencode/plugins/opencode-context-plugin"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  PLUGIN_DIR="$HOME/.config/opencode/plugins/opencode-context-plugin"
else
  echo "❌ Sistema operacional não suportado: $OSTYPE"
  exit 1
fi

# Verificar se opencode está instalado
if ! command -v opencode &> /dev/null; then
  echo "❌ OpenCode não encontrado. Instale: https://opencode.ai"
  exit 1
fi

# Criar diretório de plugins se não existir
mkdir -p "$(dirname "$PLUGIN_DIR")"

# Remover instalação anterior se existir
if [ -d "$PLUGIN_DIR" ]; then
  echo "🗑️  Removendo instalação anterior..."
  rm -rf "$PLUGIN_DIR"
fi

# Clonar repositório (última versão estável)
echo "📦 Clonando repositório..."
git clone --depth 1 https://github.com/DevWellington/opencode-context-plugin.git "$PLUGIN_DIR"

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
  if jq -e '.plugin' "$CONFIG_FILE" > /dev/null 2>&1; then
    if ! jq -e '.plugin | index("opencode-context-plugin")' "$CONFIG_FILE" > /dev/null 2>&1; then
      jq '.plugin += ["opencode-context-plugin"]' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
      echo "✅ Plugin adicionado ao config"
    else
      echo "ℹ️  Plugin já está no config"
    fi
  else
    jq '. + {plugin: ["opencode-context-plugin"]}' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
    echo "✅ Plugin adicionado ao config"
  fi
else
  echo "⚠️  jq não encontrado. Adicione manualmente ao $CONFIG_FILE:"
  echo '  "plugin": ["opencode-context-plugin"]'
fi

echo ""
echo "✅ Instalação completa!"
echo ""
echo "📁 Plugin: $PLUGIN_DIR"
echo "📝 Config: $CONFIG_FILE"
echo ""
echo "🔄 Reinicie o OpenCode: opencode"
echo ""
echo "📚 Contextos salvos em: {projeto}/.opencode/context-session/"
echo ""
echo "📦 Alternativa via npm:"
echo "   npm install -g @devwellington/opencode-context-plugin@latest"
echo ""
