// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Session } from "@/features/accounts/domain/session";
import { AccountHeldError } from "@/shared/domain/account-held";
import { BOARD_UTC_OFFSET } from "@/shared/domain/board-time-zone";
import { renderRouted } from "@/shared/testing/render-routed";

import { importedRide, openRide } from "../app/ride.fixture";
import type { RideActions } from "../app/use-ride";
import { type Ride, RideRequestError } from "../domain/ride";
import { RideDetail } from "./ride-detail";

vi.mock("../adapters/rides-gateway");

const everything = {
  canEdit: true,
  canChangeSeats: true,
  canCancel: true,
  canRepeat: true,
  canContact: false,
  delayUntil: null,
};

/** The driver's own ride with every action the API may allow. */
const mine: Ride = { ...openRide, isMine: true, seatsAvailable: 2, actions: everything };

const signedIn: Session = {
  status: "signed-in",
  account: {
    id: "a1",
    displayName: "Passageira",
    phone: "+5561999990002",
    phoneDisplay: "(61) 99999-0002",
    email: null,
    emailConfirmed: true,
    requiredAction: null,
    cars: [],
    canDrive: false,
  },
};

function actionsFor(ride: Ride, overrides: Partial<RideActions> = {}): RideActions {
  return {
    ride,
    status: "ready",
    changeSeats: vi.fn((seats: number) => Promise.resolve({ ...ride, seatsAvailable: seats })),
    edit: vi.fn(() => Promise.resolve(ride)),
    cancel: vi.fn(() => Promise.resolve({ ...ride, status: "cancelled" as const })),
    repeat: vi.fn((departureAt: string) => Promise.resolve({ ...ride, id: "r9", departureAt })),
    busy: false,
    ...overrides,
  };
}

