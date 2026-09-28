import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { createWarehouse, listWarehouses } from "../../api/merchant";
import type { Warehouse } from "../../api/types";
import { ApiError } from "../../auth/AuthContext";
import { BackButton } from "../../nav/TabStackNav";
import { Button, Card, Field, Input, ScreenTitle } from "../../components/ui";
import { colors, fonts, space } from "../../theme/tokens";

export function WarehousesScreen() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await listWarehouses();
    setWarehouses(res.warehouses);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await createWarehouse({ name: name.trim(), location: location.trim() });
      setName("");
      setLocation("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space[4], paddingTop: space[8], paddingBottom: space[8] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <BackButton />
          <ScreenTitle title="Warehouses" />
          <Card style={{ marginBottom: space[4] }}>
            <Field label="Name">
              <Input value={name} onChangeText={setName} placeholder="Main warehouse" />
            </Field>
            <Field label="Location" error={error}>
              <Input value={location} onChangeText={setLocation} placeholder="Hargeisa" />
            </Field>
            <Button title="Add warehouse" onPress={submit} loading={busy} disabled={!name.trim() || !location.trim()} block />
          </Card>
        </View>
      }
      data={warehouses}
      keyExtractor={(w) => w.id}
      renderItem={({ item }) => (
        <Card style={{ marginBottom: space[2] }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>{item.location}</Text>
          {item.responsible ? <Text style={styles.meta}>Responsible: {item.responsible.user.fullName}</Text> : null}
        </Card>
      )}
      ListEmptyComponent={
        <Card>
          <Text style={{ fontFamily: fonts.body, color: colors.neutral700 }}>No warehouses yet.</Text>
        </Card>
      }
    />
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.neutral700, marginTop: 2 },
});
