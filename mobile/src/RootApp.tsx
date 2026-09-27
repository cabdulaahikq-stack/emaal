import React, { useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { useFonts as useCaprasimo, Caprasimo_400Regular } from "@expo-google-fonts/caprasimo";
import { useFonts as useFigtree, Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold } from "@expo-google-fonts/figtree";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LoginScreen } from "./screens/LoginScreen";
import { SignupScreen } from "./screens/SignupScreen";
import { UnlockScreen } from "./screens/UnlockScreen";
import { TabStackNav, type TabDef } from "./nav/TabStackNav";
import { colors } from "./theme/tokens";

import { WalletHomeScreen } from "./screens/customer/WalletHomeScreen";
import { DepositScreen } from "./screens/customer/DepositScreen";
import { WithdrawScreen } from "./screens/customer/WithdrawScreen";
import { TransferScreen } from "./screens/customer/TransferScreen";
import { TransactionDetailScreen as CustomerTransactionDetailScreen } from "./screens/customer/TransactionDetailScreen";

import { AdminHomeScreen } from "./screens/admin/AdminHomeScreen";
import { WalletsListScreen } from "./screens/admin/WalletsListScreen";
import { WalletDetailScreen } from "./screens/admin/WalletDetailScreen";
import { ApprovalsScreen } from "./screens/admin/ApprovalsScreen";
import { TransactionDetailScreen as AdminTransactionDetailScreen } from "./screens/admin/TransactionDetailScreen";
import { PartnersListScreen } from "./screens/admin/PartnersListScreen";
import { PartnerDetailScreen } from "./screens/admin/PartnerDetailScreen";
import { ApiDocsScreen } from "./screens/admin/ApiDocsScreen";
import { IconBook, IconHome, IconKey, IconShield, IconWallet } from "./components/icons";

const CUSTOMER_TABS: TabDef[] = [{ key: "wallet", label: "Wallet", icon: (a) => <IconWallet color={a ? colors.accent700 : colors.neutral600} />, rootRoute: "WalletHome" }];

const CUSTOMER_SCREENS = {
  WalletHome: WalletHomeScreen,
  Deposit: DepositScreen,
  Withdraw: WithdrawScreen,
  Transfer: TransferScreen,
  TransactionDetail: CustomerTransactionDetailScreen,
};

const ADMIN_TABS: TabDef[] = [
  { key: "home", label: "Home", icon: (a) => <IconHome color={a ? colors.accent700 : colors.neutral600} />, rootRoute: "AdminHome" },
  { key: "wallets", label: "Wallets", icon: (a) => <IconWallet color={a ? colors.accent700 : colors.neutral600} />, rootRoute: "WalletsList" },
  { key: "approvals", label: "Approvals", icon: (a) => <IconShield color={a ? colors.accent700 : colors.neutral600} />, rootRoute: "Approvals" },
  { key: "partners", label: "API", icon: (a) => <IconKey color={a ? colors.accent700 : colors.neutral600} />, rootRoute: "PartnersList" },
  { key: "docs", label: "Docs", icon: (a) => <IconBook color={a ? colors.accent700 : colors.neutral600} />, rootRoute: "ApiDocs" },
];

const ADMIN_SCREENS = {
  AdminHome: AdminHomeScreen,
  WalletsList: WalletsListScreen,
  WalletDetail: WalletDetailScreen,
  Approvals: ApprovalsScreen,
  TransactionDetail: AdminTransactionDetailScreen,
  PartnersList: PartnersListScreen,
  PartnerDetail: PartnerDetailScreen,
  ApiDocs: ApiDocsScreen,
};

function Gate() {
  const { status, user } = useAuth();
  const [authScreen, setAuthScreen] = useState<"login" | "signup">("login");

  if (status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent700} />
      </View>
    );
  }

  if (status === "signedOut") {
    return authScreen === "login" ? (
      <LoginScreen onGoSignup={() => setAuthScreen("signup")} />
    ) : (
      <SignupScreen onGoLogin={() => setAuthScreen("login")} />
    );
  }

  if (status === "locked") {
    return <UnlockScreen />;
  }

  if (user?.role === "ADMIN") {
    return <TabStackNav tabs={ADMIN_TABS} screens={ADMIN_SCREENS} />;
  }
  return <TabStackNav tabs={CUSTOMER_TABS} screens={CUSTOMER_SCREENS} />;
}

export default function RootApp() {
  const [caprasimoLoaded] = useCaprasimo({ Caprasimo_400Regular });
  const [figtreeLoaded] = useFigtree({ Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold });

  // On web, don't block the initial render on the custom webfont download —
  // render immediately with the system-font fallback and let the custom
  // fonts swap in via CSS once they arrive, same as any other web page.
  if (Platform.OS !== "web" && (!caprasimoLoaded || !figtreeLoaded)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent700} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
