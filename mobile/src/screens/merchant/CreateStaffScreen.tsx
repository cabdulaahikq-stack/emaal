import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { createStaff } from "../../api/merchant";
import { ApiError } from "../../auth/AuthContext";
import { useStackNav, BackButton } from "../../nav/TabStackNav";
import { Button, Field, Input, Screen, ScreenTitle } from "../../components/ui";
import { colors, fonts, space } from "../../theme/tokens";

const PERMISSIONS: Array<{ key: "canTakeOrders" | "canSell" | "canCollectCash" | "canPayoutCash" | "canIntakeStock"; label: string }> = [
  { key: "canSell", label: "Sell at the register (POS)" },
  { key: "canTakeOrders", label: "Accept/reject wholesale orders" },
  { key: "canCollectCash", label: "View the cash register" },
  { key: "canPayoutCash", label: "Pay out cash" },
  { key: "canIntakeStock", label: "Record stock intake" },
];

export function CreateStaffScreen() {
  const nav = useStackNav();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = fullName.trim().length > 1 && phone.length >= 9 && jobTitle.trim().length > 1;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await createStaff({ fullName: fullName.trim(), phone: phone.trim(), jobTitle: jobTitle.trim(), ...perms });
      Alert.alert(
        "Staff account created",
        `Share these login details with ${fullName.trim()} — they won't be shown again:\n\nPhone: ${res.credentials.phone}\nPassword: ${res.credentials.password}\nPIN: ${res.credentials.pin}`,
      );
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
        <ScreenTitle title="Add staff" subtitle="They'll get their own login — never a shared PIN" />

        <Field label="Full name">
          <Input value={fullName} onChangeText={setFullName} placeholder="Staff member's name" />
        </Field>
        <Field label="Phone number">
          <Input value={phone} onChangeText={setPhone} placeholder="+252 6XX XXX XXX" keyboardType="phone-pad" autoCapitalize="none" />
        </Field>
        <Field label="Job title">
          <Input value={jobTitle} onChangeText={setJobTitle} placeholder="Cashier" />
        </Field>

        <Text style={styles.sectionTitle}>Permissions</Text>
        {PERMISSIONS.map((p) => (
          <View key={p.key} style={styles.permRow}>
            <Text style={styles.permLabel}>{p.label}</Text>
            <Switch value={!!perms[p.key]} onValueChange={(v) => setPerms((cur) => ({ ...cur, [p.key]: v }))} trackColor={{ true: colors.accent, false: colors.neutral400 }} />
          </View>
        ))}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button title="Create staff account" onPress={submit} loading={busy} disabled={!canSubmit} block style={{ marginTop: space[6], marginBottom: space[8] }} />
      </Screen>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
