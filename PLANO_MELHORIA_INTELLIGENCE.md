# Plano Faseado para Melhorar o Arquivo de Intelligence

## 1. Fase 0: Preparação e Regras de Execução
- Objetivo: definir padrão único para mudanças no `intelligence`.
- Ações:
  - Mapear estado atual do arquivo (estrutura, responsabilidades, pontos frágeis).
  - Definir convenções: formato, nomenclatura, comentários, critérios de qualidade.
  - Criar checklist obrigatório por alteração.
- Skills/Agentes:
  - `plugin-creator` (se precisar estruturar fluxo de plugin relacionado).
  - Agente de arquitetura (macroestrutura) + agente de qualidade (critérios).
- Saída:
  - Documento “baseline + regras”.
- Revisão obrigatória (modelo menor):
  - Validar se cada regra é objetiva e testável.
  - Corrigir ambiguidades automaticamente.

## 2. Fase 1: Diagnóstico Profundo do Intelligence
- Objetivo: identificar problemas por categoria.
- Ações:
  - Auditoria por blocos: contexto, decisões, fallback, segurança, logs, erros.
  - Classificar problemas por severidade (alta/média/baixa).
  - Levantar lacunas funcionais e de manutenção.
- Skills/Agentes:
  - Agente de análise estática.
  - Agente de risco/regressão.
- Saída:
  - Matriz de problemas priorizada.
- Revisão obrigatória (modelo menor):
  - Revalidar priorização.
  - Sugerir correções rápidas nos itens de alta severidade.

## 3. Fase 2: Refatoração Estrutural por Módulos
- Objetivo: reorganizar o `intelligence` sem alterar comportamento externo.
- Ações:
  - Separar responsabilidades em seções/módulos lógicos.
  - Padronizar contratos de entrada/saída.
  - Reduzir duplicação e acoplamento.
- Skills/Agentes:
  - Agente de refatoração.
  - Agente de consistência de contratos.
- Saída:
  - Estrutura nova + diff documentado.
- Revisão obrigatória (modelo menor):
  - Conferir compatibilidade.
  - Corrigir regressões estruturais automaticamente.

## 4. Fase 3: Qualidade de Decisão e Regras de Negócio
- Objetivo: melhorar precisão e previsibilidade.
- Ações:
  - Refinar regras de decisão (ordem de prioridade, conflitos, fallback).
  - Incluir validações explícitas de borda.
  - Formalizar comportamento em casos de erro/incerteza.
- Skills/Agentes:
  - Agente de regras de negócio.
  - Agente de cenários extremos.
- Saída:
  - Regras revisadas + casos esperados.
- Revisão obrigatória (modelo menor):
  - Rodar checklist lógico.
  - Ajustar inconsistências de decisão sem intervenção manual.

## 5. Fase 4: Observabilidade e Testabilidade
- Objetivo: facilitar diagnóstico e autonomia de correção.
- Ações:
  - Inserir pontos de observabilidade (logs sem ruído).
  - Criar testes por comportamento crítico.
  - Cobrir happy path + edge cases + falhas.
- Skills/Agentes:
  - Agente de testes.
  - Agente de observabilidade.
- Saída:
  - Suíte mínima de testes e critérios de aceitação.
- Revisão obrigatória (modelo menor):
  - Executar testes.
  - Corrigir implementação até “verde” com limite de tentativas definido.

## 6. Fase 5: Hardening e Segurança
- Objetivo: reduzir risco operacional.
- Ações:
  - Revisar tratamento de entradas inválidas.
  - Garantir fail-safe e mensagens de erro claras.
  - Avaliar risco de comportamento inesperado.
- Skills/Agentes:
  - Agente de segurança.
  - Agente de robustez.
- Saída:
  - Checklist de hardening concluído.
- Revisão obrigatória (modelo menor):
  - Reexecutar cenários críticos.
  - Corrigir falhas de robustez detectadas.

## 7. Fase 6: Governança de Entrega e Autonomia do Modelo Menor
- Objetivo: garantir ciclo contínuo de melhoria autônoma.
- Ações:
  - Definir “Definition of Done” por fase.
  - Exigir revisão cruzada: implementador → revisor automático (modelo menor).
  - Criar protocolo: detectar, corrigir, revalidar, registrar decisão.
- Skills/Agentes:
  - Agente orquestrador.
  - Agente revisor final.
- Saída:
  - Fluxo operacional fechado para iteração contínua.
- Revisão obrigatória (modelo menor):
  - Gate final de qualidade antes de merge/publicação.

## Regras Operacionais (aplicadas em todas as fases)
1. Toda implementação deve ter revisão automática obrigatória do modelo menor.
2. O modelo menor tem autonomia para corrigir implementação, desde que mantenha contrato e passe testes.
3. Nenhuma fase é concluída sem evidência objetiva (diff + testes + checklist).
4. Mudanças de alto impacto exigem mini-plano de rollback.
5. Cada correção deve registrar: problema, causa raiz, ajuste, validação.

## Cadência sugerida
1. Planejar fase.
2. Implementar pequeno lote.
3. Revisar com modelo menor (autocorreção).
4. Validar com testes/checklist.
5. Consolidar e avançar para próxima fase.
