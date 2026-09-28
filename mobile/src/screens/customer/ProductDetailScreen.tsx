import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { checkout, createWholesaleOrder } from "../../api/marketplace";
import type { Product, ProductVariant } from "../../api/types";
import type { Route } from "../../nav/TabStackNav";
import { BackButton } from "../../nav/TabStackNav";
import { Button, Card, Screen, Tag } from "../../components/ui";
import { PinStepUpSheet } from "../../components/PinStepUpSheet";
import { useSaleAction } from "./useSaleAction";
import { colors, fonts, radius, space } from "../../theme/tokens";
import { formatUsd } from "../../util/format";

export function ProductDetailScreen({ route }: { route: Route }) {
  const product = route.params?.product as Product;
  const variants = product.variants ?? [];
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const variant = variants.find((v) => v.id === variantId);

  const items = variant ? [{ productId: product.id, variantId: variant.id, quantity }] : [];

  const buyAction = useSaleAction((pin, idempotencyKey) => checkout({ merchantId: product.merchantId, items, pin, idempotencyKey }), {
    successTitle: "Purchased",
  });
  const orderAction = useSaleAction(
    (pin, idempotencyKey) => createWholesaleOrder({ merchantId: product.merchantId, items, pin, idempotencyKey }),
    { pendingTitle: "Order sent", pendingMessage: "The shop will accept or decline your wholesale order." },
  );

  const sellable = variant ? variant.sellableQty : 0;
  const canOrder = !!variant && quantity > 0 && quantity <= sellable;

  return (
    <Screen>
      <BackButton />
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: space[2] }}>
        <Tag label={product.category} tone="neutral" />
        {product.shopName ? <Text style={styles.shop}>{product.shopName}</Text> : null}
      </View>
      <Text style={styles.name}>{product.name}</Text>
      {product.description ? <Text style={styles.description}>{product.description}</Text> : null}

      <View style={{ flexDirection: "row", gap: space[3], marginTop: space[4] }}>
        <PriceBlock label="Retail" value={formatUsd(product.retailPriceAfterDiscount)} />
        <PriceBlock label="Wholesale" value={formatUsd(product.wholesalePrice)} />
      </View>

      {variants.length > 0 ? (
        <View style={{ marginTop: space[6] }}>
          <Text style={styles.sectionTitle}>Size / variant</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[2] }}>
            {variants.map((v) => (
              <VariantChip key={v.id} variant={v} active={v.id === variantId} onPress={() => setVariantId(v.id)} />
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: space[6] }}>
        <Text style={styles.sectionTitle}>Quantity</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[4], marginTop: space[2] }}>
          <Pressable style={styles.stepBtn} onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
          <Text style={styles.qty}>{quantity}</Text>
          <Pressable style={styles.stepBtn} onPress={() => setQuantity((q) => q + 1)}>
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
          {variant ? <Text style={styles.stockNote}>{sellable} in stock</Text> : null}
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: space[3], marginTop: space[8] }}>
        <Button title="Order wholesale" variant="secondary" onPress={orderAction.open} disabled={!canOrder} style={{ flex: 1 }} />
        <Button title="Buy now" onPress={buyAction.open} disabled={!canOrder} style={{ flex: 1 }} />
      </View>

      <PinStepUpSheet
        visible={buyAction.sheetVisible}
        title="Confirm purchase"
        subtitle={variant ? `${quantity} × ${product.name}` : product.name}
        busy={buyAction.busy}
        error={buyAction.error}
        onSubmit={buyAction.submit}
        onCancel={buyAction.cancel}
      />
      <PinStepUpSheet
        visible={orderAction.sheetVisible}
        title="Confirm wholesale order"
        subtitle={variant ? `${quantity} × ${product.name} · funds held until accepted` : product.name}
        busy={orderAction.busy}
        error={orderAction.error}
        onSubmit={orderAction.submit}
        onCancel={orderAction.cancel}
      />
    </Screen>
  );
}

function PriceBlock({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1 }}>
      <Text style={styles.priceLabel}>{label}</Text>
      <Text style={styles.priceValue}>{value}</Text>
    </Card>
  );
}

function VariantChip({ variant, active, onPress }: { variant: ProductVariant; active: boolean; onPress: () => void }) {
  const disabled = variant.sellableQty <= 0;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.chip, active && styles.chipActive, disabled && { opacity: 0.4 }]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{variant.sizeLabel ?? "One size"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shop: { fontFamily: fonts.body, fontSize: 12, color: colors.neutral700 },
  name: { fontFamily: fonts.heading, fontSize: 26, color: colors.text, marginTop: space[2] },
  description: { fontFamily: fonts.body, fontSize: 13.5, color: colors.neutral700, marginTop: space[2] },
  sectionTitle: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.neutral700 },

  priceLabel: { fontFamily: fonts.body, fontSize: 10.5, letterSpacing: 0.5, textTransform: "uppercase", color: colors.neutral700 },
  priceValue: { fontFamily: fonts.heading, fontSize: 20, color: colors.text, marginTop: 4 },

  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.neutral200 },
  chipActive: { backgroundColor: colors.accent },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  chipTextActive: { color: colors.white },

  stepBtn: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.neutral200, alignItems: "center", justifyContent: "center" },
  stepBtnText: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  qty: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, minWidth: 24, textAlign: "center" },
  stockNote: { fontFamily: fonts.body, fontSize: 11.5, color: colors.neutral700, marginLeft: space[2] },
});
