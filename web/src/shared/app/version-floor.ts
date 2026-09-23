/**
 * Whether `current` is older than `minimum` (D-105). Both are MAJOR.MINOR.PATCH; the parts compare
 * as numbers and any suffix is ignored. Anything unreadable is never below the floor: the floor is
 * an emergency brake and must not lock the app out by accident.
 */
export function isBelowFloor(current: string, minimum: string): boolean {
  const have = parts(current);
  const need = parts(minimum);
  if (have === null || need === null) return false;
  for (let index = 0; index < 3; index += 1) {
    const difference = (have[index] ?? 0) - (need[index] ?? 0);
    if (difference !== 0) return difference < 0;
  }
  return false;
}

function parts(version: string): readonly number[] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  return match === null ? null : match.slice(1).map(Number);
}
