import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { getApprovals, getDashboard } from "../../api/admin";
import type { ApprovalRequest, DashboardSummary } from "../../api/types";
import { useStackNav } from "../../nav/TabStackNav";
import { Card, Tag } from "../../components/ui";
import { IconLogOut } from "../../components/icons";
import { colors, fonts, radius, space } from "../../theme/tokens";
import { formatUsd } from "../../util/format";

export function AdminHomeScreen() {
  const { user, logout } = useAuth();
  const nav = useStackNav();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [dash, app] = await Promise.all([getDashboard(), getApprovals("PENDING")]);
    setSummary(dash);
    setApprovals(app.approvals.slice(0, 3));
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
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space[4], paddingTop: space[8], paddingBottom: space[8] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>Emaal support console</Text>
          <Text style={styles.name}>Morning, {user?.fullName?.split(" ")[0]}</Text>
        </View>
        <Pressable onPress={logout} style={styles.logoutBtn}>
          <IconLogOut color={colors.accent800} />
        </Pressable>
      </View>

      <View style={styles.floatCard}>
        <Text style={styles.floatLabel}>Total float held</Text>
        <Text style={styles.floatValue}>{summary ? formatUsd(summary.totalFloat) : "—"}</Text>
        <View style={{ flexDirection: "row", gap: space[6], marginTop: space[4] }}>
          <Stat label="Available" value={summary ? formatUsd(summary.availableFloat) : "—"} />
          <Stat label="On hold" value={summary ? formatUsd(summary.heldFloat) : "—"} accent />
        </View>
      </View>

      <View style={styles.tileRow}>
        <Tile label="Volume 24h" value={summary ? formatUsd(summary.volume24h) : "—"} />
        <Pressable style={{ flex: 1 }} onPress={() => nav.push("Approvals")}>
          <Tile label="Pending" value={summary ? String(summary.pendingApprovals) : "—"} />
        </Pressable>
        <Tile label="Failed" value={summary ? String(summary.failedTransactions) : "—"} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Needs you</Text>
        <Text style={styles.sectionLink} onPress={() => nav.push("Approvals")}>
          See all
        </Text>
      </View>
      {approvals.length === 0 ? (
        <Card>
          <Text style={{ fontFamily: fonts.body, color: colors.neutral700 }}>Nothing waiting on you right now.</Text>
        </Card>
      ) : (
        approvals.map((a) => (
          <Pressable key={a.id} onPress={() => nav.push("Approvals")}>
            <Card style={{ marginBottom: space[2] }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Tag label={a.transaction.type} tone="accent" />
                <Text style={styles.metaText}>{new Date(a.createdAt).toLocaleTimeString()}</Text>
              </View>
              <Text style={styles.approvalTitle}>{formatUsd(a.transaction.amount)}</Text>
              <Text style={styles.approvalReason}>{a.reason}</Text>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && { color: colors.accent300 }]}>{value}</Text>
    </View>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  eyebrow: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: colors.neutral700 },
  name: { fontFamily: fonts.heading, fontSize: 22, color: colors.text, marginTop: 4 },
  logoutBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.accent200, alignItems: "center", justifyContent: "center" },

  floatCard: { marginTop: space[4], padding: space[6], borderRadius: 32, backgroundColor: colors.accent900 },
  floatLabel: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.accent300 },
  floatValue: { fontFamily: fonts.heading, fontSize: 34, color: colors.neutral100, marginTop: 6 },
  statLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.accent300, opacity: 0.8 },
  statValue: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.neutral100, marginTop: 2 },

  tileRow: { flexDirection: "row", gap: space[2], marginTop: space[4] },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: 22, padding: space[3] },
  tileLabel: { fontFamily: fonts.body, fontSize: 9.5, letterSpacing: 0.5, textTransform: "uppercase", color: colors.neutral700 },
  tileValue: { fontFamily: fonts.heading, fontSize: 18, marginTop: 4, color: colors.text },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: space[6], marginBottom: space[2] },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  sectionLink: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accent700 },
  metaText: { fontFamily: fonts.body, fontSize: 11, color: colors.neutral700 },
  approvalTitle: { fontFamily: fonts.heading, fontSize: 17, marginTop: 8, color: colors.text },
  approvalReason: { fontFamily: fonts.body, fontSize: 12.5, color: colors.neutral700, marginTop: 3 },
});
