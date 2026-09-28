import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { listMarketplaceProducts } from "../../api/marketplace";
import type { Product } from "../../api/types";
import { useStackNav } from "../../nav/TabStackNav";
import { Card, Input, Tag } from "../../components/ui";
import { colors, fonts, space } from "../../theme/tokens";
import { formatUsd } from "../../util/format";

export function MarketplaceHomeScreen() {
  const nav = useStackNav();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (q?: string) => {
    const res = await listMarketplaceProducts(q);
    setProducts(res.products);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timeout = setTimeout(() => load(query), 250);
    return () => clearTimeout(timeout);
  }, [query, load]);

  async function onRefresh() {
    setRefreshing(true);
    await load(query);
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
              <Text style={styles.eyebrow}>Emaal</Text>
              <Text style={styles.name}>Marketplace</Text>
            </View>
            <Pressable onPress={() => nav.push("MyOrders")} style={styles.ordersLink}>
              <Text style={styles.ordersLinkText}>My orders</Text>
            </Pressable>
          </View>
          <Input value={query} onChangeText={setQuery} placeholder="Search products" style={{ marginTop: space[4], marginBottom: space[2] }} />
        </View>
      }
      data={products}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => (
        <Pressable onPress={() => nav.push("ProductDetail", { product: item })}>
          <Card style={{ marginBottom: space[2] }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Tag label={item.category} tone="neutral" />
              {item.shopName ? <Text style={styles.shop}>{item.shopName}</Text> : null}
            </View>
            <Text style={styles.productName}>{item.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 }}>
              <Text style={styles.price}>{formatUsd(item.retailPriceAfterDiscount)}</Text>
              {item.discountPercent > 0 ? <Text style={styles.strike}>{formatUsd(item.retailPrice)}</Text> : null}
            </View>
          </Card>
        </Pressable>
      )}
      ListEmptyComponent={
        <Card>
          <Text style={{ fontFamily: fonts.body, color: colors.neutral700 }}>No products found.</Text>
        </Card>
      }
    />
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: colors.neutral700 },
  name: { fontFamily: fonts.heading, fontSize: 24, color: colors.text, marginTop: 4 },
  ordersLink: { paddingVertical: 8, paddingHorizontal: 4 },
  ordersLinkText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accent700 },
  shop: { fontFamily: fonts.body, fontSize: 11.5, color: colors.neutral700 },
  productName: { fontFamily: fonts.bodyMedium, fontSize: 15.5, color: colors.text, marginTop: 6 },
  price: { fontFamily: fonts.heading, fontSize: 17, color: colors.text },
  strike: { fontFamily: fonts.body, fontSize: 12, color: colors.neutral600, textDecorationLine: "line-through" },
});
