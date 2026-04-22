# Guia de Publicação - OpenCode Context Plugin

## Pacote npm

**Pacote:** `@devwellington/opencode-context-plugin`
**Versão atual:** 1.5.0
**NPM:** https://www.npmjs.com/package/@devwellington/opencode-context-plugin
**GitHub:** https://github.com/DevWellington/opencode-context-plugin

## Publicar Atualizações

### 1. Preparar e testar

```bash
cd /path/to/opencode-context-plugin
npm test
```

### 2. Versionar e publicar

```bash
# Patch (1.4.1 → 1.4.2) - bug fixes
npm version patch

# Minor (1.4.1 → 1.5.0) - novas features
npm version minor

# Publish
npm publish --access public
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

- [x] Testar com `npm test` (263 testes passando)
- [x] Atualizar CHANGELOG.md
- [x] Bump version no package.json
- [x] Commit e push para GitHub
- [x] Publish no NPM
- [x] Atualizar instalação global com `npm install -g`

## Estrutura do Projeto

```
opencode-context-plugin/
├── index.js              # Plugin principal (ESM, V2 export)
├── package.json          # Configuração npm
├── README.md             # Documentação
├── AGENTS.md            # Instruções para agentes
├── agents/              # 11 agentes @ocp-* (.md files)
├── src/
│   ├── agents/          # Geradores de relatório
│   │   ├── generateToday.js
│   │   ├── generateWeekly.js
│   │   ├── generateMonthly.js
│   │   ├── generateAnnual.js
│   │   └── generateIntelligenceLearning.js
│   └── modules/        # Módulos principais
└── .opencode/
    └── context-session/ # Estrutura hierárquica
        ├── daily-summary.md
        ├── intelligence-learning.md
        └── YYYY/
            ├── annual-YYYY.md
            └── MM/
                ├── monthly-YYYY-MM.md
                └── WW/
                    ├── week-summary.md
                    └── DD/
                        ├── day-summary.md
                        └── session files
```

## Fluxo Hierárquico de Relatórios

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

## Links

- [NPM Package](https://www.npmjs.com/package/@devwellington/opencode-context-plugin)
- [GitHub Repo](https://github.com/DevWellington/opencode-context-plugin)
