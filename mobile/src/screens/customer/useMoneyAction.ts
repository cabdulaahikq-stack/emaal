import { useState } from "react";
import { Alert } from "react-native";
import * as Crypto from "expo-crypto";
import { ApiError } from "../../auth/AuthContext";
import type { Transaction } from "../../api/types";
import { useStackNav } from "../../nav/TabStackNav";
import { statusLabel } from "../../util/format";

/** Drives the "amount entered → PIN step-up → submit" flow shared by deposit, withdraw and transfer. */
export function useMoneyAction(submitFn: (pin: string, idempotencyKey: string) => Promise<{ transaction: Transaction }>) {
  const nav = useStackNav();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => Crypto.randomUUID());

  function open() {
    setError(null);
    setSheetVisible(true);
  }
  function cancel() {
    setSheetVisible(false);
  }

  async function submit(pin: string) {
    setBusy(true);
    setError(null);
    try {
      const { transaction } = await submitFn(pin, idempotencyKey);
      setSheetVisible(false);
      setIdempotencyKey(Crypto.randomUUID());
      Alert.alert(
        transaction.status === "HELD_FOR_APPROVAL" ? "Sent for approval" : "Done",
        transaction.status === "HELD_FOR_APPROVAL"
          ? "This amount is large enough that it needs an admin's sign-off before it completes."
          : `Status: ${statusLabel(transaction.status)}`,
      );
      nav.pop();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return { sheetVisible, open, cancel, submit, busy, error };
}
