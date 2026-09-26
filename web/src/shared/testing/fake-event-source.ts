import { vi } from "vitest";

/**
 * A stand-in for the browser's `EventSource`, which jsdom does not have. Every connection opened is
 * kept in `FakeEventSource.opened`, and the test plays the server: opens it, sends named events,
 * or fails it the way the browser reports a drop.
 */
export class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static readonly opened: FakeEventSource[] = [];

  /** The newest connection; fails the test when none was opened. */
  static latest(): FakeEventSource {
    const source = FakeEventSource.opened.at(-1);
    if (source === undefined) throw new Error("No EventSource was opened.");
    return source;
  }

  readyState = FakeEventSource.CONNECTING;
  closed = false;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private readonly listeners = new Map<string, ((event: MessageEvent<string>) => void)[]>();

  constructor(
    readonly url: string,
    readonly init: EventSourceInit = {},
  ) {
    FakeEventSource.opened.push(this);
  }

  addEventListener(name: string, listener: (event: MessageEvent<string>) => void): void {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }

  close(): void {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }

  /** The server accepted the connection. */
  open(): void {
    this.readyState = FakeEventSource.OPEN;
    this.onopen?.();
  }

  /** The server sent one named event. */
  send(name: string, data: string): void {
    const event = new MessageEvent<string>(name, { data });
    for (const listener of this.listeners.get(name) ?? []) listener(event);
  }

  /** The connection dropped: `retrying` is the browser trying again by itself, else it gave up. */
  fail(retrying: boolean): void {
    this.readyState = retrying ? FakeEventSource.CONNECTING : FakeEventSource.CLOSED;
    this.onerror?.();
  }
}

/** Puts the fake in place of `EventSource` and forgets connections of earlier tests. */
export function installFakeEventSource(): void {
  FakeEventSource.opened.length = 0;
  vi.stubGlobal("EventSource", FakeEventSource);
}
