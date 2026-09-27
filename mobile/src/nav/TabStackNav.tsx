import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, space } from "../theme/tokens";

export interface Route {
  name: string;
  params?: Record<string, unknown>;
}

interface StackApi {
  push: (name: string, params?: Record<string, unknown>) => void;
  pop: () => void;
  current: Route;
  canGoBack: boolean;
}

const StackContext = createContext<StackApi | null>(null);

export function useStackNav(): StackApi {
  const ctx = useContext(StackContext);
  if (!ctx) throw new Error("useStackNav must be used within a TabStackNav");
  return ctx;
}

export interface TabDef {
  key: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  /** The route this tab resets to when tapped (also the root, un-poppable screen). */
  rootRoute: string;
}

/**
 * A minimal hand-rolled tab + single shared stack navigator. Avoids pulling
 * in React Navigation / expo-router (both move fast across Expo SDKs) for an
 * app this size. One push/pop stack is shared across every tab — tapping a
 * tab resets the stack to that tab's root — which is how the original
 * prototype's bottom nav + drill-in screens actually behave.
 */
export function TabStackNav({ tabs, screens }: { tabs: TabDef[]; screens: Record<string, React.ComponentType<{ route: Route }>> }) {
  const [activeTab, setActiveTab] = useState(tabs[0]!.key);
  const [stack, setStack] = useState<Route[]>([{ name: tabs[0]!.rootRoute }]);

  const current = stack[stack.length - 1]!;

  const push = useCallback((name: string, params?: Record<string, unknown>) => {
    setStack((prev) => [...prev, { name, params }]);
  }, []);
  const pop = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  function selectTab(tab: TabDef) {
    setActiveTab(tab.key);
    setStack([{ name: tab.rootRoute }]);
  }

  const api = useMemo<StackApi>(() => ({ push, pop, current, canGoBack: stack.length > 1 }), [push, pop, current, stack.length]);

  const Screen = screens[current.name];
  if (!Screen) throw new Error(`No screen registered for route "${current.name}"`);

  return (
    <View style={{ flex: 1 }}>
      <StackContext.Provider value={api}>
        <View style={{ flex: 1 }}>
          <Screen route={current} />
        </View>
      </StackContext.Provider>

      {tabs.length > 1 && (
        <View style={styles.tabBar}>
          {tabs.map((t) => {
            const active = t.key === activeTab;
            return (
              <Pressable
                key={t.key}
                onPress={() => selectTab(t)}
                style={styles.tabItem}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                {t.icon(active)}
                <Text style={[styles.tabLabel, active && { color: colors.accent700, fontFamily: fonts.bodyBold }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function BackButton() {
  const { pop, canGoBack } = useStackNav();
  if (!canGoBack) return null;
  return (
    <Pressable onPress={pop} style={styles.backBtn} hitSlop={12}>
      <Text style={styles.backBtnText}>‹ Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.neutral300,
    backgroundColor: colors.neutral100,
    paddingBottom: space[2],
    paddingTop: space[2],
  },
  tabItem: { flex: 1, alignItems: "center", gap: 2 },
  tabLabel: { fontFamily: fonts.body, fontSize: 10.5, color: colors.neutral700, marginTop: 2 },
  backBtn: { paddingVertical: space[2] },
  backBtnText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.accent700 },
});
