# 🚀 Guia de Publicação e Instalação

## Opção 1: Publicar no NPM (Recomendado para uso geral)

### Passo 1: Preparar para publicação

```bash
cd /Users/wellingtonribeiro/projects/opencode-context-plugin

# Verifique se tem conta no npm
npm whoami

# Se não tiver, crie uma conta em https://www.npmjs.com/signup
npm login
```

### Passo 2: Publicar no NPM

```bash
# Teste local primeiro
npm pack

# Publique (versão inicial)
npm publish --access public

# Para atualizações futuras
npm version patch  # 1.0.0 -> 1.0.1
npm publish
```

### Passo 3: Instalar em qualquer computador

```bash
# Instalação global via npm
npm install -g @wellingtonribeiro/opencode-context-plugin

# Ou instale diretamente no opencode
opencode plugin @wellingtonribeiro/opencode-context-plugin@latest --global
```

### Passo 4: Configurar no OpenCode

Edite `~/.config/opencode/opencode.json`:

```json
{
  "plugins": [
    "@wellingtonribeiro/opencode-context-plugin"
  ]
}
```

---

## Opção 2: GitHub (Sem NPM)

### Passo 1: Criar repositório no GitHub

```bash
cd /Users/wellingtonribeiro/projects/opencode-context-plugin

# Inicialize o git se não tiver
git init

# Adicione os arquivos
git add .
git commit -m "Initial commit: opencode context plugin"

# Crie o repositório no GitHub (via web ou CLI)
gh repo create opencode-context-plugin --public --source=. --push
```

### Passo 2: Instalar via Git em qualquer computador

```bash
# Clone para a pasta de plugins do opencode
git clone https://github.com/wellingtonribeiro/opencode-context-plugin.git \
  ~/.config/opencode/plugins/context-plugin
```

### Passo 3: Configurar

Edite `~/.config/opencode/opencode.json`:

```json
{
  "plugins": ["context-plugin"]
}
```

---

## Opção 3: Instalação Rápida (Script Único)

Crie um script de instalação:

```bash
#!/bin/bash
# install.sh

PLUGIN_DIR="$HOME/.config/opencode/plugins/context-plugin"

echo "🔧 Instalando opencode-context-plugin..."

# Criar diretório
mkdir -p "$PLUGIN_DIR"

# Clonar ou atualizar
if [ -d "$PLUGIN_DIR/.git" ]; then
  cd "$PLUGIN_DIR" && git pull
else
  git clone https://github.com/wellingtonribeiro/opencode-context-plugin.git "$PLUGIN_DIR"
fi

# Adicionar ao config se não existir
CONFIG_FILE="$HOME/.config/opencode/opencode.json"
if ! grep -q "context-plugin" "$CONFIG_FILE" 2>/dev/null; then
  # Backup
  cp "$CONFIG_FILE" "${CONFIG_FILE}.bak"
  
  # Adicionar plugin (simplificado)
  echo "⚠️  Adicione manualmente ao $CONFIG_FILE:"
  echo '  "plugins": ["context-plugin"]'
fi

echo "✅ Instalação completa!"
echo "🔄 Reinicie o OpenCode: opencode"
```

Uso:
```bash
curl -fsSL https://raw.githubusercontent.com/wellingtonribeiro/opencode-context-plugin/main/install.sh | bash
```

---

## Opção 4: Copia Manual (Desenvolvimento/Testing)

### No seu computador atual:

```bash
# Copiar para plugins globais
cp -r /Users/wellingtonribeiro/projects/opencode-context-plugin \
  ~/.config/opencode/plugins/context-plugin
```

### Em outro computador:

```bash
# Via SCP/RSYNC
scp -r ~/projects/opencode-context-plugin user@outro-pc:~/.config/opencode/plugins/

# Ou via USB/Drive
# 1. Copie a pasta para um drive
# 2. No outro PC: cp -r /drive/opencode-context-plugin ~/.config/opencode/plugins/context-plugin
```

---

## 📋 Checklist de Publicação

### Antes de publicar:

- [ ] `package.json` com nome único (`@wellingtonribeiro/opencode-context-plugin`)
- [ ] `README.md` completo com instruções de instalação
- [ ] `LICENSE` (MIT já está)
- [ ] `.gitignore` configurado
- [ ] Testado em múltiplos projetos
- [ ] Versionamento semântico (1.0.0)

### Após publicar:

- [ ] Documentação atualizada no GitHub
- [ ] Instruções de instalação claras
- [ ] Exemplos de uso
- [ ] Changelog (opcional)

---

## 🌍 Instalação em Múltiplos Computadores

### Método recomendado (NPM + Config Sync):

1. **Publique no NPM** (Opção 1)

2. **Sincronize sua config** via dotfiles:

```bash
# No seu repositório de dotfiles
echo 'opencode plugin @wellingtonribeiro/opencode-context-plugin@latest --global' >> ~/.dotfiles/install.sh
```

3. **Em cada computador novo**:

```bash
# Instale o plugin
npm install -g @wellingtonribeiro/opencode-context-plugin

# Ou via opencode CLI
opencode plugin @wellingtonribeiro/opencode-context-plugin@latest --global
```

---

## 🔗 Links Úteis

- [NPM Publish Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [OpenCode Plugin Docs](https://opencode.ai/docs/plugins)
- [Semantic Versioning](https://semver.org/)

---

## 📊 Comparação de Métodos

| Método | Facilidade | Atualização | Offline | Recomendado para |
|--------|-----------|-------------|---------|------------------|
| **NPM** | ⭐⭐⭐⭐⭐ | Automática | ❌ | Produção / Geral |
| **GitHub** | ⭐⭐⭐⭐ | Git pull | ✅ | Dev / Teams |
| **Script** | ⭐⭐⭐⭐⭐ | Automática | ❌ | Distribuição fácil |
| **Manual** | ⭐⭐ | Manual | ✅ | Testing / Local |

---

## 🎯 Minha Recomendação

**Para você usar em todos os computadores:**

1. **Publique no NPM** (5 minutos)
2. **Crie repositório GitHub** (público ou privado)
3. **Use o script de instalação** para facilitar

Assim você:
- ✅ Tem backup na nuvem
- ✅ Instala em qualquer PC com 1 comando
- ✅ Recebe updates facilmente
- ✅ Pode compartilhar com outros

Quer que eu crie o script de instalação e o `.gitignore` completo?
