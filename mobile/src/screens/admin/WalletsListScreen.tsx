import React, { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { searchWallets } from "../../api/admin";
import type { Wallet } from "../../api/types";
import { useStackNav } from "../../nav/TabStackNav";
import { Card, Input, Screen, ScreenTitle, Tag } from "../../components/ui";
import { colors, fonts, space } from "../../theme/tokens";
import { formatUsd } from "../../util/format";

export function WalletsListScreen() {
  const nav = useStackNav();
  const [query, setQuery] = useState("");
  const [wallets, setWallets] = useState<Wallet[]>([]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      searchWallets(query).then((res) => setWallets(res.wallets));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <Screen>
      <ScreenTitle eyebrow="Admin" title="Wallets" />
      <Input value={query} onChangeText={setQuery} placeholder="Search by name or phone" style={{ marginBottom: space[4] }} />
      <FlatList
        data={wallets}
        keyExtractor={(w) => w.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => nav.push("WalletDetail", { id: item.id })}>
            <Card style={{ marginBottom: space[2], flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.holderName}</Text>
                <Text style={styles.phone}>{item.holderPhone}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.balance}>{formatUsd(item.balance)}</Text>
                {item.holderStatus === "SUSPENDED" ? <Tag label="Suspended" tone="danger" /> : null}
              </View>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.text },
  phone: { fontFamily: fonts.body, fontSize: 12, color: colors.neutral700, marginTop: 2 },
  balance: { fontFamily: fonts.heading, fontSize: 16, color: colors.text },
});
