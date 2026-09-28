import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { posSell, searchProducts } from "../../api/merchant";
import type { Product, ProductVariant } from "../../api/types";
import { ApiError } from "../../auth/AuthContext";
import { Button, Card, Field, Input, Screen, ScreenTitle } from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme/tokens";
import { formatUsd } from "../../util/format";

interface CartLine {
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

export function POSScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tender, setTender] = useState<"CASH" | "WALLET">("CASH");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerPin, setBuyerPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim()) searchProducts(query).then((res) => setResults(res.products));
      else setResults([]);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function addToCart(product: Product, variant: ProductVariant) {
    setCart((c) => {
      const existing = c.find((l) => l.variant.id === variant.id);
      if (existing) return c.map((l) => (l.variant.id === variant.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...c, { product, variant, quantity: 1 }];
    });
  }
  function removeLine(variantId: string) {
    setCart((c) => c.filter((l) => l.variant.id !== variantId));
  }

  const total = cart.reduce((sum, l) => sum + l.product.retailPriceAfterDiscount * l.quantity, 0);
  const canSubmit = cart.length > 0 && (tender === "CASH" || (buyerPhone.length >= 9 && buyerPin.length === 4));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const { sale } = await posSell({
        items: cart.map((l) => ({ productId: l.product.id, variantId: l.variant.id, quantity: l.quantity })),
        tender,
        buyerPhone: tender === "WALLET" ? buyerPhone.trim() : undefined,
        buyerPin: tender === "WALLET" ? buyerPin : undefined,
        idempotencyKey: Crypto.randomUUID(),
      });
      Alert.alert("Sale complete", `Total: ${formatUsd(sale.total)}`);
      setCart([]);
      setBuyerPhone("");
      setBuyerPin("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} keyboardShouldPersistTaps="handled">
      <Screen>
        <ScreenTitle title="Sell" subtitle="Ring up a sale at the register" />

        <Input value={query} onChangeText={setQuery} placeholder="Search a product to add" />
        {results.map((p) => (
          <View key={p.id} style={{ marginTop: space[2] }}>
            {(p.variants ?? []).map((v) => (
              <Pressable key={v.id} onPress={() => addToCart(p, v)} disabled={v.sellableQty <= 0}>
                <Card style={[styles.resultRow, v.sellableQty <= 0 && { opacity: 0.4 }]}>
                  <Text style={styles.resultName}>
                    {p.name} {v.sizeLabel ? `· ${v.sizeLabel}` : ""}
                  </Text>
                  <Text style={styles.resultPrice}>{formatUsd(p.retailPriceAfterDiscount)}</Text>
                </Card>
              </Pressable>
            ))}
          </View>
        ))}

        <Text style={styles.sectionTitle}>Cart</Text>
        {cart.length === 0 ? (
          <Card>
            <Text style={{ fontFamily: fonts.body, color: colors.neutral700 }}>Search above and tap an item to add it.</Text>
          </Card>
        ) : (
          cart.map((l) => (
            <Card key={l.variant.id} style={{ marginBottom: space[2] }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.resultName}>
                  {l.quantity} × {l.product.name} {l.variant.sizeLabel ? `· ${l.variant.sizeLabel}` : ""}
                </Text>
                <Text onPress={() => removeLine(l.variant.id)} style={styles.removeText}>
                  ✕
                </Text>
              </View>
              <Text style={styles.resultPrice}>{formatUsd(l.product.retailPriceAfterDiscount * l.quantity)}</Text>
            </Card>
          ))
        )}

        {cart.length > 0 ? (
          <View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatUsd(total)}</Text>
            </View>

            <View style={styles.segment}>
              <SegmentButton label="Cash" active={tender === "CASH"} onPress={() => setTender("CASH")} />
              <SegmentButton label="Wallet" active={tender === "WALLET"} onPress={() => setTender("WALLET")} />
            </View>

            {tender === "WALLET" ? (
              <View>
                <Field label="Buyer's phone number">
                  <Input value={buyerPhone} onChangeText={setBuyerPhone} placeholder="+252 6XX XXX XXX" keyboardType="phone-pad" />
                </Field>
                <Field label="Buyer's PIN" error={error}>
                  <Input
                    value={buyerPin}
                    onChangeText={(t) => setBuyerPin(t.replace(/\D/g, "").slice(0, 4))}
                    placeholder="••••"
                    keyboardType="number-pad"
                    secureTextEntry
                  />
                </Field>
              </View>
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            <Button title="Complete sale" onPress={submit} loading={busy} disabled={!canSubmit} block style={{ marginBottom: space[8] }} />
          </View>
        ) : null}
      </Screen>
    </ScrollView>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentBtn, active && styles.segmentBtnActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  resultRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: space[2] },
  resultName: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text, flexShrink: 1 },
  resultPrice: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  removeText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.danger },
  sectionTitle: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.neutral700, marginTop: space[6], marginBottom: space[2] },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: space[4], marginBottom: space[4] },
  totalLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  totalValue: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
  segment: { flexDirection: "row", backgroundColor: colors.neutral200, borderRadius: radius.pill, padding: 4, marginBottom: space[4] },
  segmentBtn: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: radius.pill },
  segmentBtnActive: { backgroundColor: colors.accent },
  segmentText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.neutral700 },
  segmentTextActive: { color: colors.white },
  errorText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.danger, marginBottom: space[2] },
});
