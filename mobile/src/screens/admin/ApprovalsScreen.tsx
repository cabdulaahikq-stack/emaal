import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { approveTransaction, getApprovals, rejectTransaction } from "../../api/admin";
import type { ApprovalRequest } from "../../api/types";
import { useStackNav } from "../../nav/TabStackNav";
import { ApiError } from "../../auth/AuthContext";
import { Button, Card, Screen, ScreenTitle, Tag } from "../../components/ui";
import { colors, fonts, space } from "../../theme/tokens";
import { formatUsd } from "../../util/format";

export function ApprovalsScreen() {
  const nav = useStackNav();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getApprovals("PENDING");
    setApprovals(res.approvals);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function decide(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      const fn = action === "approve" ? approveTransaction : rejectTransaction;
      await fn(id);
      await load();
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen>
      <ScreenTitle eyebrow="Admin" title="Approvals" subtitle="Large or risky transactions waiting on a decision" />
      <FlatList
        data={approvals}
        keyExtractor={(a) => a.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: space[2] }} />}
        renderItem={({ item }) => (
          <Card>
            <Pressable onPress={() => nav.push("TransactionDetail", { id: item.transaction.id })}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Tag label={item.transaction.type} tone="accent" />
                <Text style={styles.meta}>{new Date(item.createdAt).toLocaleTimeString()}</Text>
              </View>
              <Text style={styles.amount}>{formatUsd(item.transaction.amount)}</Text>
              <Text style={styles.reason}>{item.reason}</Text>
            </Pressable>
            <View style={{ flexDirection: "row", gap: space[2], marginTop: space[3] }}>
              <Button
                title="Reject"
                variant="secondary"
                onPress={() => decide(item.transaction.id, "reject")}
                loading={busyId === item.transaction.id}
                style={{ flex: 1 }}
              />
              <Button
                title="Approve"
                onPress={() => decide(item.transaction.id, "approve")}
                loading={busyId === item.transaction.id}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <Card>
            <Text style={{ fontFamily: fonts.body, color: colors.neutral700 }}>Nothing needs your review right now.</Text>
          </Card>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { fontFamily: fonts.body, fontSize: 11, color: colors.neutral700 },
  amount: { fontFamily: fonts.heading, fontSize: 20, color: colors.text, marginTop: 8 },
  reason: { fontFamily: fonts.body, fontSize: 12.5, color: colors.neutral700, marginTop: 3 },
});
