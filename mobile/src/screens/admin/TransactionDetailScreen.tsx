import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { approveTransaction, getTransactionDetail, rejectTransaction } from "../../api/admin";
import type { Transaction } from "../../api/types";
import type { Route } from "../../nav/TabStackNav";
import { BackButton } from "../../nav/TabStackNav";
import { ApiError } from "../../auth/AuthContext";
import { Button, Card, Screen, Tag } from "../../components/ui";
import { colors, fonts, space } from "../../theme/tokens";
import { formatUsd, statusLabel } from "../../util/format";

const STATUS_TONE: Record<string, "accent" | "accent2" | "neutral" | "danger"> = {
  COMPLETED: "accent2",
  HELD_FOR_APPROVAL: "accent",
  REJECTED: "danger",
  FAILED: "danger",
  REVERSED: "neutral",
};

export function TransactionDetailScreen({ route }: { route: Route }) {
  const id = route.params?.id as string;
  const [tx, setTx] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    getTransactionDetail(id).then((res) => setTx(res.transaction));
  }

  useEffect(load, [id]);

  async function decide(action: "approve" | "reject") {
    setBusy(true);
    try {
      const fn = action === "approve" ? approveTransaction : rejectTransaction;
      await fn(id);
      load();
      Alert.alert(action === "approve" ? "Approved" : "Rejected");
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <BackButton />
      {!tx ? (
        <ActivityIndicator style={{ marginTop: space[8] }} />
      ) : (
        <View>
          <Text style={styles.amount}>{formatUsd(tx.amount)}</Text>
          <Tag label={statusLabel(tx.status)} tone={STATUS_TONE[tx.status] ?? "neutral"} />

          <Card style={{ marginTop: space[6] }}>
            <Row label="Type" value={tx.type} />
            <Row label="Reference" value={tx.id} mono />
            <Row label="Created" value={new Date(tx.createdAt).toLocaleString()} />
          </Card>

          {tx.status === "HELD_FOR_APPROVAL" && (
            <View style={{ flexDirection: "row", gap: space[3], marginTop: space[6] }}>
              <Button title="Reject" variant="secondary" onPress={() => decide("reject")} loading={busy} style={{ flex: 1 }} />
              <Button title="Approve" onPress={() => decide("approve")} loading={busy} style={{ flex: 1 }} />
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && { fontSize: 11 }]} numberOfLines={1}>
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
