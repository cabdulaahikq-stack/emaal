import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { cancelPaymentRequest, getPaymentRequest, payPaymentRequest } from "../../api/marketplace";
import type { PaymentRequest } from "../../api/types";
import { useAuth, ApiError } from "../../auth/AuthContext";
import type { Route } from "../../nav/TabStackNav";
import { useStackNav, BackButton } from "../../nav/TabStackNav";
import { Button, Card, Screen, Tag } from "../../components/ui";
import { PinStepUpSheet } from "../../components/PinStepUpSheet";
import { colors, fonts, space } from "../../theme/tokens";
import { formatUsd } from "../../util/format";

const STATUS_TONE: Record<string, "accent" | "accent2" | "neutral" | "danger"> = {
  PENDING: "accent",
  PAID: "accent2",
  CANCELLED: "danger",
};

export function PaymentRequestDetailScreen({ route }: { route: Route }) {
  const id = route.params?.id as string;
  const { user } = useAuth();
  const nav = useStackNav();
  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getPaymentRequest(id);
    setRequest(res.request);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function pay(pin: string) {
    setBusy(true);
    setError(null);
    try {
      await payPaymentRequest(id, pin);
      setSheetVisible(false);
      Alert.alert("Paid", "Payment sent.");
      nav.pop();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await cancelPaymentRequest(id);
      nav.pop();
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!request) {
    return (
      <Screen>
        <BackButton />
        <ActivityIndicator style={{ marginTop: space[8] }} />
      </Screen>
    );
  }

  const isPayer = user?.phone === request.payerPhone;
  const isRequester = user?.id === request.requesterId;

  return (
    <Screen>
      <BackButton />
      <Text style={styles.amount}>{formatUsd(request.amount)}</Text>
      <Tag label={request.status} tone={STATUS_TONE[request.status] ?? "neutral"} />

      <Card style={{ marginTop: space[6] }}>
        <Row label="From" value={request.requesterName ?? request.requesterPhone ?? "—"} />
        <Row label="To" value={request.payerPhone} />
        <Row label="Created" value={new Date(request.createdAt).toLocaleString()} />
      </Card>

      {request.status === "PENDING" && isPayer ? (
        <Button title="Pay now" onPress={() => setSheetVisible(true)} block style={{ marginTop: space[6] }} />
      ) : null}
      {request.status === "PENDING" && isRequester ? (
        <Button title="Cancel request" variant="secondary" onPress={cancel} loading={busy} block style={{ marginTop: space[6] }} />
      ) : null}

      <PinStepUpSheet
        visible={sheetVisible}
        title="Confirm payment"
        subtitle={`${formatUsd(request.amount)} to ${request.requesterName ?? request.requesterPhone}`}
        busy={busy}
        error={error}
        onSubmit={pay}
        onCancel={() => setSheetVisible(false)}
      />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  amount: { fontFamily: fonts.heading, fontSize: 40, color: colors.text, marginBottom: space[2] },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(32,30,29,0.08)" },
  rowLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.neutral700 },
  rowValue: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text, flexShrink: 1, textAlign: "right", marginLeft: space[4] },
});
