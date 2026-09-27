import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, space } from "../theme/tokens";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export function PinPad({
  onComplete,
  error,
  dark = false,
}: {
  onComplete: (pin: string) => void;
  error?: string | null;
  dark?: boolean;
}) {
  const [digits, setDigits] = useState("");

  function press(key: string) {
    if (key === "") return;
    if (key === "⌫") {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    if (digits.length >= 4) return;
    const next = digits + key;
    setDigits(next);
    if (next.length === 4) {
      onComplete(next);
      setDigits("");
    }
  }

  const dotColor = dark ? colors.neutral100 : colors.text;
  const keyColor = dark ? colors.neutral100 : colors.text;

  return (
    <View>
      <View style={styles.dots}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.dot, { borderColor: dotColor }, i < digits.length && { backgroundColor: dotColor }]} />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.grid}>
        {KEYS.map((key, i) => (
          <Pressable
            key={i}
            disabled={key === ""}
            onPress={() => press(key)}
            style={({ pressed }) => [styles.key, pressed && key !== "" && { opacity: 0.6 }]}
          >
            <Text style={[styles.keyText, { color: keyColor }]}>{key}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: "row", justifyContent: "center", gap: space[3], marginBottom: space[4] },
  dot: { width: 14, height: 14, borderRadius: radius.pill, borderWidth: 2 },
  error: { textAlign: "center", color: colors.danger, fontFamily: fonts.body, fontSize: 13, marginBottom: space[3] },
  grid: { flexDirection: "row", flexWrap: "wrap", width: 3 * 72, alignSelf: "center" },
  key: { width: 72, height: 64, alignItems: "center", justifyContent: "center" },
  keyText: { fontFamily: fonts.heading, fontSize: 22 },
});
