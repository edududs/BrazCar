# Estado do projeto

Atualizado em 2026-09-20.

## Onde estamos

Desenho fechado, nenhum código escrito. A entrevista de design de 18 a 20/09/2026 produziu as
decisões em [decisions/README.md](decisions/README.md). O repo contém só documentação.

## Próximo passo

1. Esqueleto do repo: `src/` com uv, ruff, pyright, poe e o teste de arquitetura por AST;
   `web/` com yarn 4, Vite, eslint e prettier; hooks de `pre-commit` e `pre-push`.
2. **Teste de risco antes do domínio:** uma rota SSE mínima publicada pelo túnel do Cloudflare
   em `api-brazcar.elj-labs.org`, medida num iPhone com o app em primeiro e segundo plano.
   Se o túnel fizer buffer, entra o adaptador de consulta condicional atrás da mesma porta (D-049).
3. Contextos, nesta ordem: `places`, `accounts`, `rides`.
4. Front e PWA.

## Pendências abertas

- D-040 está como proposto: falta testar se um usuário de banco com `search_path` fixo isola as
  tabelas `whatsmeow_*` sem tocar na URL nem no código Go. Só importa quando o extrator entrar.
- Sobrou uma pasta `.whatsapp_scrapping_wip/proj1/.pytest_cache` com permissão negada no
  Windows. Remover manualmente como administrador. Está no `.gitignore`.
- Texto dos termos de uso e de privacidade ainda não foi escrito (D-033).

## Em voo

Nada.
