import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { PinPad } from "./PinPad";
import { colors, fonts, space } from "../theme/tokens";

/** A full-screen PIN step-up, shown right before any money-moving call — mirrors the design's "Confirm → PIN" pattern. */
export function PinStepUpSheet({
  visible,
  title,
  subtitle,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  busy: boolean;
  error: string | null;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
}) {
  const [key, setKey] = useState(0);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={{ marginTop: space[6] }}>
            <PinPad
              key={key}
              onComplete={(pin) => {
                onSubmit(pin);
                setKey((k) => k + 1);
              }}
              error={busy ? null : error}
            />
          </View>

          <Pressable onPress={onCancel} style={styles.cancel} disabled={busy}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(20,77,66,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.neutral100, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: space[6], paddingBottom: space[8] },
  title: { fontFamily: fonts.heading, fontSize: 20, color: colors.text, textAlign: "center" },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.neutral700, textAlign: "center", marginTop: 4 },
  cancel: { marginTop: space[4], alignSelf: "center" },
  cancelText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.neutral700 },
});
