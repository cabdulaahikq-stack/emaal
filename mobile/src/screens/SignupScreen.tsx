import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { useAuth, ApiError } from "../auth/AuthContext";
import { Button, Field, Input, Screen, ScreenTitle } from "../components/ui";
import { colors, fonts, space } from "../theme/tokens";

export function SignupScreen({ onGoLogin }: { onGoLogin: () => void }) {
  const { signup } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
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
      await signup({ fullName: fullName.trim(), phone: phone.trim(), password, pin });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = fullName.trim().length > 1 && phone.length >= 9 && password.length >= 8 && pin.length === 4 && pin2.length === 4;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Screen>
          <ScreenTitle eyebrow="Emaal" title="Create your wallet" subtitle="Your phone number becomes your wallet number" />

          <Field label="Full name">
            <Input value={fullName} onChangeText={setFullName} placeholder="Amina Ali" />
          </Field>
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

          <Button title="Create wallet" onPress={submit} loading={busy} disabled={!canSubmit} block />

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
