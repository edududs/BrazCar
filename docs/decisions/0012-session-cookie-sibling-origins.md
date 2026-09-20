# 0012 — Sessão por cookie entre origens irmãs

Status: decidido (2026-09-20). Cobre: D-058, D-059.

## Contexto

O front fica no Vercel e a API na máquina de teste, em origens diferentes. O Safari bloqueia cookie de terceiros, então login por cookie só sobrevive no iOS se as duas origens forem do mesmo domínio registrado. O certificado grátis do Cloudflare cobre só subdomínios de primeiro nível.

## Decisão

`brazcar.elj-labs.org` para o front e `api-brazcar.elj-labs.org` para a API. Cookie de sessão httpOnly com `SameSite=Lax`, CORS com credenciais e origem explícita, e checagem de `Origin` nas requisições que alteram estado.

## Alternativas descartadas

- **Token em header.** precisa ficar guardado no JavaScript, pior contra XSS do que cookie httpOnly.
- **`api.brazcar.elj-labs.org`.** segundo nível, fora do certificado grátis.
- **Mesma origem com proxy servindo o front.** o front ficaria preso à máquina de teste.

## Consequências

- `EventSource` precisa de `withCredentials`.
- Endereços da zona `elj-labs.org` exigem entrada explícita no túnel, porque o curinga existente é de outra zona.
