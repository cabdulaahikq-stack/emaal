import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  createApiKey,
  getPartnerDetail,
  revokeApiKey,
  setPartnerStatus,
  topupSettlement,
} from "../../api/admin";
import type { ApiKeySummary, ApiPartner, Wallet } from "../../api/types";
import type { Route } from "../../nav/TabStackNav";
import { BackButton } from "../../nav/TabStackNav";
import { ApiError } from "../../auth/AuthContext";
import { Button, Card, Field, Input, Screen, Tag } from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme/tokens";
import { formatUsd } from "../../util/format";

const ALL_SCOPES = ["balance:read", "transaction:read", "transfer:write"] as const;

type PartnerDetail = ApiPartner & { apiKeys: ApiKeySummary[] };

export function PartnerDetailScreen({ route }: { route: Route }) {
  const id = route.params?.id as string;
  const [partner, setPartner] = useState<PartnerDetail | null>(null);
  const [settlementWallet, setSettlementWallet] = useState<Wallet | null>(null);
  const [requestLogs, setRequestLogs] = useState<Array<{ id: string; method: string; path: string; statusCode: number; createdAt: string }>>([]);
  const [newKeyPlaintext, setNewKeyPlaintext] = useState<string | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["balance:read"]);
  const [topupAmount, setTopupAmount] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    getPartnerDetail(id).then((res) => {
      setPartner(res.partner);
      setSettlementWallet(res.settlementWallet);
      setRequestLogs(res.requestLogs);
    });
  }
  useEffect(load, [id]);

  async function changeStatus(status: "ACTIVE" | "SUSPENDED" | "REVOKED") {
    setBusy(true);
    try {
      await setPartnerStatus(id, status);
      load();
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function submitTopup() {
    setBusy(true);
    try {
      await topupSettlement(id, Number(topupAmount));
      setTopupAmount("");
      load();
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function submitCreateKey() {
    setBusy(true);
    try {
      const res = await createApiKey(id, selectedScopes);
      setNewKeyPlaintext(res.apiKey.plaintext);
      load();
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function doRevoke(keyId: string) {
    setBusy(true);
    try {
      await revokeApiKey(id, keyId);
      load();
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!partner || !settlementWallet) {
    return (
      <Screen>
        <BackButton />
        <ActivityIndicator style={{ marginTop: space[8] }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <BackButton />
        <Text style={styles.name}>{partner.name}</Text>
        <Tag label={partner.status} tone={partner.status === "ACTIVE" ? "accent2" : "danger"} />

        <View style={{ flexDirection: "row", gap: space[2], marginTop: space[4] }}>
          {partner.status !== "ACTIVE" && <Button title="Activate" onPress={() => changeStatus("ACTIVE")} loading={busy} style={{ flex: 1 }} />}
          {partner.status !== "SUSPENDED" && (
            <Button title="Suspend" variant="secondary" onPress={() => changeStatus("SUSPENDED")} loading={busy} style={{ flex: 1 }} />
          )}
          {partner.status !== "REVOKED" && (
            <Button title="Revoke" variant="secondary" onPress={() => changeStatus("REVOKED")} loading={busy} style={{ flex: 1 }} />
          )}
        </View>

        <Text style={styles.sectionTitle}>Settlement balance</Text>
        <Card>
          <Text style={styles.settlementValue}>{formatUsd(settlementWallet.balance)}</Text>
          <Text style={styles.settlementNote}>Payouts to customers draw down this balance — fund it below.</Text>
          <View style={{ flexDirection: "row", gap: space[2], marginTop: space[3] }}>
            <Input
              value={topupAmount}
              onChangeText={(t) => setTopupAmount(t.replace(/[^0-9.]/g, ""))}
              placeholder="Amount USD"
              keyboardType="decimal-pad"
              style={{ flex: 1 }}
            />
            <Button title="Fund" onPress={submitTopup} loading={busy} disabled={!topupAmount} />
          </View>
        </Card>

        <Text style={styles.sectionTitle}>API keys</Text>
        {newKeyPlaintext ? (
          <Card style={{ marginBottom: space[2], backgroundColor: colors.accent100 }}>
            <Text style={styles.newKeyLabel}>New key — shown once, copy it now</Text>
            <Text selectable style={styles.newKeyValue}>
              {newKeyPlaintext}
            </Text>
            <Button title="Done" variant="ghost" onPress={() => setNewKeyPlaintext(null)} />
          </Card>
        ) : null}
        {partner.apiKeys.map((k) => (
          <Card key={k.id} style={{ marginBottom: space[2] }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={styles.keyPrefix}>emaal_live_{k.keyPrefix}…</Text>
              {k.revokedAt ? <Tag label="Revoked" tone="danger" /> : <Tag label="Active" tone="accent2" />}
            </View>
            <Text style={styles.keyScopes}>{k.scopes.join(", ")}</Text>
            {!k.revokedAt && <Button title="Revoke" variant="ghost" onPress={() => doRevoke(k.id)} />}
          </Card>
        ))}

        <Card>
          <Text style={styles.newKeyLabel}>Issue a new key</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[2] }}>
            {ALL_SCOPES.map((scope) => {
              const active = selectedScopes.includes(scope);
              return (
                <Pressable
                  key={scope}
                  onPress={() => setSelectedScopes((prev) => (active ? prev.filter((s) => s !== scope) : [...prev, scope]))}
                  style={[styles.scopeChip, active && { backgroundColor: colors.accent }]}
                >
                  <Text style={[styles.scopeChipText, active && { color: colors.white }]}>{scope}</Text>
                </Pressable>
              );
            })}
          </View>
          <Button title="Create key" onPress={submitCreateKey} loading={busy} disabled={selectedScopes.length === 0} style={{ marginTop: space[3] }} />
        </Card>

        <Text style={styles.sectionTitle}>Recent requests</Text>
        {requestLogs.length === 0 ? (
          <Text style={{ fontFamily: fonts.body, color: colors.neutral700 }}>No API calls yet.</Text>
        ) : (
          requestLogs.map((log) => (
            <View key={log.id} style={styles.logRow}>
              <Text style={styles.logMethod}>{log.method}</Text>
              <Text style={styles.logPath} numberOfLines={1}>
                {log.path}
              </Text>
              <Tag label={String(log.statusCode)} tone={log.statusCode < 400 ? "accent2" : "danger"} />
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.heading, fontSize: 24, color: colors.text, marginTop: space[2] },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 17, color: colors.text, marginTop: space[6], marginBottom: space[2] },
  settlementValue: { fontFamily: fonts.heading, fontSize: 28, color: colors.text },
  settlementNote: { fontFamily: fonts.body, fontSize: 12, color: colors.neutral700, marginTop: 4 },
  newKeyLabel: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.accent800 },
  newKeyValue: { fontFamily: fonts.body, fontSize: 12, color: colors.accent900, marginTop: 6, marginBottom: 8 },
  keyPrefix: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  keyScopes: { fontFamily: fonts.body, fontSize: 11.5, color: colors.neutral700, marginTop: 4, marginBottom: 4 },
  scopeChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.neutral200 },
  scopeChipText: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.neutral800 },
  logRow: { flexDirection: "row", alignItems: "center", gap: space[2], paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(32,30,29,0.08)" },
  logMethod: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.accent700, width: 44 },
  logPath: { fontFamily: fonts.body, fontSize: 12, color: colors.text, flex: 1 },
});
