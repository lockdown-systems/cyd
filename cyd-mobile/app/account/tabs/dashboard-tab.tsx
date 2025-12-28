import type { AccountTabProps } from "./types";
import { TabPlaceholder } from "./tab-placeholder";

export function DashboardTab({ handle, palette }: AccountTabProps) {
  return (
    <TabPlaceholder
      palette={palette}
      message={`Dashboard coming soon for ${handle}.`}
    />
  );
}
