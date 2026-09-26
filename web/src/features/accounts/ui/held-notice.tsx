import { Link } from "@tanstack/react-router";

import { NoticeBar } from "@/shared/ui/notice-bar";

interface HeldNoticeProps {
  /** The API's own phrase (D-168): every write behind the gate refuses with the same wording. */
  readonly message: string;
}

/**
 * What a blocked write shows instead of a generic refusal, wherever the error can surface outside
 * the guarded screens (D-168): the ride detail stays visible, so a held account only finds out
 * when it tries to act. The phrase, and the one way to fix it.
 */
export function HeldNotice({ message }: HeldNoticeProps) {
  return (
    <NoticeBar
      tone="critical"
      role="alert"
      actions={
        <Link to="/conta" className="text-secondary font-semibold text-brand-ink">
          Ir para minha conta
        </Link>
      }
    >
      {message}
    </NoticeBar>
  );
}
