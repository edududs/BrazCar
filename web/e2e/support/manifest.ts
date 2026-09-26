import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * What `manage.py seed_demo` wrote (D-133). Identifiers are born in the domain, so they change on
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

/** One invite issued for a `suitePhones` entry, its e-mail already given (D-166, D-167): the suite
 * finishes the registration itself, opening `/cadastro?token=<emailToken>`. */
export interface DemoInvite {
  readonly phone: string;
  readonly inviteToken: string;
  readonly email: string;
  readonly emailToken: string;
}

/** One invite of `catalog_invites`, in whatever state its name says (D-133, D-166, D-167): the
 * screens catalogue opens these and never spends them. `email` and `emailToken` are only ever set
 * for `awaiting` — the sign-up page is photographed with them. */
export interface CatalogInvite {
  readonly inviteToken: string;
  readonly email: string | null;
  readonly emailToken: string | null;
}

/** One invite per situation `GET /api/accounts/invites/{token}` can answer, reserved for the
 * screens catalogue alone (D-133, D-134): `yarn screens` and the three projects share these same
 * five tokens, so no test may give an e-mail, register or otherwise consume one. */
export interface CatalogInvites {
  readonly open: CatalogInvite;
  readonly awaiting: CatalogInvite;
  readonly expired: CatalogInvite;
  readonly superseded: CatalogInvite;
  readonly used: CatalogInvite;
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
  /** One invite per `suitePhones` entry, aligned by index (D-166, D-167). */
  readonly suiteInvites: readonly DemoInvite[];
  /** One invite per state the screens catalogue needs, never spent by any test (D-133, D-134). */
  readonly catalogInvites: CatalogInvites;
  /** One seeded account without a confirmed e-mail per project x attempt (D-168), at the index
   * `sparePhone(0)` gives: there is no journey to multiply by, since these accounts exist from the
   * first request instead of being signed up by a test. */
  readonly suiteLegacyPhones: readonly string[];
  /** Slug of the one seeded account still without a confirmed e-mail (D-168). */
  readonly legacyPerson: string;
  readonly accounts: readonly DemoAccount[];
  readonly rides: readonly DemoRide[];
  readonly candidatesByVerdict: Readonly<Record<string, number>>;
  account: (slug: string) => DemoAccount;
  ride: (slug: string) => DemoRide;
  /** One of the departure days the board shows, earliest first. */
  dayAt: (index: number) => string;
  /** One of the numbers the suite may register, one per project. */
  suitePhoneAt: (index: number) => string;
  /** The invite of one of the numbers the suite may register, same index as `suitePhoneAt`. */
  suiteInviteAt: (index: number) => DemoInvite;
  /** One of the numbers held for want of a confirmed e-mail, at `sparePhone(0)`'s index. */
  suiteLegacyPhoneAt: (index: number) => string;
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

interface RawInvite {
  phone: string;
  invite_token: string;
  email: string;
  email_token: string;
}

interface RawCatalogInvite {
  invite_token: string;
  email: string | null;
  email_token: string | null;
}

interface RawCatalogInvites {
  open: RawCatalogInvite;
  awaiting: RawCatalogInvite;
  expired: RawCatalogInvite;
  superseded: RawCatalogInvite;
  used: RawCatalogInvite;
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
  suite_invites: RawInvite[];
  catalog_invites: RawCatalogInvites;
  suite_legacy_phones: string[];
  legacy_person: string;
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

function at<T>(items: readonly T[], index: number, what: string): T {
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
  const suiteInvites: DemoInvite[] = raw.suite_invites.map((invite) => ({
    phone: invite.phone,
    inviteToken: invite.invite_token,
    email: invite.email,
    emailToken: invite.email_token,
  }));
  const catalogInvite = (invite: RawCatalogInvite): CatalogInvite => ({
    inviteToken: invite.invite_token,
    email: invite.email,
    emailToken: invite.email_token,
  });
  const catalogInvites: CatalogInvites = {
    open: catalogInvite(raw.catalog_invites.open),
    awaiting: catalogInvite(raw.catalog_invites.awaiting),
    expired: catalogInvite(raw.catalog_invites.expired),
    superseded: catalogInvite(raw.catalog_invites.superseded),
    used: catalogInvite(raw.catalog_invites.used),
  };
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
    suiteInvites,
    catalogInvites,
    suiteLegacyPhones: raw.suite_legacy_phones,
    legacyPerson: raw.legacy_person,
    accounts,
    rides,
    candidatesByVerdict: raw.candidates_by_verdict,
    account: (slug) => found(accounts, slug, "account"),
    ride: (slug) => found(rides, slug, "ride"),
    dayAt: (index) => at(raw.days, index, "day"),
    suitePhoneAt: (index) => at(raw.suite_phones, index, "spare phone"),
    suiteInviteAt: (index) => at(suiteInvites, index, "suite invite"),
    suiteLegacyPhoneAt: (index) => at(raw.suite_legacy_phones, index, "legacy phone"),
    groupLabelAt: (index) => at(raw.group_labels, index, "group label"),
  };
}
