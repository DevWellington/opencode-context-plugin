# Plano de Correções Restantes - Testes (Remote Sync + Global Intelligence)

## Objetivo
Resolver as 20 falhas restantes da suíte (`tests/remoteSync.test.js` e `tests/globalIntelligence.test.js`) até retornar para estado totalmente verde, com foco em previsibilidade, isolamento de ambiente de teste e compatibilidade de comportamento.

## Contexto Atual
- Total atual: 871 testes.
- Status atual: 851 passando, 20 falhando.
- Grupos com falha:
  - `tests/remoteSync.test.js` (falhas de permissão + contrato de retorno esperado).
  - `tests/globalIntelligence.test.js` (conteúdo esperado não sendo persistido no arquivo global).

## Fase 0: Baseline e Reprodutibilidade
- Objetivo: travar cenário antes das mudanças.
- Tarefas:
  - Executar somente suites-alvo e salvar saída de erro.
  - Identificar quais falhas são ambientais (sandbox/path de HOME) vs. funcionais.
  - Registrar ordem de execução reproduzível para validação final.
- Critérios de aceite:
  - Lista de falhas classificada por causa raiz (ambiente, contrato, lógica).
- Revisão obrigatória (modelo menor):
  - Confirmar que cada falha tem causa provável objetiva.
  - Corrigir classificação ambígua antes de implementar.

## Fase 1: Correções de Isolamento de Ambiente em Remote Sync
- Objetivo: eliminar dependência de path global real em testes.
- Tarefas:
  - Revisar `src/modules/syncOperations.js` para evitar gravação obrigatória em `~/.opencode/.config` durante testes.
  - Introduzir mecanismo explícito de injeção de caminho de config para teste (ex.: env var ou helper interno), sem quebrar comportamento em produção.
  - Ajustar setup dos testes para usar diretório temporário gravável.
  - Garantir que operações concorrentes usem o mesmo path injetado.
- Critérios de aceite:
  - Nenhum `EPERM`/`mkdir` fora de diretório de teste.
  - `configureRemoteSync` passa nos cenários S3/GCS/Custom sem depender do HOME real.
- Revisão obrigatória (modelo menor):
  - Validar que não há regressão de segurança de path em produção.
  - Corrigir automaticamente qualquer acesso residual ao path global durante testes.

## Fase 2: Alinhamento de Contrato de Retorno em Remote Sync
- Objetivo: estabilizar estrutura de retorno esperada pelos testes.
- Tarefas:
  - Definir contrato único para `syncToRemote` e `syncGlobalIntelligence` em sucesso/erro:
    - `success`
    - `uploaded`
    - `failed`
    - `error` (quando aplicável)
  - Ajustar implementação para sempre retornar shape consistente, inclusive em "not configured".
  - Atualizar testes apenas se houver mudança de contrato deliberada e documentada.
- Critérios de aceite:
  - Asserts de `uploaded`/`failed` passam em todos os cenários.
  - Fluxo de erro continua informativo sem quebrar callers.
- Revisão obrigatória (modelo menor):
  - Revalidar uniformidade do contrato em todos os branches de retorno.
  - Corrigir divergências automaticamente.

## Fase 3: Correções de Global Intelligence
- Objetivo: garantir persistência do conteúdo esperado na seção de projetos.
- Tarefas:
  - Revisar `src/utils/globalIntelligence.js` (e dependências) no fluxo de:
    - inclusão/atualização de entrada de projeto (`### <project-name>`),
    - atualização de timestamp,
    - contabilização de projetos/sessões,
    - serialização concorrente.
  - Verificar se mudanças recentes impediram merge no bloco "Project Directory".
  - Corrigir parsing/rewrite para preservar estrutura e aplicar atualizações incrementais.
- Critérios de aceite:
  - Testes validam presença de projetos (`project-0/1/2`, `test-project`).
  - Timestamp esperado refletido corretamente.
- Revisão obrigatória (modelo menor):
  - Rodar cenários de atualização sequencial e concorrente.
  - Corrigir automaticamente perda de dados por overwrite.

## Fase 4: Robustez de Concorrência
- Objetivo: estabilizar testes concorrentes que dependem de lock/ordenação.
- Tarefas:
  - Revisar `withSyncLock`, `markPendingChanges` e pontos de escrita concorrente.
  - Garantir que estado compartilhado não seja resetado indevidamente entre chamadas paralelas.
  - Adicionar testes direcionados se houver lacuna de cobertura em corrida de estado.
- Critérios de aceite:
  - Casos concorrentes passam de forma determinística em múltiplas execuções.
- Revisão obrigatória (modelo menor):
  - Executar repetição da suíte alvo para detectar flakiness.
  - Aplicar autocorreções para corrida detectada.

## Fase 5: Validação Final e Gate de Entrega
- Objetivo: confirmar fechamento integral das falhas.
- Tarefas:
  - Executar suites alvo:
    - `tests/remoteSync.test.js`
    - `tests/globalIntelligence.test.js`
  - Executar suíte completa do projeto.
  - Consolidar evidências finais (antes/depois, total de testes, arquivos alterados).
- Critérios de aceite:
  - 871/871 testes passando.
  - Sem regressão nas áreas de intelligence já corrigidas.
- Revisão obrigatória (modelo menor):
  - Gate final com autonomia para corrigir qualquer regressão residual antes de concluir.

## Regras Operacionais
1. Toda correção deve ter teste que prova comportamento, não apenas cobertura superficial.
2. O modelo menor pode corrigir código e testes para manter contrato explícito e estável.
3. Nenhuma fase fecha sem evidência objetiva (diff + execução + checklist).
4. Mudanças de contrato exigem atualização simultânea de testes e documentação inline.
5. Qualquer dependência de ambiente externo deve ser isolada por injeção/configuração testável.

## Backlog Executável (ordem sugerida)
1. Isolar path de config no `syncOperations` para testes.
2. Uniformizar retorno de `syncToRemote`/`syncGlobalIntelligence`.
3. Corrigir persistência/merge do `globalIntelligence` para entradas de projeto e timestamp.
4. Estabilizar concorrência (`withSyncLock`, `markPendingChanges`).
5. Rodar suites alvo e suíte completa até verde total.

## Definição de Concluído (DoD)
- Todas as 20 falhas resolvidas com evidência.
- Suite completa 871/871 verde.
- Sem acesso indevido a paths globais em ambiente de teste.
- Contratos de retorno estáveis e documentados.
