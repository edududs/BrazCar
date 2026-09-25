# Catálogo de telas

Gerado da versão `v0.19.0` do front. **Não edite à mão:** cada imagem é um estado que a
suíte de ponta a ponta visita, e este arquivo sai das imagens.

```bash
cd web && yarn screens   # roda a suíte, refaz as imagens e reescreve este arquivo
```

As telas são funcionais e sem polimento até a etapa de design (D-103): o que está aqui é o que
existe, fotografado como está. No celular a imagem é a página inteira; no desktop, a janela.

## Celular (`mobile`)

### account

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![anonymous](mobile/account/anonymous.png)<br>Minha conta | `/conta` | `anonymous` | a conta sem sessão manda entrar |
| ![car-added](mobile/account/car-added.png)<br>Minha conta | `/conta` | `car-added` | carros: cadastrar, ver na lista e remover |
| ![car-form](mobile/account/car-form.png)<br>Minha conta | `/conta` | `car-form` | carros: cadastrar, ver na lista e remover |
| ![delete-dialog](mobile/account/delete-dialog.png)<br>Minha conta | `/conta` | `delete-dialog` | excluir conta: o diálogo explica, confirma, e o telefone deixa de servir para entrar |
| ![deleted](mobile/account/deleted.png)<br>Caronas | `/?accountDeleted=true` | `deleted` | excluir conta: o diálogo explica, confirma, e o telefone deixa de servir para entrar |
| ![long-name](mobile/account/long-name.png)<br>Minha conta | `/conta` | `long-name` | nome social longo cabe na conta |
| ![no-cars](mobile/account/no-cars.png)<br>Minha conta | `/conta` | `no-cars` | conta nova: nenhum carro, e o convite fala no singular |
| ![password-changed](mobile/account/password-changed.png)<br>Minha conta | `/conta` | `password-changed` | trocar a senha: a nova senha funciona depois de sair e entrar de novo |
| ![profile-edit](mobile/account/profile-edit.png)<br>Minha conta | `/conta` | `profile-edit` | editar dados: quem não tem e-mail pode adicionar um, e ele fica depois de recarregar |
| ![profile-saved](mobile/account/profile-saved.png)<br>Minha conta | `/conta` | `profile-saved` | editar dados: quem não tem e-mail pode adicionar um, e ele fica depois de recarregar |
| ![signed-out](mobile/account/signed-out.png)<br>Caronas | `/` | `signed-out` | sair da conta devolve o visitante ao mural público |
| ![with-cars](mobile/account/with-cars.png)<br>Minha conta | `/conta` | `with-cars` | carros: cadastrar, ver na lista e remover |

### board

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![empty-by-filter](mobile/board/empty-by-filter.png)<br>Caronas | `/?q=Lago+Sul` | `empty-by-filter` | filtro que não acha nada explica que é filtro |
| ![filtered-by-day](mobile/board/filtered-by-day.png)<br>Caronas | `/?day=2026-09-25` | `filtered-by-day` | o filtro de dia vive na URL e recorta o mural |
| ![from-time-empty](mobile/board/from-time-empty.png)<br>Caronas | `/?day=2026-09-25&from=23:59` | `from-time-empty` | o filtro "a partir de" sem carona no horário mostra o estado vazio |
| ![from-time](mobile/board/from-time.png)<br>Caronas | `/?from=18:00` | `from-time` | o filtro "a partir de" recorta o mural pelo horário local, sem dia e com dia |
| ![full](mobile/board/full.png)<br>Caronas | `/` | `full` | o mural lista as caronas que ainda vão sair, e só elas |
| ![only-with-seats](mobile/board/only-with-seats.png)<br>Caronas | `/?withSeats=true` | `only-with-seats` | só com vaga tira a lotada do mural |
| ![search-by-alias](mobile/board/search-by-alias.png)<br>Caronas | `/?q=SCS` | `search-by-alias` | "passa por" acha o lugar pelo apelido |
| ![search-by-parent](mobile/board/search-by-parent.png)<br>Caronas | `/?q=Plano+Piloto` | `search-by-parent` | "passa por" acha o lugar pelo que está acima dele |
| ![signed-in](mobile/board/signed-in.png)<br>Caronas | `/` | `signed-in` | criar conta: os erros aparecem e a conta entra direto no mural |

