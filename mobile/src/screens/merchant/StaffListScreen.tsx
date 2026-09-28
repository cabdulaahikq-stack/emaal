import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { listStaff } from "../../api/merchant";
import type { StaffMember } from "../../api/types";
import { useStackNav } from "../../nav/TabStackNav";
import { Button, Card, ScreenTitle, Tag } from "../../components/ui";
import { colors, fonts, space } from "../../theme/tokens";

const STATUS_TONE: Record<string, "accent" | "accent2" | "neutral" | "danger"> = {
  ACTIVE: "accent2",
  ON_LEAVE: "accent",
  SUSPENDED: "danger",
};

export function StaffListScreen() {
  const nav = useStackNav();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await listStaff();
    setStaff(res.staff);
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
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space[4], paddingTop: space[8], paddingBottom: space[8] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.headerRow}>
          <ScreenTitle title="Staff" />
          <Button title="+ Add" onPress={() => nav.push("CreateStaff")} />
        </View>
      }
      data={staff}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => (
        <Pressable onPress={() => nav.push("StaffDetail", { staff: item })}>
          <Card style={{ marginBottom: space[2], flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.user?.fullName}</Text>
              <Text style={styles.meta}>
                {item.jobTitle} · {item.user?.phone}
              </Text>
            </View>
            <Tag label={item.status} tone={STATUS_TONE[item.status] ?? "neutral"} />
          </Card>
        </Pressable>
      )}
      ListEmptyComponent={
        <Card>
          <Text style={{ fontFamily: fonts.body, color: colors.neutral700 }}>No staff yet.</Text>
        </Card>
      }
    />
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: space[2] },
  name: { fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.neutral700, marginTop: 2 },
});
