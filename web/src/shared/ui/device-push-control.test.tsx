// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DevicePush } from "../app/use-device-push";
import { DevicePushControl } from "./device-push-control";

function fakePush(overrides: Partial<DevicePush> = {}): DevicePush {
  return {
    permission: "default",
    subscribed: false,
    pending: false,
    error: null,
    enable: vi.fn(() => Promise.resolve()),
    disable: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

describe("DevicePushControl", () => {
  it("says an unsupported browser does not receive notifications", () => {
    render(<DevicePushControl push={fakePush({ permission: "unsupported" })} />);

    expect(screen.getByText("Este navegador não recebe notificações.")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("asks the iPhone to install the app, with the steps", () => {
    const { container } = render(
      <DevicePushControl push={fakePush({ permission: "needs-install" })} />,
    );

    expect(container.textContent).toContain(
      "No iPhone, adicione o BrazCar à Tela de Início para receber avisos. Toque em Compartilhar",
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("tells a blocked browser where to release it", () => {
    render(<DevicePushControl push={fakePush({ permission: "denied" })} />);

    expect(
      screen.getByText("Notificações bloqueadas. Libere nos ajustes do navegador."),
    ).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("turns on straight from the tap, by touch and by keyboard", async () => {
    const user = userEvent.setup();
    const push = fakePush();
    render(<DevicePushControl push={push} />);

    await user.click(screen.getByRole("button", { name: "Ativar notificações" }));
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(push.enable).toHaveBeenCalledTimes(3);
  });

  it("shows the button busy while the action runs", () => {
    render(<DevicePushControl push={fakePush({ pending: true })} />);

    const button = screen.getByRole("button", { name: "Ativar notificações" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("says it is checking while the subscription is read", () => {
    render(<DevicePushControl push={fakePush({ permission: "granted", subscribed: null })} />);

    expect(screen.getByText("Verificando este aparelho…")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says it is on and turns off by touch and by keyboard", async () => {
    const user = userEvent.setup();
    const push = fakePush({ permission: "granted", subscribed: true });
    render(<DevicePushControl push={push} />);

    expect(screen.getByText("Notificações ligadas neste aparelho")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Desligar" }));
    await user.keyboard("{Enter}");

    expect(push.disable).toHaveBeenCalledTimes(2);
  });

  it("without actions, only says what is on and draws nothing for off or checking", () => {
    const { rerender } = render(
      <DevicePushControl
        push={fakePush({ permission: "granted", subscribed: true })}
        actions={false}
      />,
    );
    expect(screen.getByText("Notificações ligadas neste aparelho")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();

    rerender(<DevicePushControl push={fakePush()} actions={false} />);
    expect(screen.queryByRole("button")).toBeNull();

    rerender(
      <DevicePushControl
        push={fakePush({ permission: "granted", subscribed: null })}
        actions={false}
      />,
    );
    expect(screen.queryByText(/Verificando/)).toBeNull();
  });

  it("without actions and with nothing to say, leaves no empty box behind", () => {
    const { container, rerender } = render(<DevicePushControl push={fakePush()} actions={false} />);
    expect(container.childElementCount).toBe(0);

    rerender(
      <DevicePushControl
        push={fakePush({ permission: "granted", subscribed: null })}
        actions={false}
      />,
    );
    expect(container.childElementCount).toBe(0);

    rerender(<DevicePushControl push={fakePush({ error: "Falhou." })} actions={false} />);
    expect(screen.getByRole("alert").textContent).toBe("Falhou.");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("announces the hook's failure in a notice, in any state", () => {
    render(
      <DevicePushControl
        push={fakePush({ permission: "unsupported", error: "Não foi possível ligar." })}
      />,
    );

    expect(screen.getByRole("alert").textContent).toBe("Não foi possível ligar.");
  });
});
