import { useCallback, useEffect, useRef, useState } from "react";

/** How long the typing stands still before the text goes to the address. */
export const FILTER_TEXT_PAUSE_MS = 250;

interface TextFilterDraft {
  /** What the field shows: what the person typed, until the address says something else. */
  readonly draft: string;
  readonly setDraft: (text: string) => void;
}

/**
 * The text of a filter that lives in the address (D-056) without the field being driven by it.
 * The field keeps its own draft while the person types, and the address follows after a short
 * pause (at once when the field is emptied). An address that changes by itself (a link, back and
 * forward, "Limpar filtros") replaces the draft; the echoes of what this hook already sent do not,
 * so a key that arrives before the previous navigation settles is never overwritten (D-190).
 */
export function useTextFilterDraft(
  applied: string,
  commit: (text: string) => void,
  pauseMs: number = FILTER_TEXT_PAUSE_MS,
): TextFilterDraft {
  const [draft, setDraftState] = useState(applied);
  const sent = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCommit = useRef(commit);
  useEffect(() => {
    latestCommit.current = commit;
  });

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const send = useCallback((text: string) => {
    sent.current.push(text);
    latestCommit.current(text);
  }, []);

  const setDraft = useCallback(
    (text: string) => {
      setDraftState(text);
      cancel();
      if (text === "") {
        send(text);
        return;
      }
      timer.current = setTimeout(() => {
        timer.current = null;
        send(text);
      }, pauseMs);
    },
    [cancel, pauseMs, send],
  );

  useEffect(() => {
    const index = sent.current.indexOf(applied);
    if (index >= 0) {
      sent.current.splice(0, index + 1);
      return;
    }
    // Not ours: the address moved on its own.
    sent.current = [];
    cancel();
    setDraftState(applied);
  }, [applied, cancel]);

  useEffect(() => cancel, [cancel]);

  return { draft, setDraft };
}
