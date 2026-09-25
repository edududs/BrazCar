# Catálogo de telas

Gerado da versão `v0.13.0` do front. **Não edite à mão:** cada imagem é um estado que a
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
| ![signed-out](mobile/account/signed-out.png)<br>Minha conta | `/conta` | `signed-out` | sair da conta devolve o visitante ao mural público |
| ![with-cars](mobile/account/with-cars.png)<br>Minha conta | `/conta` | `with-cars` | carros: cadastrar, ver na lista e remover |

### board

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![empty-by-filter](mobile/board/empty-by-filter.png)<br>Caronas | `/?q=Lago+Sul` | `empty-by-filter` | filtro que não acha nada explica que é filtro |
| ![filtered-by-day](mobile/board/filtered-by-day.png)<br>Caronas | `/?day=2026-09-24` | `filtered-by-day` | o filtro de dia vive na URL e recorta o mural |
| ![full](mobile/board/full.png)<br>Caronas | `/` | `full` | o mural lista as caronas que ainda vão sair, e só elas |
| ![only-with-seats](mobile/board/only-with-seats.png)<br>Caronas | `/?withSeats=true` | `only-with-seats` | só com vaga tira a lotada do mural |
| ![search-by-alias](mobile/board/search-by-alias.png)<br>Caronas | `/?q=SCS` | `search-by-alias` | "passa por" acha o lugar pelo apelido |
| ![search-by-parent](mobile/board/search-by-parent.png)<br>Caronas | `/?q=Plano+Piloto` | `search-by-parent` | "passa por" acha o lugar pelo que está acima dele |
| ![signed-in](mobile/board/signed-in.png)<br>Caronas | `/` | `signed-in` | criar conta: os erros aparecem e a conta entra direto no mural |

### contact

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![before](mobile/contact/before.png)<br>Carona | `/caronas/1c586e93-141f-4cb7-9f41-fa45e164b8b1` | `before` | pedir contato revela o WhatsApp e a placa |
| ![limit-reached](mobile/contact/limit-reached.png)<br>Carona | `/caronas/41a02a25-cd86-4514-8a0b-5b46f5131000` | `limit-reached` | com a cota do dia gasta, o pedido é recusado na própria tela |
| ![none-when-cancelled](mobile/contact/none-when-cancelled.png)<br>Carona | `/caronas/3fb53475-8359-40e0-b3ea-519ca01409dd` | `none-when-cancelled` | carona cancelada não oferece o botão nem para quem está logado |
| ![none-when-full](mobile/contact/none-when-full.png)<br>Carona | `/caronas/710a3f8f-dc15-4d39-8fc0-df9694acfb66` | `none-when-full` | carona lotada não oferece o botão nem para quem está logado |
| ![revealed](mobile/contact/revealed.png)<br>Carona | `/caronas/1c586e93-141f-4cb7-9f41-fa45e164b8b1` | `revealed` | pedir contato revela o WhatsApp e a placa |

### edit

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![form](mobile/edit/form.png)<br>Editar carona | `/caronas/f090f3bf-28cd-422c-8d91-47a070f36a18/editar` | `form` | editar: o mesmo dia passa, outro dia é recusado |
| ![other-day-refused](mobile/edit/other-day-refused.png)<br>Editar carona | `/caronas/f090f3bf-28cd-422c-8d91-47a070f36a18/editar` | `other-day-refused` | editar: o mesmo dia passa, outro dia é recusado |

