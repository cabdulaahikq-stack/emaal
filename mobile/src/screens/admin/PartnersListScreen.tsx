import React, { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { createPartner, getPartners } from "../../api/admin";
import type { ApiPartner } from "../../api/types";
import { useStackNav } from "../../nav/TabStackNav";
import { ApiError } from "../../auth/AuthContext";
import { Button, Card, Field, Input, Screen, ScreenTitle, Tag } from "../../components/ui";
import { colors, fonts, space } from "../../theme/tokens";

const STATUS_TONE: Record<ApiPartner["status"], "accent2" | "danger" | "neutral"> = {
  ACTIVE: "accent2",
  SUSPENDED: "danger",
  REVOKED: "neutral",
};

export function PartnersListScreen() {
  const nav = useStackNav();
  const [partners, setPartners] = useState<ApiPartner[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    getPartners().then((res) => setPartners(res.partners));
  }
  useEffect(load, []);

  async function submitCreate() {
    setBusy(true);
    setError(null);
    try {
      await createPartner(name.trim());
      setName("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenTitle eyebrow="Admin" title="API partners" subtitle="Third parties integrated with the Emaal wallet API" />

      {showCreate ? (
        <Card style={{ marginBottom: space[4] }}>
          <Field label="Partner name" error={error}>
            <Input value={name} onChangeText={setName} placeholder="Acme Ecommerce" />
          </Field>
          <View style={{ flexDirection: "row", gap: space[2] }}>
            <Button title="Cancel" variant="secondary" onPress={() => setShowCreate(false)} style={{ flex: 1 }} />
            <Button title="Create" onPress={submitCreate} loading={busy} disabled={!name.trim()} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : (
        <Button title="+ New partner" variant="secondary" onPress={() => setShowCreate(true)} block />
      )}

      <FlatList
        style={{ marginTop: space[4] }}
        data={partners}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => nav.push("PartnerDetail", { id: item.id })}>
            <Card style={{ marginBottom: space[2], flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item._count?.apiKeys ?? 0} key{item._count?.apiKeys === 1 ? "" : "s"} · {item._count?.transactions ?? 0} transactions
                </Text>
              </View>
              <Tag label={item.status} tone={STATUS_TONE[item.status]} />
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.neutral700, marginTop: 2 },
});
