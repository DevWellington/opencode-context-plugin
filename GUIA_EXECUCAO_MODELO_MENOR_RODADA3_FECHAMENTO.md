# Guia Extremamente Detalhado - Rodada 3 (Fechamento 100%)

## Objetivo desta rodada
Corrigir os pontos finais identificados no code review e fechar 100% dos critérios solicitados.

## Itens obrigatórios desta rodada
1. Remover comportamento destrutivo de teste que apaga `~/.opencode` real.
2. Corrigir regra de contagem de projetos para aceitar nomes reais (maiúscula, número, etc.).
3. Garantir suíte verde e validação final com agentes de verificação.

---

## 1) Perfil do executor (modelo menor/júnior)

Você deve trabalhar com disciplina de execução assistida:
- Um problema por vez.
- Um patch pequeno por vez.
- Teste imediatamente após cada patch.
- Não concluir sem evidência objetiva.

Se tiver dúvida, pare e diagnostique antes de editar.

---

## 2) Uso obrigatório de skills e agentes

## Skills recomendadas
- `github:github`: para consultar contexto histórico (se houver dúvida de intenção).
- `github:gh-fix-ci`: se aparecer falha em checks/CI após alterações.

## Agentes internos (papéis e ordem)
1. **Agente de Diagnóstico**: confirma a causa raiz em arquivo/linha.
2. **Agente de Implementação**: aplica patch mínimo.
3. **Agente de Testes**: roda suites específicas e interpreta falhas.
4. **Agente de Refatoração**: limpa detalhes sem alterar comportamento.
5. **Agente de Validação**: executa checklist de aceite e confirma 100%.

## Regra de transição entre agentes
- Só avance para o próximo agente quando o checklist da etapa atual estiver 100% completo.

---

## 3) Escopo de arquivos (obrigatório)

### Código
- `src/utils/globalIntelligence.js`

### Testes
- `tests/globalIntelligence.test.js`
- `tests/intelligence-reference.test.js` (sanidade de intelligence)
- `tests/intelligenceTemplate.test.js` (sanidade de renderização)

### Validação cruzada
- `tests/remoteSync.test.js` (garantir que nada quebrou no ecossistema de sync)

---

## 4) Fases de execução (muito detalhado)

## Fase A - Baseline e diagnóstico guiado

### A.1 Ações
- Ler os trechos críticos antes de editar.
- Confirmar se ainda existe remoção de `~/.opencode` no teste.
- Confirmar lógica atual de contagem de projetos.

### A.2 Comandos
```bash
git status --short
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/globalIntelligence.test.js --runInBand
```

### A.3 Evidência esperada
- Texto curto com:
  - arquivo/linha do teste destrutivo,
  - arquivo/linha da regex de contagem.

### A.4 Gate para avançar
- Causa raiz registrada para os 2 itens.

---

## Fase B - Correção 1 (teste destrutivo)

## Problema
Teste remove diretório real do usuário em HOME.

## Objetivo
Eliminar qualquer escrita/remoção destrutiva fora de diretório temporário de teste.

### B.1 Estratégia obrigatória
- No teste `should create .opencode directory if not exists`:
  - NÃO usar `os.homedir()` para remoção real.
  - Operar somente em caminho injetado via `setGlobalIntelligencePath(...)` dentro de `testBaseDir`.

### B.2 Regras de implementação
- Preservar intenção do teste (validar criação de diretório), mas em ambiente isolado.
- Nunca apagar caminho global do usuário.

### B.3 Testes imediatos
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/globalIntelligence.test.js --runInBand
```

### B.4 Critério de aceite
- Nenhuma operação de remoção/escrita em `~/.opencode` dentro desse teste.
- Suite de `globalIntelligence` passa.

---

## Fase C - Correção 2 (contagem de projetos)

## Problema
Regex atual conta apenas projetos com inicial minúscula.

## Objetivo
Contar corretamente entradas reais de projeto na seção `### Active Projects`.

### C.1 Estratégia obrigatória
- Limitar escopo de contagem ao bloco de projetos.
- Contar headings de projeto independentemente de inicial minúscula.
- Não contar headings estruturais fora da seção.

