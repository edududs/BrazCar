#!/usr/bin/env node
// Writes docs/screens/README.md from the pictures the end to end suite took (D-134).
//
//   node scripts/screens-catalog.mjs
//
// The source is what is on disk: every PNG under docs/screens/<project>/<journey>/<state>.png,
// joined with the note `snap()` left in web/e2e/.state/screens. Nothing here is written by hand,
// so a state that comes or goes changes the catalogue by itself.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const screensDir = path.join(root, "docs", "screens");
const notesDir = path.join(root, "web", "e2e", ".state", "screens");
const catalogue = path.join(screensDir, "README.md");

// O celular primeiro: é o projeto principal (D-133). O resto entra em ordem alfabética.
const projectTitles = { mobile: "Celular", desktop: "Desktop" };
const projectOrder = ["mobile", "desktop"];

function walk(dir, prefix = "") {
  const found = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...walk(full, `${prefix}${entry}/`));
    } else if (entry.endsWith(".png")) {
      found.push(`${prefix}${entry.slice(0, -4)}`);
    }
  }
  return found;
}

function noteOf(project, name) {
  try {
    return JSON.parse(readFileSync(path.join(notesDir, project, `${name}.json`), "utf8"));
  } catch {
    return { route: "", screen: "", journey: "" };
  }
}

function escape(text) {
  return text.replaceAll("|", "\\|");
}

function projects() {
  let found = [];
  try {
    found = readdirSync(screensDir).filter((entry) =>
      statSync(path.join(screensDir, entry)).isDirectory(),
    );
  } catch {
    return [];
  }
  const rank = (name) => {
    const at = projectOrder.indexOf(name);
    return at === -1 ? projectOrder.length : at;
  };
  return found.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

const version = JSON.parse(readFileSync(path.join(root, "web", "package.json"), "utf8")).version;
const lines = [
  "# Catálogo de telas",
  "",
  `Gerado da versão \`v${version}\` do front. **Não edite à mão:** cada imagem é um estado que a`,
  "suíte de ponta a ponta visita, e este arquivo sai das imagens.",
  "",
  "```bash",
  "cd web && yarn screens   # roda a suíte, refaz as imagens e reescreve este arquivo",
  "```",
  "",
  "As telas são funcionais e sem polimento até a etapa de design (D-103): o que está aqui é o que",
  "existe, fotografado como está. No celular a imagem é a página inteira; no desktop, a janela.",
  "",
];

let total = 0;
for (const project of projects()) {
  const names = walk(path.join(screensDir, project));
  if (names.length === 0) continue;
  lines.push(`## ${projectTitles[project] ?? project} (\`${project}\`)`, "");
  let journey = ""; // a jornada em curso, para abrir uma tabela por pasta
  for (const name of names) {
    const [group, state] = [name.slice(0, name.indexOf("/")), name.slice(name.indexOf("/") + 1)];
    if (group !== journey) {
      if (journey !== "") lines.push("");
      journey = group;
      lines.push(
        `### ${journey}`,
        "",
        "| Tela | Rota | Situação | O que a jornada faz ali |",
        "|---|---|---|---|",
      );
    }
    const note = noteOf(project, name);
    const image = `![${escape(state)}](${project}/${name}.png)`;
    lines.push(
      `| ${image}<br>${escape(note.screen || state)} | \`${escape(note.route || "—")}\` | \`${escape(state)}\` | ${escape(note.journey || "—")} |`,
    );
    total += 1;
  }
  lines.push("");
}

if (total === 0) {
  lines.push("Nenhuma imagem no momento: rode `yarn screens` em `web/`.", "");
}

writeFileSync(catalogue, lines.join("\n"), "utf8");
process.stdout.write(`screens: ${String(total)} imagem(ns) em ${catalogue}\n`);
