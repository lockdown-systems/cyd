import {
  useCallback,
  useMemo,
  useState,
  type ComponentProps,
  type ComponentType,
} from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAccounts } from "@/hooks/use-accounts";
import { DashboardTab } from "./tabs/dashboard-tab";
import { SaveTab } from "./tabs/save-tab";
import { DeleteTab } from "./tabs/delete-tab";
import { BrowseTab } from "./tabs/browse-tab";
import type { AccountTabKey, AccountTabProps } from "./tabs/types";

export default function AccountPlaceholderScreen() {
  const params = useLocalSearchParams<{ accountId: string | string[] }>();
  const accountId = Array.isArray(params.accountId)
    ? params.accountId[0]
    : params.accountId;
  const colorScheme = useColorScheme() ?? "light";
  const palette = Colors[colorScheme];
  const { accounts, loading, error } = useAccounts();
  const account = useMemo(
    () => accounts.find((item) => item.uuid === accountId),
    [accounts, accountId],
  );
  const [activeTab, setActiveTab] = useState<AccountTabKey>("dashboard");
  const insets = useSafeAreaInsets();
  const handleSelectTab = useCallback((tab: AccountTabKey) => {
    setActiveTab(tab);
  }, []);

  const avatarUri = account?.avatarDataURI ?? null;
  const username = account?.handle
    ? account.handle.startsWith("@")
      ? account.handle
      : `@${account.handle}`
    : null;
  const displayName = account?.displayName ?? username ?? "Unknown";
  const initial = displayName.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  const accountStatus = error
    ? "Unable to load account"
    : loading
      ? "Loading account…"
      : account
        ? null
        : "Account not found";
  const canonicalHandle = username ?? account?.handle ?? accountId ?? "unknown";
  const ActiveTabComponent = TAB_COMPONENTS[activeTab];

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.text,
          headerShadowVisible: false,
          headerBackTitle: "Back",
          headerTitle: () => (
            <View style={styles.headerTitle}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={[
                    styles.avatar,
                    {
                      borderColor: palette.icon + "33",
                      backgroundColor: palette.icon + "20",
                    },
                  ]}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View
                  style={[
                    styles.avatarFallback,
                    {
                      borderColor: palette.icon + "33",
                      backgroundColor: palette.icon + "20",
                    },
                  ]}
                >
                  <Text style={[styles.avatarInitial, { color: palette.text }]}>
                    {initial}
                  </Text>
                </View>
              )}
              <View style={styles.headerTextStack}>
                <Text
                  style={[styles.accountName, { color: palette.text }]}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                <Text
                  style={[styles.accountUsername, { color: palette.icon }]}
                  numberOfLines={1}
                >
                  {username ?? ""}
                </Text>
              </View>
            </View>
          ),
        }}
      />
      <View style={styles.container}>
        <View style={styles.contentArea}>
          {accountStatus ? (
            <View style={styles.statusContainer}>
              <Text style={[styles.subtitle, { color: palette.icon }]}>
                {accountStatus}
              </Text>
            </View>
          ) : (
            <ActiveTabComponent
              handle={canonicalHandle}
              palette={palette}
              onSelectTab={handleSelectTab}
            />
          )}
        </View>
        <View
          style={[styles.tabBarContainer, { paddingBottom: insets.bottom }]}
        >
          <View
            style={[
              styles.tabBar,
              {
                borderColor: palette.icon + "22",
                backgroundColor: palette.card,
              },
            ]}
          >
            {TAB_CONFIG.map((tab) => {
              const selected = tab.key === activeTab;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => handleSelectTab(tab.key)}
                  style={[
                    styles.tabButton,
                    selected && { backgroundColor: palette.icon + "11" },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <MaterialIcons
                    name={tab.icon}
                    size={20}
                    color={selected ? palette.tint : palette.icon}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: selected ? palette.tint : palette.icon },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

type TabConfig = {
  key: AccountTabKey;
  label: string;
  icon: ComponentProps<typeof MaterialIcons>["name"];
};

const TAB_CONFIG: TabConfig[] = [
  { key: "dashboard", label: "Dashboard", icon: "home" },
  { key: "save", label: "Save", icon: "download" },
  { key: "delete", label: "Delete", icon: "local-fire-department" },
  { key: "browse", label: "Browse", icon: "preview" },
];

const TAB_COMPONENTS: Record<AccountTabKey, ComponentType<AccountTabProps>> = {
  dashboard: DashboardTab,
  save: SaveTab,
  delete: DeleteTab,
  browse: BrowseTab,
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 0,
    gap: 4,
  },
  contentArea: {
    flex: 1,
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    maxWidth: 260,
  },
  headerTextStack: {
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: "700",
  },
  accountName: {
    fontSize: 16,
    fontWeight: "700",
  },
  accountUsername: {
    fontSize: 14,
    opacity: 0.9,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  statusContainer: {
    flex: 1,
    justifyContent: "center",
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
  },
  tabBarContainer: {
    paddingTop: 8,
    paddingBottom: 0,
    marginTop: "auto",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 4,
    borderRadius: 16,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
});
