import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text } from "react-native";
import { getApiDocsMarkdown } from "../../api/admin";
import { Screen, ScreenTitle } from "../../components/ui";
import { colors, fonts, space } from "../../theme/tokens";

export function ApiDocsScreen() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    getApiDocsMarkdown().then(setText);
  }, []);

  return (
    <Screen>
      <ScreenTitle eyebrow="Admin" title="API docs" subtitle="What third-party developers see" />
      {text === null ? (
        <ActivityIndicator />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.doc}>{text}</Text>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  doc: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.text },
});
