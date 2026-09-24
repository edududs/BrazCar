import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, type RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * Render a screen piece that links somewhere or queries the API: a memory router with one root
 * route and a fresh query client, so components stay the ones production uses.
 */
export function renderRouted(ui: ReactNode): RenderResult {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRoute({
    component: () => <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}