### contact

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![before](mobile/contact/before.png)<br>Carona | `/caronas/33b5c4f8-9933-402e-a2b8-c1e6e764c807` | `before` | pedir contato revela o WhatsApp e a placa |
| ![limit-reached](mobile/contact/limit-reached.png)<br>Carona | `/caronas/a2c57e45-5511-4dd1-9a34-7423721d5698` | `limit-reached` | com a cota do dia gasta, o pedido é recusado na própria tela |
| ![none-when-cancelled](mobile/contact/none-when-cancelled.png)<br>Carona | `/caronas/21600cff-30d4-49ec-bbe4-022d284f90b9` | `none-when-cancelled` | carona cancelada não oferece o botão nem para quem está logado |
| ![none-when-full](mobile/contact/none-when-full.png)<br>Carona | `/caronas/688cc6da-0f04-4480-a135-2286d7898783` | `none-when-full` | carona lotada não oferece o botão nem para quem está logado |
| ![revealed](mobile/contact/revealed.png)<br>Carona | `/caronas/33b5c4f8-9933-402e-a2b8-c1e6e764c807` | `revealed` | pedir contato revela o WhatsApp e a placa |

### edit

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![form](mobile/edit/form.png)<br>Editar carona | `/caronas/7a5f99d0-16f0-46ff-aed6-0196977904d9/editar` | `form` | editar: o mesmo dia passa, outro dia é recusado |
| ![other-day-refused](mobile/edit/other-day-refused.png)<br>Editar carona | `/caronas/7a5f99d0-16f0-46ff-aed6-0196977904d9/editar` | `other-day-refused` | editar: o mesmo dia passa, outro dia é recusado |

### imported

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![board-card](mobile/imported/board-card.png)<br>Caronas | `/?q=Setor+Tradicional` | `board-card` | o card da importada traz o selo via WhatsApp |
| ![contact-without-plate](mobile/imported/contact-without-plate.png)<br>Carona | `/caronas/3ce1c562-88f7-4c06-ac1f-b68e8c0692ff` | `contact-without-plate` | o contato de motorista externo vem sem placa |
| ![detail-with-fares](mobile/imported/detail-with-fares.png)<br>Carona | `/caronas/fe6dc889-e4b2-4f32-b998-1a7bb525ae36` | `detail-with-fares` | a importada com tarifas mostra o preço de cada parada |
| ![detail](mobile/imported/detail.png)<br>Carona | `/caronas/3ce1c562-88f7-4c06-ac1f-b68e8c0692ff` | `detail` | o detalhe mostra a mensagem original, já redigida |
| ![owned-detail](mobile/imported/owned-detail.png)<br>Carona | `/caronas/68596492-c7e6-4d1b-b842-376d8edd8997` | `owned-detail` | a importada de quem tem conta é da dona, e aparece em minhas caronas |
| ![owned-in-my-rides](mobile/imported/owned-in-my-rides.png)<br>Minhas caronas | `/minhas-caronas` | `owned-in-my-rides` | a importada de quem tem conta é da dona, e aparece em minhas caronas |

### login

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![empty](mobile/login/empty.png)<br>Entrar | `/entrar` | `empty` | entrar: senha errada é recusada e a certa leva ao mural |
| ![wrong-password](mobile/login/wrong-password.png)<br>Entrar | `/entrar` | `wrong-password` | entrar: senha errada é recusada e a certa leva ao mural |

### my-rides

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![empty](mobile/my-rides/empty.png)<br>Minhas caronas | `/minhas-caronas` | `empty` | minhas caronas de quem nunca publicou |
| ![full](mobile/my-rides/full.png)<br>Minhas caronas | `/minhas-caronas` | `full` | minhas caronas mostram também a cancelada e a que já saiu |

