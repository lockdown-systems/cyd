import { useMemo } from "react";
import { Image, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAccounts } from "@/hooks/use-accounts";

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

  return (
    <SafeAreaView
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
        {accountStatus ? (
          <Text style={[styles.subtitle, { color: palette.icon }]}>
            {accountStatus}
          </Text>
        ) : (
          <Text style={[styles.subtitle, { color: palette.icon }]}>
            Placeholder for account {account?.handle ?? accountId ?? "unknown"}.
            Additional panels will live here soon.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 24,
    gap: 16,
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
});
