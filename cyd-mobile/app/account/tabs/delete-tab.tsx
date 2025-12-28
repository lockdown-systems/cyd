import type { AccountTabProps } from "./types";
import { TabPlaceholder } from "./tab-placeholder";

export function DeleteTab({ handle, palette }: AccountTabProps) {
  return (
    <TabPlaceholder
      palette={palette}
      message={`Delete coming soon for ${handle}.`}
    />
  );
}
