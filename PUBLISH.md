# Guia de Publicação - OpenCode Context Plugin

## Pacote npm

**Pacote:** `@devwellington/opencode-context-plugin`
**Versão atual:** 1.3.4
**NPM:** https://www.npmjs.com/package/@devwellington/opencode-context-plugin
**GitHub:** https://github.com/DevWellington/opencode-context-plugin

## Publicar Atualizações

### 1. Preparar e testar

```bash
cd /path/to/opencode-context-plugin

# Edite index.js com as mudanças
# Teste localmente em projetos
```

### 2. Versionar e publicar

```bash
# Patch (1.3.4 → 1.3.5) - bug fixes
npm version patch

# Minor (1.3.4 → 1.4.0) - novas features
npm version minor

# Publish
npm publish
```

### 3. Atualizar instalação global

```bash
npm install -g @devwellington/opencode-context-plugin@latest
```

### 4. Verificar

```bash
npm view @devwellington/opencode-context-plugin versions
```

## Checklist de Release

- [ ] Testar em múltiplos projetos
- [ ] Atualizar CHANGELOG no README
- [ ] Bump version no package.json
- [ ] Commit e push para GitHub
- [ ] Publish no NPM
- [ ] Atualizar instalação global com npm install -g

## Estrutura do Projeto

```
opencode-context-plugin/
├── index.js          # Plugin principal (ESM, V2 export)
├── package.json      # Configuração npm
├── README.md         # Documentação
├── AGENTS.md         # Instruções para agentes
└── old/              # Arquivos antigos/deprecados
```

## Links

- [NPM Package](https://www.npmjs.com/package/@devwellington/opencode-context-plugin)
- [GitHub Repo](https://github.com/DevWellington/opencode-context-plugin)
