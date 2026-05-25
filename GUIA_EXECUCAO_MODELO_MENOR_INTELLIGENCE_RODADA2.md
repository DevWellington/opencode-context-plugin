# Guia Extremamente Detalhado (Rodada 2) - Correções Pós Code Review de Intelligence

## Objetivo
Este guia é para um modelo menor (nível júnior) executar as correções pós-review com segurança.

Foco desta rodada:
1. Corrigir contagem de projetos em `globalIntelligence`.
2. Corrigir deduplicação para não perder sessões válidas.
3. Restaurar cobertura de comportamento default de path sem quebrar isolamento de testes.

---

## 1) Regras de execução (obrigatórias)
1. Faça apenas mudanças pequenas e testáveis.
2. Não misture correções diferentes no mesmo patch.
3. Rode testes após cada patch.
4. Registre evidência objetiva: comando + resultado + arquivo alterado.
5. Não conclua sem suíte alvo verde.

---

## 2) Skills e agentes (obrigatório)

### Skills a utilizar
- `github:github` (apenas se precisar contexto de PR/issue/histórico).
- `github:gh-fix-ci` (se CI falhar após correções).

### Agentes internos (papéis)
- **Agente de Diagnóstico**: confirma causa raiz no código.
- **Agente de Implementação**: aplica patch mínimo.
- **Agente de Testes**: roda suite alvo imediatamente.
- **Agente de Refatoração**: limpa legibilidade sem mudar comportamento.
- **Agente de Validação Final**: confirma DoD e relatório.

### Ordem obrigatória
Diagnóstico → Implementação → Testes → (opcional) Refatoração → Re-testes → Validação final.

---

## 3) Escopo de arquivos

### Código
- `src/utils/globalIntelligence.js`
- `src/agents/intelligence/deduplicator.js`

### Testes
- `tests/globalIntelligence.test.js`
- `tests/intelligence-reference.test.js`
- `tests/intelligenceTemplate.test.js` (sanidade)

---

## 4) Fluxo faseado de execução

## Fase A - Baseline e diagnóstico

### A.1 Comandos
```bash
git status --short
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/globalIntelligence.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/intelligence-reference.test.js --runInBand
```

### A.2 Diagnóstico obrigatório
- Verificar onde `Projects` é calculado em `globalIntelligence`.
- Verificar deduplicação por bloco em `parseExistingEntries`.
- Verificar quais testes de path default estão `skip` e por quê.

### A.3 Critério de saída da fase
- Causa raiz escrita para os 3 pontos, com arquivo/linha.

---

## Fase B - Correção 1 (contagem de projetos)

## Problema
`Projects` usa regex ampla e pode contar headings que não são projetos.

## Objetivo
Contar apenas entradas reais de projeto no bloco correto.

### B.1 Estratégia recomendada
- Localizar seção `### Active Projects`.
- Contar apenas headings de projeto inseridos por `updateGlobalIntelligence`.
- Evitar contar headings estruturais (Recurring Themes, etc.).

### B.2 Patch mínimo esperado
- Alteração limitada a `src/utils/globalIntelligence.js`.
- Sem alterar formato de arquivo já usado por consumidores.

### B.3 Testes após patch
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/globalIntelligence.test.js --runInBand
```

### B.4 Critério de aceite
- Testes de `updateGlobalIntelligence` continuam verdes.
- Contagem de `Projects` consistente com entradas reais.

---

## Fase C - Correção 2 (deduplicação por sessão)

## Problema
Na deduplicação, um bloco inteiro pode ser descartado ao detectar uma sessão duplicada.

## Objetivo
Deduplicar no nível de sessão e preservar sessões novas no mesmo bloco.

### C.1 Estratégia recomendada
- Parsear entry normalmente.
- Filtrar sessões duplicadas individualmente.
- Recalcular `sessionCount` com sessões remanescentes.
- Descartar entry somente se ficar sem sessões.

### C.2 Patch mínimo esperado
- Alteração focada em `parseExistingEntries` de `src/agents/intelligence/deduplicator.js`.

### C.3 Testes após patch
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/intelligence-reference.test.js --runInBand
```

### C.4 Critério de aceite
- Cenários antigos continuam passando.
- Não há perda de sessões válidas em blocos mistos.

---

## Fase D - Correção 3 (cobertura de path default)

## Problema
Dois testes de path default estão em `skip`, reduzindo cobertura do comportamento padrão.

## Objetivo
Manter isolamento e recuperar cobertura de contrato default.

### D.1 Estratégia recomendada
- Não reativar os testes no mesmo contexto isolado.
- Criar teste(s) dedicados de path default com:
  - `setGlobalIntelligencePath(null)` explícito no início do teste.
  - validação apenas de contrato de path (sem efeitos colaterais globais de escrita).

### D.2 Arquivo alvo
- `tests/globalIntelligence.test.js`

### D.3 Testes após patch
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/globalIntelligence.test.js --runInBand
```

### D.4 Critério de aceite
- Isolamento de ambiente preservado.
- Cobertura de comportamento default restaurada por teste dedicado.

---

## Fase E - Refatoração controlada

### Permitido
- Extração de helper pequeno para legibilidade.
- Nome de variável mais claro.

### Proibido
- Mudar contrato público.
- Refatoração ampla misturada com regra de negócio.

### Verificação
- Reexecutar as suites-alvo após qualquer refatoração.

---

## Fase F - Validação final (gate)

### F.1 Comandos finais
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/globalIntelligence.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/intelligence-reference.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/intelligenceTemplate.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand
```

### F.2 Definition of Done (DoD)
- [ ] Contagem de projetos corrigida.
- [ ] Deduplicação por sessão corrigida sem perda de dados válidos.
- [ ] Cobertura de path default restaurada de forma segura.
- [ ] Suites alvo verdes.
- [ ] Suíte completa verde.

---

## 5) Checklist operacional para o modelo menor

### Antes de editar
- [ ] Entendi o problema em 1 frase.
- [ ] Sei qual arquivo e função vou alterar.

### Depois de editar
- [ ] Rodei a suíte alvo.
- [ ] Resultado registrado.
- [ ] Não quebrei outros contratos.

### Antes de concluir
- [ ] Rodei suíte completa.
- [ ] Reportei diff e evidências.

---

## 6) Template obrigatório de relatório do executor

```md
# Relatório Rodada 2 - Intelligence

## 1. Resumo
- Status final:
- DoD: [atingido/não atingido]

## 2. Correção 1 (Projects count)
- Arquivo:
- Mudança:
- Evidência de teste:

## 3. Correção 2 (Deduplicação)
- Arquivo:
- Mudança:
- Evidência de teste:

## 4. Correção 3 (Cobertura path default)
- Arquivo:
- Mudança:
- Evidência de teste:

## 5. Validação final
- Comandos executados:
- Resultado:
```

---

## 7) Prompt de chamada para o modelo menor

```text
Siga estritamente o arquivo GUIA_EXECUCAO_MODELO_MENOR_INTELLIGENCE_RODADA2.md.
Execute em fases A→F, sem pular checklist.
Use os agentes internos descritos (Diagnóstico, Implementação, Testes, Refatoração, Validação).
A cada fase, reporte evidências objetivas (arquivos alterados, comandos e resultados).
Faça patches pequenos e seguros.
No final, entregue o relatório completo no template da seção 6.
```

