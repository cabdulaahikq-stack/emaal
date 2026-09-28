import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { listMyOrders } from "../../api/marketplace";
import type { Sale } from "../../api/types";
import { BackButton } from "../../nav/TabStackNav";
import { Card, Screen, ScreenTitle, Tag } from "../../components/ui";
import { colors, fonts, space } from "../../theme/tokens";
import { formatUsd } from "../../util/format";

const STATUS_TONE: Record<string, "accent" | "accent2" | "neutral" | "danger"> = {
  PENDING: "accent",
  COMPLETED: "accent2",
  REJECTED: "danger",
};

export function MyOrdersScreen() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await listMyOrders();
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

  return (
    <Screen>
      <BackButton />
      <ScreenTitle title="My orders" subtitle="Purchases and wholesale orders" />
      <FlatList
        data={sales}
        keyExtractor={(s) => s.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: space[2] }} />}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Tag label={item.kind === "WHOLESALE" ? "Wholesale" : "Retail"} tone="neutral" />
              <Tag label={item.status} tone={STATUS_TONE[item.status] ?? "neutral"} />
            </View>
            <Text style={{ fontFamily: fonts.heading, fontSize: 18, color: colors.text, marginTop: 8 }}>{formatUsd(item.total)}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.neutral700, marginTop: 3 }}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          </Card>
        )}
        ListEmptyComponent={
          <Card>
            <Text style={{ fontFamily: fonts.body, color: colors.neutral700 }}>No orders yet.</Text>
          </Card>
        }
      />
    </Screen>
  );
}
