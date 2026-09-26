# Segurança

Modelo de ameaça do BrazCar em uma página: o que é público, o que exige conta, o que nunca sai, os
limites de tentativa, como o cadastro se fecha, o que já protege e o que fica assumido como risco.

## O que é público

O mural sem sessão: rota, horário, preço, vagas e situação de cada carona. Nome, carro, mensagem
original e observações ficam de fora ([D-171](decisions/README.md)).

## O que exige conta

Publicar, editar, mudar vagas, cancelar e repetir carona; cadastrar e tirar carro; pedir contato;
mandar opinião. Conta sem e-mail confirmado fica retida e não escreve até confirmar um
([D-168](decisions/README.md)).

## O que nunca sai

Telefone e placa não entram em nenhuma lista. Só saem pela rota de pedir contato, que exige login,
tem limite por conta e grava o pedido ([D-031](decisions/README.md)).

## Limites de tentativa

Por chave, quantidade e janela, como estão hoje no código ([D-064](decisions/README.md),
[D-097](decisions/README.md)):

- Login: 10 tentativas a cada 15 minutos, por telefone. Trocar a senha estando logada passa pelo
  mesmo balde, para uma sessão roubada não virar oráculo de força bruta.
- Recuperação de senha: 3 pedidos por hora, por telefone; acima disso cai em silêncio, como telefone
  desconhecido.
- Pedido de contato: 20 por dia, por conta.
- E-mail do convite: 5 envios a cada 4 horas, por convite ([D-166](decisions/README.md),
  [D-167](decisions/README.md)).
- Troca de e-mail: 5 pedidos por hora, por conta ([D-168](decisions/README.md)).
- Opinião: 5 por dia, por conta ([D-155](decisions/README.md)).
- Pedido de remoção: 3 por dia por telefone, em silêncio, sem gravar acima disso; 10 por dia por
  cliente, respondendo 429 ([D-172](decisions/README.md)).

## Como o cadastro é fechado

O cadastro só abre pelo link do convite, vinculado a um telefone. A pessoa informa o e-mail, recebe
um link de confirmação que vale 2 horas, e só então chega ao resto do cadastro; a conta nasce com o
e-mail já confirmado. Conta de antes do convite sem e-mail confirmado fica retida até confirmar um
([D-166](decisions/README.md), [D-167](decisions/README.md), [D-168](decisions/README.md)).

## O que já protege

- Sessão por cookie `brazcar_session`, `HttpOnly`, `Secure` fora de desenvolvimento e
  `SameSite=Lax`.
- Checagem de `Origin` em todo método que altera estado: só passa da própria origem ou de uma
  origem cadastrada ([D-091](decisions/README.md)).
- Conta retida não escreve, travada por um teste que exige a checagem em toda rota de escrita
  ([D-168](decisions/README.md)).
- Regras de segurança do linter (`ruff`, conjunto `S`) sobre todo o backend, com cada exceção
  justificada por arquivo.
- Contêiner da API roda com usuário sem privilégio, nunca como root.
- Token do convite e do link de confirmação nunca aparecem no log de requisição: um filtro os troca
  por `[token]` antes de qualquer escrita ([D-167](decisions/README.md)).
- Fuzz de contrato no CI contra a API real, que já achou e corrigiu status não documentados em quase
  toda rota de escrita ([D-156](decisions/README.md)).

## O que fica assumido como risco

- O link do convite pode ser encaminhado dentro do prazo: quem o receber consegue se cadastrar com o
  telefone do convidado. A mitigação é o link ir por mensagem direta ao próprio número, com prazo
  curto ([D-166](decisions/README.md)).
- O cabeçalho de IP usado no limite do pedido de remoção só é confiável porque a API é alcançável
  apenas pelo túnel do Cloudflare; se a API ganhar entrada direta, o cabeçalho passa a ser forjável
  e o limite por IP deixa de valer ([D-172](decisions/README.md)).
