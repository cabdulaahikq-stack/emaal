import React, { useState } from "react";
import { deposit } from "../../api/wallet";
import { AmountEntryScreen } from "./AmountEntryScreen";
import { useMoneyAction } from "./useMoneyAction";

export function DepositScreen() {
  const [amount, setAmount] = useState("");
  const action = useMoneyAction((pin, idempotencyKey) => deposit({ amountUsd: Number(amount), pin, idempotencyKey }));

  return (
    <AmountEntryScreen
      title="Deposit"
      subtitle="Add funds to your Emaal wallet"
      ctaLabel="Continue"
      amount={amount}
      onAmountChange={setAmount}
      onContinue={action.open}
      sheetTitle="Confirm deposit"
      sheetSubtitle={amount ? `$${amount} · Deposit` : "Deposit"}
      action={action}
    />
  );
}
