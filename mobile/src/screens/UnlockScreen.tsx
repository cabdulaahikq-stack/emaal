import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth, ApiError } from "../auth/AuthContext";
import { PinPad } from "../components/PinPad";
import { colors, fonts, space } from "../theme/tokens";

export function UnlockScreen() {
  const { unlock, user, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handlePin(pin: string) {
    setBusy(true);
    setError(null);
    try {
      await unlock(pin);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{user?.fullName?.[0]?.toUpperCase() ?? "?"}</Text>
      </View>
      <Text style={styles.title}>Emaal</Text>
      <Text style={styles.subtitle}>{user ? `Welcome back, ${user.fullName.split(" ")[0]}` : "Enter your PIN"}</Text>

      <View style={{ marginTop: space[8] }}>
        <PinPad onComplete={handlePin} error={busy ? null : error} dark />
      </View>

      <Text style={styles.forgot} onPress={logout}>
        Not you? Sign out
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.accent900, alignItems: "center", paddingTop: 96 },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: colors.accent700,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space[4],
  },
  badgeText: { fontFamily: fonts.heading, fontSize: 22, color: colors.neutral100 },
  title: { fontFamily: fonts.heading, fontSize: 34, color: colors.neutral100 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.accent300, marginTop: space[2] },
  forgot: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.neutral100, marginTop: space[8], textDecorationLine: "underline" },
});
