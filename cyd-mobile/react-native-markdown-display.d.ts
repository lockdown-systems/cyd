declare module "react-native-markdown-display" {
  import type { ComponentType, ReactNode } from "react";
  import type { StyleProp, TextProps, TextStyle } from "react-native";

  type MarkdownStyle = Record<string, StyleProp<TextStyle>> & {
    body?: StyleProp<TextStyle>;
    paragraph?: StyleProp<TextStyle>;
    strong?: StyleProp<TextStyle>;
    em?: StyleProp<TextStyle>;
    link?: StyleProp<TextStyle>;
  };

  export type MarkdownProps = TextProps & {
    children: string | ReactNode;
    style?: MarkdownStyle;
  };

  const MarkdownDisplay: ComponentType<MarkdownProps>;
  export default MarkdownDisplay;
}
