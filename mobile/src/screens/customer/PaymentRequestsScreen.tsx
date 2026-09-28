import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { listIncomingPaymentRequests, listOutstandingPaymentRequests } from "../../api/marketplace";
import type { PaymentRequest } from "../../api/types";
import { useStackNav, BackButton } from "../../nav/TabStackNav";
import { Button, Card, Screen, ScreenTitle, Tag } from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme/tokens";
import { formatUsd } from "../../util/format";

type Tab = "outgoing" | "incoming";

const STATUS_TONE: Record<string, "accent" | "accent2" | "neutral" | "danger"> = {
  PENDING: "accent",
  PAID: "accent2",
  CANCELLED: "danger",
};

export function PaymentRequestsScreen() {
  const nav = useStackNav();
  const [tab, setTab] = useState<Tab>("incoming");
  const [outgoing, setOutgoing] = useState<PaymentRequest[]>([]);
  const [incoming, setIncoming] = useState<PaymentRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [out, inc] = await Promise.all([listOutstandingPaymentRequests(), listIncomingPaymentRequests()]);
    setOutgoing(out.requests);
    setIncoming(inc.requests);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const data = tab === "outgoing" ? outgoing : incoming;

  return (
    <Screen>
      <BackButton />
      <ScreenTitle title="Payment requests" subtitle="Ask someone to pay you, or pay a request sent to you" />
      <Button title="Request payment" onPress={() => nav.push("CreatePaymentRequest")} block style={{ marginBottom: space[4] }} />

      <View style={styles.segment}>
        <SegmentButton label="Incoming" active={tab === "incoming"} onPress={() => setTab("incoming")} />
        <SegmentButton label="Outgoing" active={tab === "outgoing"} onPress={() => setTab("outgoing")} />
      </View>

      <FlatList
        data={data}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: space[2] }} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => nav.push("PaymentRequestDetail", { id: item.id })}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.amount}>{formatUsd(item.amount)}</Text>
                <Tag label={item.status} tone={STATUS_TONE[item.status] ?? "neutral"} />
              </View>
              <Text style={styles.meta}>{tab === "incoming" ? `From ${item.requesterName ?? item.requesterPhone}` : `To ${item.payerPhone}`}</Text>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          <Card>
            <Text style={{ fontFamily: fonts.body, color: colors.neutral700 }}>Nothing here.</Text>
          </Card>
        }
      />
    </Screen>
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
  segment: { flexDirection: "row", backgroundColor: colors.neutral200, borderRadius: radius.pill, padding: 4, marginBottom: space[4] },
  segmentBtn: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: radius.pill },
  segmentBtnActive: { backgroundColor: colors.accent },
  segmentText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.neutral700 },
  segmentTextActive: { color: colors.white },
  amount: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.neutral700, marginTop: 4 },
});
