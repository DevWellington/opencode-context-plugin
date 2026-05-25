# Guia Extremamente Detalhado - Evolução do Projeto OpenCode Context Plugin (Modelo Menor)

## Objetivo
Este guia orienta um modelo menor (nível júnior) a executar uma rodada de evolução do projeto com foco em:
1. Redução de complexidade e acoplamento.
2. Estabilidade de contratos (interfaces de retorno e parsing).
3. Utilidade prática e confiabilidade do arquivo de intelligence.
4. Qualidade contínua com evidência objetiva.

---

## 1) Por que isso importa para usuários do OpenCode

### Valor para o usuário
- Menos retrabalho entre sessões.
- Melhor continuidade de contexto.
- Menos regressões em fluxos de resumo/intelligence.
- Mais previsibilidade em automações e sincronização.

### Resultado esperado
- Projeto mais confiável para uso diário em times e uso solo.
- `intelligence-learning.md` mais acionável e consistente.

---

## 2) Regras obrigatórias do executor
1. Trabalhe em pequenas entregas por fase.
2. Não mude comportamento sem cobertura de teste.
3. Sempre rode suíte alvo após cada patch.
4. Documente evidência por fase (arquivos + comandos + resultado).
5. Se houver dúvida, prefira previsibilidade à criatividade.

---

## 3) Skills e agentes (obrigatório)

## Skills sugeridas
- `github:github`: usar para mapear contexto de PR/issue, quando necessário.
- `github:gh-fix-ci`: usar se qualquer mudança quebrar CI/checks.
- `openai-docs`: usar apenas se surgir dúvida sobre integração específica com APIs OpenAI.

## Agentes internos (papéis)
- **Agente de Diagnóstico**: identifica causa raiz antes de alterar código.
- **Agente de Implementação**: aplica patch mínimo e seguro.
- **Agente de Testes**: executa e interpreta resultados.
- **Agente de Refatoração**: melhora legibilidade sem mudar regra de negócio.
- **Agente de Validação Final**: confirma DoD e escreve relatório final.

## Ordem obrigatória
Diagnóstico -> Implementação -> Testes -> Refatoração -> Re-testes -> Validação Final.

---

## 4) Escopo desta rodada (macro)

### Trilhas de melhoria
1. **Contratos e APIs internas**
- Uniformizar shape de retorno em módulos críticos (ex.: sync e intelligence).
- Padronizar tratamento de erro esperado vs inesperado.

2. **Intelligence confiável e útil**
- Garantir deduplicação sem perda de dados válidos.
- Garantir contagens e metadados coerentes (`projectState`, `projects`, `sessions`).
- Melhorar testes que comprovam valor real do arquivo de intelligence.

3. **Redução de complexidade estrutural**
- Eliminar acoplamentos desnecessários entre agentes/módulos.
- Consolidar helpers repetidos e contratos implícitos.

4. **Testabilidade e isolamento**
- Isolar paths globais em testes.
- Reduzir flakiness e dependência de ambiente.

---

## 5) Fluxo faseado extremamente detalhado

## Fase A - Baseline e observabilidade do estado atual

### A.1 Tarefas
- Listar arquivos alterados e críticos.
- Executar suites críticas e suite completa.
- Salvar baseline textual dos resultados.

### A.2 Comandos
```bash
git status --short
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/intelligence-reference.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/intelligenceTemplate.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/globalIntelligence.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/remoteSync.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand
```

### A.3 Checklist de saída
- [ ] Baseline registrado (pass/fail/skip por suíte).
- [ ] Lista de riscos atuais em até 10 linhas.

---

## Fase B - Diagnóstico orientado por risco

### B.1 Riscos-alvo
1. Contrato inconsistente de retorno em caminhos de erro.
2. Deduplicação potencialmente destrutiva.
3. Contagens/metadados de intelligence inconsistentes.
4. Dependência em paths globais reais nos testes.

### B.2 Tarefas do Agente de Diagnóstico
- Mapear funções críticas e contratos esperados.
- Identificar pontos de mutabilidade global.
- Identificar áreas sem teste comportamental forte.

### B.3 Entrega da fase
- Matriz: `risco -> arquivo -> impacto -> prioridade`.

---

## Fase C - Implementação trilha 1 (Contratos estáveis)

## Objetivo
Padronizar contratos de retorno e erro em módulos críticos.

### C.1 Arquivos candidatos
- `src/modules/syncOperations.js`
- `src/modules/syncState.js`
- `src/agents/intelligence/sessionTransformer.js`

