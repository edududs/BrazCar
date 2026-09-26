import { useState } from "react";

import { ActionButton } from "@/shared/ui/action-button";
import { Avatar } from "@/shared/ui/avatar";
import { Form } from "@/shared/ui/form";
import { Icon } from "@/shared/ui/icon";
import { IconButton } from "@/shared/ui/icon-button";
import { ListGroup, ListRowButton } from "@/shared/ui/list-row";
import { NoticeBar } from "@/shared/ui/notice-bar";
import { PasswordField } from "@/shared/ui/password-field";
import { SectionHeading } from "@/shared/ui/section-heading";
import { Sheet } from "@/shared/ui/sheet";
import { TextField } from "@/shared/ui/text-field";
import { Toast } from "@/shared/ui/toast";

import type { Account, CarData, ChangePasswordData, ProfileChanges } from "../domain/account";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { reasonOf } from "./reason";

interface AccountPanelProps {
  readonly account: Account;
  readonly busy: boolean;
  readonly updateProfile: (changes: ProfileChanges) => Promise<Account>;
  /** Mails a link to the new address; the current e-mail keeps its place until it opens (D-168). */
  readonly requestEmailChange: (email: string) => Promise<void>;
  readonly changePassword: (data: ChangePasswordData) => Promise<void>;
  readonly passwordBusy: boolean;
  readonly addCar: (data: CarData) => Promise<Account>;
  readonly removeCar: (carId: string) => Promise<Account>;
  readonly logOut: () => Promise<void>;
  readonly deleteAccount: () => Promise<void>;
  /** Where the account goes once it is gone: the board, with a way to notice it. */
  readonly onDeleted: () => void;
  /** The group that belongs to everyone, signed in or not: appearance. */
  readonly appearance?: React.ReactNode;
  /** The last line of the page: the build's version. */
  readonly footer?: React.ReactNode;
  /** Opens the opinion sheet (D-155); without it the row is not offered. */
  readonly onFeedback?: () => void;
}

type Open = "profile" | "password" | "car" | "delete" | null;

/**
 * The owner's own account, read first and edited on request (S10, S11): who they are, the cars
 * they may drive with, then what everyone gets, and the ways out.
 */
