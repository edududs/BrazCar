# Como o projeto é conduzido

O BrazCar é escrito por uma pessoa, com sessões de agentes de IA fazendo a execução. Boa parte do
processo descrito aqui existe para conferir esse trabalho contra o repositório, porque o relato de
um agente sobre o que ele fez costuma ser otimista.

## Desenho antes de código

Nenhum contexto começa a ser escrito antes de estar decidido. O desenho acontece em rodadas de
entrevista. O agente traz um bloco de perguntas fechadas, cada uma com as opções reais e uma
recomendação justificada; o dono responde e rejeita o que não serve; a rodada seguinte parte dali.
A entrevista inicial, de 18 a 20 de setembro de 2026, produziu as decisões `D-001` a `D-068` antes
da primeira linha de código de domínio.

O resultado vira duas coisas em [decisions/README.md](decisions/README.md):

- **Uma tabela única**, agrupada por assunto, com identificador, decisão em uma frase e status
  (`decidido`; `proposto` quando falta validar; `adiado` quando está fora do MVP mas a intenção
  importa). Quando o motivo é evidente, a decisão não passa daqui.
- **Um registro numerado** (`decisions/NNNN-*.md`) quando o motivo não é evidente, com contexto,
  decisão, **alternativas descartadas** e consequências. A seção de alternativas é obrigatória:
  ela evita que a mesma discussão seja refeita mais tarde e registra por que o caminho óbvio foi
  recusado. Hoje são 16 registros para 126 linhas de decisão.

Decisão não se edita. Quando a realidade muda, cria-se outra linha e a antiga passa a `substituída
por D-NNN`. `D-002` desenhava o monorepo com `src/` na raiz e foi substituída por `D-069`, que o
desenhou com `backend/` e `web/` como pastas irmãs; as duas linhas continuam na tabela.

Uma decisão também pode nascer de medição. O ADR-0013 e o ADR-0014 registram a medição do sinal do
mural por SSE, atravessando o túnel do Cloudflare e o ciclo de vida do iOS, feita num iPhone antes
de o produto ser construído em cima dela. A medição mudou números do desenho: o batimento passou a
ser evento em vez de comentário, e o vigia de silêncio caiu de 45s para 35s.

## Trabalho em passos

O [ROADMAP](ROADMAP.md) é dividido em passos, e cada passo recebe uma versão. Um passo é uma fatia
vertical que se sustenta sozinha: um contexto inteiro, o PWA, a medição do SSE. A ordem foi
decidida em `D-068` e foi seguida.

Cada passo é executado por uma sessão de agente própria, com contexto limpo, despachada por uma
sessão mestre. O despacho é escrito e traz:

- **As fontes.** Quais documentos ler inteiros antes de escrever qualquer coisa.
- **O escopo.** O que entra, o que fica de fora, o que não pode ser tocado.
- **A forma da entrega.** Commits esperados, portões que precisam passar, o que o relato final
  precisa separar.

Terminado o passo, a sessão mestre audita o resultado contra o repositório: lê o diff, roda os
portões, abre os arquivos que a sessão disse ter mudado. O relato do agente entra nessa auditoria
como hipótese sobre o que aconteceu.

A auditoria alimenta duas seções de [STATE.md](STATE.md) com esses nomes literais: "verificado de
verdade" e "não verificado". A segunda lista o que ficou sem conferência. Hoje ela diz, entre
outras coisas, que o aviso de build novo e a tela de piso de versão só foram vistos no
Chrome, nunca num iPhone, e que o mural atualizando sozinho ao voltar do segundo plano no app
instalado continua sem teste.

## Instruções sob demanda

Contexto de agente é limitado, e todo arquivo sempre carregado ocupa espaço em todas as sessões.

- [AGENTS.md](../AGENTS.md) é o único arquivo sempre carregado: doze regras invioláveis e uma
  tabela de "onde está cada coisa", em 46 linhas.
- `.claude/rules/*.md` são regras por área, com os caminhos que as ativam declarados no cabeçalho.
  A regra de domínio entra quando um arquivo de `domain/` ou `application/` é tocado; a do front,
  quando um `.ts`, `.tsx` ou `.css` de `web/` é tocado. Quem está mexendo em documentação não
  carrega nenhuma das duas.
- [INDEX.md](INDEX.md) tem uma linha por documento, com "para quê" e "atualiza quando". A sessão
  abre só o que a tarefa pede.

O índice também define o que não se escreve: estrutura de pastas, assinaturas, lista de endpoints e
campos de model ficam de fora, porque uma busca no código responde por eles e o documento
equivalente ficaria desatualizado na primeira mudança.

## Linguagem ubíqua por contexto

Cada contexto tem um glossário em `docs/domain/<contexto>.md` com três colunas: o termo no negócio,
o identificador no código, o que é. A regra de domínio manda consultar o glossário antes de nomear
qualquer coisa e proíbe sinônimo.

