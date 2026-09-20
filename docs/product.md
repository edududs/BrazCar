# Produto

## O problema

Moradores de cidades rurais do Distrito Federal, Brazlândia principalmente, trabalham e estudam
no centro de Brasília, a 30 ou 50 km. O transporte público é precário. A comunidade inventou a
carona paga: quem já vai de carro anuncia as vagas livres e cobra um valor simbólico.

Esses anúncios vivem em dezenas de grupos de WhatsApp. Um anúncio real:

```
03 VAGAS
Saindo às 19:30
Esplanada
Eixo Monumental
Estrutural
Brazlândia
Chamar PV
7,00 Dinheiro ou PIX
```

O mesmo anúncio é repostado em cinco, dez grupos e some no scroll em minutos. Não dá para
filtrar por horário nem por rota, e não há histórico.

## O que o BrazCar é

Uma plataforma onde o motorista registra a carona e o passageiro a encontra num mural com
filtros. Ela substitui o WhatsApp como canal de descoberta, não como canal de contato: achada a
carona, a conversa continua no WhatsApp, como hoje.

A plataforma funciona sozinha. A importação automática de anúncios dos grupos é uma camada que
entra depois, sem a qual o produto continua inteiro.

## A métrica

Tempo entre abrir o app e encontrar uma carona compatível com o meu horário e a minha rota.
Alguém que sai do trabalho às 18h descobre em menos de trinta segundos se existe carona às 19:30
passando pela Esplanada, e fala com o motorista.

## Quem usa

- **Passageiro.** Faz o trajeto quase todo dia. Consulta de manhã, planejando a volta, e no fim
  do expediente, com pressa, em pé, com uma mão, em Android modesto e 4G instável. Pensa primeiro
  em horário, depois em rota. Conhece os lugares pelo nome falado: "Esplanada", "Eixo", "Estrutural".
- **Motorista.** Publica a carona, ajusta as vagas conforme combina no WhatsApp, fecha quando
  lota. Precisa que publicar seja mais rápido do que colar o anúncio em dez grupos.

## Verdades do domínio

- Carona é uma linha com paradas em ordem, não um par origem e destino. O passageiro entra num
  ponto e desce em outro, e ambos podem ser intermediários.
- Horário é o eixo principal. O preço é quase sempre R$ 7,00 e não decide nada.
- Carona sem vagas ainda é informação útil: mostra que aquele horário e aquela rota são atendidos.
- A placa é a única garantia de entrar no carro certo.

## O que o MVP faz

Cadastro por telefone. Cadastro de carros. Publicar, editar, fechar, reabrir, cancelar e repetir
carona. Mural público com filtros por horário, rota, data, vagas e preço, atualizado sem recarregar.
Botão de contato que abre o WhatsApp do motorista. App instalável no celular.

## O que o MVP não faz

Reserva de vaga, conversa dentro do app, pagamento, avaliação de motorista, mapa, pedido de
carona por passageiro, carona recorrente, funcionamento sem internet, importação do WhatsApp.
O que disso tem futuro está em [ROADMAP.md](ROADMAP.md).

## Restrições

- Celular primeiro: um toque, uma mão, na rua, com pressa.
- PWA em Android e iPhone. No iPhone o app precisa ensinar a instalação manual.
- Português do Brasil, com os nomes de lugar como as pessoas falam.
- Dados pessoais mínimos e protegidos: telefone e placa nunca aparecem no mural.
