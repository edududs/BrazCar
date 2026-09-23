// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as source from "../adapters/board-signal-source";
import { useBoardSignal } from "./use-board-signal";

vi.mock("../adapters/board-signal-source");

const mocked = vi.mocked(source);

/** Renders the hook with a fake signal and hands back the function that plays a revision frame. */
function renderSignal(random: () => number) {
  let send: (revision: number) => void = () => undefined;
  const close = vi.fn();
  mocked.subscribeToBoardSignal.mockImplementation((onRevision) => {
    send = onRevision;
    return { close };
  });
  const onChange = vi.fn();
  const view = renderHook(() => {
    useBoardSignal({ onChange, maxSpreadMs: 2000, random });
  });
  return {
    send: (revision: number) => {
      send(revision);
    },
    onChange,
    close,
    view,
  };
}

describe("useBoardSignal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("takes the opening revision as where the board stands, not as a change", () => {
    const { send, onChange } = renderSignal(() => 0.5);

    send(7);
    vi.advanceTimersByTime(5000);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("waits the random delay before refreshing on a new revision (D-047)", () => {
    const { send, onChange } = renderSignal(() => 0.5);
    send(7);

    send(8);
    vi.advanceTimersByTime(999);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("counts a burst on wake as one signal, even with a zero delay (D-077)", () => {
    const { send, onChange } = renderSignal(() => 0);
    send(7);

    for (const revision of [8, 9, 10, 11]) send(revision);
    vi.advanceTimersByTime(0);

    expect(onChange).toHaveBeenCalledOnce();
  });

  it("refreshes again for a change after the previous refresh ran", () => {
    const { send, onChange } = renderSignal(() => 0.1);
    send(7);
    send(8);
    vi.advanceTimersByTime(200);

    send(9);
    vi.advanceTimersByTime(200);

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("refreshes after a reconnect only if the board moved meanwhile", () => {
    const { send, onChange } = renderSignal(() => 0);
    send(7);

    send(7); // reconnected, nothing missed
    vi.advanceTimersByTime(0);
    expect(onChange).not.toHaveBeenCalled();

    send(9); // reconnected behind
    vi.advanceTimersByTime(0);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("closes the connection and drops a pending refresh on unmount", () => {
    const { send, onChange, close, view } = renderSignal(() => 0.5);
    send(7);
    send(8);

    view.unmount();
    vi.advanceTimersByTime(5000);

    expect(close).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });
});
