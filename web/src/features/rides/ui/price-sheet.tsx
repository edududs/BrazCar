import { useState } from "react";

import { ActionButton } from "@/shared/ui/action-button";
import { Sheet } from "@/shared/ui/sheet";
import { TextField } from "@/shared/ui/text-field";

interface PriceSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Decimal as text, already applied, or null. */
  readonly value: string | null;
  readonly onApply: (value: string | null) => void;
}

/** "Até quanto?": the most the person pays, as a filter. */
export function PriceSheet({ open, onOpenChange, value, onApply }: PriceSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Até quanto?"
      description="Mostra só as caronas até esse preço."
    >
      {open ? (
        <PriceSheetBody
          initial={value ?? ""}
          onApply={(next) => {
            onApply(next);
            onOpenChange(false);
          }}
        />
      ) : null}
    </Sheet>
  );
}

function PriceSheetBody({
  initial,
  onApply,
}: {
  readonly initial: string;
  readonly onApply: (value: string | null) => void;
}) {
  const [price, setPrice] = useState(initial);
  return (
    <>
      <TextField
        label="Preço até"
        type="number"
        inputMode="decimal"
        min="0"
        step="0.5"
        prefix="R$"
        placeholder="7,00"
        value={price}
        onChange={setPrice}
      />
      <div className="flex gap-2.5">
        <div className="flex-1">
          <ActionButton
            emphasis="quiet"
            onPress={() => {
              onApply(null);
            }}
          >
            Limpar
          </ActionButton>
        </div>
        <div className="flex-[2]">
          <ActionButton
            emphasis="primary"
            onPress={() => {
              onApply(price === "" ? null : price);
            }}
          >
            Mostrar caronas
          </ActionButton>
        </div>
      </div>
    </>
  );
}
