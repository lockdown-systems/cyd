import type { AccountTabProps } from "./types";
import { TabPlaceholder } from "./tab-placeholder";

export function SaveTab({ handle, palette }: AccountTabProps) {
  return (
    <TabPlaceholder
      palette={palette}
      message={`Save coming soon for ${handle}.`}
    />
  );
}
