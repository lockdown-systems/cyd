/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

const tintColorLight = "#123857";
const tintColorDark = "#9dd5ff";

export const Colors = {
  light: {
    text: "#0b1626",
    background: "#ccdaeeff",
    tint: tintColorLight,
    icon: "#4a5463",
    tabIconDefault: "#4a5463",
    tabIconSelected: tintColorLight,
    card: "#dee5f1",
    button: {
      background: "#1c283c",
      text: "#f4f7fb",
      ripple: "rgba(255, 255, 255, 0.2)",
    },
  },
  dark: {
    text: "#f4f5f7",
    background: "#3a414b",
    tint: tintColorDark,
    icon: "#b7bfc9",
    tabIconDefault: "#b7bfc9",
    tabIconSelected: tintColorDark,
    card: "#2c333d",
    button: {
      background: "#f2f5fb",
      text: "#0f1724",
      ripple: "rgba(0, 0, 0, 0.15)",
    },
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
});
