import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { colors, fonts, radius, shadow, space } from "../theme/tokens";

// --- Button ---------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost";

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  block,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  block?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btnBase,
        variant === "primary" && styles.btnPrimary,
        variant === "secondary" && styles.btnSecondary,
        variant === "ghost" && styles.btnGhost,
        block && { alignSelf: "stretch" },
        pressed && !disabled && { opacity: 0.85 },
        (disabled || loading) && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.white : colors.accent700} />
      ) : (
        <Text style={[styles.btnText, variant === "primary" ? { color: colors.white } : { color: colors.accent700 }]}>{title}</Text>
      )}
    </Pressable>
  );
}

// --- Card -------------------------------------------------------------------

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle | (ViewStyle | false | null | undefined)[] }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// --- Tag --------------------------------------------------------------------

type TagTone = "accent" | "accent2" | "neutral" | "danger";

export function Tag({ label, tone = "neutral" }: { label: string; tone?: TagTone }) {
  return (
    <View style={[styles.tag, tagToneStyle[tone]]}>
      <Text style={[styles.tagText, tagTextToneStyle[tone]]}>{label}</Text>
    </View>
  );
}

const tagToneStyle: Record<TagTone, ViewStyle> = {
  accent: { backgroundColor: colors.accent100 },
  accent2: { backgroundColor: colors.accent2_100 },
  neutral: { backgroundColor: colors.neutral200 },
  danger: { backgroundColor: colors.dangerBg },
};
const tagTextToneStyle: Record<TagTone, { color: string }> = {
  accent: { color: colors.accent700 },
  accent2: { color: colors.accent2_700 },
  neutral: { color: colors.neutral700 },
  danger: { color: colors.danger },
};

// --- Field / Input ------------------------------------------------------------

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: space[4] }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.neutral500} {...props} style={[styles.input, props.style]} />;
}

// --- Screen scaffolding -------------------------------------------------------

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function ScreenTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: space[4] }}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btnBase: {
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: space[6],
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: colors.accent, ...shadow.sm },
  btnSecondary: { backgroundColor: colors.accent100 },
  btnGhost: { backgroundColor: "transparent" },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 15 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space[4],
  },

  tag: { alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill },
  tagText: { fontFamily: fonts.bodyMedium, fontSize: 11.5 },

  fieldLabel: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.neutral700, marginBottom: 6 },
  fieldError: { fontFamily: fonts.body, fontSize: 12, color: colors.danger, marginTop: 4 },
  input: {
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral300,
    paddingVertical: 12,
    paddingHorizontal: space[4],
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },

  screen: { flex: 1, backgroundColor: colors.bg, padding: space[4], paddingTop: space[8] },
  eyebrow: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: colors.neutral700 },
  title: { fontFamily: fonts.heading, fontSize: 26, color: colors.text, marginTop: 6 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.neutral700, marginTop: 4, fontStyle: "italic" },
});
