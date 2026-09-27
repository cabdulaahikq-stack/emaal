import React from "react";
import { Text, View } from "react-native";
import { BackButton } from "../../nav/TabStackNav";
import { Button, Field, Input, Screen, ScreenTitle } from "../../components/ui";
import { PinStepUpSheet } from "../../components/PinStepUpSheet";
import { colors, fonts, space } from "../../theme/tokens";

interface MoneyActionState {
  sheetVisible: boolean;
  busy: boolean;
  error: string | null;
  cancel: () => void;
  submit: (pin: string) => void;
}

export function AmountEntryScreen({
  title,
  subtitle,
  ctaLabel,
  amount,
  onAmountChange,
  onContinue,
  sheetTitle,
  sheetSubtitle,
  action,
  children,
  extraDisabled,
}: {
  title: string;
  subtitle: string;
  ctaLabel: string;
  amount: string;
  onAmountChange: (v: string) => void;
  onContinue: () => void;
  sheetTitle: string;
  sheetSubtitle: string;
  action: MoneyActionState;
  children?: React.ReactNode;
  extraDisabled?: boolean;
}) {
  const numeric = Number(amount);
  const canContinue = amount.length > 0 && Number.isFinite(numeric) && numeric > 0 && !extraDisabled;

  return (
    <Screen>
      <BackButton />
      <ScreenTitle title={title} subtitle={subtitle} />

      {children}

      <Field label="Amount (USD)">
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: 20, color: colors.text, marginRight: space[2] }}>$</Text>
          <Input
            value={amount}
            onChangeText={(t) => onAmountChange(t.replace(/[^0-9.]/g, ""))}
            placeholder="0.00"
            keyboardType="decimal-pad"
            style={{ flex: 1 }}
          />
        </View>
      </Field>

      <Button title={ctaLabel} onPress={onContinue} disabled={!canContinue} block />

      <PinStepUpSheet
        visible={action.sheetVisible}
        title={sheetTitle}
        subtitle={sheetSubtitle}
        busy={action.busy}
        error={action.error}
        onSubmit={action.submit}
        onCancel={action.cancel}
      />
    </Screen>
  );
}
