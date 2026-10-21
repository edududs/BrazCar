# Política de privacidade

O BrazCar é uma plataforma de caronas em beta fechado: só entra quem recebe convite. Esta política
explica que dado o produto guarda, de quem, por quê, quem vê o quê, por quanto tempo e como sair.

## O que é coletado

Da pessoa que cria conta pelo convite:

- Telefone, e-mail e nome social, exigidos no cadastro.
- Carros cadastrados, com placa.
- Senha, guardada só de forma embaralhada e irreversível, nunca em texto.
- Os pedidos de contato feitos, com o número que foi revelado.

Do motorista que aparece numa carona importada dos grupos de WhatsApp, sem nunca ter se cadastrado:

- O telefone de quem postou o anúncio e o nome que aparece no WhatsApp.
- O texto da mensagem original, com telefone, e-mail, CPF e placa trocados por reticências antes de
  qualquer gravação.

De quem pede para ser avisado de carona ("Me avise"):

- O dia, a janela de horário e o texto "passa por" de cada aviso, e quais caronas já foram
  avisadas a ele ([D-175](decisions/README.md), [D-178](decisions/README.md)).

De quem manda uma opinião pela Conta ou pede a própria remoção do mural:

- O texto da opinião e, numa reclamação, o telefone de quem ela aponta.
- O telefone de quem pede remoção e um texto opcional.

## Por que cada dado existe

- Telefone identifica a conta e é o destino do link de contato pelo WhatsApp.
- E-mail confirmado torna a conta responsável pelo que publica e é o único caminho de recuperar a
  senha.
- Nome social e carro, com placa, aparecem para quem já pediu contato, para reconhecer o carro certo
  na rua.
- A senha é guardada de forma embaralhada e irreversível, de modo que nem o próprio produto a lê de
  volta.
- O texto da mensagem importada é a prova do anúncio original; a troca por reticências tira o que
  identifica outras pessoas sem apagar o anúncio.
- O pedido de contato fica registrado porque é a base para medir uso do produto e para notar padrão
  de leitura em massa do mural (raspagem).
- O aviso guarda o que foi pedido para poder comparar com cada carona nova, e o registro de cada
  carona avisada impede que a mesma notificação chegue duas vezes ([D-178](decisions/README.md)).

## Quem vê o quê

Sem entrar na conta, o mural mostra só trajeto, horário, preço, vagas e situação de cada carona;
nome, carro, mensagem original e observações ficam de fora.

Com a conta aberta, o mural mostra também o nome social e o carro de quem publicou. Telefone e placa
nunca aparecem numa lista, como a do mural: só são mostrados a quem pede contato numa carona, o que
exige estar com a conta aberta, tem limite por conta e registra quem pediu.

Os avisos de uma conta só aparecem para ela. A notificação leva só paradas e horário da carona,
nunca nome, carro, placa, telefone, mensagem ou observação ([D-178](decisions/README.md)).

Opiniões e pedidos de remoção não aparecem em nenhuma tela do produto: são lidos só por quem cuida
do BrazCar.

## Por quanto tempo

- Carona importada some do mural quando o horário passa; as mensagens que deram origem à carona
  somem junto.
- Mensagem que não virou carona, ou virou e não foi aceita, é apagada com até 24 horas de idade
  depois de analisada.
- O pedido de contato registrado fica: é o histórico que sustenta a detecção de leitura em massa do
  mural.
- O aviso deixa de valer no fim do próprio dia e é apagado pela limpeza seguinte, com o registro
  das caronas avisadas; o de conta excluída também ([D-179](decisions/README.md)).

## Como sair

Motorista com carona importada, sem conta no produto, pode pedir a própria remoção pela página
"Sair do mural", que é pública e não pede login. O pedido não apaga nada sozinho: só vale depois de
aprovado, e a aprovação bloqueia o telefone e apaga o que veio dele.

Quem tem conta pode excluí-la a qualquer momento pela própria Conta; dados pessoais somem, e só o
identificador da conta permanece, para o histórico do BrazCar.

## Por que o acesso é por convite

A importação dos grupos de WhatsApp expõe telefone de motorista que nunca se cadastrou. Cadastro
aberto deixaria qualquer pessoa alcançar esse dado e até se cadastrar com o número de outro
motorista para assumir as caronas importadas dele. O convite prova a posse do número antes de
qualquer cadastro.
