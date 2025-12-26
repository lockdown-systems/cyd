import { useCallback, useMemo } from "react";
import {
  FlatList,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import WordmarkDark from "@/assets/images/cyd-wordmark-dark.svg";
import WordmarkLight from "@/assets/images/cyd-wordmark.svg";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

const CYD_DESKTOP_URL = "https://cyd.social/";

type Account = {
  id: string;
  platform: "bluesky" | string;
  name: string;
  username: string;
  avatarDataURI: string;
};

// Placeholder data for layout purposes. Replace with real account data later.
const placeholderAccounts: Account[] = [
  {
    id: "acc-demo-1",
    platform: "bluesky",
    name: "Nexamind",
    username: "nexamind-cyd.bsky.social",
    avatarDataURI:
      "base64:iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAAB8ESQZAAAAKUlEQVR4nO3MMQ0AIAgDQf//M2kYCRwYkpwN1F3T0zrg0g7T7NNsMIYQwkMAkf0Aw5TzfIMAAAAASUVORK5CYII=",
  },
  {
    id: "acc-demo-2",
    platform: "bluesky",
    name: "Cyd Support",
    username: "support-cyd.bsky.social",
    avatarDataURI:
      "base64:iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAAB8ESQZAAAAL0lEQVR4nO3MMQ0AAAgDINc/9MYalKTBciyc2VXb3SJJkiRJkiRJkiQ5ZD4COr0F6jU8TDgAAAAASUVORK5CYII=",
  },
];

export default function AccountSelectionScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const palette = Colors[colorScheme];
  const Wordmark = colorScheme === "dark" ? WordmarkDark : WordmarkLight;

  const accounts = placeholderAccounts; // TODO: source real accounts

  const handleAddAccount = useCallback(() => {
    // TODO: navigate to the account onboarding flow.
    console.log("Add account pressed");
  }, []);

  const handleSelectAccount = useCallback((account: Account) => {
    // TODO: replace with navigation when the detail view exists.
    console.log("Selected account", account.id);
  }, []);

  const handleOpenDesktop = useCallback(() => {
    Linking.openURL(CYD_DESKTOP_URL).catch((err) =>
      console.warn("Unable to open URL", err),
    );
  }, []);

  const renderAccount = useCallback(
    ({ item }: { item: Account }) => (
      <AccountCard
        account={item}
        palette={palette}
        onSelect={handleSelectAccount}
      />
    ),
    [palette, handleSelectAccount],
  );

  const listEmpty = useMemo(
    () => (
      <Text style={[styles.emptyStateText, { color: palette.icon }]}>
        No accounts yet. Add your first one.
      </Text>
    ),
    [palette.icon],
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: palette.background }]}
    >
      <View style={styles.container}>
        <View style={styles.mainContent}>
          <View style={styles.wordmarkWrapper}>
            <Wordmark
              width="100%"
              height={72}
              preserveAspectRatio="xMidYMid meet"
            />
          </View>

          <FlatList
            data={accounts}
            keyExtractor={(item) => item.id}
            renderItem={renderAccount}
            ListEmptyComponent={listEmpty}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={
              accounts.length === 0 ? styles.emptyListContainer : undefined
            }
          />

          <Pressable
            onPress={handleAddAccount}
            style={({ pressed }) => [
              styles.addAccountButton,
              {
                backgroundColor: palette.button.background,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            android_ripple={{ color: palette.button.ripple }}
          >
            <Text
              style={[
                styles.addAccountButtonText,
                { color: palette.button.text },
              ]}
            >
              Add Account
            </Text>
          </Pressable>
        </View>

        <Text
          style={[styles.footerText, { color: palette.icon }]}
          accessibilityRole="text"
        >
          Want to claw back your data from X (formerly Twitter) and Facebook?
          Use the{" "}
          <Text
            style={[styles.footerLink, { color: palette.tint }]}
            onPress={handleOpenDesktop}
          >
            Cyd desktop app
          </Text>{" "}
          on a computer.
        </Text>
      </View>
    </SafeAreaView>
  );
}

type AccountCardProps = {
  account: Account;
  palette: typeof Colors.light;
  onSelect: (account: Account) => void;
};

function AccountCard({ account, palette, onSelect }: AccountCardProps) {
  const avatarUri = account.avatarDataURI.startsWith("base64:")
    ? `data:image/png;base64,${account.avatarDataURI.slice(7)}`
    : account.avatarDataURI;

  return (
    <Pressable
      onPress={() => onSelect(account)}
      style={({ pressed }) => [
        styles.accountCard,
        {
          borderColor: palette.icon + "22",
          backgroundColor: palette.card,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <Image
        source={{ uri: avatarUri }}
        style={[
          styles.avatar,
          {
            borderColor: palette.icon + "33",
            backgroundColor: palette.icon + "33",
          },
        ]}
        accessibilityIgnoresInvertColors
      />
      <View style={styles.accountTextStack}>
        <Text
          style={[styles.accountName, { color: palette.text }]}
          numberOfLines={1}
        >
          {account.name}
        </Text>
        <Text
          style={[styles.accountUsername, { color: palette.icon }]}
          numberOfLines={1}
        >
          @{account.username}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    gap: 16,
  },
  mainContent: {
    flex: 1,
    gap: 20,
  },
  wordmarkWrapper: {
    alignItems: "flex-start",
  },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    gap: 16,
  },
  accountTextStack: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  accountUsername: {
    fontSize: 14,
    opacity: 0.9,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  addAccountButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  addAccountButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  footerText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  footerLink: {
    fontWeight: "600",
  },
  emptyStateText: {
    textAlign: "center",
    fontSize: 14,
    paddingVertical: 24,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
});