### C.2 Recomendação técnica
- Parsear linhas do bloco após `### Active Projects` até próximo `##`/`---`.
- Considerar projeto válido como linha `### <nome>` que não seja o próprio marcador de seção.

### C.3 Testes imediatos
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/globalIntelligence.test.js --runInBand
```

### C.4 Critério de aceite
- Contagem coerente para nomes como `MyProject`, `123-app`, `test-project`.
- Sem regressão nos testes existentes.

---

## Fase D - Refatoração controlada

## Permitido
- Extrair helper local para leitura do bloco de projetos.
- Melhorar nomes de variáveis e comentários curtos.

## Proibido
- Alterar formato do arquivo global sem necessidade.
- Mudar contratos públicos além do necessário.

### D.1 Revalidação após refatoração
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/globalIntelligence.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/intelligence-reference.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/intelligenceTemplate.test.js --runInBand
```

---

## Fase E - Validação cruzada obrigatória

### E.1 Objetivo
Provar que mudanças não quebraram áreas próximas.

### E.2 Comandos
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/remoteSync.test.js --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand
```

### E.3 Critério de aceite
- Suite completa verde.
- Zero falha nova.

---

## Fase F - Rodar agentes de validação final (obrigatório)

O executor deve explicitamente ativar:
1. **Agente de Validação Funcional**
- Reconfere os 2 requisitos corrigidos no código.

2. **Agente de Validação de Segurança de Testes**
- Garante ausência de operação destrutiva em HOME real.

3. **Agente de Validação de Qualidade**
- Garante legibilidade e manutenção (sem complexidade desnecessária).

4. **Agente de Validação de Resultado**
- Confirma `100%` dos itens pedidos com evidências.

### F.1 Saída obrigatória dos agentes
- Checklist final com status `OK/FAIL` por requisito.
- Se qualquer item for `FAIL`, executar correção imediata e repetir validação.

---

## 5) Checklist de 100% (Definition of Done)

## Requisitos funcionais
- [ ] Teste destrutivo removido/isolado.
- [ ] Contagem de projetos corrigida para nomes reais.

## Requisitos de qualidade
- [ ] Sem regressão em intelligence/sync.
- [ ] Contratos preservados.
- [ ] Código legível e com comentários úteis apenas quando necessário.

## Requisitos de validação
- [ ] `tests/globalIntelligence.test.js` verde.
- [ ] `tests/intelligence-reference.test.js` verde.
- [ ] `tests/intelligenceTemplate.test.js` verde.
- [ ] `tests/remoteSync.test.js` verde.
- [ ] suíte completa verde.
- [ ] agentes de validação executados e aprovados.

---

## 6) Protocolo de contingência (quando der erro)

Se algum teste falhar:
1. Ler só a primeira falha.
2. Corrigir só a causa raiz daquela falha.
3. Rodar só a suíte correspondente.
4. Depois voltar para validação cruzada.

Se houver inconsistência de execução:
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js --clearCache
```
Repetir suíte alvo e registrar resultado.

---

## 7) Template obrigatório de relatório do executor

```md
# Relatório Rodada 3 - Fechamento 100%

## 1. Resumo
- Status final:
- DoD atingido: [sim/não]

## 2. Correção 1 (teste destrutivo)
- Arquivo:
- Alteração:
- Evidência:

## 3. Correção 2 (contagem de projetos)
- Arquivo:
- Alteração:
- Evidência:

## 4. Validação cruzada
- Comandos:
- Resultados:

## 5. Agentes de validação
- Funcional: [OK/FAIL]
- Segurança de testes: [OK/FAIL]
- Qualidade: [OK/FAIL]
- Resultado final 100%: [OK/FAIL]

## 6. Ações extras executadas
- (somente se precisou corrigir algo após validação)
```

---

## 8) Prompt de chamada para o modelo júnior

```text
Siga estritamente o arquivo GUIA_EXECUCAO_MODELO_MENOR_RODADA3_FECHAMENTO.md.
Execute em fases A -> F sem pular checklists.
Use explicitamente os agentes internos descritos e reporte o resultado de cada um.
Após implementar, rode os testes de validação cruzada e a suíte completa.
Se qualquer validação falhar, execute as correções necessárias até atingir 100% dos itens do DoD.
No final, entregue o relatório completo no template da seção 7 com evidências objetivas.
```