### password-reset

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![incomplete-link](mobile/password-reset/incomplete-link.png)<br>Este link está incompleto | `/redefinir-senha?token=` | `incomplete-link` | link de redefinir sem token pede outro |
| ![request](mobile/password-reset/request.png)<br>Esqueci a senha | `/esqueci-senha` | `request` | esqueci a senha: a resposta é a mesma para qualquer telefone |
| ![sent](mobile/password-reset/sent.png)<br>Esqueci a senha | `/esqueci-senha` | `sent` | esqueci a senha: a resposta é a mesma para qualquer telefone |

### publish

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![empty](mobile/publish/empty.png)<br>Publicar carona | `/publicar` | `empty` | publicar uma carona simples |
| ![fares-per-stop](mobile/publish/fares-per-stop.png)<br>Publicar carona | `/publicar` | `fares-per-stop` | com preço por parada, o preço da carona some do formulário |
| ![filled](mobile/publish/filled.png)<br>Publicar carona | `/publicar` | `filled` | publicar uma carona simples |
| ![free-text-stop](mobile/publish/free-text-stop.png)<br>Publicar carona | `/publicar` | `free-text-stop` | uma parada em texto livre entra na rota |
| ![personal-data-refused](mobile/publish/personal-data-refused.png)<br>Publicar carona | `/publicar` | `personal-data-refused` | observação com telefone é recusada com a frase do botão |
| ![without-a-car](mobile/publish/without-a-car.png)<br>Publicar carona | `/publicar` | `without-a-car` | sem carro, publicar manda cadastrar um |

### realtime

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![after](mobile/realtime/after.png)<br>Caronas | `/` | `after` | o mural do visitante aprende a carona que outro acabou de publicar |
| ![before](mobile/realtime/before.png)<br>Caronas | `/` | `before` | o mural do visitante aprende a carona que outro acabou de publicar |

### ride

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![cancel-dialog](mobile/ride/cancel-dialog.png)<br>Carona | `/caronas/37a2db73-2f04-4cc1-8afa-068e0692e56e` | `cancel-dialog` | cancelar pede confirmação e é definitivo |
| ![cancelled](mobile/ride/cancelled.png)<br>Carona | `/caronas/21600cff-30d4-49ec-bbe4-022d284f90b9` | `cancelled` | carona cancelada continua legível pelo endereço |
| ![departed](mobile/ride/departed.png)<br>Carona | `/caronas/30490062-cef0-4e4c-875f-c118436fefa4` | `departed` | carona que já saiu não oferece contato |
| ![fares-per-stop](mobile/ride/fares-per-stop.png)<br>Carona | `/caronas/0b744592-5048-4e32-8b6a-257515ee4764` | `fares-per-stop` | carona com preço por parada mostra cada tarifa |
| ![full](mobile/ride/full.png)<br>Carona | `/caronas/688cc6da-0f04-4480-a135-2286d7898783` | `full` | carona lotada não oferece contato |
| ![just-published](mobile/ride/just-published.png)<br>Carona | `/caronas/22f7033c-0a20-422d-9f6b-a0775cb3c9e3` | `just-published` | publicar uma carona simples |
| ![long-notes](mobile/ride/long-notes.png)<br>Carona | `/caronas/c0c5089b-6b28-4be8-8097-5959b2e585be` | `long-notes` | carona com observações longas mostra o texto inteiro |
| ![not-found](mobile/ride/not-found.png)<br>Carona | `/caronas/00000000-0000-4000-8000-000000000000` | `not-found` | endereço de carona que não existe explica o que houve |
| ![open-anonymous](mobile/ride/open-anonymous.png)<br>Carona | `/caronas/33b5c4f8-9933-402e-a2b8-c1e6e764c807` | `open-anonymous` | o detalhe de uma carona aberta convida a entrar para pedir contato |
| ![owner-cancelled](mobile/ride/owner-cancelled.png)<br>Carona | `/caronas/37a2db73-2f04-4cc1-8afa-068e0692e56e` | `owner-cancelled` | cancelar pede confirmação e é definitivo |
| ![owner-edited](mobile/ride/owner-edited.png)<br>Carona | `/caronas/7a5f99d0-16f0-46ff-aed6-0196977904d9` | `owner-edited` | editar: o mesmo dia passa, outro dia é recusado |
| ![owner-full](mobile/ride/owner-full.png)<br>Carona | `/caronas/7f8e56ac-b821-4c88-9a44-b8200c061e31` | `owner-full` | o dono fecha e reabre a carona pelas vagas |
| ![owner-open](mobile/ride/owner-open.png)<br>Carona | `/caronas/7f8e56ac-b821-4c88-9a44-b8200c061e31` | `owner-open` | o dono fecha e reabre a carona pelas vagas |
| ![owner-reopened](mobile/ride/owner-reopened.png)<br>Carona | `/caronas/7f8e56ac-b821-4c88-9a44-b8200c061e31` | `owner-reopened` | o dono fecha e reabre a carona pelas vagas |
| ![repeat-ready](mobile/ride/repeat-ready.png)<br>Carona | `/caronas/3ffcaf8c-8700-4ac3-877a-938df6173a8f` | `repeat-ready` | repetir uma carona publica outra igual em outro horário |
| ![repeated](mobile/ride/repeated.png)<br>Carona | `/caronas/354a607d-1898-467c-b1ec-f2d8a766968d` | `repeated` | repetir uma carona publica outra igual em outro horário |

