import type { AccountTabProps } from "./types";
import { TabPlaceholder } from "./tab-placeholder";

export function BrowseTab({ handle, palette }: AccountTabProps) {
  return (
    <TabPlaceholder
      palette={palette}
      message={`Browse coming soon for ${handle}.`}
    />
  );
}
