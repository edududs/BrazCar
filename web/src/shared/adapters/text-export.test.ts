// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { copyText, shareText } from "./text-export";

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "clipboard");
});

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

describe("copyText", () => {
  it("copies through the clipboard and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    await expect(copyText("61 99999-0001")).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("61 99999-0001");
  });

  it("fails softly when the clipboard refuses", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    await expect(copyText("61 99999-0001")).resolves.toBe("failed");
  });
});

describe("shareText", () => {
  it("uses the system share sheet where there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    await expect(shareText("BrazCar", "Vem de carona")).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "BrazCar", text: "Vem de carona" });
  });

  it("falls back to the clipboard where there is no share sheet", async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    await expect(shareText("BrazCar", "Vem de carona")).resolves.toBe("copied");
  });

  it("fails softly when sharing is cancelled", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancelled"));
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    await expect(shareText("BrazCar", "Vem de carona")).resolves.toBe("failed");
  });
});
