import { describe, expect, it } from "vitest";

import { noFilters } from "../domain/board";
import { rideKeys } from "./keys";

describe("rideKeys", () => {
  it("keys a board query by its own filters, under the shared 'boards' prefix", () => {
    const filters = { ...noFilters, text: "incra" };
    expect(rideKeys.board(filters)).toEqual(["rides", "board", filters]);
    expect(rideKeys.board(filters).slice(0, 2)).toEqual(rideKeys.boards);
  });

  it("keys 'mine' and a single ride by id, both under 'rides'", () => {
    expect(rideKeys.mine).toEqual(["rides", "mine"]);
    expect(rideKeys.one("r1")).toEqual(["rides", "one", "r1"]);
  });
});
