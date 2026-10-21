import { useState } from "react";

import { HeldNotice } from "@/features/accounts/ui/held-notice";
import type { DevicePush } from "@/shared/app/use-device-push";
import { AccountHeldError } from "@/shared/domain/account-held";
import { Card } from "@/shared/ui/card";
import { DevicePushControl } from "@/shared/ui/device-push-control";
import { Icon } from "@/shared/ui/icon";
import { IconButton } from "@/shared/ui/icon-button";
import { ListGroup, ListRow } from "@/shared/ui/list-row";
import { NoticeBar } from "@/shared/ui/notice-bar";
import { SectionHeading } from "@/shared/ui/section-heading";

import { useMyAlerts } from "../app/use-my-alerts";
import { AlertRequestError, type RideAlert } from "../domain/alert";
import { alertDayLabel, alertSummary } from "./format";

const NO_ANSWER = "Sem resposta do serviço. Tente de novo.";

interface MyAlertsProps {
  readonly accountId: string;
  /** The one device-push instance of the page, shared with the way out of the account. */
  readonly push: DevicePush;
  readonly now: Date;
}

/** The alerts the account asked for, with the way to drop each, and what this device does with them. */
export function MyAlerts({ accountId, push, now }: MyAlertsProps) {
  const { status, alerts, limit, remove, removing } = useMyAlerts(accountId);
  const [failure, setFailure] = useState<unknown>(null);

  const drop = (alertId: string) => {
    setFailure(null);
    remove(alertId).catch((reason: unknown) => {
      setFailure(reason);
    });
  };

  return (
    <>
      <SectionHeading
        {...(status === "ready" && limit !== null
          ? { aside: `${String(alerts.length)} de ${String(limit)}` }
          : {})}
      >
        Meus avisos
      </SectionHeading>
      {status === "loading" ? (
        <p className="text-secondary text-ink-2">Carregando seus avisos…</p>
      ) : status === "failed" ? (
        <p className="text-secondary text-ink-2">Não foi possível carregar seus avisos.</p>
      ) : (
        <ListGroup>
          {alerts.length === 0 ? (
            <ListRow
              icon={<Icon name="bell" />}
              title="Nenhum aviso ativo."
              subtitle="No mural, toque em Me avise."
            />
          ) : (
            alerts.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                now={now}
                disabled={removing === alert.id}
                onDrop={drop}
              />
            ))
          )}
        </ListGroup>
      )}
      <Failure reason={failure} />
      <SectionHeading>Notificações neste aparelho</SectionHeading>
      <Card>
        <DevicePushControl push={push} />
      </Card>
    </>
  );
}

interface AlertRowProps {
  readonly alert: RideAlert;
  readonly now: Date;
  readonly disabled: boolean;
  readonly onDrop: (alertId: string) => void;
}

function AlertRow({ alert, now, disabled, onDrop }: AlertRowProps) {
  const day = alertDayLabel(alert.day, now);
  const summary = alertSummary(alert);
  return (
    <ListRow
      icon={<Icon name="bell" />}
      title={day}
      subtitle={summary}
      trailing={
        <IconButton
          icon="trash"
          label={`Apagar aviso de ${day}, ${summary}`}
          look="plain"
          disabled={disabled}
          onPress={() => {
            onDrop(alert.id);
          }}
        />
      }
    />
  );
}

function Failure({ reason }: { readonly reason: unknown }) {
  if (reason === null) return null;
  if (reason instanceof AccountHeldError) return <HeldNotice message={reason.message} />;
  return (
    <NoticeBar tone="critical" role="alert">
      {reason instanceof AlertRequestError ? reason.message : NO_ANSWER}
    </NoticeBar>
  );
}
