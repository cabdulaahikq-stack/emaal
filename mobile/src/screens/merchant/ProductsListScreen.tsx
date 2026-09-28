import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useAuth, ApiError } from "../../auth/AuthContext";
import { getProductByBarcode, searchProducts } from "../../api/merchant";
import type { Product } from "../../api/types";
import { useStackNav } from "../../nav/TabStackNav";
import { Button, Card, Input, Tag } from "../../components/ui";
import { colors, fonts, space } from "../../theme/tokens";
import { formatUsd } from "../../util/format";

export function ProductsListScreen() {
  const { user } = useAuth();
  const nav = useStackNav();
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  const load = useCallback(async (q?: string) => {
    const res = await searchProducts(q);
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

  async function lookupBarcode() {
    if (!barcode.trim()) return;
    setBarcodeError(null);
    try {
      const res = await getProductByBarcode(barcode.trim());
      nav.push("ProductDetail", { productId: res.product.id });
      setBarcode("");
    } catch (err) {
      setBarcodeError(err instanceof ApiError ? err.message : "Not found");
    }
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space[4], paddingTop: space[8], paddingBottom: space[8] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Products</Text>
            {user?.role === "MERCHANT" ? <Button title="+ Add" onPress={() => nav.push("CreateProduct")} /> : null}
          </View>
          <Input value={query} onChangeText={setQuery} placeholder="Search products" style={{ marginTop: space[4] }} />
          <View style={{ flexDirection: "row", gap: space[2], marginTop: space[3], alignItems: "center" }}>
            <Input value={barcode} onChangeText={setBarcode} placeholder="Enter barcode" style={{ flex: 1 }} onSubmitEditing={lookupBarcode} />
            <Button title="Find" variant="secondary" onPress={lookupBarcode} />
          </View>
          {barcodeError ? <Text style={styles.barcodeError}>{barcodeError}</Text> : null}
        </View>
      }
      data={products}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => {
        const totalStock = (item.variants ?? []).reduce((sum, v) => sum + v.sellableQty, 0);
        return (
          <Pressable onPress={() => nav.push("ProductDetail", { productId: item.id })}>
            <Card style={{ marginTop: space[3], flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productMeta}>
                  {item.category} · {totalStock} in stock
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.price}>{formatUsd(item.retailPrice)}</Text>
                {totalStock === 0 ? <Tag label="Out of stock" tone="danger" /> : null}
              </View>
            </Card>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        <Card style={{ marginTop: space[3] }}>
          <Text style={{ fontFamily: fonts.body, color: colors.neutral700 }}>No products yet.</Text>
        </Card>
      }
    />
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  productName: { fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.text },
  productMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.neutral700, marginTop: 2 },
  price: { fontFamily: fonts.heading, fontSize: 16, color: colors.text },
  barcodeError: { fontFamily: fonts.body, fontSize: 12, color: colors.danger, marginTop: 4 },
});
