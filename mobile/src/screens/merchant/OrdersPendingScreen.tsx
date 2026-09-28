import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { acceptOrder, listPendingOrders, rejectOrder } from "../../api/merchant";
import type { Sale } from "../../api/types";
import { ApiError } from "../../auth/AuthContext";
import { Button, Card, Screen, ScreenTitle } from "../../components/ui";
import { colors, fonts, space } from "../../theme/tokens";
import { formatUsd } from "../../util/format";

export function OrdersPendingScreen() {
  const [orders, setOrders] = useState<Sale[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await listPendingOrders();
    setOrders(res.orders);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function decide(id: string, action: "accept" | "reject") {
    setBusyId(id);
    try {
      const fn = action === "accept" ? acceptOrder : rejectOrder;
      await fn(id);
      await load();
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen>
      <ScreenTitle title="Wholesale orders" subtitle="Accept or reject orders waiting on you" />
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: space[2] }} />}
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.amount}>{formatUsd(item.total)}</Text>
            <Text style={styles.meta}>
              {item.items?.length ?? 0} item(s) · {new Date(item.createdAt).toLocaleString()}
            </Text>
            <View style={{ flexDirection: "row", gap: space[2], marginTop: space[3] }}>
              <Button title="Reject" variant="secondary" onPress={() => decide(item.id, "reject")} loading={busyId === item.id} style={{ flex: 1 }} />
              <Button title="Accept" onPress={() => decide(item.id, "accept")} loading={busyId === item.id} style={{ flex: 1 }} />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <Card>
            <Text style={{ fontFamily: fonts.body, color: colors.neutral700 }}>No pending orders.</Text>
          </Card>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  amount: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.neutral700, marginTop: 4 },
});
