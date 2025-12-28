import { Colors } from "@/constants/theme";

export type AccountTabPalette = typeof Colors.light;

export type AccountTabProps = {
  handle: string;
  palette: AccountTabPalette;
};
