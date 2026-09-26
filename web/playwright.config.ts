import { defineConfig, devices } from "@playwright/test";

import {
  apiOrigin,
  apiPort,
  mailDir,
  manifestPath,
  webOrigin,
  webPort,
} from "./e2e/support/origins";

/**
 * End to end suite and screens catalogue (D-133, D-134).
 *
 * The front is the built app served by `vite preview`, never the dev server: what goes to the air
 * is what gets photographed, service worker and all. The API runs on its own SQLite file, seeded
 * by `manage.py seed_demo` in the same command that starts it.
 */

const backend = [
  "uv run python manage.py migrate --no-input",
  "uv run python manage.py sync_places",
  "uv run python manage.py index_rides",
  `uv run python manage.py seed_demo --manifest ../web/${manifestPath}`,
  `uv run uvicorn brazcar.config.asgi:application --host localhost --port ${String(apiPort)}`,
].join(" && ");

export default defineConfig({
  testDir: "e2e",
  outputDir: "e2e/.state/results",
  globalSetup: "./e2e/support/global-setup.ts",
  fullyParallel: false, // one database and one board: the suites would read each other's writes
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "e2e/.state/report", open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: webOrigin,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    video: "off",
    screenshot: "off", // every picture this suite keeps goes through `snap()`
  },
  projects: [
    // O celular é o projeto principal (o dono usa iPhone) e o desktop é o secundário. Os dois no
    // Chromium de propósito: um motor só para instalar e manter verde, igual aqui e no GitHub. O
    // iPhone de verdade continua sendo conferido à mão, no endereço publicado (D-106).
    { name: "mobile", use: { ...devices["iPhone 15"], browserName: "chromium" } },
    // O mesmo celular no tema escuro: a suíte inteira roda de novo para provar que nada some
    // nem fica ilegível; o catálogo não o fotografa por padrão (`yarn screens --project mobile-dark`
    // quando se quiser ver).
    {
      name: "mobile-dark",
      use: { ...devices["iPhone 15"], browserName: "chromium", colorScheme: "dark" },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: [
    {
      command: backend,
      cwd: "../backend",
      url: `${apiOrigin}/api/health`,
      reuseExistingServer: false,
      timeout: 300_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        DJANGO_DEBUG: "1",
        DATABASE_URL: "sqlite:///e2e.sqlite3",
        DJANGO_ALLOWED_HOSTS: "localhost,127.0.0.1",
        DJANGO_CORS_ALLOWED_ORIGINS: webOrigin,
        PASSWORD_RESET_LINK: `${webOrigin}/redefinir-senha?token={token}`,
        // The invite and e-mail links (D-166 to D-168) point at the suite's own web origin, and
        // the mails themselves go to a file the fixtures read the link off (`support/mail.ts`),
        // never to `mail.outbox`.
        INVITE_LINK: `${webOrigin}/convite?token={token}`,
        SIGNUP_LINK: `${webOrigin}/cadastro?token={token}`,
        EMAIL_CONFIRM_LINK: `${webOrigin}/confirmar-email?token={token}`,
        EMAIL_BACKEND: "django.core.mail.backends.filebased.EmailBackend",
        EMAIL_FILE_PATH: mailDir,
        PYTHONIOENCODING: "utf-8",
      },
    },
    {
      command: `yarn vite build && yarn vite preview --port ${String(webPort)} --strictPort`,
      url: webOrigin,
      reuseExistingServer: false,
      timeout: 300_000,
      env: { VITE_API_BASE_URL: apiOrigin },
    },
  ],
});
