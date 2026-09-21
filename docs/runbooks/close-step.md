# Encerrar um passo

Ritual para fechar um passo do [ROADMAP](../ROADMAP.md) ou qualquer entrega que mereça versão.
Vale para pessoa e para agente. Siga na ordem; cada item diz como provar que foi feito.

Padrões usados: [Conventional Commits](https://www.conventionalcommits.org/pt-br/),
[SemVer](https://semver.org/lang/pt-BR/), [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
[git-cliff](https://git-cliff.org) e GitHub Releases.

## 1. Verificar

- `uv run poe check` em `backend/` e `yarn run check` em `web/`, os dois verdes. Mostre a saída real.
- O portão pesado uma vez, sem esperar o push: `.githooks/pre-push` cobre o que o GitHub não roda.
- `git status` limpo. Nada pela metade vira versão.

## 2. Higiene

- Commits do passo em Conventional Commits, sem trailers e sem citar ferramentas de autoria:
  `git log <última tag>..HEAD --format=%B | grep -i -E "co-authored|generated with"` não devolve nada.
- Nenhum segredo versionado: `git ls-files | grep -i -E "\\.env$|token|secret"` só mostra arquivos `.example`.
- `docs/specs/<feature>/` do passo apagada, com o essencial já promovido para decisão, runbook ou glossário.

## 3. Documentos

Só o que o passo tocou, num commit `docs:` antes de cortar a versão. Descubra primeiro qual será a
versão, para citá-la: `scripts/release.sh --dry-run` mostra o número sem mudar nada.

| Documento | O que conferir |
|---|---|
| `docs/STATE.md` | A versão, o que ficou pronto, o que foi **verificado de verdade**, o que **não** foi, próximo passo, pendências, data |
| `docs/ROADMAP.md` | Item marcado como feito, com a versão: "Feito, tag `vX.Y.Z`" |
| `docs/decisions/README.md` | Toda decisão nova já tem linha. Nenhuma decisão antiga foi editada |
| `docs/domain/<context>.md` | Termo novo ou renomeado está no glossário, com o identificador em inglês |
| `docs/runbooks/` | Se o passo mudou como se publica ou opera, o runbook descreve o que foi feito de fato |
| `docs/INDEX.md` e `AGENTS.md` | Documento novo tem linha no índice; regra nova que vale sempre está no `AGENTS.md` |

Releia o `STATE.md` inteiro antes de fechar: linha velha que contradiz o passo é o erro mais comum.

## 4. Versão e changelog

O número da versão não se escolhe, sai dos commits. Antes da 1.0: `feat` sobe o `MINOR`, `fix`
sobe o `PATCH`, e quebra de contrato também sobe o `MINOR`. A fonte da verdade da versão é a tag.

```bash
scripts/release.sh   # CHANGELOG.md, versão do backend, commit chore(release) e tag anotada
```

O `CHANGELOG.md` é gerado pelo git-cliff (`cliff.toml`) e não se edita à mão. Se uma entrada saiu
ruim, o conserto é na mensagem do commit seguinte, não no arquivo. As notas da versão ficam
gravadas na própria tag anotada.

## 5. Publicar

**O push é do Eduardo**, salvo ordem explícita dele. A sessão para aqui, mostra o resumo e espera.

```bash
git push --follow-tags
```

A tag dispara dois fluxos no GitHub: `image` publica a imagem da API no GHCR (D-067) e `release`
cria a GitHub Release com as notas da tag. Confira os dois e o portão rápido:

```bash
gh run list --limit 5
gh release view vX.Y.Z
```

Publicar na máquina de teste é outro runbook: [deploy.md](deploy.md).

## 6. Memória do agente

Só o que não cabe no repo: fato novo sobre a máquina de teste, conta externa, caminho de segredo,
preferência do Eduardo que apareceu no passo. Se um ponteiro para o repo ficou velho, atualize.
Nada que o repo já registre.

## 7. Relato final

Em quatro partes curtas: o que entrou, o que foi verificado de verdade, o que não foi, e o que
passa como pendência para o próximo passo.