### C.2 Regras de implementação
- Sempre retornar objetos com shape previsível.
- Preservar campos essenciais em todos os branches (`success`, `error`, etc., quando aplicável).
- Evitar throw em fluxos operacionais esperados (usar retorno estruturado).

### C.3 Testes obrigatórios
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/remoteSync.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/intelligence-reference.test.js --runInBand
```

### C.4 Critério de aceite
- Zero falha nas suites relacionadas.
- Nenhuma mudança de contrato sem atualização de testes.

---

## Fase D - Implementação trilha 2 (Intelligence útil e consistente)

## Objetivo
Aumentar confiabilidade e valor prático do intelligence.

### D.1 Tarefas
- Validar deduplicação por sessão (não por bloco inteiro).
- Garantir contagens/metadados coerentes (`projectState`, projects/sessions).
- Garantir que o conteúdo gerado continue legível e compacto.

### D.2 Arquivos candidatos
- `src/agents/intelligence/deduplicator.js`
- `src/agents/intelligence/sessionTransformer.js`
- `src/agents/intelligenceTemplate.js`
- `src/utils/globalIntelligence.js`

### D.3 Testes obrigatórios
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/intelligence-reference.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/intelligenceTemplate.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/globalIntelligence.test.js --runInBand
```

### D.4 Critério de aceite
- Sem perda de sessões válidas por deduplicação.
- Metadados consistentes com conteúdo real.
- Formato do arquivo de intelligence aprovado pelos testes.

---

## Fase E - Implementação trilha 3 (Redução de complexidade)

## Objetivo
Refatorar com segurança, sem alterar comportamento.

### E.1 Permitido
- Extração de helpers pequenos.
- Remoção de duplicações locais.
- Comentários curtos em blocos críticos.

### E.2 Proibido
- Reescrita ampla.
- Mudança de regra de negócio escondida em refatoração.

### E.3 Verificação
- Reexecutar suites de inteligência e sync após cada refatoração.

---

## Fase F - Isolamento de testes e anti-flakiness

## Objetivo
Garantir reprodutibilidade local e em CI.

### F.1 Tarefas
- Confirmar injeção de paths em testes que tocam disco global.
- Garantir reset de estado global entre testes.
- Evitar dependência de ordem de execução.

### F.2 Testes obrigatórios
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/remoteSync.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/globalIntelligence.test.js --runInBand
```

---

## Fase G - Validação final (gate)

### G.1 Comandos finais
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/intelligence-reference.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/intelligenceTemplate.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/globalIntelligence.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/remoteSync.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand
```

### G.2 Definition of Done (DoD)
- [ ] Suíte completa verde.
- [ ] Sem regressão em intelligence.
- [ ] Contratos estáveis e previsíveis.
- [ ] Isolamento de testes validado.
- [ ] Diff coerente e enxuto.

---

## 6) Protocolo de resposta a falhas (passo a passo)

Se um teste falhar:
1. Leia apenas a primeira falha completa.
2. Identifique arquivo/função exata.
3. Corrija uma única causa.
4. Reexecute só a suíte relevante.
5. Só depois rode a suíte completa.

Se comportamento for inconsistente entre execuções:
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js --clearCache
```
Reexecute a suíte alvo e valide paths efetivos.

---

## 7) Entrega obrigatória do executor (template)

```md
# Relatório de Execução - Evolução do Projeto

## 1. Resumo
- Objetivo da rodada:
- Status final:

## 2. Mudanças por trilha
### Trilha 1 (Contratos)
- Arquivos:
- Mudanças:
- Evidências:

### Trilha 2 (Intelligence)
- Arquivos:
- Mudanças:
- Evidências:

### Trilha 3 (Complexidade/Refatoração)
- Arquivos:
- Mudanças:
- Evidências:

## 3. Testes executados
- Comandos:
- Resultados:

## 4. Riscos residuais
- Risco:
- Mitigação sugerida:

## 5. DoD
- [ ] suíte completa verde
- [ ] sem regressão em intelligence
- [ ] contratos estáveis
- [ ] isolamento de ambiente validado
```

---

## 8) Prompt pronto para chamar o modelo menor

```text
Siga estritamente o arquivo GUIA_EXECUCAO_MODELO_MENOR_EVOLUCAO_PROJETO_OPENCODE.md.
Execute em fases A -> G sem pular checklist.
Use os agentes internos descritos (Diagnóstico, Implementação, Testes, Refatoração, Validação).
Após cada fase, reporte evidências objetivas (arquivos alterados + comandos + resultados).
Faça patches pequenos, seguros e incrementais.
No final, entregue o relatório preenchido no template da seção 7.
```

