import React, { useEffect, useState } from "react";
import { Text } from "react-native";
import { lookupPhone, transfer } from "../../api/wallet";
import { AmountEntryScreen } from "./AmountEntryScreen";
import { useMoneyAction } from "./useMoneyAction";
import { Field, Input } from "../../components/ui";
import { colors, fonts } from "../../theme/tokens";

export function TransferScreen() {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [recipientName, setRecipientName] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (phone.length < 9) {
      setRecipientName(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    lookupPhone(phone)
      .then((res) => {
        if (!cancelled) setRecipientName(res.found ? (res.name ?? null) : null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [phone]);

  const action = useMoneyAction((pin, idempotencyKey) => transfer({ toPhone: phone, amountUsd: Number(amount), pin, idempotencyKey }));

  return (
    <AmountEntryScreen
      title="Send money"
      subtitle="Transfer to another Emaal wallet"
      ctaLabel="Continue"
      amount={amount}
      onAmountChange={setAmount}
      onContinue={() => {
        if (recipientName) action.open();
      }}
      sheetTitle="Confirm transfer"
      sheetSubtitle={amount ? `$${amount} to ${recipientName ?? phone}` : "Transfer"}
      action={action}
      extraDisabled={!recipientName}
    >
      <Field
        label="Recipient phone number"
        error={phone.length >= 9 && !checking && !recipientName ? "No Emaal wallet found for this number" : null}
      >
        <Input value={phone} onChangeText={setPhone} placeholder="+252 6XX XXX XXX" keyboardType="phone-pad" autoCapitalize="none" />
      </Field>
      {recipientName ? <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.accent700, marginTop: -8, marginBottom: 12 }}>→ {recipientName}</Text> : null}
    </AmountEntryScreen>
  );
}
