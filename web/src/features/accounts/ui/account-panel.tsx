import { useState } from "react";

import { ActionButton } from "@/shared/ui/action-button";
import { Card } from "@/shared/ui/card";
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

/** The owner's own account: who they are, the cars they may drive with, and the way out. */
export function AccountPanel({ account, busy, addCar, removeCar, logOut }: AccountPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const fail = (reason: unknown) => {
    setError(reasonOf(reason));
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="text-base font-semibold">Seus dados</h2>
        <p className="text-sm">{account.displayName}</p>
        <p className="text-sm opacity-70">{account.phone}</p>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Carros</h2>
        <p className="text-sm opacity-70">
          Opcional. Só precisa de carro quem vai oferecer carona; para pegar carona, não.
        </p>
        {account.cars.length === 0 ? null : (
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
        <CarForm hasCars={account.cars.length > 0} busy={busy} addCar={addCar} onError={fail} />
      </Card>

      {error === null ? null : (
        <p role="alert" className="rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}

      <ActionButton
        disabled={busy}
        onPress={() => {
          logOut().catch(fail);
        }}
      >
        Sair da conta
      </ActionButton>
    </div>
  );
}

interface CarFormProps {
  readonly hasCars: boolean;
  readonly busy: boolean;
  readonly addCar: (data: CarData) => Promise<Account>;
  readonly onError: (reason: unknown) => void;
}

const emptyCar: CarData = { model: "", color: "", plate: "" };

/** Closed until asked for: a car is an option of the account, not a step of it. */
function CarForm({ hasCars, busy, addCar, onError }: CarFormProps) {
  const [open, setOpen] = useState(false);
  const [car, setCar] = useState<CarData>(emptyCar);
  const set = (key: keyof CarData) => (value: string) => {
    setCar((current) => ({ ...current, [key]: value }));
  };

  if (!open) {
    return (
      <ActionButton
        onPress={() => {
          setOpen(true);
        }}
      >
        {hasCars ? "Adicionar outro carro" : "Cadastrar um carro"}
      </ActionButton>
    );
  }
  return (
    <Form
      onSubmit={() => {
        addCar(car).then(() => {
          setCar(emptyCar);
          setOpen(false);
        }, onError);
      }}
    >
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
      <div className="flex gap-2">
        <ActionButton submit emphasis="primary" disabled={busy}>
          Salvar carro
        </ActionButton>
        <ActionButton
          onPress={() => {
            setCar(emptyCar);
            setOpen(false);
          }}
        >
          Cancelar
        </ActionButton>
      </div>
    </Form>
  );
}
