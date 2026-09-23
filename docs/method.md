# Como o projeto é conduzido

Este documento descreve o processo de trabalho do BrazCar: como uma ideia vira decisão, como uma
decisão vira código e como um passo é fechado. O projeto é escrito por um dono só, com sessões de
agente de IA (Claude Code) fazendo a execução. O processo existe porque essa forma de trabalhar
falha de um jeito específico — o agente entrega rápido, descreve bem o que fez e acerta menos do
que o relato sugere — e quase tudo aqui é contramedida para isso.

## Desenho antes de código

Nenhum contexto começa a ser escrito antes de estar decidido. O desenho acontece em rodadas de
entrevista: o agente traz um bloco de perguntas fechadas, cada uma com as opções reais e uma
recomendação justificada; o dono responde, discorda quando discorda, e a rodada seguinte parte
dali. A entrevista inicial do projeto, de 18 a 20 de setembro de 2026, produziu as decisões
`D-001` a `D-068` antes da primeira linha de código de domínio.

O resultado não fica na conversa. Ele vira duas coisas em
[decisions/README.md](decisions/README.md):

- **Uma tabela única**, agrupada por assunto, com identificador, decisão em uma frase e status
  (`decidido`, `proposto` quando falta validar, `adiado` quando está fora do MVP mas a intenção
  importa). Decisão cujo motivo é evidente para de crescer aqui.
- **Um registro numerado** (`decisions/NNNN-*.md`) quando o motivo não é evidente, com contexto,
  decisão, **alternativas descartadas** e consequências. A seção de alternativas é obrigatória:
  ela é o que impede a discussão de ser refeita daqui a três meses, e o que explica ao leitor de
  fora por que o caminho óbvio não foi tomado. Hoje são 14 registros para 107 linhas de decisão.

**Decisão não se edita.** Quando a realidade muda, cria-se outra linha e a antiga passa a
`substituída por D-NNN`, com o rastro visível. `D-002` e `D-062` estão lá, substituídas, de
propósito: o histórico do raciocínio vale mais do que uma tabela limpa.

Uma decisão pode nascer de medição em vez de argumento. O ADR-0013 e o ADR-0014 existem porque a
peça mais arriscada do produto — manter o mural vivo por SSE, atravessando túnel do Cloudflare e o
ciclo de vida do iOS — foi medida num iPhone real **antes** de ser construída, e a medição mudou
números concretos do desenho.

## Trabalho em passos

O [ROADMAP](ROADMAP.md) é dividido em passos, e cada passo tem uma versão. Um passo é uma fatia
vertical que se sustenta sozinha (um contexto inteiro, o PWA, o teste do SSE), não uma camada.
A ordem foi decidida antes (`D-068`) e foi seguida.

Cada passo é executado por uma sessão de agente própria, com contexto limpo, despachada por uma
sessão mestre. O despacho é escrito, e traz sempre:

- **As fontes**: quais documentos ler inteiros antes de escrever qualquer coisa.
- **O escopo**: o que entra, o que não entra, e o que não pode ser tocado.
- **A forma da entrega**: commits esperados, portões que precisam passar, o que o relato final
  precisa separar.

Quando o passo termina, a sessão mestre **audita contra o repositório, não contra o relato**: lê o
diff, roda os portões, abre os arquivos que a sessão disse ter mudado. O relato do agente é uma
hipótese sobre o que aconteceu, e é tratado como tal.

O que sobra dessa auditoria vai para [STATE.md](STATE.md) em duas seções literais: **verificado de
verdade** e **não verificado**. A segunda é a mais importante. "O aviso de build novo num iPhone
(só no Chrome)" fica escrito, com todas as letras, até alguém conferir num iPhone. Um projeto
conduzido por agentes acumula certeza falsa rápido; separar as duas listas é o freio.

## Instruções: pouco sempre, o resto sob demanda

Contexto de agente é caro e finito, então o projeto trata instrução como se trata dependência.

- [AGENTS.md](../AGENTS.md) é o **único arquivo sempre carregado**: onze regras invioláveis e uma
  tabela de "onde está cada coisa". Cabe numa tela.
- `.claude/rules/*.md` são **regras por área**, com os caminhos que as ativam no cabeçalho. A regra
  de domínio entra quando um arquivo de `domain/` ou `application/` é tocado; a do front, quando um
  `.tsx` é tocado. Quem está mexendo em documentação nunca paga por elas.
- [INDEX.md](INDEX.md) é uma linha por documento, com "para quê" e "atualiza quando". O agente abre
  só o que a tarefa pede.

A mesma economia vale ao contrário: o índice diz explicitamente que **não se documenta o que uma
busca no código responde** — estrutura de pastas, assinaturas, lista de endpoints, campos de model.
Documento que repete o código apodrece e passa a mentir.