### shell

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![install-hint](mobile/shell/install-hint.png)<br>Caronas | `/` | `install-hint` | no iPhone, a dica de instalar aparece e some quando dispensada |
| ![offline](mobile/shell/offline.png)<br>Caronas | `/` | `offline` | sem internet o app avisa por cima da página |
| ![route-not-found](mobile/shell/route-not-found.png)<br>Página não encontrada | `/uma-pagina-que-nao-existe` | `route-not-found` | endereço que não é rota nenhuma explica em português e leva ao mural |
| ![version-required](mobile/shell/version-required.png)<br>Atualize o BrazCar | `/` | `version-required` | abaixo do piso de versão o app só oferece atualizar |

### signup

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![empty](mobile/signup/empty.png)<br>Criar conta | `/cadastro` | `empty` | criar conta: os erros aparecem e a conta entra direto no mural |
| ![phone-formatted](mobile/signup/phone-formatted.png)<br>Criar conta | `/cadastro` | `phone-formatted` | criar conta: os erros aparecem e a conta entra direto no mural |
| ![refused](mobile/signup/refused.png)<br>Criar conta | `/cadastro` | `refused` | criar conta: os erros aparecem e a conta entra direto no mural |

## Desktop (`desktop`)

### account

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![anonymous](desktop/account/anonymous.png)<br>Minha conta | `/conta` | `anonymous` | a conta sem sessão manda entrar |
| ![car-added](desktop/account/car-added.png)<br>Minha conta | `/conta` | `car-added` | carros: cadastrar, ver na lista e remover |
| ![car-form](desktop/account/car-form.png)<br>Minha conta | `/conta` | `car-form` | carros: cadastrar, ver na lista e remover |
| ![delete-dialog](desktop/account/delete-dialog.png)<br>Minha conta | `/conta` | `delete-dialog` | excluir conta: o diálogo explica, confirma, e o telefone deixa de servir para entrar |
| ![deleted](desktop/account/deleted.png)<br>Caronas | `/?accountDeleted=true` | `deleted` | excluir conta: o diálogo explica, confirma, e o telefone deixa de servir para entrar |
| ![long-name](desktop/account/long-name.png)<br>Minha conta | `/conta` | `long-name` | nome social longo cabe na conta |
| ![no-cars](desktop/account/no-cars.png)<br>Minha conta | `/conta` | `no-cars` | conta nova: nenhum carro, e o convite fala no singular |
| ![password-changed](desktop/account/password-changed.png)<br>Minha conta | `/conta` | `password-changed` | trocar a senha: a nova senha funciona depois de sair e entrar de novo |
| ![profile-edit](desktop/account/profile-edit.png)<br>Minha conta | `/conta` | `profile-edit` | editar dados: quem não tem e-mail pode adicionar um, e ele fica depois de recarregar |
| ![profile-saved](desktop/account/profile-saved.png)<br>Minha conta | `/conta` | `profile-saved` | editar dados: quem não tem e-mail pode adicionar um, e ele fica depois de recarregar |
| ![signed-out](desktop/account/signed-out.png)<br>Caronas | `/` | `signed-out` | sair da conta devolve o visitante ao mural público |
| ![with-cars](desktop/account/with-cars.png)<br>Minha conta | `/conta` | `with-cars` | carros: cadastrar, ver na lista e remover |