export function AccountPanel({
  account,
  busy,
  updateProfile,
  requestEmailChange,
  changePassword,
  passwordBusy,
  addCar,
  removeCar,
  logOut,
  deleteAccount,
  onDeleted,
  appearance,
  footer,
  onFeedback,
}: AccountPanelProps) {
  const [open, setOpen] = useState<Open>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const fail = (reason: unknown) => {
    setError(reasonOf(reason));
  };
  const close = () => {
    setOpen(null);
  };
  const say = (message: string) => {
    setDone(message);
    window.setTimeout(() => {
      setDone((current) => (current === message ? null : current));
    }, 4000);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Avatar name={account.displayName} size={72} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-display text-heading font-bold text-balance">{account.displayName}</p>
          <p className="text-secondary text-ink-2 tabular-nums">{account.phoneDisplay}</p>
          {account.email === null ? null : (
            <p className="text-caption text-ink-3">{account.email}</p>
          )}
        </div>
      </div>

      <SectionHeading>Seus dados</SectionHeading>
      <ListGroup>
        <ListRowButton
          icon={<Icon name="edit" />}
          title="Editar dados"
          subtitle={
            account.email === null
              ? "Sem e-mail você não recupera a senha."
              : "Nome social e e-mail"
          }
          leads
          onPress={() => {
            setOpen("profile");
          }}
        />
        <ListRowButton
          icon={<Icon name="key" />}
          title="Trocar senha"
          leads
          onPress={() => {
            setOpen("password");
          }}
        />
      </ListGroup>

      <SectionHeading>Carros</SectionHeading>
      <ListGroup>
        {account.cars.map((owned) => (
          <div
            key={owned.id}
            className="flex min-h-[60px] items-center gap-3 px-4 py-2 text-body font-medium text-ink"
          >
            <span className="grid size-[38px] shrink-0 place-items-center rounded-[12px] bg-surface-2 text-ink-2">
              <Icon name="car" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span>
                {owned.model} {owned.color}
              </span>
              <span className="font-mono text-sm tracking-[0.06em] text-ink-3">{owned.plate}</span>
            </span>
            <IconButton
              icon="trash"
              label={`Remover ${owned.model} ${owned.color}`}
              look="plain"
              disabled={busy}
              onPress={() => {
                removeCar(owned.id).catch(fail);
              }}
            />
          </div>
        ))}
        <ListRowButton
          icon={<Icon name="plus" />}
          title={account.cars.length === 0 ? "Cadastrar um carro" : "Adicionar outro carro"}
          subtitle={
            account.cars.length === 0 ? "Para publicar caronas, você precisa de um." : undefined
          }
          tone="brand"
          leads
          onPress={() => {
            setOpen("car");
          }}
        />
      </ListGroup>

      {appearance}

      <SectionHeading>BrazCar</SectionHeading>
      <ListGroup>
        {onFeedback === undefined ? null : (
          <ListRowButton
            icon={<Icon name="feedback" />}
            title="Enviar opinião"
            subtitle="Sugestão, reclamação ou elogio sobre o app."
            leads
            onPress={onFeedback}
          />
        )}
        <ListRowButton
          icon={<Icon name="logout" />}
          title="Sair da conta"
          disabled={busy}
          onPress={() => {
            logOut().catch(fail);
          }}
        />
        <ListRowButton
          icon={<Icon name="trash" />}
          title="Excluir conta"
          tone="critical"
          disabled={busy}
          onPress={() => {
            setOpen("delete");
          }}
        />
      </ListGroup>

      {error === null ? null : (
        <NoticeBar tone="critical" role="alert">
          {error}
        </NoticeBar>
      )}
      {footer}
      {done === null ? null : <Toast icon={<Icon name="check" size={16} />}>{done}</Toast>}

      <Sheet
        open={open === "profile"}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        title="Seus dados"
        description="O telefone não muda por aqui."
      >
        {open === "profile" ? (
          <ProfileForm
            account={account}
            busy={busy}
            updateProfile={updateProfile}
            requestEmailChange={requestEmailChange}
            onSaved={(message) => {
              close();
              say(message);
            }}
          />
        ) : null}
      </Sheet>
      <Sheet
        open={open === "password"}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        title="Trocar senha"
      >
        {open === "password" ? (
          <PasswordForm
            busy={passwordBusy}
            changePassword={changePassword}
            onSaved={() => {
              close();
              say("Senha alterada.");
            }}
          />
        ) : null}
      </Sheet>
      <Sheet
        open={open === "car"}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        title="Novo carro"
      >
        {open === "car" ? (
          <CarForm
            busy={busy}
            addCar={addCar}
            onSaved={() => {
              close();
              say("Carro cadastrado. Já dá para publicar.");
            }}
          />
        ) : null}
      </Sheet>
      <DeleteAccountDialog
        open={open === "delete"}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        phoneDisplay={account.phoneDisplay}
        busy={busy}
        onConfirm={() => {
          close();
          deleteAccount().then(onDeleted, fail);
        }}
      />
    </div>
  );
}

interface ProfileFormProps {
  readonly account: Account;
  readonly busy: boolean;
  readonly updateProfile: (changes: ProfileChanges) => Promise<Account>;
  readonly requestEmailChange: (email: string) => Promise<void>;
  /** What to say once saving is done, since a changed e-mail earns its own sentence (D-168). */
  readonly onSaved: (message: string) => void;
}

/** Nome social saves at once; a changed e-mail asks the new address to confirm it by link
 * instead (D-168). The phone is shown, never edited: it is the account's identity, and nothing
 * proves a new one is still the same owner yet (D-027). */