## Linguagem ubíqua por contexto

Cada contexto tem um glossário em `docs/domain/<contexto>.md` com três colunas: o termo no negócio,
o identificador no código e o que é. A regra de domínio manda consultar o glossário **antes de
nomear qualquer coisa**, e proíbe sinônimo: um conceito tem um nome só.

Isso resolve um problema prático de trabalhar com agentes. Sessões diferentes, sem memória
compartilhada, inventam `RideStatus`, `RideState` e `status_value` para a mesma coisa em três
semanas. Com o glossário, a `situação` é `RideStatus` em qualquer sessão, e `docs/domain/rides.md`
é a fonte. O glossário também é onde as invariantes ficam escritas em português, o que torna
revisável a parte do código que mais custa caro para errar.

## Documentação no mesmo commit

Decisão nova vira linha na tabela **no commit que a implementa**, não depois. Termo novo entra no
glossário no mesmo commit em que aparece no código. Documento novo ganha linha no índice. Isso é
regra inviolável no `AGENTS.md`, e a razão é simples: documentação adiada não é escrita, e num
fluxo de sessões independentes um documento defasado desalinha todas as sessões seguintes.

Parte disso é verificada por máquina: `backend/tests/test_docs_links.py` percorre todo Markdown
versionado e falha se um link relativo apontar para arquivo que não existe. Link quebrado é um
teste vermelho, não uma descoberta de leitor.

## Portões: rápido sempre, pesado antes de publicar

O código passa por dois portões, e a divisão é sobre custo (`D-066`).

| Portão | Onde roda | O que faz |
|---|---|---|
| Rápido | hook de `pre-commit` e GitHub | formatação, lint, tipos, testes de domínio e de rota, teste de arquitetura, divergência do OpenAPI, links da documentação |
| Cobertura | só no GitHub | os mesmos testes rápidos, medindo cobertura; falha abaixo do piso |
| Pesado | hook de `pre-push` e sob demanda | tudo do rápido, mais contrato de repositório no Postgres real e o build do front |

Os hooks são scripts versionados em `.githooks/`, ligados por `core.hooksPath` (`D-074`), e cada
portão só roda se os caminhos dele mudaram. O portão rápido precisa ser rápido o bastante para
ninguém querer pulá-lo; o pesado precisa rodar antes de algo sair da máquina.

Nada disso depende de serviço de terceiros. A cobertura é medida no próprio fluxo do GitHub, o
resumo vai para o log e o passo falha abaixo do piso: não há painel externo lendo o código
(`D-008`).

## Encerrar um passo

Fechar um passo é um ritual escrito, em [runbooks/close-step.md](runbooks/close-step.md), seguido
na ordem. Ele existe porque o fim é onde o trabalho apressa e onde o rastro se perde.

1. **Verificar.** Portão rápido e portão pesado dos dois lados, com a saída real mostrada. `git
   status` limpo.
2. **Higiene.** Commits em Conventional Commits, sem trailers e sem citar ferramenta de autoria;
   nenhum segredo versionado; pastas efêmeras de spec apagadas. Cada item tem o comando que prova.
3. **Documentos.** Só o que o passo tocou, num commit `docs:` antes de cortar a versão: `STATE.md`,
   `ROADMAP.md`, tabela de decisões, glossários, runbooks, índice.
4. **Versão e changelog.** O número **não se escolhe**: sai dos commits. `scripts/release.sh` lê os
   Conventional Commits com git-cliff, calcula o próximo SemVer, regenera o `CHANGELOG.md` no
   formato Keep a Changelog, alinha a versão do backend e do front, faz o commit de release e cria
   a tag anotada com as notas dentro. O changelog nunca é editado à mão: conserto de entrada ruim
   é na mensagem do commit seguinte.
5. **Publicar.** O script **não dá push**. Ele para e mostra o comando.
6. **Memória.** Só o que não cabe no repositório: fato sobre a máquina de teste, caminho de
   segredo, preferência do dono. Nada que o repositório já registre.
7. **Relato final**, em quatro partes: o que entrou, o que foi verificado de verdade, o que não
   foi, e o que passa como pendência.

A tag é a fonte da verdade da versão. O GitHub só a transforma em release e em imagem publicada;
nada de versionamento é decidido lá (`D-080`).

## Quem decide e quem assina

O dono decide o desenho, revisa o resultado e **dá o push**. Nenhuma sessão publica. Nenhuma sessão
aprova o próprio trabalho: a auditoria é sempre de fora, contra o repositório.

Commits e documentação não citam a ferramenta de autoria e não levam trailers. Não é ocultação — a
metodologia está descrita neste documento, aberto no repositório público. É que a autoria e a
responsabilidade pelo que está aqui são de uma pessoa, e o histórico do Git registra isso, não a
cadeia de ferramentas que produziu cada linha.
