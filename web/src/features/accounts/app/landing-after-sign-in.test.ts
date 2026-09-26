import { describe, expect, it } from "vitest";

import type { Account } from "../domain/account";
import { landingAfterSignIn } from "./landing-after-sign-in";

const working: Account = {
  id: "a1",
  phone: "+5561999990001",
  phoneDisplay: "(61) 99999-0001",
  displayName: "Ana",
  email: "ana@example.com",
  emailConfirmed: true,
  requiredAction: null,
  cars: [],
  canDrive: false,
};

const held: Account = {
  ...working,
  email: null,
  emailConfirmed: false,
  requiredAction: "confirm_email",
};

describe("landingAfterSignIn (D-168)", () => {
  it("a valid returnTo always wins, held or not", () => {
    expect(landingAfterSignIn(working, "/confirmar-email?token=tok-1")).toEqual({
      kind: "return",
      href: "/confirmar-email?token=tok-1",
    });
    expect(landingAfterSignIn(held, "/confirmar-email?token=tok-1")).toEqual({
      kind: "return",
      href: "/confirmar-email?token=tok-1",
    });
  });

  it("without a returnTo, a held account goes to its own account, not the board", () => {
    expect(landingAfterSignIn(held, null)).toEqual({ kind: "route", to: "/conta" });
  });

  it("without a returnTo, a working account goes to the board", () => {
    expect(landingAfterSignIn(working, null)).toEqual({ kind: "route", to: "/" });
  });
});
