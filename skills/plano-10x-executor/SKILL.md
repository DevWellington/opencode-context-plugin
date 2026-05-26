---
name: plano-10x-executor
description: Use quando o usuário pedir um planejamento extremamente detalhado para execução por modelo menor/júnior, exigindo uso de skills e agentes, fluxo por fases (implementação, testes, validação e refatoração), salvamento em arquivo .md e fechamento com evidência de 100% de atendimento.
---

# Skill: Plano 10x Executor

## Quando usar
Use esta skill quando o pedido incluir uma ou mais destas intenções:
- "planejamento extremamente detalhado"
- "executado por modelo menor/junior"
- "usar skills e agentes"
- "criar fluxo de implementação, testes, validação e refatoração"
- "salvar em arquivo .md"
- "atingir 100% do que foi pedido"

## Resultado obrigatório
Você deve entregar:
1. Um plano completo por fases, com critérios de aceite por fase.
2. Orientação explícita para o executor júnior usar skills e agentes.
3. Gates de validação com evidência objetiva.
4. Um arquivo `.md` salvo no workspace.
5. Nome do arquivo e prompt pronto para chamar o outro modelo.

## Modo de execução (agente principal)
Siga exatamente esta sequência:

### Etapa 1: Entender e fixar objetivo
- Reescreva internamente o objetivo em termos verificáveis.
- Liste o que significa "100% atendido" para este pedido.
- Defina o escopo mínimo (o que precisa existir no arquivo final).

### Etapa 2: Estruturar o plano em fases
Crie fases obrigatórias:
- Fase 0: Baseline e diagnóstico
- Fase 1: Implementação inicial
- Fase 2: Testes alvo
- Fase 3: Correções e hardening
- Fase 4: Refatoração segura
- Fase 5: Regressão essencial
- Fase 6: Validação completa e auditoria final
- Fase 7: Entrega e evidências

Cada fase deve conter:
- Objetivo
- Entradas
- Passos detalhados
- Critério de aceite
- Evidência esperada

### Etapa 3: Orquestrar skills e agentes para o executor
No próprio plano, inclua instruções explícitas:
- Agente A (Diagnóstico)
- Agente B (Implementação)
- Agente C (Testes)
- Agente D (Auditoria)

Para cada agente, definir:
- Responsabilidade
- Entregável
- Regra de handoff para próximo agente

### Etapa 4: Definir gates de qualidade
O plano precisa ter gates obrigatórios:
- Gate 1: Testes alvo
- Gate 2: Regressão essencial
- Gate 3: Suite completa
- Gate 4: Auditoria de conformidade com o pedido

Regra: não avançar de gate sem evidência.

### Etapa 5: Incluir template de relatório final
Inclua seção de relatório com formato fixo:
1. Resumo executivo
2. Mudanças por fase
3. Arquivos alterados
4. Resultados de teste
5. Riscos remanescentes
6. Veredito: "100% atendido: sim/não"

### Etapa 6: Salvar e entregar
- Salvar em `.md` com nome claro e versionável.
- Informar caminho final.
- Entregar um prompt de execução para o modelo júnior.

## Prompt padrão para repassar ao júnior
Use este texto-base e adapte apenas o nome do arquivo:

"Execute o arquivo `<NOME_DO_ARQUIVO>.md` integralmente, fase por fase, sem pular gates. Use agentes separados para Diagnóstico, Implementação, Testes e Auditoria. Em cada fase, gere evidências objetivas (arquivos alterados, testes executados, resultado). Só avance quando o critério de aceite da fase estiver cumprido. Ao final, rode validação completa e execute todas as ações necessárias para atingir 100% do pedido. Entregue relatório final no template exigido."

## Checklist de qualidade da própria skill
Antes de finalizar, confirme:
- [ ] O plano está por fases e cobre implementação, testes, validação e refatoração.
- [ ] O plano orienta explicitamente o uso de skills e agentes.
- [ ] O plano tem critérios de aceite por fase.
- [ ] O plano exige evidência e gate para avanço.
- [ ] O arquivo `.md` foi salvo e o nome foi informado ao usuário.
- [ ] Foi entregue um prompt pronto para o modelo júnior.

## Anti-padrões (evitar)
- Não entregar plano genérico sem critérios verificáveis.
- Não esquecer o salvamento em `.md`.
- Não afirmar "100%" sem exigir evidência de testes.
- Não deixar o executor sem instruções de handoff entre agentes.
- Não misturar escopo novo sem justificar impacto.
