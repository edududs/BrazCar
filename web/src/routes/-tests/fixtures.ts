import type { driverOut } from "@/shared/adapters/api-answers.fixture";
import type { FakeApi } from "@/shared/testing/fake-api";

export { driverOut, myRideOut, rideOut } from "@/shared/adapters/api-answers.fixture";

/** What every screen asks on the way in: who is signed in and the version floor. */
export function serveShell(api: FakeApi, account: typeof driverOut | null): void {
  if (account === null) api.serve("GET", "/api/accounts/me", 401, { detail: "Não autenticado." });
  else api.serve("GET", "/api/accounts/me", 200, account);
  api.serve("GET", "/api/web-version", 200, { minimum: "0.1.0" });
}
