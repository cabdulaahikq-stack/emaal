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
import { MarketplaceHomeScreen } from "./screens/customer/MarketplaceHomeScreen";
import { ProductDetailScreen as CustomerProductDetailScreen } from "./screens/customer/ProductDetailScreen";
import { MyOrdersScreen } from "./screens/customer/MyOrdersScreen";
import { PaymentRequestsScreen } from "./screens/customer/PaymentRequestsScreen";
import { CreatePaymentRequestScreen } from "./screens/customer/CreatePaymentRequestScreen";
import { PaymentRequestDetailScreen } from "./screens/customer/PaymentRequestDetailScreen";

import { AdminHomeScreen } from "./screens/admin/AdminHomeScreen";
import { WalletsListScreen } from "./screens/admin/WalletsListScreen";
import { WalletDetailScreen } from "./screens/admin/WalletDetailScreen";
import { ApprovalsScreen } from "./screens/admin/ApprovalsScreen";
import { TransactionDetailScreen as AdminTransactionDetailScreen } from "./screens/admin/TransactionDetailScreen";
import { PartnersListScreen } from "./screens/admin/PartnersListScreen";
import { PartnerDetailScreen } from "./screens/admin/PartnerDetailScreen";
import { ApiDocsScreen } from "./screens/admin/ApiDocsScreen";

import { MerchantHomeScreen } from "./screens/merchant/MerchantHomeScreen";
import { ProductsListScreen } from "./screens/merchant/ProductsListScreen";
import { CreateProductScreen } from "./screens/merchant/CreateProductScreen";
import { ProductDetailScreen as MerchantProductDetailScreen } from "./screens/merchant/ProductDetailScreen";
import { POSScreen } from "./screens/merchant/POSScreen";
import { OrdersPendingScreen } from "./screens/merchant/OrdersPendingScreen";
import { CashRegisterScreen } from "./screens/merchant/CashRegisterScreen";
import { StaffListScreen } from "./screens/merchant/StaffListScreen";
import { CreateStaffScreen } from "./screens/merchant/CreateStaffScreen";
import { StaffDetailScreen } from "./screens/merchant/StaffDetailScreen";
import { WarehousesScreen } from "./screens/merchant/WarehousesScreen";

import { IconBook, IconHome, IconKey, IconPlus, IconShield, IconWallet } from "./components/icons";

const CUSTOMER_TABS: TabDef[] = [
  { key: "wallet", label: "Wallet", icon: (a) => <IconWallet color={a ? colors.accent700 : colors.neutral600} />, rootRoute: "WalletHome" },
  { key: "shop", label: "Shop", icon: (a) => <IconBook color={a ? colors.accent700 : colors.neutral600} />, rootRoute: "MarketplaceHome" },
];

const CUSTOMER_SCREENS = {
  WalletHome: WalletHomeScreen,
  Deposit: DepositScreen,
  Withdraw: WithdrawScreen,
  Transfer: TransferScreen,
  TransactionDetail: CustomerTransactionDetailScreen,
  MarketplaceHome: MarketplaceHomeScreen,
  ProductDetail: CustomerProductDetailScreen,
  MyOrders: MyOrdersScreen,
  PaymentRequests: PaymentRequestsScreen,
  CreatePaymentRequest: CreatePaymentRequestScreen,
  PaymentRequestDetail: PaymentRequestDetailScreen,
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

const MERCHANT_SCREENS = {
  MerchantHome: MerchantHomeScreen,
  ProductsList: ProductsListScreen,
  CreateProduct: CreateProductScreen,
  ProductDetail: MerchantProductDetailScreen,
  POS: POSScreen,
  OrdersPending: OrdersPendingScreen,
  CashRegister: CashRegisterScreen,
  StaffList: StaffListScreen,
  CreateStaff: CreateStaffScreen,
  StaffDetail: StaffDetailScreen,
  Warehouses: WarehousesScreen,
};

// A staff member gets the same tabs minus Staff management, which stays
// MERCHANT-only both here and on the backend (requireRole("MERCHANT")).
const MERCHANT_TABS: TabDef[] = [
  { key: "home", label: "Home", icon: (a) => <IconHome color={a ? colors.accent700 : colors.neutral600} />, rootRoute: "MerchantHome" },
  { key: "products", label: "Products", icon: (a) => <IconBook color={a ? colors.accent700 : colors.neutral600} />, rootRoute: "ProductsList" },
  { key: "sell", label: "Sell", icon: (a) => <IconPlus color={a ? colors.accent700 : colors.neutral600} />, rootRoute: "POS" },
  { key: "orders", label: "Orders", icon: (a) => <IconShield color={a ? colors.accent700 : colors.neutral600} />, rootRoute: "OrdersPending" },
  { key: "register", label: "Register", icon: (a) => <IconWallet color={a ? colors.accent700 : colors.neutral600} />, rootRoute: "CashRegister" },
  { key: "staff", label: "Staff", icon: (a) => <IconKey color={a ? colors.accent700 : colors.neutral600} />, rootRoute: "StaffList" },
];

const STAFF_TABS: TabDef[] = MERCHANT_TABS.filter((t) => t.key !== "staff");

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
  if (user?.role === "MERCHANT") {
    return <TabStackNav tabs={MERCHANT_TABS} screens={MERCHANT_SCREENS} />;
  }
  if (user?.role === "STAFF") {
    return <TabStackNav tabs={STAFF_TABS} screens={MERCHANT_SCREENS} />;
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
