import { useState } from "react";

import { ActionButton } from "@/shared/ui/action-button";
import { Form } from "@/shared/ui/form";
import { TextField } from "@/shared/ui/text-field";

import type { Account, CarData } from "../domain/account";
import { reasonOf } from "./reason";

interface AccountPanelProps {
  readonly account: Account;
  readonly busy: boolean;
  readonly addCar: (data: CarData) => Promise<Account>;
  readonly removeCar: (carId: string) => Promise<Account>;
  readonly logOut: () => Promise<void>;
}

const emptyCar: CarData = { model: "", color: "", plate: "" };

/** The owner's own account: cars to drive with, and the way out. */
export function AccountPanel({ account, busy, addCar, removeCar, logOut }: AccountPanelProps) {
  const [car, setCar] = useState<CarData>(emptyCar);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof CarData) => (value: string) => {
    setCar((current) => ({ ...current, [key]: value }));
  };
  const fail = (reason: unknown) => {
    setError(reasonOf(reason));
  };

  const submitCar = () => {
    setError(null);
    addCar(car).then(() => {
      setCar(emptyCar);
    }, fail);
  };

  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm">
        {account.displayName} · {account.phone}
      </p>
      <h2 className="text-lg font-semibold">Meus carros</h2>
      {account.cars.length === 0 ? (
        <p className="text-sm opacity-70">Cadastre um carro para publicar caronas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {account.cars.map((owned) => (
            <li key={owned.id} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {owned.model}, {owned.color} · {owned.plate}
              </span>
              <ActionButton
                disabled={busy}
                onPress={() => {
                  removeCar(owned.id).catch(fail);
                }}
              >
                Remover
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
      <Form onSubmit={submitCar} error={error}>
        <TextField
          label="Modelo"
          value={car.model}
          onChange={set("model")}
          placeholder="Gol"
          required
        />
        <TextField
          label="Cor"
          value={car.color}
          onChange={set("color")}
          placeholder="prata"
          required
        />
        <TextField
          label="Placa"
          value={car.plate}
          onChange={set("plate")}
          placeholder="ABC1D23"
          hint="Só quem pedir contato vê a placa."
          required
        />
        <ActionButton submit emphasis="primary" disabled={busy}>
          Adicionar carro
        </ActionButton>
      </Form>
      <ActionButton
        disabled={busy}
        onPress={() => {
          logOut().catch(fail);
        }}
      >
        Sair
      </ActionButton>
    </section>
  );
}
