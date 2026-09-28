import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { updateStaff } from "../../api/merchant";
import type { StaffMember, StaffStatus } from "../../api/types";
import { ApiError } from "../../auth/AuthContext";
import type { Route } from "../../nav/TabStackNav";
import { useStackNav, BackButton } from "../../nav/TabStackNav";
import { Button, Field, Input, Screen, ScreenTitle } from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme/tokens";

const PERMISSIONS: Array<{ key: "canTakeOrders" | "canSell" | "canCollectCash" | "canPayoutCash" | "canIntakeStock"; label: string }> = [
  { key: "canSell", label: "Sell at the register (POS)" },
  { key: "canTakeOrders", label: "Accept/reject wholesale orders" },
  { key: "canCollectCash", label: "View the cash register" },
  { key: "canPayoutCash", label: "Pay out cash" },
  { key: "canIntakeStock", label: "Record stock intake" },
];

const STATUSES: StaffStatus[] = ["ACTIVE", "ON_LEAVE", "SUSPENDED"];

export function StaffDetailScreen({ route }: { route: Route }) {
  const initial = route.params?.staff as StaffMember;
  const nav = useStackNav();
  const [jobTitle, setJobTitle] = useState(initial.jobTitle);
  const [status, setStatus] = useState<StaffStatus>(initial.status);
  const [perms, setPerms] = useState({
    canTakeOrders: initial.canTakeOrders,
    canSell: initial.canSell,
    canCollectCash: initial.canCollectCash,
    canPayoutCash: initial.canPayoutCash,
    canIntakeStock: initial.canIntakeStock,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updateStaff(initial.id, { jobTitle: jobTitle.trim(), status, ...perms });
      Alert.alert("Saved", "Staff account updated.");
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
        <ScreenTitle title={initial.user?.fullName ?? "Staff"} subtitle={initial.user?.phone} />

        <Field label="Job title">
          <Input value={jobTitle} onChangeText={setJobTitle} />
        </Field>

        <Field label="Status">
          <View style={{ flexDirection: "row", gap: space[2] }}>
            {STATUSES.map((s) => (
              <Text key={s} onPress={() => setStatus(s)} style={[styles.chip, status === s && styles.chipActive]}>
                {s.replace("_", " ")}
              </Text>
            ))}
          </View>
        </Field>

        <Text style={styles.sectionTitle}>Permissions</Text>
        {PERMISSIONS.map((p) => (
          <View key={p.key} style={styles.permRow}>
            <Text style={styles.permLabel}>{p.label}</Text>
            <Switch
              value={perms[p.key]}
              onValueChange={(v) => setPerms((cur) => ({ ...cur, [p.key]: v }))}
              trackColor={{ true: colors.accent, false: colors.neutral400 }}
            />
          </View>
        ))}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button title="Save changes" onPress={save} loading={busy} block style={{ marginTop: space[6], marginBottom: space[8] }} />
      </Screen>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.text,
    backgroundColor: colors.neutral200,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  chipActive: { backgroundColor: colors.accent, color: colors.white },
  sectionTitle: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.neutral700, marginTop: space[4], marginBottom: space[2] },
  permRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(32,30,29,0.08)",
  },
  permLabel: { fontFamily: fonts.body, fontSize: 13.5, color: colors.text, flex: 1, marginRight: space[3] },
  errorText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.danger, marginTop: space[2] },
});
