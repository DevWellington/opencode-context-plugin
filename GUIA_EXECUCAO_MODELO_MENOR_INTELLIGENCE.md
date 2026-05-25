# Guia Extremamente Detalhado de Execução (Modelo Menor) - Intelligence

## Objetivo deste guia
Este documento é um roteiro passo a passo para um modelo menor executar correções e melhorias no fluxo de `intelligence` com segurança, previsibilidade e evidência objetiva.

Ele foi escrito em nível júnior: siga exatamente a ordem das fases e não pule checkpoints.

---

## 0) Perfil de execução esperado

### Papel do executor (modelo menor)
- Você é o **implementador principal**.
- Você deve agir com disciplina: alterações pequenas, testes frequentes, validação contínua.
- Não tente "otimizar tudo" de uma vez.

### Princípios obrigatórios
1. Faça mudanças pequenas e verificáveis.
2. Sempre rode testes após cada bloco de alteração.
3. Nunca conclua sem evidências (diff + testes + checklist).
4. Preserve contratos públicos existentes (ou documente mudanças de contrato).
5. Em dúvida, prefira previsibilidade à criatividade.

---

## 1) Skills e agentes (obrigatório usar)

### Skills a usar durante a execução
- `github:github` (se precisar contexto de PR/issue/histórico, quando aplicável).
- `github:gh-fix-ci` (se houver falha de CI após implementação).
- `openai-docs` (somente se precisar confirmar padrões de APIs OpenAI; não é esperado para este escopo).

### Agentes internos recomendados (papéis)
Use mentalmente estes “subagentes” em sequência:
1. **Agente de Diagnóstico**: confirma causa raiz antes de editar.
2. **Agente de Implementação**: aplica patch mínimo e seguro.
3. **Agente de Testes**: executa suíte alvo e interpreta falhas.
4. **Agente de Refatoração**: limpa dívidas pequenas sem mudar comportamento.
5. **Agente de Validação Final**: confirma DoD e evidencia resultados.

### Regra de orquestração
- Apenas 1 agente “ativo” por vez.
- Só avance de agente após checklist da etapa atual passar.

---

## 2) Escopo técnico desta rodada

### Arquivos críticos
- `src/agents/intelligence/sessionTransformer.js`
- `src/agents/intelligence/deduplicator.js`
- `src/agents/intelligence/sanitizer.js`
- `src/agents/intelligenceTemplate.js`
- `src/agents/generateIntelligenceLearning.js`
- `src/utils/globalIntelligence.js`
- `src/modules/syncState.js`
- `src/modules/syncOperations.js`
- `tests/intelligence-reference.test.js`
- `tests/intelligenceTemplate.test.js`
- `tests/globalIntelligence.test.js`
- `tests/remoteSync.test.js`

### Objetivos de qualidade desta rodada
1. Garantir robustez funcional do fluxo `intelligence`.
2. Eliminar riscos de regressão silenciosa.
3. Manter suíte verde e reproduzível.
4. Melhorar isolamento de ambiente em testes.

---

## 3) Fluxo operacional (faseado)

## Fase A - Preparação e baseline

### A.1 Checklist inicial
- [ ] Confirmar branch e estado do workspace.
- [ ] Ler arquivos críticos (não editar ainda).
- [ ] Rodar testes alvo para baseline.

### A.2 Comandos sugeridos
```bash
git status --short
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/intelligence-reference.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/intelligenceTemplate.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/remoteSync.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/globalIntelligence.test.js --runInBand
```

### A.3 Saída esperada
- Baseline documentado com pass/fail por suíte.
- Lista curta de falhas atuais (se houver).

### A.4 Critério para avançar
- Você consegue reproduzir o estado atual localmente.

---

## Fase B - Diagnóstico guiado por risco

### B.1 Risco 1: deduplicação descartar blocos válidos
Arquivo: `src/agents/intelligence/deduplicator.js`
- Verificar a lógica de deduplicação por bloco.
- Objetivo: impedir perda de sessões válidas quando só parte do bloco é duplicada.

### B.2 Risco 2: path override parcial em Global Intelligence
Arquivo: `src/utils/globalIntelligence.js`
- Verificar se `setGlobalIntelligencePath()` afeta também criação de diretório.
- Objetivo: evitar escrita acidental no HOME real durante testes.

