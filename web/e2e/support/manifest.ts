import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * What `manage.py seed_demo` wrote (D-132). Identifiers are born in the domain, so they change on
 * every run; the slugs do not. Reading them here keeps the suites free of constants that would rot.
 */

export interface DemoAccount {
  readonly slug: string;
  readonly id: string;
  readonly phone: string;
  readonly displayName: string;
  readonly password: string;
  readonly cars: readonly string[];
}

export interface DemoRide {
  readonly slug: string;
  readonly id: string;
  readonly driver: string;
  readonly departureAt: string;
  readonly day: string;
  readonly status: string;
  readonly origin: string;
  readonly onBoard: boolean;
}

export interface DemoManifest {
  readonly anchor: string;
  readonly days: readonly string[];
  readonly groupLabels: readonly string[];
  /** Numbers no seeded account uses: the suite may register them and the teardown forgets them. */
  readonly suitePhones: readonly string[];
  readonly accounts: readonly DemoAccount[];
  readonly rides: readonly DemoRide[];
  readonly candidatesByVerdict: Readonly<Record<string, number>>;
  account: (slug: string) => DemoAccount;
  ride: (slug: string) => DemoRide;
  /** One of the departure days the board shows, earliest first. */
  dayAt: (index: number) => string;
  /** One of the numbers the suite may register, one per project. */
  suitePhoneAt: (index: number) => string;
  /** The label of one of the groups the demonstration messages arrived in. */
  groupLabelAt: (index: number) => string;
}

interface RawAccount {
  slug: string;
  id: string;
  phone: string;
  display_name: string;
  password: string;
  cars: string[];
}

interface RawRide {
  slug: string;
  id: string;
  driver: string;
  departure_at: string;
  day: string;
  status: string;
  origin: string;
  on_board: boolean;
}

interface RawManifest {
  anchor: string;
  days: string[];
  group_labels: string[];
  suite_phones: string[];
  accounts: RawAccount[];
  rides: RawRide[];
  candidates_by_verdict: Record<string, number>;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const manifestFile = path.join(here, "..", ".state", "manifest.json");

function found<T extends { slug: string }>(items: readonly T[], slug: string, what: string): T {
  const item = items.find((candidate) => candidate.slug === slug);
  if (item === undefined) {
    throw new Error(`the seed has no ${what} called "${slug}"; run yarn e2e again`);
  }
  return item;
}

function at(items: readonly string[], index: number, what: string): string {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`the seed left no ${what} at ${String(index)}; run yarn e2e again`);
  }
  return item;
}

export function loadManifest(): DemoManifest {
  const raw = JSON.parse(readFileSync(manifestFile, "utf8")) as RawManifest;
  const accounts: DemoAccount[] = raw.accounts.map((account) => ({
    slug: account.slug,
    id: account.id,
    phone: account.phone,
    displayName: account.display_name,
    password: account.password,
    cars: account.cars,
  }));
  const rides: DemoRide[] = raw.rides.map((ride) => ({
    slug: ride.slug,
    id: ride.id,
    driver: ride.driver,
    departureAt: ride.departure_at,
    day: ride.day,
    status: ride.status,
    origin: ride.origin,
    onBoard: ride.on_board,
  }));
  return {
    anchor: raw.anchor,
    days: raw.days,
    groupLabels: raw.group_labels,
    suitePhones: raw.suite_phones,
    accounts,
    rides,
    candidatesByVerdict: raw.candidates_by_verdict,
    account: (slug) => found(accounts, slug, "account"),
    ride: (slug) => found(rides, slug, "ride"),
    dayAt: (index) => at(raw.days, index, "day"),
    suitePhoneAt: (index) => at(raw.suite_phones, index, "spare phone"),
    groupLabelAt: (index) => at(raw.group_labels, index, "group label"),
  };
}