Sem isso, sessões independentes chegam a `RideStatus`, `RideState` e `status_value` para o mesmo
conceito. Com o glossário, a situação da carona é `RideStatus` em qualquer sessão. O mesmo arquivo
guarda as invariantes do contexto em português, o que permite revisá-las sem abrir o código.

## Documentação no mesmo commit

Decisão nova vira linha na tabela no commit que a implementa. Termo novo entra no glossário no
commit em que aparece no código. Documento novo ganha linha no índice. É regra inviolável no
`AGENTS.md`, porque num fluxo de sessões independentes um documento defasado desalinha as sessões
seguintes.

Parte disso é verificada por máquina. `backend/tests/test_docs_links.py` percorre todo Markdown
versionado e falha quando um link relativo aponta para arquivo que não existe.

## Portões

O código passa por três portões, divididos por custo de execução (`D-066`, `D-132`).

| Portão | Onde roda | O que faz |
|---|---|---|
| Rápido | hook de `pre-commit` e GitHub | formatação, lint, tipos, testes de domínio e de rota, teste de arquitetura, divergência do OpenAPI, links da documentação |
| Cobertura | só no GitHub | os mesmos testes rápidos, medindo cobertura; falha abaixo do piso |
| Pesado | GitHub e sob demanda local | tudo do rápido, mais o contrato de repositório no Postgres (serviço do runner no GitHub, compose localmente) e o build do front |

Os hooks são scripts versionados em `.githooks/`, ligados por `core.hooksPath` (`D-074`). O de
`pre-commit` roda o portão rápido só se os caminhos dele mudaram, e leva cerca de 30 segundos no
backend e cerca de 40 no front. Nenhum hook roda teste no push: o `pre-push` saiu, e um
`commit-msg` de milissegundos recusa assunto fora do Conventional Commits e trailer ou menção a
ferramenta de IA (`D-132`).

A cobertura é medida dentro do fluxo do GitHub: o resumo vai para o log do passo e o passo falha
abaixo do piso. Nenhum serviço externo lê o código ou recebe relatório (`D-008`). Os dois lados
medem o pacote inteiro, o que hoje dá 92% no backend e 20% no front, com pisos de 87% e 15%. O
número do front é baixo porque só os hooks headless têm teste, e ele é medido assim de propósito,
para que a lacuna apareça; a meta é a paridade com o backend.

A lacuna se fecha por regra permanente: verificação feita à mão durante um passo vira teste
automatizado no mesmo passo, e bugfix entra com o teste que o reproduz (`D-126`). Um agente
que conferiu um fluxo no navegador ou uma rota por `curl` deixa esse caminho coberto antes de
fechar o passo, para que o passo seguinte não o quebre em silêncio. Duas peças decididas em `D-065`
continuam sem existir, o Schemathesis sobre o OpenAPI e o E2E com Playwright nas jornadas críticas;
elas entram num passo próprio de qualidade, o primeiro depois do 7a, que fechou na `v0.8.0`.

## Encerrar um passo

Fechar um passo segue o roteiro de [runbooks/close-step.md](runbooks/close-step.md), na ordem.
Cada item traz o comando que prova que foi feito.

1. **Verificar.** Portão rápido e portão pesado dos dois lados, com a saída real mostrada. `git
   status` limpo.
2. **Higiene.** Commits em Conventional Commits, sem trailers e sem citar ferramenta de autoria;
   nenhum segredo versionado; pastas efêmeras de spec apagadas.
3. **Documentos.** Só o que o passo tocou, num commit `docs:` antes de cortar a versão: `STATE.md`,
   `ROADMAP.md`, tabela de decisões, glossários, runbooks, índice.
4. **Versão e changelog.** O número sai dos commits. `scripts/release.sh` lê os Conventional
   Commits com git-cliff, calcula o próximo SemVer, regenera o `CHANGELOG.md` no formato Keep a
   Changelog, alinha a versão do backend e a do front, faz o commit de release e cria a tag anotada
   com as notas dentro. O changelog não é editado à mão; entrada ruim se conserta na mensagem do
   commit seguinte.
5. **Publicar.** O script para antes do push e mostra o comando.
6. **Memória.** Só o que não cabe no repositório: fato sobre a máquina de teste, caminho de
   segredo, preferência do dono.
7. **Relato final**, em quatro partes: o que entrou, o que foi verificado, o que não foi, e o que
   passa como pendência.

A tag é a fonte da verdade da versão. O cálculo acontece na máquina do dono; o GitHub só transforma
a tag em release e em imagem no GHCR (`D-080`).

## Quem decide e quem assina

O dono decide o desenho, revisa o resultado e dá o push. Nenhuma sessão publica nem aprova o
próprio trabalho: a auditoria é feita de fora, contra o repositório.

Commits e documentação não citam ferramenta de autoria e não levam trailers. A metodologia está
descrita neste documento, que é público; o histórico do Git registra a autoria e a
responsabilidade, que são de uma pessoa.
