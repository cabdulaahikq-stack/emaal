import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { getWalletDetail } from "../../api/admin";
import type { LedgerEntry, Wallet } from "../../api/types";
import type { Route } from "../../nav/TabStackNav";
import { BackButton, useStackNav } from "../../nav/TabStackNav";
import { Card, Screen, Tag } from "../../components/ui";
import { colors, fonts, space } from "../../theme/tokens";
import { formatUsd } from "../../util/format";

export function WalletDetailScreen({ route }: { route: Route }) {
  const id = route.params?.id as string;
  const nav = useStackNav();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    getWalletDetail(id).then((res) => {
      setWallet(res.wallet);
      setLedger(res.ledger);
    });
  }, [id]);

  if (!wallet) {
    return (
      <Screen>
        <BackButton />
        <ActivityIndicator style={{ marginTop: space[8] }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackButton />
      <Text style={styles.name}>{wallet.holderName}</Text>
      <Text style={styles.phone}>{wallet.holderPhone}</Text>
      {wallet.holderStatus === "SUSPENDED" ? <Tag label="Account suspended" tone="danger" /> : null}

      <View style={styles.balanceRow}>
        <View>
          <Text style={styles.label}>Balance</Text>
          <Text style={styles.value}>{formatUsd(wallet.balance)}</Text>
        </View>
        <View>
          <Text style={styles.label}>Available</Text>
          <Text style={styles.value}>{formatUsd(wallet.available)}</Text>
        </View>
        <View>
          <Text style={styles.label}>Held</Text>
          <Text style={styles.value}>{formatUsd(wallet.held)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Ledger</Text>
      <FlatList
        data={ledger}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => nav.push("TransactionDetail", { id: item.transactionId })}>
            <Card style={{ marginBottom: space[2], flexDirection: "row", justifyContent: "space-between" }}>
              <View>
                <Text style={styles.entryDirection}>{item.direction}</Text>
                <Text style={styles.entryDate}>{new Date(item.createdAt).toLocaleString()}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.entryAmount, { color: item.direction === "CREDIT" ? colors.accent700 : colors.text }]}>
                  {item.direction === "CREDIT" ? "+" : "−"}
                  {formatUsd(item.amount)}
                </Text>
                <Text style={styles.entryDate}>bal {formatUsd(item.balanceAfter)}</Text>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  phone: { fontFamily: fonts.body, fontSize: 13, color: colors.neutral700, marginTop: 2, marginBottom: 8 },
  balanceRow: { flexDirection: "row", gap: space[6], marginTop: space[4], marginBottom: space[4] },
  label: { fontFamily: fonts.body, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, color: colors.neutral700 },
  value: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, marginTop: 2 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 17, color: colors.text, marginBottom: space[2] },
  entryDirection: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  entryDate: { fontFamily: fonts.body, fontSize: 11, color: colors.neutral700, marginTop: 2 },
  entryAmount: { fontFamily: fonts.heading, fontSize: 15 },
});
