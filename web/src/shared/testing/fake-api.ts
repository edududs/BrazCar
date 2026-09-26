import { vi } from "vitest";

/** The origin the fake API answers on, set as `VITE_API_BASE_URL` before the client is built. */
export const fakeApiOrigin = "https://api.test";

/** One request as it left the front: what a gateway test asserts on. */
export interface SentRequest {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly credentials: RequestCredentials;
  readonly contentType: string | null;
  /** The parsed JSON body, or `undefined` when nothing was sent. */
  readonly body: unknown;
}

type Answer = () => Response;

/**
 * Stands in for the network under the real `apiClient`: every request is recorded. A request to a
 * route given a standing answer with `serve` gets it every time; any other takes the next queued
 * answer. With neither, the test forgot to say what the API replies, and the request fails loudly
 * instead of hanging.
 */
export class FakeApi {
  readonly sent: SentRequest[] = [];
  private readonly answers: Answer[] = [];
  private readonly routes = new Map<string, Answer>();

  /** A standing JSON answer for every `METHOD /path` request: a whole screen's worth of calls. */
  serve(method: string, path: string, status: number, body: unknown): void {
    this.routes.set(`${method} ${path}`, () => Response.json(body, { status }));
  }

  /** The requests sent to one route, in order. */
  sentTo(method: string, path: string): SentRequest[] {
    return this.sent.filter((request) => request.method === method && request.path === path);
  }

  /** A JSON answer with a status. */
  answer(status: number, body: unknown): void {
    this.answers.push(() => Response.json(body, { status }));
  }

  /** A raw text answer, for a proxy's HTML error page or a body cut in half. */
  answerText(status: number, text: string, contentType = "text/html"): void {
    this.answers.push(
      () => new Response(text, { status, headers: { "Content-Type": contentType } }),
    );
  }

  /** An answer with no body at all. */
  answerEmpty(status: number): void {
    this.answers.push(() => new Response(null, { status }));
  }

  /** The network is down: `fetch` rejects before any status exists. */
  dropConnection(): void {
    this.answers.push(() => {
      throw new TypeError("Failed to fetch");
    });
  }

  /** The last request sent; fails the test when there is none. */
  last(): SentRequest {
    const request = this.sent.at(-1);
    if (request === undefined) throw new Error("No request reached the fake API.");
    return request;
  }

  reset(): void {
    this.sent.length = 0;
    this.answers.length = 0;
    this.routes.clear();
  }

  readonly fetch = async (input: Request): Promise<Response> => {
    const url = new URL(input.url);
    const text = await input.text();
    this.sent.push({
      method: input.method,
      path: url.pathname,
      query: url.searchParams,
      credentials: input.credentials,
      contentType: input.headers.get("Content-Type"),
      body: text === "" ? undefined : (JSON.parse(text) as unknown),
    });
    const next = this.routes.get(`${input.method} ${url.pathname}`) ?? this.answers.shift();
    if (next === undefined)
      throw new Error(`No answer queued for ${input.method} ${url.pathname}.`);
    return next();
  };
}

/**
 * Installs the fake before the API client module is evaluated: call it inside `vi.hoisted`, since
 * the client captures `fetch` and the base URL when it is created.
 */
export function installFakeApi(): FakeApi {
  const api = new FakeApi();
  vi.stubEnv("VITE_API_BASE_URL", fakeApiOrigin);
  vi.stubGlobal("fetch", api.fetch);
  return api;
}
