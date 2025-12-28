import { StyleSheet, Text, View } from "react-native";

import type { AccountTabProps } from "./types";

type TabPlaceholderProps = Pick<AccountTabProps, "palette"> & {
  message: string;
};

export function TabPlaceholder({ palette, message }: TabPlaceholderProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: palette.icon }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
});
