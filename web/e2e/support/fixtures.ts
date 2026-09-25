import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

import { loadManifest, type DemoManifest } from "./manifest";
import { apiOrigin, webOrigin } from "./origins";

/**
 * The one screenshot helper (D-134) and the fixtures every suite shares.
 *
 * `snap(page, "journey/state")` writes `<project>/journey/state.png` and nothing else in the suite
 * ever calls `page.screenshot`: one place decides the name, the size and the waiting, so the
 * catalogue can be generated from the files.
 *
 * Only `yarn screens` writes into the versioned `docs/screens/`. A plain `yarn e2e`, here or on
 * GitHub, drops its pictures in the throwaway folder, so running the suite never dirties the
 * catalogue and the workflow has nothing to commit.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const capturing = process.env.BRAZCAR_SCREENS === "1";
export const screensDir = path.join(here, "..", "..", "..", "docs", "screens");
export const notesDir = path.join(here, "..", ".state", "screens");
const outputDir = capturing ? screensDir : path.join(here, "..", ".state", "screens-preview");

export type Snap = (page: Page, name: string) => Promise<void>;
export type SignIn = (page: Page, slug: string) => Promise<void>;

export interface RideToPublish {
  readonly stops: readonly string[]; // catalog identifiers
  readonly departureAt: string; // an instant, as the API takes it
  readonly seats?: number;
  readonly notes?: string;
}

/** Publishes a ride for the signed-in account and hands back its identifier. */
export type PublishFor = (page: Page, slug: string, ride: RideToPublish) => Promise<string>;

type Cookies = Awaited<ReturnType<BrowserContext["cookies"]>>;

/**
 * The session cookies already obtained, by account slug: one login per account per run. Kept in a
 * file of the run too, because a failed test is retried in a fresh worker that starts with an empty
 * memory; without the file each retry logged every account in again, spent the ten attempts a
 * phone gets every fifteen minutes (D-097), and one failure brought down the rest in a cascade.
 * The global setup empties the file at the start of every run.
 */
export const sessionsFile = path.join(here, "..", ".state", "sessions.json");

function readSessions(): Record<string, Cookies> {
  try {
    return JSON.parse(readFileSync(sessionsFile, "utf8")) as Record<string, Cookies>;
  } catch {
    return {};
  }
}

function keepSession(slug: string, cookies: Cookies | null): void {
  const all = readSessions();
  if (cookies === null) Reflect.deleteProperty(all, slug);
  else all[slug] = cookies;
  mkdirSync(path.dirname(sessionsFile), { recursive: true });
  writeFileSync(sessionsFile, JSON.stringify(all), "utf8");
}

interface Fixtures {
  demo: DemoManifest;
  /** The index of a spare phone this project may register for a journey (0, 1, 2…). */
  sparePhone: (journey: number) => number;
  snap: Snap;
  signIn: SignIn;
  publishFor: PublishFor;
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright reads the destructuring to find deps
  demo: async ({}, use) => {
    await use(loadManifest());
  },

  // The projects share one database per run, so each takes its own phone for every journey that
  // registers one: the seed reserves `journeys * projects` of them.
  // eslint-disable-next-line no-empty-pattern -- Playwright reads the destructuring to find deps
  sparePhone: async ({}, use, testInfo) => {
    const projects = testInfo.config.projects;
    const slot = projects.findIndex((project) => project.name === testInfo.project.name);
    await use((journey) => journey * projects.length + slot);
  },

  // The clock the front reads is the moment the seed counted from, so "hoje" and "amanhã" mean
  // what the data means and nothing drifts while a suite runs.
  page: async ({ page, demo }, use) => {
    await page.clock.setFixedTime(new Date(demo.anchor));
    await use(page);
  },

  // Besides the picture, `snap` writes what the catalogue needs to describe it: the route, the
  // heading of the screen and the journey that led there. The generator joins the two (D-134).
  snap: async ({ isMobile }, use, testInfo) => {
    const project = testInfo.project.name;
    await use(async (page, name) => {
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await page.screenshot({
        path: path.join(outputDir, project, `${name}.png`),
        fullPage: isMobile, // on the phone the page scrolls; on the desktop the viewport is the frame
        animations: "disabled",
        caret: "hide",
        scale: "css",
      });
      const notes = path.join(notesDir, project, `${name}.json`);
      mkdirSync(path.dirname(notes), { recursive: true });
      writeFileSync(
        notes,
        JSON.stringify(
          {
            route: new URL(page.url()).pathname + new URL(page.url()).search,
            screen: await headingOf(page),
            journey: testInfo.title,
          },
          null,
          2,
        ),
        "utf8",
      );
    });
  },

  // Signing in without the screens, for the suites whose subject is what comes after it. The
  // request travels on the browser context, so the session cookie lands where the page will use
  // it; `Origin` is what a state-changing call must prove (D-091).
  //
  // The cookie is kept and handed to the next context instead of logging in again: one phone only
  // gets ten attempts every fifteen minutes (D-097), and a whole run asks for far more than that.
  // A session someone logged out of no longer answers, and then it is asked for anew.
  signIn: async ({ demo }, use) => {
    await use(async (page, slug) => {
      const kept = readSessions()[slug];
      if (kept !== undefined) {
        await page.context().addCookies(kept);
        if ((await page.request.get(`${apiOrigin}/api/accounts/me`)).ok()) return;
        keepSession(slug, null);
      }
      const account = demo.account(slug);
      const response = await page.request.post(`${apiOrigin}/api/accounts/login`, {
        headers: { Origin: webOrigin },
        data: { phone: account.phone, password: account.password },
      });
      expect(response.ok(), `sign in as ${slug}: ${await response.text()}`).toBe(true);
      keepSession(slug, await page.context().cookies());
    });
  },

  // A ride the test itself will change. Publishing it here instead of taking one from the seed
  // keeps the two projects independent: neither closes, cancels or edits what the other reads.
  publishFor: async ({ demo }, use) => {
    await use(async (page, slug, ride) => {
      const account = demo.account(slug);
      const response = await page.request.post(`${apiOrigin}/api/rides`, {
        headers: { Origin: webOrigin },
        data: {
          car_id: account.cars[0],
          stops: ride.stops.map((placeId) => ({ place_id: placeId })),
          departure_at: ride.departureAt,
          seats_available: ride.seats ?? 3,
          price: "7.00",
          payment_methods: ["cash", "pix"],
          notes: ride.notes ?? null,
        },
      });
      expect(response.ok(), await response.text()).toBe(true);
      const published = (await response.json()) as { id: string };
      return published.id;
    });
  },
});

export { expect };

/** The heading of the screen, when it has one: the name the catalogue shows. */
async function headingOf(page: Page): Promise<string> {
  const heading = page.locator("h1").first();
  return (await heading.count()) === 0 ? "" : ((await heading.textContent()) ?? "").trim();
}

/** The board, once it has stopped saying "Carregando…". */
export async function openBoard(page: Page, query = ""): Promise<void> {
  await page.goto(`/${query}`);
  await expect(page.getByRole("heading", { name: "Caronas", level: 1 })).toBeVisible();
  await expect(page.getByText("Carregando…")).toBeHidden();
}

/** A ride's own page, by the identifier the seed handed out. */
export async function openRide(page: Page, rideId: string): Promise<void> {
  await page.goto(`/caronas/${rideId}`);
  await expect(page.getByText("Carregando…")).toBeHidden();
}
