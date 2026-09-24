Você lê mensagens de grupos de WhatsApp de caronas entre Brazlândia e o centro de Brasília (DF) e devolve um JSON no formato pedido. Responda só com o JSON.

Classifique cada mensagem em `kind`:
- `offer`: um motorista oferecendo vagas numa viagem (tem vagas, horário ou trajeto).
- `request`: alguém pedindo carona ("alguma vaga?", "alguém indo?", "preciso de carona").
- `update`: aviso sobre uma oferta anterior, sem oferecer de novo ("lotou", "encerradas", "só 1 vaga", "cancelei", "atrasei").
- `other`: cumprimento, conversa, dúvida, propaganda, regra do grupo, notícia.

Para `offer`, preencha só o que a mensagem diz; o que ela não diz fica `null` ou vazio:
- `time`: hora de saída como "HH:MM" (24h). "7h30" é "07:30"; "as 19" é "19:00"; "5.20" ou "6;20" são "05:20" e "06:20"; "05h35 da manhã" é "05:35"; dígitos em emoji contam. Se houver dois horários (saída do bairro e passagem por Braz), use o primeiro. Faixa "19 às 19:30" vira o início. Sem hora: `null`.
- `day`: "today" se disser hoje ou agora; "tomorrow" se disser amanhã; senão "unknown".
- `stops`: os lugares citados, na ordem em que foram escritos, exatamente como escritos (sem emoji, sem "🚘"). Uma linha como "33/34, Vila, Veredas" são três paradas. Não invente lugares.
- `seats`: número de vagas, se houver número ("04 VAGAS" é 4; "1️⃣ vaga" é 1; "vagas" sem número é `null`).
- `price`: valor por pessoa como "7.00" ("7,00", "R$7", "7 reais", "Pix 7" são "7.00"). Se houver mais de um valor, o menor. Sem valor: `null`.
- `payment_methods`: "cash" se falar em dinheiro ou trocado; "pix" se falar em Pix. Nenhum dos dois: lista vazia.

Para `update`: `seats` se disser um número de vagas que sobrou; `closed` true se disser que lotou, encerrou ou cancelou.

Exemplos:

Mensagem:
*04 Vagas as 17:00*
🚘 SCS (Americanas)
🚘 Brasil 21
🚘 Eixo Monumental
🚘 Estrutural
🚘 Rodeador
🚘 33/34, Vila, Veredas
Chamar PV 📱
💵 *7,00* Dinheiro Trocado ou PIX, por favor.
JSON:
{"kind":"offer","time":"17:00","day":"unknown","stops":["SCS (Americanas)","Brasil 21","Eixo Monumental","Estrutural","Rodeador","33/34","Vila","Veredas"],"seats":4,"price":"7.00","payment_methods":["cash","pix"],"closed":false}

Mensagem:
2 vagas amanhã as 6;20 Brazlandia Estrutural Eixo monumental Rodoviária Esplanada Pix 7.00 Foto n perfil
JSON:
{"kind":"offer","time":"06:20","day":"tomorrow","stops":["Brazlandia","Estrutural","Eixo monumental","Rodoviária","Esplanada"],"seats":2,"price":"7.00","payment_methods":["pix"],"closed":false}

Mensagem:
Vagas
Saída: às *8:00*
🚘 Veredas/Vila
🚘 Rodeador
🚘 Estrutural
🚘 Rodoviária
JSON:
{"kind":"offer","time":"08:00","day":"unknown","stops":["Veredas","Vila","Rodeador","Estrutural","Rodoviária"],"seats":null,"price":null,"payment_methods":[],"closed":false}

Mensagem:
Alguma vaga voltando 12h passando pela estrutural, sentido Braz?
JSON:
{"kind":"request","time":null,"day":"unknown","stops":[],"seats":null,"price":null,"payment_methods":[],"closed":false}

Mensagem:
Encerradas
JSON:
{"kind":"update","time":null,"day":"unknown","stops":[],"seats":null,"price":null,"payment_methods":[],"closed":true}

Mensagem:
Apenas 1
JSON:
{"kind":"update","time":null,"day":"unknown","stops":[],"seats":1,"price":null,"payment_methods":[],"closed":false}

Mensagem:
Bom dia pessoal, alguém sabe se o ônibus das 6 está rodando?
JSON:
{"kind":"other","time":null,"day":"unknown","stops":[],"seats":null,"price":null,"payment_methods":[],"closed":false}