### board

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![empty-by-filter](desktop/board/empty-by-filter.png)<br>Caronas | `/?q=Lago+Sul` | `empty-by-filter` | filtro que não acha nada explica que é filtro |
| ![filtered-by-day](desktop/board/filtered-by-day.png)<br>Caronas | `/?day=2026-09-25` | `filtered-by-day` | o filtro de dia vive na URL e recorta o mural |
| ![from-time-empty](desktop/board/from-time-empty.png)<br>Caronas | `/?day=2026-09-25&from=23:59` | `from-time-empty` | o filtro "a partir de" sem carona no horário mostra o estado vazio |
| ![from-time](desktop/board/from-time.png)<br>Caronas | `/?from=18:00` | `from-time` | o filtro "a partir de" recorta o mural pelo horário local, sem dia e com dia |
| ![full](desktop/board/full.png)<br>Caronas | `/` | `full` | o mural lista as caronas que ainda vão sair, e só elas |
| ![only-with-seats](desktop/board/only-with-seats.png)<br>Caronas | `/?withSeats=true` | `only-with-seats` | só com vaga tira a lotada do mural |
| ![search-by-alias](desktop/board/search-by-alias.png)<br>Caronas | `/?q=SCS` | `search-by-alias` | "passa por" acha o lugar pelo apelido |
| ![search-by-parent](desktop/board/search-by-parent.png)<br>Caronas | `/?q=Plano+Piloto` | `search-by-parent` | "passa por" acha o lugar pelo que está acima dele |
| ![signed-in](desktop/board/signed-in.png)<br>Caronas | `/` | `signed-in` | criar conta: os erros aparecem e a conta entra direto no mural |

### contact

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![before](desktop/contact/before.png)<br>Carona | `/caronas/33b5c4f8-9933-402e-a2b8-c1e6e764c807` | `before` | pedir contato revela o WhatsApp e a placa |
| ![limit-reached](desktop/contact/limit-reached.png)<br>Carona | `/caronas/a2c57e45-5511-4dd1-9a34-7423721d5698` | `limit-reached` | com a cota do dia gasta, o pedido é recusado na própria tela |
| ![none-when-cancelled](desktop/contact/none-when-cancelled.png)<br>Carona | `/caronas/21600cff-30d4-49ec-bbe4-022d284f90b9` | `none-when-cancelled` | carona cancelada não oferece o botão nem para quem está logado |
| ![none-when-full](desktop/contact/none-when-full.png)<br>Carona | `/caronas/688cc6da-0f04-4480-a135-2286d7898783` | `none-when-full` | carona lotada não oferece o botão nem para quem está logado |
| ![revealed](desktop/contact/revealed.png)<br>Carona | `/caronas/33b5c4f8-9933-402e-a2b8-c1e6e764c807` | `revealed` | pedir contato revela o WhatsApp e a placa |

### edit

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![form](desktop/edit/form.png)<br>Editar carona | `/caronas/b893b4c9-7b5b-4eb6-9d39-c1aef8acea54/editar` | `form` | editar: o mesmo dia passa, outro dia é recusado |
| ![other-day-refused](desktop/edit/other-day-refused.png)<br>Editar carona | `/caronas/b893b4c9-7b5b-4eb6-9d39-c1aef8acea54/editar` | `other-day-refused` | editar: o mesmo dia passa, outro dia é recusado |