function ProfileForm({
  account,
  busy,
  updateProfile,
  requestEmailChange,
  onSaved,
}: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(account.displayName);
  const [email, setEmail] = useState(account.email ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const nameChanged = displayName !== account.displayName;
    const emailChanged = email !== (account.email ?? "");
    if (!nameChanged && !emailChanged) {
      onSaved("Dados salvos.");
      return;
    }
    Promise.all([
      nameChanged ? updateProfile({ displayName }) : Promise.resolve(),
      emailChanged ? requestEmailChange(email) : Promise.resolve(),
    ]).then(
      () => {
        onSaved(
          emailChanged ? "Enviamos um link para o novo e-mail. Ele vale 2 horas." : "Dados salvos.",
        );
      },
      (reason: unknown) => {
        setError(reasonOf(reason));
      },
    );
  };

  return (
    <Form onSubmit={submit} error={error}>
      <TextField label="Celular" value={account.phoneDisplay} onChange={() => undefined} readOnly />
      <TextField label="Nome social" value={displayName} onChange={setDisplayName} required />
      <TextField
        label="E-mail"
        value={email}
        onChange={setEmail}
        type="email"
        inputMode="email"
        hint="Trocar o e-mail manda um link de confirmação para o endereço novo."
      />
      <ActionButton submit emphasis="primary" busy={busy}>
        Salvar dados
      </ActionButton>
    </Form>
  );
}

interface PasswordFormProps {
  readonly busy: boolean;
  readonly changePassword: (data: ChangePasswordData) => Promise<void>;
  readonly onSaved: () => void;
}

const emptyPasswordChange: ChangePasswordData = { currentPassword: "", newPassword: "" };

/** Its own path to a new password, separate from the personal data (D-139). */
function PasswordForm({ busy, changePassword, onSaved }: PasswordFormProps) {
  const [data, setData] = useState<ChangePasswordData>(emptyPasswordChange);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    changePassword(data).then(onSaved, (reason: unknown) => {
      setError(reasonOf(reason));
    });
  };

  return (
    <Form onSubmit={submit} error={error}>
      <PasswordField
        label="Senha atual"
        value={data.currentPassword}
        onChange={(value) => {
          setData((current) => ({ ...current, currentPassword: value }));
        }}
        autoComplete="current-password"
      />
      <PasswordField
        label="Nova senha"
        value={data.newPassword}
        onChange={(value) => {
          setData((current) => ({ ...current, newPassword: value }));
        }}
        autoComplete="new-password"
        hint="Pelo menos 8 caracteres."
      />
      <ActionButton submit emphasis="primary" busy={busy}>
        Salvar senha
      </ActionButton>
    </Form>
  );
}

interface CarFormProps {
  readonly busy: boolean;
  readonly addCar: (data: CarData) => Promise<Account>;
  readonly onSaved: () => void;
}

const emptyCar: CarData = { model: "", color: "", plate: "" };

/** Three fields on a sheet; the plate says who will see it (S10). */
function CarForm({ busy, addCar, onSaved }: CarFormProps) {
  const [car, setCar] = useState<CarData>(emptyCar);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof CarData) => (value: string) => {
    setCar((current) => ({ ...current, [key]: value }));
  };

  return (
    <Form
      error={error}
      onSubmit={() => {
        setError(null);
        addCar(car).then(onSaved, (reason: unknown) => {
          setError(reasonOf(reason));
        });
      }}
    >
      <TextField
        label="Modelo"
        value={car.model}
        onChange={set("model")}
        placeholder="Gol"
        hint="Sem a marca: o modelo já diz."
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
        hint="Antiga ou Mercosul. Só quem pedir contato vê a placa."
        required
      />
      <ActionButton submit emphasis="primary" busy={busy}>
        Salvar carro
      </ActionButton>
    </Form>
  );
}
