// Unmount what a test rendered before the next one runs. Testing Library only does this by itself
// with vitest globals on, which this project keeps off.
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
