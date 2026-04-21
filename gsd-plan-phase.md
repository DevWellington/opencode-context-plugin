Regra para o plugin em geral:

- Para toda geração de arquivo, voce deverá utilizar palavras chave (modelo Obsidian) para vincular sempre os arquivos entre eles; palavras chave importantes: 
    - nome do arquivo do projeto (codigo);
    - nome do método ou funcionalidade;
    - nome de variáveis, e tbm variáveis de ambiente;
    - e nomes que ajudem a fazer que a leitura dos arquivos gerados sejam efetivos em encontrar rapidamente o que o usuário pediu ou pedirá nos proximos prompts;
    - ao abrir o projeto pelo Obsidian, espero ver as conexões e que isso faça sentido para os grafos e a relação ao projeto;

- atualize os arquivos .gitignore, e os arquivos .md do projeto;

Regras para os agentes: 

- Crie agentes para leitura e geração/atualização dos arquivos;
- Com a possibilidade de passar parametros para leitura (ex.: @ocp-read-today --summary, --all; tendo como default o --summary); 
- para geração dos arquivos, os agentes devem gerar somente o resumo, e não o arquivo completo, para evitar sobrecarga de informações.
- Os agentes de leitura devem ser capazes de ler os arquivos gerados pelos agentes de geração, e apresentar as informações de forma clara e concisa, respeitando os parâmetros passados.
- Para o arquivo de inteligence-learning o agente deverá seguir as diretrizes já definidas para Inteligence Learning do projeto e das decisões do usuário;
- O arquivo de inteligence-learning deverá ser atualizado sempre que houver geração de um novo arquivo, mantendo as suas diretrizes definidas;


- @ocp-help (um helper sobre os agentes e funcionalidades do plugin)
- @ocp-generate-today
- @ocp-read-today
- @ocp-gemerate-weeked
- @ocp-read-weeked
- @ocp-gemerate-month
- @ocp-read-month
- @ocp-gemerate-year
- @ocp-read-year
- @ocp-generate-inteligence-learning (atualiza o arquivo atual com novas informações do contexto)
- @ocp-read-inteligence-learning
