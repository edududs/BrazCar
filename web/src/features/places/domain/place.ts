export type PlaceKind = "area" | "point";

/** An entry of the catalog, as the screens need it. The API shape stays in adapters/. */
export interface Place {
  readonly id: string;
  readonly name: string;
  readonly kind: PlaceKind;
  readonly aliases: readonly string[];
  readonly parentId: string | null;
}
