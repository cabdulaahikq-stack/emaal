import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { getProductDetail, recordStockIntake } from "../../api/merchant";
import type { Product, StockIntake } from "../../api/types";
import { ApiError } from "../../auth/AuthContext";
import type { Route } from "../../nav/TabStackNav";
import { BackButton } from "../../nav/TabStackNav";
import { Button, Card, Field, Input, Screen, Tag } from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme/tokens";
import { formatUsd } from "../../util/format";

export function ProductDetailScreen({ route }: { route: Route }) {
  const productId = route.params?.productId as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [intakes, setIntakes] = useState<StockIntake[]>([]);
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getProductDetail(productId);
    setProduct(res.product);
    setIntakes(res.stockIntakes);
    setVariantId((cur) => cur || res.product.variants?.[0]?.id || "");
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitIntake() {
    if (!variantId || !qty || !cost) return;
    setBusy(true);
    setError(null);
    try {
      await recordStockIntake({ variantId, quantity: Number(qty), costPriceUsd: Number(cost) });
      setQty("");
      setCost("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!product) {
    return (
      <Screen>
        <BackButton />
        <ActivityIndicator style={{ marginTop: space[8] }} />
      </Screen>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <BackButton />
        <Tag label={product.category} tone="neutral" />
        <Text style={styles.name}>{product.name}</Text>
        {product.barcode ? <Text style={styles.meta}>Barcode: {product.barcode}</Text> : null}

        <View style={{ flexDirection: "row", gap: space[3], marginTop: space[4] }}>
          <PriceBlock label="Cost" value={formatUsd(product.costPrice)} />
          <PriceBlock label="Wholesale" value={formatUsd(product.wholesalePrice)} />
          <PriceBlock label="Retail" value={formatUsd(product.retailPrice)} />
        </View>

        <Text style={styles.sectionTitle}>Variants</Text>
        {(product.variants ?? []).map((v) => (
          <Card key={v.id} style={{ marginBottom: space[2] }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={styles.variantLabel}>{v.sizeLabel ?? "One size"}</Text>
              <Text style={styles.variantStock}>{v.sellableQty} sellable</Text>
            </View>
            <Text style={styles.variantMeta}>
              {v.stockQty} in stock · {v.reservedQty} reserved · {v.warehouse?.name}
            </Text>
          </Card>
        ))}

        <Text style={styles.sectionTitle}>Record stock intake</Text>
        <Card>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: space[3] }}>
            {(product.variants ?? []).map((v) => (
              <Text key={v.id} onPress={() => setVariantId(v.id)} style={[styles.variantChip, variantId === v.id && styles.variantChipActive]}>
                {v.sizeLabel ?? "One size"}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: space[2] }}>
            <View style={{ flex: 1 }}>
              <Field label="Quantity">
                <Input value={qty} onChangeText={(t) => setQty(t.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="0" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Cost price (USD)">
                <Input value={cost} onChangeText={(t) => setCost(t.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" placeholder="0.00" />
              </Field>
            </View>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Button title="Add stock" onPress={submitIntake} loading={busy} disabled={!variantId || !qty || !cost} block />
        </Card>

        {intakes.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Recent intakes</Text>
            {intakes.map((i) => (
              <View key={i.id} style={styles.intakeRow}>
                <Text style={styles.intakeText}>
                  +{i.quantity} @ {formatUsd(i.costPrice)}
                </Text>
                <Text style={styles.intakeMeta}>{new Date(i.createdAt).toLocaleDateString()}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Screen>
    </ScrollView>
  );
}

function PriceBlock({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1 }}>
      <Text style={{ fontFamily: fonts.body, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: colors.neutral700 }}>{label}</Text>
      <Text style={{ fontFamily: fonts.heading, fontSize: 16, color: colors.text, marginTop: 4 }}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.heading, fontSize: 24, color: colors.text, marginTop: space[2] },
  meta: { fontFamily: fonts.body, fontSize: 12.5, color: colors.neutral700, marginTop: 4 },
  sectionTitle: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.neutral700, marginTop: space[6], marginBottom: space[2] },
  variantLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  variantStock: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.accent700 },
  variantMeta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.neutral700, marginTop: 3 },
  variantChip: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.text,
    backgroundColor: colors.neutral200,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  variantChipActive: { backgroundColor: colors.accent, color: colors.white },
  errorText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.danger, marginBottom: space[2] },
  intakeRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  intakeText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  intakeMeta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.neutral700 },
});
