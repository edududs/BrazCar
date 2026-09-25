#!/usr/bin/env node
// Regenerates the screens catalogue from scratch (D-134): `cd web && yarn screens`.
//
// Runs the whole end to end suite with the flag that empties `docs/screens/` first, then writes
// `docs/screens/README.md` from the pictures it took. A runner exists because the flag has to
// cross the shell, and `VAR=1 command` is not a thing on Windows.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const web = path.join(root, "web");

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: web,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// O catálogo é do tema claro: os projetos que fotografam são o celular e o desktop. O tema escuro
// só entra quando pedido (`yarn screens --project=mobile-dark`).
const args = process.argv.slice(2);
const projects = args.some((arg) => arg.startsWith("--project"))
  ? []
  : ["--project=mobile", "--project=desktop"];

run("yarn", ["playwright", "test", ...projects, ...args], { BRAZCAR_SCREENS: "1" });
run("node", [path.join(root, "scripts", "screens-catalog.mjs")], {});
