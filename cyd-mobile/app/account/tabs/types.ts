import { Colors } from "@/constants/theme";

export type AccountTabPalette = typeof Colors.light;

export type AccountTabKey = "dashboard" | "save" | "delete" | "browse";

export type AccountTabProps = {
  handle: string;
  palette: AccountTabPalette;
  onSelectTab?: (tab: AccountTabKey) => void;
};
