import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { getTransaction } from "../../api/wallet";
import type { Transaction } from "../../api/types";
import type { Route } from "../../nav/TabStackNav";
import { BackButton } from "../../nav/TabStackNav";
import { Card, Screen, Tag } from "../../components/ui";
import { colors, fonts, space } from "../../theme/tokens";
import { formatUsd, statusLabel } from "../../util/format";

const STATUS_TONE: Record<string, "accent" | "accent2" | "neutral" | "danger"> = {
  COMPLETED: "accent2",
  HELD_FOR_APPROVAL: "accent",
  PENDING: "accent",
  REJECTED: "danger",
  FAILED: "danger",
  REVERSED: "neutral",
};

export function TransactionDetailScreen({ route }: { route: Route }) {
  const id = route.params?.id as string;
  const [tx, setTx] = useState<Transaction | null>(null);

  useEffect(() => {
    getTransaction(id).then((res) => setTx(res.transaction));
  }, [id]);

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
            {tx.failureReason ? <Row label="Reason" value={tx.failureReason} /> : null}
          </Card>
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
