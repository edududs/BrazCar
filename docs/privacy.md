# Privacidade

O BrazCar é uma plataforma de caronas em beta fechado: só entra quem recebe convite. Este documento
explica que dado o produto guarda, de quem, por quê, quem vê o quê, por quanto tempo e como sair.

## O que é coletado

Da pessoa que cria conta pelo convite:

- Telefone, e-mail e nome social, exigidos no cadastro ([D-159](decisions/README.md),
  [D-160](decisions/README.md)).
- Carros cadastrados, com placa.
- Senha, guardada só como hash, nunca em texto.
- Os pedidos de contato feitos, com o número que foi revelado ([D-140](decisions/README.md)).

Do motorista que aparece numa carona importada dos grupos de WhatsApp, sem nunca ter se cadastrado:

- O telefone de quem postou o anúncio e o nome que aparece no WhatsApp ([D-117](decisions/README.md)).
- O texto da mensagem original, com telefone, e-mail, CPF e placa trocados por reticências antes de
  qualquer gravação ([D-128](decisions/README.md)).

De quem manda uma opinião pela Conta ou pede a própria remoção do mural:

- O texto da opinião e, numa reclamação, o telefone de quem ela aponta ([D-155](decisions/README.md)).
- O telefone de quem pede remoção e um texto opcional ([D-172](decisions/README.md)).

## Por que cada dado existe

- Telefone identifica a conta e é o destino do link de contato pelo WhatsApp.
- E-mail confirmado torna a conta responsável pelo que publica e é o único caminho de recuperar a
  senha ([D-160](decisions/README.md)).
- Nome social e carro, com placa, aparecem para quem já pediu contato, para reconhecer o carro certo
  na rua.
- Senha como hash: nem o próprio produto lê a senha de volta.
- O texto da mensagem importada é a prova do anúncio original; a redação tira o que identifica
  terceiros sem apagar o anúncio ([D-128](decisions/README.md)).
- O pedido de contato fica registrado porque é a base para medir uso do produto e para notar padrão
  de raspagem ([D-140](decisions/README.md)).

## Quem vê o quê

Sem sessão, o mural mostra só rota, horário, preço, vagas e situação de cada carona; nome, carro,
mensagem original e observações ficam de fora ([D-171](decisions/README.md)).

Com sessão, o mural mostra também o nome social e o carro de quem publicou. Telefone e placa nunca
entram numa lista: só saem pela rota de pedir contato, que exige login, tem limite por conta e grava
quem pediu ([D-031](decisions/README.md), [D-140](decisions/README.md)).

Opiniões e pedidos de remoção não aparecem em nenhuma tela do produto: são lidos só por comando de
quem cuida do BrazCar ([D-155](decisions/README.md), [D-172](decisions/README.md)).

## Por quanto tempo

- Carona importada some do mural quando o horário passa; a candidata e as mensagens que a
  originaram somem junto ([D-119](decisions/README.md)).
- Mensagem que não virou carona, ou virou e não foi aceita, é apagada com até 24 horas de idade
  depois de julgada; a poda roda tanto como job do banco quanto como varredura do próprio worker, a
  mesma regra nos dois casos ([D-119](decisions/README.md)).
- O pedido de contato registrado fica: é o histórico que sustenta a detecção de raspagem
  ([D-140](decisions/README.md)).

## Como sair

Motorista com carona importada, sem conta no produto, pode pedir a própria remoção. Hoje esse pedido
só entra pela rota pública da API; a página do site que o torna alcançável para qualquer pessoa ainda
está pendente. O pedido não apaga nada sozinho: só vale depois de aprovado, e a aprovação bloqueia o
telefone e apaga o que veio dele ([D-162](decisions/README.md), [D-172](decisions/README.md)).

Quem tem conta pode excluí-la a qualquer momento pela própria Conta; dados pessoais somem, e o
identificador fica só para o histórico interno ([D-033](decisions/README.md)).

## Por que o acesso é por convite

A importação dos grupos de WhatsApp expõe telefone de motorista que nunca se cadastrou. Cadastro
aberto deixaria qualquer pessoa alcançar esse dado e até se cadastrar com o número de outro
motorista para assumir as caronas importadas dele. O convite prova a posse do número antes de
qualquer cadastro ([D-159](decisions/README.md)).
