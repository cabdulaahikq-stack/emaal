import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth, ApiError } from "../auth/AuthContext";
import { Button, Field, Input, Screen, ScreenTitle } from "../components/ui";
import { colors, fonts, radius, space } from "../theme/tokens";

type AccountKind = "customer" | "merchant";

export function SignupScreen({ onGoLogin }: { onGoLogin: () => void }) {
  const { signup, merchantSignup } = useAuth();
  const [kind, setKind] = useState<AccountKind>("customer");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pinsMismatch = pin.length === 4 && pin2.length === 4 && pin !== pin2;

  async function submit() {
    if (pin !== pin2) {
      setError("PINs don't match");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (kind === "merchant") {
        await merchantSignup({ fullName: fullName.trim(), phone: phone.trim(), password, pin, shopName: shopName.trim() });
      } else {
        await signup({ fullName: fullName.trim(), phone: phone.trim(), password, pin });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    fullName.trim().length > 1 &&
    phone.length >= 9 &&
    password.length >= 8 &&
    pin.length === 4 &&
    pin2.length === 4 &&
    (kind === "customer" || shopName.trim().length > 1);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Screen>
          <ScreenTitle
            eyebrow="Emaal"
            title={kind === "merchant" ? "Open your shop" : "Create your wallet"}
            subtitle="Your phone number becomes your wallet number"
          />

          <View style={styles.segment}>
            <SegmentButton label="Customer" active={kind === "customer"} onPress={() => setKind("customer")} />
            <SegmentButton label="Merchant" active={kind === "merchant"} onPress={() => setKind("merchant")} />
          </View>

          <Field label="Full name">
            <Input value={fullName} onChangeText={setFullName} placeholder="Amina Ali" />
          </Field>
          {kind === "merchant" ? (
            <Field label="Shop name">
              <Input value={shopName} onChangeText={setShopName} placeholder="Amina's Shoes" />
            </Field>
          ) : null}
          <Field label="Phone number">
            <Input value={phone} onChangeText={setPhone} placeholder="+252 6XX XXX XXX" keyboardType="phone-pad" autoCapitalize="none" />
          </Field>
          <Field label="Password">
            <Input value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoCapitalize="none" />
          </Field>
          <Field label="Set a 4-digit PIN">
            <Input value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, "").slice(0, 4))} placeholder="••••" keyboardType="number-pad" secureTextEntry />
          </Field>
          <Field label="Confirm PIN" error={pinsMismatch ? "PINs don't match" : error}>
            <Input value={pin2} onChangeText={(t) => setPin2(t.replace(/\D/g, "").slice(0, 4))} placeholder="••••" keyboardType="number-pad" secureTextEntry />
          </Field>

          <Button title={kind === "merchant" ? "Open shop" : "Create wallet"} onPress={submit} loading={busy} disabled={!canSubmit} block />

          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.neutral700, marginTop: space[6], textAlign: "center" }}>
            Already have an account?{" "}
            <Text onPress={onGoLogin} style={{ color: colors.accent700, fontFamily: fonts.bodyBold }}>
              Log in
            </Text>
          </Text>
        </Screen>
      </ScrollView>
    </KeyboardAvoidingView>
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
});