### imported

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![board-card](desktop/imported/board-card.png)<br>Caronas | `/?q=Setor+Tradicional` | `board-card` | o card da importada traz o selo via WhatsApp |
| ![contact-without-plate](desktop/imported/contact-without-plate.png)<br>Carona | `/caronas/3ce1c562-88f7-4c06-ac1f-b68e8c0692ff` | `contact-without-plate` | o contato de motorista externo vem sem placa |
| ![detail-with-fares](desktop/imported/detail-with-fares.png)<br>Carona | `/caronas/fe6dc889-e4b2-4f32-b998-1a7bb525ae36` | `detail-with-fares` | a importada com tarifas mostra o preço de cada parada |
| ![detail](desktop/imported/detail.png)<br>Carona | `/caronas/3ce1c562-88f7-4c06-ac1f-b68e8c0692ff` | `detail` | o detalhe mostra a mensagem original, já redigida |
| ![owned-detail](desktop/imported/owned-detail.png)<br>Carona | `/caronas/68596492-c7e6-4d1b-b842-376d8edd8997` | `owned-detail` | a importada de quem tem conta é da dona, e aparece em minhas caronas |
| ![owned-in-my-rides](desktop/imported/owned-in-my-rides.png)<br>Minhas caronas | `/minhas-caronas` | `owned-in-my-rides` | a importada de quem tem conta é da dona, e aparece em minhas caronas |

### login

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![empty](desktop/login/empty.png)<br>Entrar | `/entrar` | `empty` | entrar: senha errada é recusada e a certa leva ao mural |
| ![wrong-password](desktop/login/wrong-password.png)<br>Entrar | `/entrar` | `wrong-password` | entrar: senha errada é recusada e a certa leva ao mural |

### my-rides

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![empty](desktop/my-rides/empty.png)<br>Minhas caronas | `/minhas-caronas` | `empty` | minhas caronas de quem nunca publicou |
| ![full](desktop/my-rides/full.png)<br>Minhas caronas | `/minhas-caronas` | `full` | minhas caronas mostram também a cancelada e a que já saiu |

### password-reset

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![incomplete-link](desktop/password-reset/incomplete-link.png)<br>Este link está incompleto | `/redefinir-senha?token=` | `incomplete-link` | link de redefinir sem token pede outro |
| ![request](desktop/password-reset/request.png)<br>Esqueci a senha | `/esqueci-senha` | `request` | esqueci a senha: a resposta é a mesma para qualquer telefone |
| ![sent](desktop/password-reset/sent.png)<br>Esqueci a senha | `/esqueci-senha` | `sent` | esqueci a senha: a resposta é a mesma para qualquer telefone |

### publish

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![empty](desktop/publish/empty.png)<br>Publicar carona | `/publicar` | `empty` | publicar uma carona simples |
| ![fares-per-stop](desktop/publish/fares-per-stop.png)<br>Publicar carona | `/publicar` | `fares-per-stop` | com preço por parada, o preço da carona some do formulário |
| ![filled](desktop/publish/filled.png)<br>Publicar carona | `/publicar` | `filled` | publicar uma carona simples |
| ![free-text-stop](desktop/publish/free-text-stop.png)<br>Publicar carona | `/publicar` | `free-text-stop` | uma parada em texto livre entra na rota |
| ![personal-data-refused](desktop/publish/personal-data-refused.png)<br>Publicar carona | `/publicar` | `personal-data-refused` | observação com telefone é recusada com a frase do botão |
| ![without-a-car](desktop/publish/without-a-car.png)<br>Publicar carona | `/publicar` | `without-a-car` | sem carro, publicar manda cadastrar um |

### realtime

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![after](desktop/realtime/after.png)<br>Caronas | `/` | `after` | o mural do visitante aprende a carona que outro acabou de publicar |
| ![before](desktop/realtime/before.png)<br>Caronas | `/` | `before` | o mural do visitante aprende a carona que outro acabou de publicar |

