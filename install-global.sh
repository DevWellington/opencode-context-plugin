#!/bin/bash

set -e

echo "🚀 Instalando plugin globalmente e configurando projetos..."

# Instalação global (código do plugin)
GLOBAL_PLUGIN_DIR="$HOME/.config/opencode/plugins/opencode-context-plugin"

echo "📦 Instalando plugin em $GLOBAL_PLUGIN_DIR..."
if [ -d "$GLOBAL_PLUGIN_DIR" ]; then
  echo "🗑️  Removendo versão anterior..."
  rm -rf "$GLOBAL_PLUGIN_DIR"
fi

git clone --depth 1 https://github.com/DevWellington/opencode-context-plugin.git "$GLOBAL_PLUGIN_DIR"

# Configuração global
GLOBAL_CONFIG="$HOME/.config/opencode/opencode.json"
if [ ! -f "$GLOBAL_CONFIG" ]; then
  echo '{}' > "$GLOBAL_CONFIG"
fi

# Adicionar ao config global se não existir
if ! grep -q "opencode-context-plugin" "$GLOBAL_CONFIG" 2>/dev/null; then
  if command -v jq &> /dev/null; then
    jq '.plugin = (.plugin // []) + ["opencode-context-plugin"] | unique' "$GLOBAL_CONFIG" > "${GLOBAL_CONFIG}.tmp" && mv "${GLOBAL_CONFIG}.tmp" "$GLOBAL_CONFIG"
  fi
  echo "✅ Plugin adicionado ao config global"
else
  echo "ℹ️  Plugin já está no config global"
fi

# Instalar em todos os projetos OpenCode existentes
echo ""
echo "📁 Configurando projetos existentes..."

PROJECTS=$(find "$HOME/projects" -name ".opencode" -type d 2>/dev/null | sed 's/\/.opencode$//')

for PROJECT in $PROJECTS; do
  OPENCODE_DIR="$PROJECT/.opencode"
  CONFIG_FILE="$OPENCODE_DIR/opencode.json"
  
  # Pular o próprio projeto do plugin
  if [ "$PROJECT" = "$HOME/projects/opencode-context-plugin" ]; then
    continue
  fi
  
  echo "  → $PROJECT"
  
  # Criar config local se não existir
  if [ ! -f "$CONFIG_FILE" ]; then
    echo '{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-context-plugin"]
}' > "$CONFIG_FILE"
    echo "    ✅ Config local criada"
  else
    # Adicionar plugin se não existir
    if ! grep -q "opencode-context-plugin" "$CONFIG_FILE" 2>/dev/null; then
      if command -v jq &> /dev/null; then
        jq '.plugin = (.plugin // []) + ["opencode-context-plugin"] | unique' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
      fi
      echo "    ✅ Plugin adicionado"
    else
      echo "    ℹ️  Já configurado"
    fi
  fi
done

echo ""
echo "✅ Instalação completa!"
echo ""
echo "📋 Resumo:"
echo "   • Plugin instalado: $GLOBAL_PLUGIN_DIR"
echo "   • Config global: $GLOBAL_CONFIG"
echo "   • Projetos configurados: $(echo "$PROJECTS" | wc -l | tr -d ' ')"
echo ""
echo "🔄 Reinicie o OpenCode e os arquivos serão salvos em:"
echo "   {projeto}/.opencode/context-session/"
echo ""
