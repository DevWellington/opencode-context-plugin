# Plano de Correções - Review da Implementação de Intelligence

## Objetivo
Corrigir os achados do review na implementação de `intelligence`, com foco em comportamento, cobertura de testes e segurança de manutenção, preservando compatibilidade com a refatoração já entregue.

## Escopo das Correções
- Corrigir inferência de `activePhase` quando `reportIntelligence` estiver ausente.
- Reforçar testes de compatibilidade legada em `parseExistingEntries`.
- Limpar dívida técnica de parâmetros não utilizados em `transformToReferenceSchema`.
- Executar validação final com foco na suíte de inteligência e regressões relacionadas.

## Fase 0: Preparação e Baseline
- Objetivo: estabelecer ponto de partida verificável.
- Tarefas:
  - Congelar baseline dos arquivos:
    - `src/agents/intelligence/sessionTransformer.js`
    - `src/agents/intelligence/deduplicator.js`
    - `tests/intelligence-reference.test.js`
  - Confirmar comportamento atual com execução dos testes de inteligência.
  - Registrar cenário de reprodução do bug de fase dinâmica.
- Critérios de aceite:
  - Baseline registrado.
  - Cenário de falha reproduzível documentado.
- Revisão obrigatória (modelo menor):
  - Validar se o cenário reproduz exatamente o achado.
  - Corrigir inconsistências na definição do cenário antes de avançar.

## Fase 1: Correção da Regra de Inferência de Fase
- Objetivo: tornar `inferActivePhase` realmente dinâmica, mesmo sem `reportIntelligence`.
- Tarefas:
  - Ajustar `inferActivePhase(reportIntelligence, allSessions)` para:
    - Considerar `allSessions.length` independentemente de `reportIntelligence`.
    - Manter ordem de prioridade de decisão explícita e previsível.
  - Preservar os estados existentes:
    - `active-development`
    - `stabilization`
    - `bug-fixing`
    - `maintenance`
  - Adicionar/ajustar testes unitários cobrindo:
    - Sem `reportIntelligence` + poucas sessões.
    - Sem `reportIntelligence` + muitas sessões.
    - Com `reportIntelligence` contendo pendências/issues/falhas.
- Critérios de aceite:
  - Estado `maintenance` atingível sem `reportIntelligence` quando o volume de sessões justificar.
  - Nenhuma regressão nos demais estados.
- Revisão obrigatória (modelo menor):
  - Rodar checklist lógico da matriz de decisão.
  - Autocorrigir implementação se qualquer caso esperado falhar.

## Fase 2: Fortalecimento de Testes de Compatibilidade Legada
- Objetivo: impedir falsos positivos em parser legado.
- Tarefas:
  - Expandir testes de `parseExistingEntries` para formato antigo (`### Session N - TYPE`) com asserts de conteúdo:
    - `id`, `date`, `messages`, `keywords`, `bugs`.
  - Cobrir casos de borda:
    - Blocos incompletos.
    - Campos ausentes.
    - Valores inesperados mas parseáveis.
  - Garantir que os testes validem comportamento funcional, não apenas tipo (`Array.isArray`).
- Critérios de aceite:
  - Testes falham quando parser retornar estrutura vazia/inválida para conteúdo legado válido.
  - Testes passam com extração consistente dos campos críticos.
- Revisão obrigatória (modelo menor):
  - Revisar robustez dos asserts.
  - Corrigir testes frágeis automaticamente.

## Fase 3: Limpeza Técnica de Assinaturas e Contratos
- Objetivo: reduzir ambiguidade de manutenção.
- Tarefas:
  - Revisar assinatura de `transformToReferenceSchema(allEntries, latestEntry, reportIntelligence, config)`.
  - Escolher uma estratégia:
    - (A) usar efetivamente `latestEntry`/`config`, ou
    - (B) remover parâmetros não utilizados com atualização de call sites.
  - Atualizar documentação inline/JSDoc para refletir o contrato real.
- Critérios de aceite:
  - Nenhum parâmetro órfão sem justificativa.
  - Call sites consistentes com a assinatura final.
- Revisão obrigatória (modelo menor):
  - Verificar coerência entre assinatura, uso e testes.
  - Aplicar correções de contrato caso detecte divergência.

## Fase 4: Validação Integrada e Gate de Qualidade
- Objetivo: confirmar estabilidade das correções.
- Tarefas:
  - Executar suíte alvo:
    - `tests/intelligence-reference.test.js`
    - testes correlatos de geração/transformação de intelligence.
  - Executar suíte completa do projeto (quando viável) para detectar regressões cruzadas.
  - Revisar logs críticos adicionados no transformer para garantir sinal útil sem ruído excessivo.
- Critérios de aceite:
  - Testes da área de inteligência 100% verdes.
  - Sem regressões em módulos consumidores.
- Revisão obrigatória (modelo menor):
  - Rodar validação final automatizada.
  - Autocorrigir falhas de implementação antes de marcar conclusão.

## Regras Operacionais de Execução
1. Toda alteração deve vir acompanhada de teste que falha antes e passa depois.
2. O modelo menor tem autonomia para corrigir implementação e testes, desde que preserve contratos e semântica esperada.
3. Nenhuma fase é concluída sem evidência: diff + execução de testes + checklist da fase.
4. Em mudança de contrato, atualizar simultaneamente: código, testes e documentação inline.
5. Em caso de comportamento ambíguo, priorizar previsibilidade da regra e explicitar a decisão no código.

## Backlog de Entrega (ordem sugerida)
1. Corrigir `inferActivePhase` e criar testes direcionados.
2. Reforçar testes legados de `parseExistingEntries`.
3. Limpar assinatura/contrato de `transformToReferenceSchema`.
4. Rodar validação integrada e consolidar evidências.

## Definição de Concluído (DoD)
- Achados do review resolvidos com evidência.
- Testes relevantes cobrindo cenários críticos e legados.
- Contratos claros, sem parâmetros órfãos.
- Revisão final do modelo menor concluída com autocorreções aplicadas.
