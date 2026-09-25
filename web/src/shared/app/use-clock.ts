import { useEffect, useState } from "react";

/**
 * The current moment, refreshed every so often: for a screen that says "now" or groups by day.
 * One reader of the clock, so a test (or the end to end suite's frozen clock) sees it change.
 */
export function useClock(everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, everyMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [everyMs]);
  return now;
}