### imported

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![board-card](mobile/imported/board-card.png)<br>Caronas | `/?q=Setor+Tradicional` | `board-card` | o card da importada traz o selo via WhatsApp |
| ![contact-without-plate](mobile/imported/contact-without-plate.png)<br>Carona | `/caronas/1fdf22c9-20fe-4317-bb2b-5d5b886c9bd5` | `contact-without-plate` | o contato de motorista externo vem sem placa |
| ![detail-with-fares](mobile/imported/detail-with-fares.png)<br>Carona | `/caronas/0d2413a2-04b1-4f71-83a2-2ae8baefc4b3` | `detail-with-fares` | a importada com tarifas mostra o preço de cada parada |
| ![detail](mobile/imported/detail.png)<br>Carona | `/caronas/1fdf22c9-20fe-4317-bb2b-5d5b886c9bd5` | `detail` | o detalhe mostra a mensagem original, já redigida |
| ![owned-detail](mobile/imported/owned-detail.png)<br>Carona | `/caronas/5205f3af-148a-48ad-b6a8-2ae7e5c2cb98` | `owned-detail` | a importada de quem tem conta é da dona, e aparece em minhas caronas |
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
| ![incomplete-link](mobile/password-reset/incomplete-link.png)<br>Redefinir senha | `/redefinir-senha?token=` | `incomplete-link` | link de redefinir sem token pede outro |
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
| ![cancel-dialog](mobile/ride/cancel-dialog.png)<br>Carona | `/caronas/9d32d656-94dc-470a-9064-edf8c79503d2` | `cancel-dialog` | cancelar pede confirmação e é definitivo |
| ![cancelled](mobile/ride/cancelled.png)<br>Carona | `/caronas/3fb53475-8359-40e0-b3ea-519ca01409dd` | `cancelled` | carona cancelada continua legível pelo endereço |
| ![departed](mobile/ride/departed.png)<br>Carona | `/caronas/7b7f4794-569f-460e-9e2b-f8dcac00a332` | `departed` | carona que já saiu não oferece contato |
| ![fares-per-stop](mobile/ride/fares-per-stop.png)<br>Carona | `/caronas/17e1d518-cc56-43c9-a008-1937a94c5f88` | `fares-per-stop` | carona com preço por parada mostra cada tarifa |
| ![full](mobile/ride/full.png)<br>Carona | `/caronas/710a3f8f-dc15-4d39-8fc0-df9694acfb66` | `full` | carona lotada não oferece contato |
| ![just-published](mobile/ride/just-published.png)<br>Carona | `/caronas/72287491-f2b2-4059-a178-c9ba3a0cf1b9` | `just-published` | publicar uma carona simples |
| ![long-notes](mobile/ride/long-notes.png)<br>Carona | `/caronas/debfb069-0bf0-4bd7-93ce-89f46cfedc3a` | `long-notes` | carona com observações longas mostra o texto inteiro |
| ![not-found](mobile/ride/not-found.png)<br>Carona | `/caronas/00000000-0000-4000-8000-000000000000` | `not-found` | endereço de carona que não existe explica o que houve |
| ![open-anonymous](mobile/ride/open-anonymous.png)<br>Carona | `/caronas/1c586e93-141f-4cb7-9f41-fa45e164b8b1` | `open-anonymous` | o detalhe de uma carona aberta convida a entrar para pedir contato |
| ![owner-cancelled](mobile/ride/owner-cancelled.png)<br>Carona | `/caronas/9d32d656-94dc-470a-9064-edf8c79503d2` | `owner-cancelled` | cancelar pede confirmação e é definitivo |
| ![owner-edited](mobile/ride/owner-edited.png)<br>Carona | `/caronas/f090f3bf-28cd-422c-8d91-47a070f36a18` | `owner-edited` | editar: o mesmo dia passa, outro dia é recusado |
| ![owner-full](mobile/ride/owner-full.png)<br>Carona | `/caronas/3b0226ff-7d6d-4f03-9c13-5a3dd60462e0` | `owner-full` | o dono fecha e reabre a carona pelas vagas |
| ![owner-open](mobile/ride/owner-open.png)<br>Carona | `/caronas/3b0226ff-7d6d-4f03-9c13-5a3dd60462e0` | `owner-open` | o dono fecha e reabre a carona pelas vagas |
| ![owner-reopened](mobile/ride/owner-reopened.png)<br>Carona | `/caronas/3b0226ff-7d6d-4f03-9c13-5a3dd60462e0` | `owner-reopened` | o dono fecha e reabre a carona pelas vagas |
| ![repeat-ready](mobile/ride/repeat-ready.png)<br>Carona | `/caronas/0ae9e300-efba-4968-a0b3-dcfeb45dc608` | `repeat-ready` | repetir uma carona publica outra igual em outro horário |
| ![repeated](mobile/ride/repeated.png)<br>Carona | `/caronas/72322e67-a45e-4c62-b885-62c26fd48d1d` | `repeated` | repetir uma carona publica outra igual em outro horário |

### shell

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![install-hint](mobile/shell/install-hint.png)<br>Caronas | `/` | `install-hint` | no iPhone, a dica de instalar aparece e some quando dispensada |
| ![offline](mobile/shell/offline.png)<br>Sem internet | `/` | `offline` | sem internet o app avisa por cima da página |
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
| ![signed-out](desktop/account/signed-out.png)<br>Minha conta | `/conta` | `signed-out` | sair da conta devolve o visitante ao mural público |
| ![with-cars](desktop/account/with-cars.png)<br>Minha conta | `/conta` | `with-cars` | carros: cadastrar, ver na lista e remover |

