import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, configure, render, type RenderResult } from "@testing-library/react";

import { routeTree } from "@/routeTree.gen";

// Routes are split per file and load on first visit; on a busy machine the first import of a page
// can take longer than Testing Library's default second.
configure({ asyncUtilTimeout: 5000 });

export interface RenderedApp extends RenderResult {
  readonly router: ReturnType<typeof createAppRouter>;
  readonly client: QueryClient;
}

function createAppRouter(path: string) {
  return createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
}

/**
 * The whole app at `path`, as `main.tsx` mounts it: the real route tree, the real hooks and the real
 * gateways, over a fresh query client. What the API answers is up to the test's fake API, and the
 * board's signal needs the fake EventSource installed.
 */
export async function renderApp(path: string): Promise<RenderedApp> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createAppRouter(path);
  await act(() => router.load());
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router, client };
}
