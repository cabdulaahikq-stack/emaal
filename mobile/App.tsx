import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native";
import RootApp from "./src/RootApp";
import { colors } from "./src/theme/tokens";

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <RootApp />
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}