### B.3 Risco 3: coerência de contrato nos retornos de sync
Arquivo: `src/modules/syncOperations.js`
- Verificar shape de retorno em todos os caminhos (sucesso/erro/not-configured).
- Objetivo: uniformidade de contrato para consumidores e testes.

### B.4 Critério para avançar
- Causa raiz de cada risco escrita em 1-2 linhas, com arquivo e linha.

---

## Fase C - Implementação incremental (pequenos patches)

### C.1 Regra de patch
- Um patch por problema.
- Rodar testes relevantes após cada patch.

### C.2 Patch 1 (deduplicação segura)
Objetivo:
- Alterar deduplicação para descartar sessão duplicada, não bloco inteiro.

Teste mínimo após patch:
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/intelligence-reference.test.js --runInBand
```

### C.3 Patch 2 (path override completo global intelligence)
Objetivo:
- Garantir que criação de diretório derive do caminho efetivo retornado por `getGlobalIntelligencePath()` quando override estiver ativo.

Teste mínimo após patch:
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/globalIntelligence.test.js --runInBand
```

### C.4 Patch 3 (contrato de retorno sync consistente)
Objetivo:
- Validar que todos os retornos tenham shape consistente (`success`, `uploaded`, `failed`, `error` quando aplicável).

Teste mínimo após patch:
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/remoteSync.test.js --runInBand
```

### C.5 Critério para avançar
- Cada patch aprovado pela suíte alvo correspondente.

---

## Fase D - Refatoração controlada (sem mudar comportamento)

### D.1 Itens permitidos
- Extração de função pequena para legibilidade.
- Renomeação local mais clara.
- Comentário sucinto em blocos complexos.

### D.2 Itens proibidos nesta fase
- Mudança de contrato público.
- Reescrita ampla.
- Misturar refatoração com nova regra de negócio.

### D.3 Validação pós-refatoração
Rodar novamente as suítes críticas:
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/intelligence-reference.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/intelligenceTemplate.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/remoteSync.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/globalIntelligence.test.js --runInBand
```

---

## Fase E - Validação final (gate)

### E.1 Execução completa
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand
```

### E.2 Definição de Pronto (DoD)
- [ ] Suíte completa verde.
- [ ] Sem regressão em inteligência.
- [ ] Paths de teste isolados (sem depender do HOME real).
- [ ] Contratos estáveis documentados.
- [ ] Diff revisado e coerente com escopo.

---

## 4) Protocolo de decisão para o modelo menor (anti-erro)

### Se um teste falhar
1. Não abrir 5 arquivos ao mesmo tempo.
2. Ler apenas stack trace + arquivo alvo.
3. Corrigir 1 causa por vez.
4. Reexecutar apenas suíte relacionada.
5. Só então voltar para suíte completa.

### Se aparecer comportamento estranho entre execuções
1. Limpar cache do Jest:
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js --clearCache
```
2. Reexecutar suíte-alvo.
3. Se persistir, checar variáveis de ambiente e path efetivo dos arquivos de estado.

### Se houver dúvida de contrato
- Preserve comportamento atual aprovado por testes.
- Se precisar mudar contrato, atualize testes e documentação na mesma alteração.

---

## 5) Template de relatório final do executor (copiar e preencher)

```md
# Relatório de Execução - Intelligence

## 1. Resumo
- Objetivo:
- Status final:

## 2. Mudanças por arquivo
- arquivo:
  - alteração:
  - motivo:

## 3. Testes executados
- comando:
- resultado:

## 4. Riscos e mitigação
- risco:
- mitigação:

## 5. DoD
- [ ] suíte completa verde
- [ ] sem regressão funcional
- [ ] isolamento de ambiente validado
- [ ] contratos estáveis
```

---

## 6) Orientação de chamada (prompt) para o modelo menor

Use exatamente este prompt para iniciar o executor:

```text
Siga estritamente o arquivo GUIA_EXECUCAO_MODELO_MENOR_INTELLIGENCE.md.
Execute por fases (A até E), sem pular checklist.
Use o fluxo de agentes descrito (Diagnóstico, Implementação, Testes, Refatoração, Validação).
Após cada fase, reporte evidências objetivas (arquivos alterados + comandos + resultado).
Não faça mudanças amplas; use patches pequenos e verificáveis.
No final, entregue o relatório preenchido no formato do template da seção 5.
```

