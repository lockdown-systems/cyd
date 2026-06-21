import type { FacebookAccount } from "../../../../shared_types";

// The account boolean settings that enable deleting each data category.
export type FacebookDeleteSetting =
  | "deleteWallPosts"
  | "deleteComments"
  | "deleteReactions"
  | "deletePostsOnOthers"
  | "deleteOthersPosts"
  | "deleteCheckins"
  | "deleteTaggedPosts"
  | "deleteTaggedMedia";

// The numeric FacebookProgress fields, one per category.
export type FacebookDeleteCounter =
  | "wallPostsDeleted"
  | "commentsDeleted"
  | "reactionsDeleted"
  | "postsOnOthersDeleted"
  | "othersPostsDeleted"
  | "checkinsDeleted"
  | "taggedPostsDeleted"
  | "taggedMediaDeleted";

export type FacebookDeleteCategory = {
  // The FacebookAccount boolean field that enables deleting this category.
  setting: FacebookDeleteSetting & keyof FacebookAccount;
  // The category_key URL parameter for the Facebook activity log.
  categoryKey: string;
  // The FacebookProgress counter incremented as items in this category are deleted.
  counter: FacebookDeleteCounter;
  // The i18n key for the checkbox label shown on the delete options page.
  labelKey: string;
};

// Data categories the user can choose to delete.
// The deleteActivity job, defineJobs(), and the delete options UI all derive from this.
export const FACEBOOK_DELETE_CATEGORIES: FacebookDeleteCategory[] = [
  {
    setting: "deleteWallPosts",
    categoryKey: "MANAGEPOSTSPHOTOSANDVIDEOS",
    counter: "wallPostsDeleted",
    labelKey: "facebook.deleteOptions.deleteWallPosts",
  },
  {
    setting: "deleteComments",
    categoryKey: "COMMENTSCLUSTER",
    counter: "commentsDeleted",
    labelKey: "facebook.deleteOptions.deleteComments",
  },
  {
    setting: "deleteReactions",
    categoryKey: "LIKEDPOSTS",
    counter: "reactionsDeleted",
    labelKey: "facebook.deleteOptions.deleteReactions",
  },
  {
    setting: "deletePostsOnOthers",
    categoryKey: "POSTSONOTHERSTIMELINES",
    counter: "postsOnOthersDeleted",
    labelKey: "facebook.deleteOptions.deletePostsOnOthers",
  },
  {
    setting: "deleteOthersPosts",
    categoryKey: "WALLCLUSTER",
    counter: "othersPostsDeleted",
    labelKey: "facebook.deleteOptions.deleteOthersPosts",
  },
  {
    setting: "deleteCheckins",
    categoryKey: "CHECKINS",
    counter: "checkinsDeleted",
    labelKey: "facebook.deleteOptions.deleteCheckins",
  },
  {
    setting: "deleteTaggedPosts",
    categoryKey: "MANAGETAGSBYOTHERSCLUSTER",
    counter: "taggedPostsDeleted",
    labelKey: "facebook.deleteOptions.deleteTaggedPosts",
  },
  {
    setting: "deleteTaggedMedia",
    categoryKey: "TAGGEDPHOTOS",
    counter: "taggedMediaDeleted",
    labelKey: "facebook.deleteOptions.deleteTaggedMedia",
  },
];

// Returns the categories the user has enabled for deletion on this account.
export function selectedDeleteCategories(
  account: FacebookAccount,
): FacebookDeleteCategory[] {
  return FACEBOOK_DELETE_CATEGORIES.filter((category) =>
    Boolean(account[category.setting]),
  );
}
