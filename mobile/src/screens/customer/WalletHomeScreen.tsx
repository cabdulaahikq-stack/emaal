import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { getMyWallet } from "../../api/wallet";
import type { LedgerEntry, Wallet } from "../../api/types";
import { useStackNav } from "../../nav/TabStackNav";
import { Card } from "../../components/ui";
import { IconArrowDownLeft, IconArrowUpRight, IconKey, IconLogOut, IconPlus } from "../../components/icons";
import { colors, fonts, radius, space } from "../../theme/tokens";
import { formatUsd } from "../../util/format";

export function WalletHomeScreen() {
  const { user, logout } = useAuth();
  const nav = useStackNav();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [activity, setActivity] = useState<LedgerEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await getMyWallet();
    setWallet(res.wallet);
    setActivity(res.recentActivity);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space[4], paddingTop: space[8], paddingBottom: space[8] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.eyebrow}>Emaal · {user?.role}</Text>
              <Text style={styles.name}>{user?.fullName}</Text>
            </View>
            <Pressable onPress={logout} style={styles.logoutBtn}>
              <IconLogOut color={colors.accent800} />
            </Pressable>
          </View>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available balance</Text>
            <Text style={styles.balanceValue}>{wallet ? formatUsd(wallet.available) : "—"}</Text>
            {wallet && wallet.held > 0 ? <Text style={styles.heldNote}>{formatUsd(wallet.held)} on hold pending approval</Text> : null}
          </View>

          <View style={styles.actionsRow}>
            <ActionButton icon={<IconPlus color={colors.white} />} label="Deposit" onPress={() => nav.push("Deposit")} />
            <ActionButton icon={<IconArrowUpRight color={colors.white} />} label="Withdraw" onPress={() => nav.push("Withdraw")} />
            <ActionButton icon={<IconArrowDownLeft color={colors.white} />} label="Send" onPress={() => nav.push("Transfer")} />
            <ActionButton icon={<IconKey color={colors.white} />} label="Requests" onPress={() => nav.push("PaymentRequests")} />
          </View>

          <Text style={styles.sectionTitle}>Recent activity</Text>
        </View>
      }
      data={activity}
      keyExtractor={(e) => e.id}
      renderItem={({ item }) => (
        <Pressable onPress={() => nav.push("TransactionDetail", { id: item.transactionId })}>
          <Card style={{ marginBottom: space[2], flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.entryDirection}>{item.direction === "CREDIT" ? "Received" : "Sent"}</Text>
              <Text style={styles.entryDate}>{new Date(item.createdAt).toLocaleString()}</Text>
            </View>
            <Text style={[styles.entryAmount, { color: item.direction === "CREDIT" ? colors.accent700 : colors.text }]}>
              {item.direction === "CREDIT" ? "+" : "−"}
              {formatUsd(item.amount)}
            </Text>
          </Card>
        </Pressable>
      )}
      ListEmptyComponent={
        <Card>
          <Text style={{ fontFamily: fonts.body, color: colors.neutral700 }}>Nothing yet — your activity will show up here.</Text>
        </Card>
      }
    />
  );
}

function ActionButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable style={{ flex: 1, alignItems: "center" }} onPress={onPress}>
      <View style={styles.actionCircle}>{icon}</View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  eyebrow: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: colors.neutral700 },
  name: { fontFamily: fonts.heading, fontSize: 24, color: colors.text, marginTop: 4 },
  logoutBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.accent200, alignItems: "center", justifyContent: "center" },

  balanceCard: { marginTop: space[4], padding: space[6], borderRadius: 32, backgroundColor: colors.accent900 },
  balanceLabel: { fontFamily: fonts.body, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: colors.accent300 },
  balanceValue: { fontFamily: fonts.heading, fontSize: 38, color: colors.neutral100, marginTop: 8 },
  heldNote: { fontFamily: fonts.body, fontSize: 12, color: colors.accent300, marginTop: 8 },

  actionsRow: { flexDirection: "row", gap: space[3], marginTop: space[6] },
  actionCircle: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.text, marginTop: 6 },

  sectionTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, marginTop: space[6], marginBottom: space[2] },

  entryDirection: { fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.text },
  entryDate: { fontFamily: fonts.body, fontSize: 11.5, color: colors.neutral700, marginTop: 2 },
  entryAmount: { fontFamily: fonts.heading, fontSize: 16 },
});
