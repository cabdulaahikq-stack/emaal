import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { createProduct, listWarehouses } from "../../api/merchant";
import type { ProductCategory, Warehouse } from "../../api/types";
import { ApiError } from "../../auth/AuthContext";
import { useStackNav, BackButton } from "../../nav/TabStackNav";
import { Button, Field, Input, Screen, ScreenTitle } from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme/tokens";

interface VariantRow {
  key: number;
  sizeLabel: string;
  qty: string;
  warehouseId: string;
}

let rowKey = 0;
function newRow(warehouseId: string): VariantRow {
  return { key: rowKey++, sizeLabel: "", qty: "0", warehouseId };
}

const CATEGORIES: ProductCategory[] = ["SHOES", "CLOTHING", "OTHER"];

export function CreateProductScreen() {
  const nav = useStackNav();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategory>("OTHER");
  const [barcode, setBarcode] = useState("");
  const [description, setDescription] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [rows, setRows] = useState<VariantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listWarehouses().then((res) => {
      setWarehouses(res.warehouses);
      if (res.warehouses.length > 0) setRows([newRow(res.warehouses[0]!.id)]);
    });
  }, []);

  function addRow() {
    setRows((r) => [...r, newRow(warehouses[0]?.id ?? "")]);
  }
  function removeRow(key: number) {
    setRows((r) => r.filter((row) => row.key !== key));
  }
  function updateRow(key: number, patch: Partial<VariantRow>) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  const needsSize = category !== "OTHER";
  const canSubmit =
    name.trim().length > 1 &&
    costPrice.length > 0 &&
    wholesalePrice.length > 0 &&
    retailPrice.length > 0 &&
    rows.length > 0 &&
    rows.every((r) => r.warehouseId && (!needsSize || r.sizeLabel.trim().length > 0));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await createProduct({
        name: name.trim(),
        category,
        barcode: barcode.trim() || undefined,
        description: description.trim() || undefined,
        costPriceUsd: Number(costPrice),
        wholesalePriceUsd: Number(wholesalePrice),
        retailPriceUsd: Number(retailPrice),
        discountPercent: discountPercent ? Number(discountPercent) : undefined,
        variants: rows.map((r) => ({
          sizeLabel: needsSize ? r.sizeLabel.trim() : undefined,
          initialStockQty: Number(r.qty) || 0,
          warehouseId: r.warehouseId,
        })),
      });
      nav.pop();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} keyboardShouldPersistTaps="handled">
      <Screen>
        <BackButton />
        <ScreenTitle title="Add product" />

        <Field label="Name">
          <Input value={name} onChangeText={setName} placeholder="Product name" />
        </Field>

        <Field label="Category">
          <View style={{ flexDirection: "row", gap: space[2] }}>
            {CATEGORIES.map((c) => (
              <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]}>
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="Barcode (optional)">
          <Input value={barcode} onChangeText={setBarcode} placeholder="e.g. 0123456789" />
        </Field>
        <Field label="Description (optional)">
          <Input value={description} onChangeText={setDescription} placeholder="Short description" multiline />
        </Field>

        <View style={{ flexDirection: "row", gap: space[2] }}>
          <View style={{ flex: 1 }}>
            <Field label="Cost price">
              <Input value={costPrice} onChangeText={(t) => setCostPrice(t.replace(/[^0-9.]/g, ""))} placeholder="0.00" keyboardType="decimal-pad" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Wholesale price">
              <Input
                value={wholesalePrice}
                onChangeText={(t) => setWholesalePrice(t.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
            </Field>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: space[2] }}>
          <View style={{ flex: 1 }}>
            <Field label="Retail price">
              <Input value={retailPrice} onChangeText={(t) => setRetailPrice(t.replace(/[^0-9.]/g, ""))} placeholder="0.00" keyboardType="decimal-pad" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Discount % (optional)">
              <Input
                value={discountPercent}
                onChangeText={(t) => setDiscountPercent(t.replace(/[^0-9]/g, ""))}
                placeholder="0"
                keyboardType="number-pad"
              />
            </Field>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{needsSize ? "Sizes & stock" : "Stock"}</Text>
        {rows.map((row) => (
          <View key={row.key} style={styles.variantRow}>
            {needsSize ? (
              <Input value={row.sizeLabel} onChangeText={(t) => updateRow(row.key, { sizeLabel: t })} placeholder="Size" style={{ width: 70 }} />
            ) : null}
            <Input
              value={row.qty}
              onChangeText={(t) => updateRow(row.key, { qty: t.replace(/[^0-9]/g, "") })}
              placeholder="Qty"
              keyboardType="number-pad"
              style={{ width: 70 }}
            />
            <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {warehouses.map((w) => (
                <Pressable
                  key={w.id}
                  onPress={() => updateRow(row.key, { warehouseId: w.id })}
                  style={[styles.whChip, row.warehouseId === w.id && styles.whChipActive]}
                >
                  <Text style={[styles.whChipText, row.warehouseId === w.id && styles.whChipTextActive]}>{w.name}</Text>
                </Pressable>
              ))}
            </View>
            {rows.length > 1 ? (
              <Pressable onPress={() => removeRow(row.key)}>
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {needsSize ? (
          <Pressable onPress={addRow} style={{ marginTop: space[2], marginBottom: space[4] }}>
            <Text style={styles.addText}>+ Add another size</Text>
          </Pressable>
        ) : null}

        {warehouses.length === 0 ? <Text style={styles.warnText}>Create a warehouse first, from Home → Warehouses.</Text> : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button title="Save product" onPress={submit} loading={busy} disabled={!canSubmit} block style={{ marginTop: space[6], marginBottom: space[8] }} />
      </Screen>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.neutral700, marginTop: space[2], marginBottom: space[2] },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.neutral200 },
  chipActive: { backgroundColor: colors.accent },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.text },
  chipTextActive: { color: colors.white },
  variantRow: { flexDirection: "row", alignItems: "center", gap: space[2], marginBottom: space[2] },
  whChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.neutral200 },
  whChipActive: { backgroundColor: colors.accent700 },
  whChipText: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.text },
  whChipTextActive: { color: colors.white },
  removeText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.danger },
  addText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accent700 },
  warnText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.danger, marginBottom: space[4] },
  errorText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.danger, marginTop: space[2] },
});
