export interface User {
  userID: string;
  url: string;
  name: string;
  profilePictureFilename: string;
}

export interface Media {
  mediaType: string;
  mediaID: string;
  filename?: string;
  isPlayable?: boolean;
  accessibilityCaption?: string;
  title?: string;
  url?: string;
  needsVideoDownload?: boolean;
}

export interface AttachedStory {
  storyID: string;
  text: string;
  media: Media[];
}

export interface Share {
  description?: string;
  title?: string;
  url?: string;
  media: Media;
}

export interface Story {
    storyID: string;
    url: string;
    createdAt: string;
    text?: string;
    title?: string;
    lifeEventTitle?: string;
    user: User;
    attachedStory?: AttachedStory;
    media: Media[];
    // shares: Share[];

  addedToDatabaseAt: string;
  archivedAt: string | null;
  deletedStoryAt: string | null;
}

export interface FacebookArchive {
  appVersion: string;
  username: string;
  createdAt: string;
  stories: Story[];
}
