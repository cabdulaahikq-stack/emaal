import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { getCashRegister, markPrinted, markWhatsappSent } from "../../api/merchant";
import type { Sale } from "../../api/types";
import { ApiError } from "../../auth/AuthContext";
import { Button, Card, ScreenTitle, Tag } from "../../components/ui";
import { colors, fonts, space } from "../../theme/tokens";
import { formatUsd } from "../../util/format";

export function CashRegisterScreen() {
  const [totalToday, setTotalToday] = useState(0);
  const [sales, setSales] = useState<Sale[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getCashRegister();
    setTotalToday(res.totalToday);
    setSales(res.sales);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function receiptAction(saleId: string, action: "printed" | "whatsapp") {
    setBusyId(saleId);
    try {
      await (action === "printed" ? markPrinted(saleId) : markWhatsappSent(saleId));
      await load();
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space[4], paddingTop: space[8], paddingBottom: space[8] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <ScreenTitle title="Cash register" subtitle="Today's sales and receipts" />
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total today</Text>
            <Text style={styles.totalValue}>{formatUsd(totalToday)}</Text>
          </View>
        </View>
      }
      data={sales}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => (
        <Card style={{ marginBottom: space[2] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Tag label={item.tender} tone={item.tender === "CASH" ? "accent2" : "accent"} />
            <Text style={styles.amount}>{formatUsd(item.total)}</Text>
          </View>
          <Text style={styles.meta}>{new Date(item.createdAt).toLocaleTimeString()}</Text>
          <View style={{ flexDirection: "row", gap: space[2], marginTop: space[3] }}>
            <Button
              title={item.printedAt ? "Printed ✓" : "Mark printed"}
              variant="secondary"
              onPress={() => receiptAction(item.id, "printed")}
              disabled={!!item.printedAt}
              loading={busyId === item.id}
              style={{ flex: 1 }}
            />
            <Button
              title={item.whatsappSentAt ? "Sent ✓" : "Send WhatsApp"}
              variant="secondary"
              onPress={() => receiptAction(item.id, "whatsapp")}
              disabled={!!item.whatsappSentAt}
              loading={busyId === item.id}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      )}
      ListEmptyComponent={
        <Card>
          <Text style={{ fontFamily: fonts.body, color: colors.neutral700 }}>No sales yet today.</Text>
        </Card>
      }
    />
  );
}

const styles = StyleSheet.create({
  totalCard: { marginTop: space[4], marginBottom: space[6], padding: space[6], borderRadius: 32, backgroundColor: colors.accent900 },
  totalLabel: { fontFamily: fonts.body, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: colors.accent300 },
  totalValue: { fontFamily: fonts.heading, fontSize: 34, color: colors.neutral100, marginTop: 8 },
  amount: { fontFamily: fonts.heading, fontSize: 17, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.neutral700, marginTop: 4 },
});
