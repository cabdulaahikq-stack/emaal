import { useState } from "react";
import { Alert } from "react-native";
import * as Crypto from "expo-crypto";
import { ApiError } from "../../auth/AuthContext";
import type { Sale } from "../../api/types";
import { useStackNav } from "../../nav/TabStackNav";

/** Drives the "confirm → PIN step-up → submit" flow shared by retail checkout and wholesale ordering. */
export function useSaleAction(
  submitFn: (pin: string, idempotencyKey: string) => Promise<{ sale: Sale }>,
  opts?: { successTitle?: string; pendingTitle?: string; pendingMessage?: string },
) {
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
      const { sale } = await submitFn(pin, idempotencyKey);
      setSheetVisible(false);
      setIdempotencyKey(Crypto.randomUUID());
      Alert.alert(
        sale.status === "PENDING" ? (opts?.pendingTitle ?? "Order sent") : (opts?.successTitle ?? "Done"),
        sale.status === "PENDING" ? (opts?.pendingMessage ?? "Waiting on the shop to accept.") : "Your order is complete.",
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
