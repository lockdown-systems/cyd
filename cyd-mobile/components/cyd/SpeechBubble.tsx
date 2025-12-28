import { Dimensions, StyleSheet, View } from "react-native";
import { useMemo } from "react";
import Markdown from "react-native-markdown-display";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { CydAvatar } from "./CydAvatar";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const TARGET_HEIGHT = Math.min(SCREEN_HEIGHT / 3, 260);
const AVATAR_HEIGHT = Math.max(110, TARGET_HEIGHT * 0.65);
const BUBBLE_MIN_HEIGHT = Math.max(100, TARGET_HEIGHT * 0.5);

type SpeechBubbleProps = {
  message: string;
};

export function SpeechBubble({ message }: SpeechBubbleProps) {
  const colorScheme = useColorScheme() ?? "light";
  const palette = Colors[colorScheme];
  const bubbleBackground = colorScheme === "dark" ? "#202020ff" : "#f3f3f3";
  const bubbleBorder = colorScheme === "dark" ? "#404040" : "#e0e0e0";
  const markdownStyles = useMemo(
    () => ({
      body: {
        fontSize: 18,
        lineHeight: 24,
        color: palette.text,
      },
      paragraph: {
        marginBottom: 8,
      },
      strong: {
        fontWeight: "700",
      },
      em: {
        fontStyle: "italic",
      },
      link: {
        color: palette.tint,
      },
    }),
    [palette.text, palette.tint],
  );

  return (
    <View
      style={[styles.wrapper, { minHeight: BUBBLE_MIN_HEIGHT }]}
      accessibilityRole="text"
    >
      <CydAvatar height={AVATAR_HEIGHT} style={styles.avatar} />
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: bubbleBackground,
            borderColor: bubbleBorder,
            minHeight: BUBBLE_MIN_HEIGHT,
          },
        ]}
      >
        <Markdown style={markdownStyles as any}>{message}</Markdown>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 0,
    paddingVertical: 0,
    marginBottom: 12,
    marginLeft: 0,
  },
  avatar: {
    flexShrink: 0,
    marginLeft: -30,
    marginRight: -5,
  },
  bubble: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopRightRadius: 32,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    borderTopLeftRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
});

export default SpeechBubble;