### board

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![empty-by-filter](desktop/board/empty-by-filter.png)<br>Caronas | `/?q=Lago+Sul` | `empty-by-filter` | filtro que não acha nada explica que é filtro |
| ![filtered-by-day](desktop/board/filtered-by-day.png)<br>Caronas | `/?day=2026-09-24` | `filtered-by-day` | o filtro de dia vive na URL e recorta o mural |
| ![full](desktop/board/full.png)<br>Caronas | `/` | `full` | o mural lista as caronas que ainda vão sair, e só elas |
| ![only-with-seats](desktop/board/only-with-seats.png)<br>Caronas | `/?withSeats=true` | `only-with-seats` | só com vaga tira a lotada do mural |
| ![search-by-alias](desktop/board/search-by-alias.png)<br>Caronas | `/?q=SCS` | `search-by-alias` | "passa por" acha o lugar pelo apelido |
| ![search-by-parent](desktop/board/search-by-parent.png)<br>Caronas | `/?q=Plano+Piloto` | `search-by-parent` | "passa por" acha o lugar pelo que está acima dele |
| ![signed-in](desktop/board/signed-in.png)<br>Caronas | `/` | `signed-in` | criar conta: os erros aparecem e a conta entra direto no mural |

### contact

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![before](desktop/contact/before.png)<br>Carona | `/caronas/1c586e93-141f-4cb7-9f41-fa45e164b8b1` | `before` | pedir contato revela o WhatsApp e a placa |
| ![limit-reached](desktop/contact/limit-reached.png)<br>Carona | `/caronas/41a02a25-cd86-4514-8a0b-5b46f5131000` | `limit-reached` | com a cota do dia gasta, o pedido é recusado na própria tela |
| ![none-when-cancelled](desktop/contact/none-when-cancelled.png)<br>Carona | `/caronas/3fb53475-8359-40e0-b3ea-519ca01409dd` | `none-when-cancelled` | carona cancelada não oferece o botão nem para quem está logado |
| ![none-when-full](desktop/contact/none-when-full.png)<br>Carona | `/caronas/710a3f8f-dc15-4d39-8fc0-df9694acfb66` | `none-when-full` | carona lotada não oferece o botão nem para quem está logado |
| ![revealed](desktop/contact/revealed.png)<br>Carona | `/caronas/1c586e93-141f-4cb7-9f41-fa45e164b8b1` | `revealed` | pedir contato revela o WhatsApp e a placa |

### edit

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![form](desktop/edit/form.png)<br>Editar carona | `/caronas/e51a9c88-8271-4dda-bb59-a78f651251b8/editar` | `form` | editar: o mesmo dia passa, outro dia é recusado |
| ![other-day-refused](desktop/edit/other-day-refused.png)<br>Editar carona | `/caronas/e51a9c88-8271-4dda-bb59-a78f651251b8/editar` | `other-day-refused` | editar: o mesmo dia passa, outro dia é recusado |