async function show(
  ride: Ride,
  options: { session?: Session; actions?: RideActions; onRepeated?: (ride: Ride) => void } = {},
) {
  const actions = options.actions ?? actionsFor(ride);
  renderRouted(
    <RideDetail
      ride={ride}
      session={options.session ?? signedIn}
      actions={actions}
      onRepeated={options.onRepeated ?? vi.fn()}
    />,
  );
  await screen.findByRole("link", { name: "Voltar ao mural" });
  return actions;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("RideDetail for the driver", () => {
  it("shows the owner's panel instead of the contact, and no passenger action", async () => {
    await show(mine);

    expect(screen.getByText("Sua carona", { selector: "span" })).toBeDefined();
    expect(screen.getByText("Vagas livres")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Pedir contato" })).toBeNull();
    expect(screen.queryByText(/Telefone e placa/)).toBeNull();
  });

  it("puts a seat back and takes one away with the stepper", async () => {
    const user = userEvent.setup();
    const actions = await show(mine);

    await user.click(screen.getByRole("button", { name: "Pôr uma vaga" }));
    await user.click(screen.getByRole("button", { name: "Tirar uma vaga" }));

    expect(vi.mocked(actions.changeSeats).mock.calls).toEqual([[3], [1]]);
  });

  it("a full ride tells the driver how to reopen it", async () => {
    await show({ ...mine, seatsAvailable: 0, status: "full" });

    expect(screen.getByText("Lotada. Ponha uma vaga para reabrir.")).toBeDefined();
  });

  it("a refused seat change shows why", async () => {
    const user = userEvent.setup();
    const actions = actionsFor(mine, {
      changeSeats: vi.fn(() => Promise.reject(new RideRequestError(409, "A carona já saiu."))),
    });
    await show(mine, { actions });

    await user.click(screen.getByRole("button", { name: "Pôr uma vaga" }));

    expect((await screen.findByRole("alert")).textContent).toBe("A carona já saiu.");
  });

  it("a held account's refusal shows the phrase and a way to fix it, not a generic message (D-168)", async () => {
    const user = userEvent.setup();
    const actions = actionsFor(mine, {
      changeSeats: vi.fn(() =>
        Promise.reject(new AccountHeldError("confirm_email", "confirme seu e-mail para continuar")),
      ),
    });
    await show(mine, { actions });

    await user.click(screen.getByRole("button", { name: "Pôr uma vaga" }));

    expect(await screen.findByText("confirme seu e-mail para continuar")).toBeDefined();
    expect(screen.getByRole("link", { name: "Ir para minha conta" }).getAttribute("href")).toBe(
      "/conta",
    );
  });

  it("offers editing as a link to the edit page", async () => {
    await show(mine);

    const edit = screen.getByRole("link", { name: /Editar/ });

    expect(edit.getAttribute("href")).toBe("/caronas/r1/editar");
  });

  it("cancelling asks first; going back cancels nothing", async () => {
    const user = userEvent.setup();
    const actions = await show(mine);

    await user.click(screen.getByRole("button", { name: /Cancelar carona/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Cancelar é definitivo/)).toBeDefined();
    await user.click(within(dialog).getByRole("button", { name: "Voltar" }));

    expect(actions.cancel).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
  });

  it("confirming the cancel calls it once", async () => {
    const user = userEvent.setup();
    const actions = await show(mine);

    await user.click(screen.getByRole("button", { name: /Cancelar carona/ }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar carona" }));

    expect(actions.cancel).toHaveBeenCalledTimes(1);
  });

  it("a refused cancel shows the reason under the actions", async () => {
    const user = userEvent.setup();
    const actions = actionsFor(mine, {
      cancel: vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    });
    await show(mine, { actions });

    await user.click(screen.getByRole("button", { name: /Cancelar carona/ }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Cancelar carona",
      }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Sem resposta do serviço. Tente de novo.",
    );
  });

  it("repeating proposes the next day at the same hour and hands the new ride on", async () => {
    const user = userEvent.setup();
    const onRepeated = vi.fn();
    const actions = await show(mine, { onRepeated });

    await user.click(screen.getByRole("button", { name: /^Repetir/ }));
    const field = await screen.findByLabelText<HTMLInputElement>("Repetir esta carona em");
    // A day later, exact: the board's offset never shifts (no daylight saving), same as `addDays`.
    const proposed = new Date(new Date(mine.departureAt).getTime() + 86_400_000);
    expect(new Date(`${field.value}:00${BOARD_UTC_OFFSET}`).getTime()).toBe(proposed.getTime());
    await user.click(screen.getByRole("button", { name: "Repetir carona" }));

    expect(actions.repeat).toHaveBeenCalledWith(proposed.toISOString());
    await waitFor(() => {
      expect(onRepeated).toHaveBeenCalledWith(expect.objectContaining({ id: "r9" }));
    });
  });

  it("a refused repeat closes the sheet and says why", async () => {
    const user = userEvent.setup();
    const actions = actionsFor(mine, {
      repeat: vi.fn(() => Promise.reject(new RideRequestError(422, "Horário no passado."))),
    });
    await show(mine, { actions });

    await user.click(screen.getByRole("button", { name: /^Repetir/ }));
    await user.click(await screen.findByRole("button", { name: "Repetir carona" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Horário no passado.");
  });

  it("a cancelled ride says so, offers only repeating, and strikes the time", async () => {
    await show({
      ...mine,
      status: "cancelled",
      actions: { ...everything, canEdit: false, canChangeSeats: false, canCancel: false },
    });

    expect(
      screen.getByText("Você cancelou esta carona. Ela saiu do mural e não volta."),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: /Repetir esta carona/ })).toBeDefined();
    expect(screen.queryByRole("link", { name: /Editar/ })).toBeNull();
    expect(screen.queryByText("Vagas livres")).toBeNull();
  });

  it("the driver's own imported ride names the group it came from and the original words", async () => {
    await show({ ...importedRide, isMine: true, actions: everything });

    expect(screen.getByText(/Veio do seu anúncio no grupo Rota Plano Piloto/)).toBeDefined();
    expect(screen.getByText("Sua mensagem no grupo")).toBeDefined();
    expect(screen.queryByText(/esconde telefones e placas/)).toBeNull();
  });

  it("the driver reads their own notes under their own heading", async () => {
    await show({ ...mine, notes: "Saio da praça." });

    expect(screen.getByRole("heading", { name: "Suas observações" })).toBeDefined();
  });
});

describe("RideDetail for a passenger, by the ride's state", () => {
  it("a full ride takes no contact and says when it will again", async () => {
    await show({ ...openRide, status: "full", seatsAvailable: 0 });

    expect(screen.getByText(/Esta carona lotou/)).toBeDefined();
    expect(screen.getByRole("link", { name: "Ver outras caronas" }).getAttribute("href")).toBe("/");
    expect(screen.queryByRole("button", { name: "Pedir contato" })).toBeNull();
  });

  it("a departed ride says when it left", async () => {
    await show({ ...openRide, status: "departed" }, { session: { status: "anonymous" } });

    expect(
      screen.getByText(/^Esta carona saiu às \d\d:\d\d\. Não aceita mais contato\.$/),
    ).toBeDefined();
    expect(screen.queryByRole("link", { name: "Entrar para pedir contato" })).toBeNull();
  });

  it("a cancelled ride says it will not leave, without seats to count", async () => {
    await show({ ...openRide, status: "cancelled" });

    expect(screen.getByText("Esta carona foi cancelada. Ela não sai mais.")).toBeDefined();
    expect(screen.getByText("—")).toBeDefined();
  });

  it("a signed-in passenger reads that the contact appears on the card when asked", async () => {
    await show({ ...openRide, actions: { ...openRide.actions, canContact: true } });

    expect(
      screen.getByText("Telefone e placa aparecem aqui quando você pedir o contato."),
    ).toBeDefined();
    expect(screen.getByText(/O pedido fica registrado/)).toBeDefined();
  });

  it("when the API allows no contact, no button is drawn", async () => {
    await show({ ...openRide, actions: { ...openRide.actions, canContact: false } });

    expect(screen.queryByRole("button", { name: "Pedir contato" })).toBeNull();
  });

  it("a visitor is offered to sign in, with no self-serve way to create an account", async () => {
    await show(openRide, { session: { status: "anonymous" } });

    expect(
      screen.getByRole("link", { name: "Entrar para pedir contato" }).getAttribute("href"),
    ).toBe("/entrar");
    expect(screen.queryByRole("link", { name: "Criar conta" })).toBeNull();
  });
});
