import React, { useState } from "react";
import { createPaymentRequest } from "../../api/marketplace";
import { ApiError } from "../../auth/AuthContext";
import { useStackNav, BackButton } from "../../nav/TabStackNav";
import { Button, Field, Input, Screen, ScreenTitle } from "../../components/ui";
import { space } from "../../theme/tokens";

export function CreatePaymentRequestScreen() {
  const nav = useStackNav();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const numeric = Number(amount);
  const canSubmit = phone.length >= 9 && amount.length > 0 && Number.isFinite(numeric) && numeric > 0;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await createPaymentRequest({ payerPhone: phone.trim(), amountUsd: numeric });
      nav.pop();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <BackButton />
      <ScreenTitle title="Request payment" subtitle="Ask a phone number to pay you" />
      <Field label="Their phone number">
        <Input value={phone} onChangeText={setPhone} placeholder="+252 6XX XXX XXX" keyboardType="phone-pad" autoCapitalize="none" />
      </Field>
      <Field label="Amount (USD)" error={error}>
        <Input value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))} placeholder="0.00" keyboardType="decimal-pad" />
      </Field>
      <Button title="Send request" onPress={submit} loading={busy} disabled={!canSubmit} block style={{ marginTop: space[4] }} />
    </Screen>
  );
}
