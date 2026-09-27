import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { useAuth, ApiError } from "../auth/AuthContext";
import { Button, Field, Input, Screen, ScreenTitle } from "../components/ui";
import { colors, fonts, space } from "../theme/tokens";

export function LoginScreen({ onGoSignup }: { onGoSignup: () => void }) {
  const { login } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await login(phone.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Screen>
          <ScreenTitle eyebrow="Emaal" title="Log in" subtitle="Wallet management, made simple" />

          <Field label="Phone number">
            <Input value={phone} onChangeText={setPhone} placeholder="+252 6XX XXX XXX" keyboardType="phone-pad" autoCapitalize="none" />
          </Field>
          <Field label="Password" error={error}>
            <Input value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry autoCapitalize="none" />
          </Field>

          <Button title="Log in" onPress={submit} loading={busy} disabled={!phone || !password} block />

          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.neutral700, marginTop: space[6], textAlign: "center" }}>
            New to Emaal?{" "}
            <Text onPress={onGoSignup} style={{ color: colors.accent700, fontFamily: fonts.bodyBold }}>
              Create an account
            </Text>
          </Text>
        </Screen>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
