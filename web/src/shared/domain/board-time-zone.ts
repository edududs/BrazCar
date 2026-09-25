/**
 * The board's own time zone: the API returns every date already converted here (D-094), never in
 * UTC, and the front must read dates back the same way, never on the device's own clock. Brazil
 * dropped daylight saving in 2019 and the board serves one city, so the offset stays fixed until
 * either of those changes.
 */
export const BOARD_TIME_ZONE = "America/Sao_Paulo";

/** The board's fixed UTC offset, for turning a wall clock chosen in its zone back into an instant. */
export const BOARD_UTC_OFFSET = "-03:00";
