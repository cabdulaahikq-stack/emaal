import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { getMerchantMe } from "../../api/merchant";
import type { MerchantProfile, Wallet } from "../../api/types";
import { useStackNav } from "../../nav/TabStackNav";
import { Card } from "../../components/ui";
import { IconLogOut } from "../../components/icons";
import { colors, fonts, radius, space } from "../../theme/tokens";
import { formatUsd } from "../../util/format";

export function MerchantHomeScreen() {
  const { user, logout } = useAuth();
  const nav = useStackNav();
  const [merchant, setMerchant] = useState<MerchantProfile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isMerchant = user?.role === "MERCHANT";

  const load = useCallback(async () => {
    if (!isMerchant) return;
    const res = await getMerchantMe();
    setMerchant(res.merchant);
    setWallet(res.wallet);
  }, [isMerchant]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space[4], paddingTop: space[8], paddingBottom: space[8] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>Emaal · {user?.role}</Text>
          <Text style={styles.name}>{isMerchant ? (merchant?.shopName ?? "Your shop") : user?.fullName}</Text>
        </View>
        <Pressable onPress={logout} style={styles.logoutBtn}>
          <IconLogOut color={colors.accent800} />
        </Pressable>
      </View>

      {isMerchant ? (
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Shop wallet balance</Text>
          <Text style={styles.balanceValue}>{wallet ? formatUsd(wallet.available) : "—"}</Text>
          {wallet && wallet.held > 0 ? <Text style={styles.heldNote}>{formatUsd(wallet.held)} on hold</Text> : null}
        </View>
      ) : (
        <Card style={{ marginTop: space[4] }}>
          <Text style={{ fontFamily: fonts.body, color: colors.neutral700 }}>
            Welcome, {user?.fullName?.split(" ")[0]}. Use the tabs below for products, sales, orders and the cash register.
          </Text>
        </Card>
      )}

      {isMerchant ? (
        <View style={{ marginTop: space[6] }}>
          <Text style={styles.sectionTitle}>Manage</Text>
          <MenuRow label="Warehouses" onPress={() => nav.push("Warehouses")} />
        </View>
      ) : null}
    </ScrollView>
  );
}

function MenuRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card style={{ marginBottom: space[2], flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.text }}>{label}</Text>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.accent700 }}>›</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  eyebrow: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: colors.neutral700 },
  name: { fontFamily: fonts.heading, fontSize: 22, color: colors.text, marginTop: 4 },
  logoutBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.accent200, alignItems: "center", justifyContent: "center" },
  balanceCard: { marginTop: space[4], padding: space[6], borderRadius: 32, backgroundColor: colors.accent900 },
  balanceLabel: { fontFamily: fonts.body, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: colors.accent300 },
  balanceValue: { fontFamily: fonts.heading, fontSize: 34, color: colors.neutral100, marginTop: 8 },
  heldNote: { fontFamily: fonts.body, fontSize: 12, color: colors.accent300, marginTop: 8 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, marginBottom: space[2] },
});
