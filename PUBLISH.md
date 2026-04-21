# 🚀 Guia de Publicação - OpenCode Context Plugin

## ✅ Publicado no NPM

**Pacote:** `@devwellington/opencode-context-plugin`  
**Versão atual:** 1.1.0  
**NPM:** https://www.npmjs.com/package/@devwellington/opencode-context-plugin  
**GitHub:** https://github.com/DevWellington/opencode-context-plugin

---

## 📦 Instalação

### Método 1: NPM (Recomendado)

```bash
# Instalação global
npm install -g @devwellington/opencode-context-plugin@latest

# Ou direto no opencode
opencode plugin @devwellington/opencode-context-plugin@latest --global
```

### Método 2: Script

```bash
curl -fsSL https://raw.githubusercontent.com/DevWellington/opencode-context-plugin/main/install.sh | bash
```

### Método 3: Git

```bash
git clone https://github.com/DevWellington/opencode-context-plugin.git \
  ~/.config/opencode/plugins/opencode-context-plugin
```

---

## 🔄 Como Publicar Atualizações

### 1. Preparar release

```bash
cd /path/to/opencode-context-plugin

# Edite index.js com as mudanças
# Atualize versão no package.json
```

### 2. Versionar e publicar

```bash
# Patch (1.1.0 → 1.1.1) - bug fixes
npm version patch

# Minor (1.1.0 → 1.2.0) - novas features
npm version minor

# Major (1.1.0 → 2.0.0) - breaking changes
npm version major

# Push e publish
git push && git push --tags
npm publish --access public
```

### 3. Verificar publicação

```bash
npm view @devwellington/opencode-context-plugin
npm view @devwellington/opencode-context-plugin versions
```

---

## 📋 Checklist de Release

- [ ] Testar em múltiplos projetos
- [ ] Atualizar CHANGELOG no README
- [ ] Bump version no package.json
- [ ] Commit e tag
- [ ] Push para GitHub
- [ ] Publish no NPM
- [ ] Testar instalação via npm

---

## 🛠️ Desenvolvimento

### Testar localmente

```bash
# Copie para pasta de plugins
cp index.js ~/.config/opencode/plugins/opencode-context-plugin/index.js

# Reinicie opencode
opencode

# Veja logs
tail -f ~/.opencode-context-plugin.log
```

### Estrutura do projeto

```
opencode-context-plugin/
├── index.js          # Plugin principal
├── package.json      # Configuração npm
├── install.sh        # Script de instalação
├── README.md         # Documentação
├── PUBLISH.md        # Este arquivo
└── .gitignore
```

---

## 📊 Versões

| Versão | Data | Mudanças |
|--------|------|----------|
| 1.1.0 | 2026-04-21 | Captura completa de mensagens, injeção de contexto |
| 1.0.x | 2026-04-20 | Versões iniciais de teste |

---

## 🔗 Links

- [NPM Package](https://www.npmjs.com/package/@devwellington/opencode-context-plugin)
- [GitHub Repo](https://github.com/DevWellington/opencode-context-plugin)
- [NPM Publish Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)

---

## 🎯 Próximos Passos

- [ ] Adicionar opção para configurar número de sessões injetadas
- [ ] Suporte a auto-save periódico
- [ ] Filtro de tool outputs para economia de tokens
- [ ] Compressão de contexto antigo
