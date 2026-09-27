import React, { useState } from "react";
import { withdraw } from "../../api/wallet";
import { AmountEntryScreen } from "./AmountEntryScreen";
import { useMoneyAction } from "./useMoneyAction";

export function WithdrawScreen() {
  const [amount, setAmount] = useState("");
  const action = useMoneyAction((pin, idempotencyKey) => withdraw({ amountUsd: Number(amount), pin, idempotencyKey }));

  return (
    <AmountEntryScreen
      title="Withdraw"
      subtitle="Cash out from your Emaal wallet"
      ctaLabel="Continue"
      amount={amount}
      onAmountChange={setAmount}
      onContinue={action.open}
      sheetTitle="Confirm withdrawal"
      sheetSubtitle={amount ? `$${amount} · Withdraw` : "Withdraw"}
      action={action}
    />
  );
}