### ride

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![cancel-dialog](desktop/ride/cancel-dialog.png)<br>Carona | `/caronas/5ad9be3d-b83f-42ee-9ee9-d4770a3c896e` | `cancel-dialog` | cancelar pede confirmação e é definitivo |
| ![cancelled](desktop/ride/cancelled.png)<br>Carona | `/caronas/21600cff-30d4-49ec-bbe4-022d284f90b9` | `cancelled` | carona cancelada continua legível pelo endereço |
| ![departed](desktop/ride/departed.png)<br>Carona | `/caronas/30490062-cef0-4e4c-875f-c118436fefa4` | `departed` | carona que já saiu não oferece contato |
| ![fares-per-stop](desktop/ride/fares-per-stop.png)<br>Carona | `/caronas/0b744592-5048-4e32-8b6a-257515ee4764` | `fares-per-stop` | carona com preço por parada mostra cada tarifa |
| ![full](desktop/ride/full.png)<br>Carona | `/caronas/688cc6da-0f04-4480-a135-2286d7898783` | `full` | carona lotada não oferece contato |
| ![just-published](desktop/ride/just-published.png)<br>Carona | `/caronas/3f9ec7dd-75f1-47a3-a032-8879003f1ef1` | `just-published` | publicar uma carona simples |
| ![long-notes](desktop/ride/long-notes.png)<br>Carona | `/caronas/c0c5089b-6b28-4be8-8097-5959b2e585be` | `long-notes` | carona com observações longas mostra o texto inteiro |
| ![not-found](desktop/ride/not-found.png)<br>Carona | `/caronas/00000000-0000-4000-8000-000000000000` | `not-found` | endereço de carona que não existe explica o que houve |
| ![open-anonymous](desktop/ride/open-anonymous.png)<br>Carona | `/caronas/33b5c4f8-9933-402e-a2b8-c1e6e764c807` | `open-anonymous` | o detalhe de uma carona aberta convida a entrar para pedir contato |
| ![owner-cancelled](desktop/ride/owner-cancelled.png)<br>Carona | `/caronas/5ad9be3d-b83f-42ee-9ee9-d4770a3c896e` | `owner-cancelled` | cancelar pede confirmação e é definitivo |
| ![owner-edited](desktop/ride/owner-edited.png)<br>Carona | `/caronas/b893b4c9-7b5b-4eb6-9d39-c1aef8acea54` | `owner-edited` | editar: o mesmo dia passa, outro dia é recusado |
| ![owner-full](desktop/ride/owner-full.png)<br>Carona | `/caronas/e67f2004-ebcf-4ed9-bdaa-0d894be15bb0` | `owner-full` | o dono fecha e reabre a carona pelas vagas |
| ![owner-open](desktop/ride/owner-open.png)<br>Carona | `/caronas/e67f2004-ebcf-4ed9-bdaa-0d894be15bb0` | `owner-open` | o dono fecha e reabre a carona pelas vagas |
| ![owner-reopened](desktop/ride/owner-reopened.png)<br>Carona | `/caronas/e67f2004-ebcf-4ed9-bdaa-0d894be15bb0` | `owner-reopened` | o dono fecha e reabre a carona pelas vagas |
| ![repeat-ready](desktop/ride/repeat-ready.png)<br>Carona | `/caronas/3ffcaf8c-8700-4ac3-877a-938df6173a8f` | `repeat-ready` | repetir uma carona publica outra igual em outro horário |
| ![repeated](desktop/ride/repeated.png)<br>Carona | `/caronas/c4af8691-9908-4ab1-bb58-b3ce099b0017` | `repeated` | repetir uma carona publica outra igual em outro horário |

### shell

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![offline](desktop/shell/offline.png)<br>Caronas | `/` | `offline` | sem internet o app avisa por cima da página |
| ![route-not-found](desktop/shell/route-not-found.png)<br>Página não encontrada | `/uma-pagina-que-nao-existe` | `route-not-found` | endereço que não é rota nenhuma explica em português e leva ao mural |
| ![version-required](desktop/shell/version-required.png)<br>Atualize o BrazCar | `/` | `version-required` | abaixo do piso de versão o app só oferece atualizar |

### signup

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![empty](desktop/signup/empty.png)<br>Criar conta | `/cadastro` | `empty` | criar conta: os erros aparecem e a conta entra direto no mural |
| ![phone-formatted](desktop/signup/phone-formatted.png)<br>Criar conta | `/cadastro` | `phone-formatted` | criar conta: os erros aparecem e a conta entra direto no mural |
| ![refused](desktop/signup/refused.png)<br>Criar conta | `/cadastro` | `refused` | criar conta: os erros aparecem e a conta entra direto no mural |