### imported

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![board-card](desktop/imported/board-card.png)<br>Caronas | `/?q=Setor+Tradicional` | `board-card` | o card da importada traz o selo via WhatsApp |
| ![contact-without-plate](desktop/imported/contact-without-plate.png)<br>Carona | `/caronas/1fdf22c9-20fe-4317-bb2b-5d5b886c9bd5` | `contact-without-plate` | o contato de motorista externo vem sem placa |
| ![detail-with-fares](desktop/imported/detail-with-fares.png)<br>Carona | `/caronas/0d2413a2-04b1-4f71-83a2-2ae8baefc4b3` | `detail-with-fares` | a importada com tarifas mostra o preço de cada parada |
| ![detail](desktop/imported/detail.png)<br>Carona | `/caronas/1fdf22c9-20fe-4317-bb2b-5d5b886c9bd5` | `detail` | o detalhe mostra a mensagem original, já redigida |
| ![owned-detail](desktop/imported/owned-detail.png)<br>Carona | `/caronas/5205f3af-148a-48ad-b6a8-2ae7e5c2cb98` | `owned-detail` | a importada de quem tem conta é da dona, e aparece em minhas caronas |
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
| ![incomplete-link](desktop/password-reset/incomplete-link.png)<br>Redefinir senha | `/redefinir-senha?token=` | `incomplete-link` | link de redefinir sem token pede outro |
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
| ![cancel-dialog](desktop/ride/cancel-dialog.png)<br>Carona | `/caronas/371e1062-aa1d-4e16-9097-790f02a19609` | `cancel-dialog` | cancelar pede confirmação e é definitivo |
| ![cancelled](desktop/ride/cancelled.png)<br>Carona | `/caronas/3fb53475-8359-40e0-b3ea-519ca01409dd` | `cancelled` | carona cancelada continua legível pelo endereço |
| ![departed](desktop/ride/departed.png)<br>Carona | `/caronas/7b7f4794-569f-460e-9e2b-f8dcac00a332` | `departed` | carona que já saiu não oferece contato |
| ![fares-per-stop](desktop/ride/fares-per-stop.png)<br>Carona | `/caronas/17e1d518-cc56-43c9-a008-1937a94c5f88` | `fares-per-stop` | carona com preço por parada mostra cada tarifa |
| ![full](desktop/ride/full.png)<br>Carona | `/caronas/710a3f8f-dc15-4d39-8fc0-df9694acfb66` | `full` | carona lotada não oferece contato |
| ![just-published](desktop/ride/just-published.png)<br>Carona | `/caronas/7eb70c1f-ed67-482e-9103-0c5317ba55a0` | `just-published` | publicar uma carona simples |
| ![long-notes](desktop/ride/long-notes.png)<br>Carona | `/caronas/debfb069-0bf0-4bd7-93ce-89f46cfedc3a` | `long-notes` | carona com observações longas mostra o texto inteiro |
| ![not-found](desktop/ride/not-found.png)<br>Carona | `/caronas/00000000-0000-4000-8000-000000000000` | `not-found` | endereço de carona que não existe explica o que houve |
| ![open-anonymous](desktop/ride/open-anonymous.png)<br>Carona | `/caronas/1c586e93-141f-4cb7-9f41-fa45e164b8b1` | `open-anonymous` | o detalhe de uma carona aberta convida a entrar para pedir contato |
| ![owner-cancelled](desktop/ride/owner-cancelled.png)<br>Carona | `/caronas/371e1062-aa1d-4e16-9097-790f02a19609` | `owner-cancelled` | cancelar pede confirmação e é definitivo |
| ![owner-edited](desktop/ride/owner-edited.png)<br>Carona | `/caronas/e51a9c88-8271-4dda-bb59-a78f651251b8` | `owner-edited` | editar: o mesmo dia passa, outro dia é recusado |
| ![owner-full](desktop/ride/owner-full.png)<br>Carona | `/caronas/e32d0430-9e85-4172-92bb-6838052b1972` | `owner-full` | o dono fecha e reabre a carona pelas vagas |
| ![owner-open](desktop/ride/owner-open.png)<br>Carona | `/caronas/e32d0430-9e85-4172-92bb-6838052b1972` | `owner-open` | o dono fecha e reabre a carona pelas vagas |
| ![owner-reopened](desktop/ride/owner-reopened.png)<br>Carona | `/caronas/e32d0430-9e85-4172-92bb-6838052b1972` | `owner-reopened` | o dono fecha e reabre a carona pelas vagas |
| ![repeat-ready](desktop/ride/repeat-ready.png)<br>Carona | `/caronas/0ae9e300-efba-4968-a0b3-dcfeb45dc608` | `repeat-ready` | repetir uma carona publica outra igual em outro horário |
| ![repeated](desktop/ride/repeated.png)<br>Carona | `/caronas/b4648111-eded-49b8-abd6-19ea16405242` | `repeated` | repetir uma carona publica outra igual em outro horário |

### shell

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![offline](desktop/shell/offline.png)<br>Sem internet | `/` | `offline` | sem internet o app avisa por cima da página |
| ![route-not-found](desktop/shell/route-not-found.png)<br>Página não encontrada | `/uma-pagina-que-nao-existe` | `route-not-found` | endereço que não é rota nenhuma explica em português e leva ao mural |
| ![version-required](desktop/shell/version-required.png)<br>Atualize o BrazCar | `/` | `version-required` | abaixo do piso de versão o app só oferece atualizar |

### signup

| Tela | Rota | Situação | O que a jornada faz ali |
|---|---|---|---|
| ![empty](desktop/signup/empty.png)<br>Criar conta | `/cadastro` | `empty` | criar conta: os erros aparecem e a conta entra direto no mural |
| ![phone-formatted](desktop/signup/phone-formatted.png)<br>Criar conta | `/cadastro` | `phone-formatted` | criar conta: os erros aparecem e a conta entra direto no mural |
| ![refused](desktop/signup/refused.png)<br>Criar conta | `/cadastro` | `refused` | criar conta: os erros aparecem e a conta entra direto no mural |
