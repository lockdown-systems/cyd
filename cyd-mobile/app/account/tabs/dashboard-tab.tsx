import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";

import iconArchive from "@/assets/images/icon-archive.png";
import iconDatabase from "@/assets/images/icon-database.png";
import iconDelete from "@/assets/images/icon-delete.png";
import { SpeechBubble } from "@/components/cyd/SpeechBubble";
import type { AccountTabKey, AccountTabProps } from "./types";

type DashboardCard = {
  key: AccountTabKey;
  title: string;
  description: (handle: string) => string;
  icon: ImageSourcePropType;
};

const CARDS: DashboardCard[] = [
  {
    key: "save",
    title: "Save My Data",
    description: (handle) =>
      "Make or update your local backup. You must do this before you delete anything.",
    icon: iconDatabase,
  },
  {
    key: "delete",
    title: "Delete My Data",
    description: (handle) =>
      "Delete your posts, reposts, likes, and/or chat messages. If you want, delete your bookmarks and unfollow everyone.",
    icon: iconDelete,
  },
  {
    key: "browse",
    title: "Browse Archive",
    description: (handle) => "Browse your local backup of Bluesky data.",
    icon: iconArchive,
  },
];

export function DashboardTab({
  handle,
  palette,
  onSelectTab,
}: AccountTabProps) {
  return (
    <>
      <SpeechBubble message="It's _you're_ data. What do you want to do with it?" />
      <ScrollView
        contentContainerStyle={[styles.grid, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {CARDS.map((card) => (
          <Pressable
            key={card.key}
            onPress={() => onSelectTab?.(card.key)}
            style={({ pressed }) => [
              styles.card,
              {
                borderColor: palette.icon + "22",
                backgroundColor: palette.card,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <Image source={card.icon} style={styles.icon} />
            <View style={styles.textStack}>
              <Text style={[styles.title, { color: palette.text }]}>
                {card.title}
              </Text>
              <Text style={[styles.description, { color: palette.icon }]}>
                {card.description(handle)}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexGrow: 1,
    gap: 8,
  },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  icon: {
    width: 64,
    height: 64,
  },
  textStack: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "left",
  },
  description: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: "left",
  },
});
