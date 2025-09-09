import path from "path";
import fs from "fs";
import { URL } from "url";

import fetch from "node-fetch";
import { app, session } from "electron";
import log from "electron-log/main";
import Database from "better-sqlite3";
import unzipper from "unzipper";

import { getResourcesPath, getAccountDataPath } from "../util";
import {
  FacebookAccount,
  FacebookJob,
  FacebookProgress,
  emptyFacebookProgress,
  FacebookDatabaseStats,
  emptyFacebookDatabaseStats,
} from "../shared_types";
import {
  runMigrations,
  Sqlite3Count,
  getAccount,
  exec,
  getConfig,
  setConfig,
} from "../database";
import { IMITMController } from "../mitm";
import {
  FacebookJobRow,
  FacebookStoryRow,
  convertFacebookJobRowToFacebookJob,
  isFBAPIResponseProfileCometManagePosts,
  isFBAPIResponseProfileCometManagePosts2,
  isFBAPIResponseProfileCometManagePostsPageInfo,
  FBNode,
  FBActor,
  FBAttachment,
  FBAttachedStory,
  FBMedia,
} from "./types";

// for building the static archive site
import { saveArchive } from "./archive";

function getURLFileExtension(urlString: string) {
  const url = new URL(urlString);
  return url.pathname.split(".").pop();
}

export class FacebookAccountController {
  private accountUUID: string = "";
  // Making this public so it can be accessed in tests
  public account: FacebookAccount | null = null;
  private accountID: number = 0;
  private accountDataPath: string = "";
  private thereIsMore: boolean = false;

  // Making this public so it can be accessed in tests
  public db: Database.Database | null = null;

  public mitmController: IMITMController;
  private progress: FacebookProgress = emptyFacebookProgress();

  private cookies: Record<string, string> = {};

  constructor(accountID: number, mitmController: IMITMController) {
    this.mitmController = mitmController;

    this.accountID = accountID;
    this.refreshAccount();

    // Monitor web request metadata
    const ses = session.fromPartition(`persist:account-${this.accountID}`);
    ses.webRequest.onCompleted((_details) => {
      // TODO: Monitor for rate limits
    });

    ses.webRequest.onSendHeaders((details) => {
      // Keep track of cookies
      if (
        details.url.startsWith("https://www.facebook.com/") &&
        details.requestHeaders
      ) {
        this.cookies = {};

        const cookieHeader = details.requestHeaders["Cookie"];
        if (cookieHeader) {
          const cookies = cookieHeader.split(";");
          cookies.forEach((cookie) => {
            const parts = cookie.split("=");
            if (parts.length == 2) {
              this.cookies[parts[0].trim()] = parts[1].trim();
            }
          });
        }
      }
    });
  }

  cleanup() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  refreshAccount() {
    // Load the account
    const account = getAccount(this.accountID);
    if (!account) {
      log.error(
        `FacebookAccountController.refreshAccount: account ${this.accountID} not found`,
      );
      return;
    }

    // Make sure it's a Facebook account
    if (account.type != "Facebook") {
      log.error(
        `FacebookAccountController.refreshAccount: account ${this.accountID} is not a Facebook account`,
      );
      return;
    }

    // Get the account UUID
    this.accountUUID = account.uuid;
    log.debug(
      `FacebookAccountController.refreshAccount: accountUUID=${this.accountUUID}`,
    );

    // Load the Facebook account
    this.account = account.facebookAccount;
    if (!this.account) {
      log.error(
        `FacebookAccountController.refreshAccount: xAccount ${this.accountID} not found`,
      );
      return;
    }
  }

  initDB() {
    if (!this.account || !this.account.accountID) {
      log.error(
        "FacebookAccountController: cannot initialize the database because the account is not found, or the account Facebook ID is not found",
        this.account,
        this.account?.accountID,
      );
      return;
    }

    // Make sure the account data folder exists
    this.accountDataPath = getAccountDataPath(
      "Facebook",
      `${this.account.accountID} ${this.account.name}`,
    );
    log.info(
      `FacebookAccountController.initDB: accountDataPath=${this.accountDataPath}`,
    );

    // Open the database
    this.db = new Database(path.join(this.accountDataPath, "data.sqlite3"), {});
    this.db.pragma("journal_mode = WAL");
    runMigrations(this.db, [
      // Create the tables
      {
        name: "initial",
        sql: [
          `CREATE TABLE job (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobType TEXT NOT NULL,
    status TEXT NOT NULL,
    scheduledAt DATETIME NOT NULL,
    startedAt DATETIME,
    finishedAt DATETIME,
    progressJSON TEXT,
    error TEXT
);`,
          `CREATE TABLE config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
);`,
          `CREATE TABLE user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userID TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    name TEXT NOT NULL,
    profilePictureFilename TEXT NOT NULL
);`,
          `CREATE TABLE story (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storyID TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    createdAt DATETIME NOT NULL,
    text TEXT,
    title TEXT,
    lifeEventTitle TEXT,
    userID TEXT NOT NULL, -- Foreign key to user.userID
    attachedStoryID INTEGER, -- Foreign key to attached_story.id
    addedToDatabaseAt DATETIME NOT NULL,
    archivedAt DATETIME,
    deletedStoryAt DATETIME,
    FOREIGN KEY(userID) REFERENCES user(userID),
    FOREIGN KEY(attachedStoryID) REFERENCES attached_story(storyID)
);`,
          `CREATE TABLE attached_story (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storyID TEXT NOT NULL UNIQUE,
    text TEXT
);`,
          `CREATE TABLE media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mediaType TEXT NOT NULL, -- "Photo", "Video", "GenericAttachmentMedia"
    mediaID TEXT NOT NULL UNIQUE,
    filename TEXT,
    isPlayable BOOLEAN,
    accessibilityCaption TEXT,
                        title TEXT,
    url TEXT,
    needsVideoDownload BOOLEAN DEFAULT 0
);`,
          `CREATE TABLE media_story (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storyID TEXT NOT NULL, -- Foreign key to story.storyID
    mediaID TEXT NOT NULL, -- Foreign key to media.mediaID
    FOREIGN KEY(storyID) REFERENCES story(storyID),
    FOREIGN KEY(mediaID) REFERENCES media(mediaID)
);`,
          `CREATE TABLE media_attached_story (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storyID TEXT NOT NULL, -- Foreign key to attached_story.storyID
    mediaID TEXT NOT NULL, -- Foreign key to media.mediaID
    FOREIGN KEY(storyID) REFERENCES attached_story(storyID),
    FOREIGN KEY(mediaID) REFERENCES media(mediaID)
);`,
        ],
      },
    ]);
    log.info("FacebookAccountController.initDB: database initialized");
  }

  resetProgress(): FacebookProgress {
    log.debug("FacebookAccountController.resetProgress");
    this.progress = emptyFacebookProgress();
    return this.progress;
  }

  createJobs(jobTypes: string[]): FacebookJob[] {
    if (!this.db) {
      this.initDB();
    }

    // Cancel pending jobs
    exec(this.db, "UPDATE job SET status = ? WHERE status = ?", [
      "canceled",
      "pending",
    ]);

    // Create new pending jobs
    jobTypes.forEach((jobType) => {
      exec(
        this.db,
        "INSERT INTO job (jobType, status, scheduledAt) VALUES (?, ?, ?)",
        [jobType, "pending", new Date()],
      );
    });

    // Select pending jobs
    const jobs: FacebookJobRow[] = exec(
      this.db,
      "SELECT * FROM job WHERE status = ? ORDER BY id",
      ["pending"],
      "all",
    ) as FacebookJobRow[];
    return jobs.map(convertFacebookJobRowToFacebookJob);
  }

  updateJob(job: FacebookJob) {
    if (!this.db) {
      this.initDB();
    }

    exec(
      this.db,
      "UPDATE job SET status = ?, startedAt = ?, finishedAt = ?, progressJSON = ?, error = ? WHERE id = ?",
      [
        job.status,
        job.startedAt ? job.startedAt : null,
        job.finishedAt ? job.finishedAt : null,
        job.progressJSON,
        job.error,
        job.id,
      ],
    );
  }

  async indexStart() {
    const ses = session.fromPartition(`persist:account-${this.accountID}`);
    await ses.clearCache();
    await this.mitmController.startMonitoring();
    log.info(ses);
    await this.mitmController.startMITM(ses, ["www.facebook.com/api/graphql/"]);
    this.thereIsMore = true;
  }

  async indexStop() {
    await this.mitmController.stopMonitoring();
    const ses = session.fromPartition(`persist:account-${this.accountID}`);
    await this.mitmController.stopMITM(ses);
  }

  async parseNode(data: FBNode) {
    log.debug("FacebookAccountController.parseNode: parsing node");

    if (data.__typename !== "Story") {
      log.info("FacebookAccountController.parseNode: not a story, skipping");
      return;
    }

    // Save the user
    let userID = null;
    if (
      data.comet_sections &&
      data.comet_sections.actor_photo.story.actors.length
    ) {
      userID = await this.saveUser(
        data.comet_sections.actor_photo.story.actors[0],
      );
    }

    // Find lifeEventTitle, for life events (like birthdays)
    let lifeEventTitle = null;
    if (
      data.attachments &&
      data.attachments.length > 0 &&
      data.attachments[0].style_type_renderer.__typename ==
        "StoryAttachmentLifeEventStyleRenderer" &&
      data.attachments[0].style_type_renderer.attachment.style_infos &&
      data.attachments[0].style_type_renderer.attachment.style_infos.length >
        0 &&
      data.attachments[0].style_type_renderer.attachment.style_infos[0]
        .life_event_title
    ) {
      lifeEventTitle =
        data.attachments[0].style_type_renderer.attachment.style_infos[0]
          .life_event_title;
    }

    // See if there's an attached story
    let attachedStoryID = null;
    if (data.attached_story) {
      attachedStoryID = await this.saveAttachedStory(data.attached_story);
    }

    // Check if the story is already in the database
    const existingStory = exec(
      this.db,
      "SELECT * FROM story WHERE storyID = ?",
      [data.id],
      "get",
    ) as FacebookStoryRow;
    if (existingStory) {
      // Update existing story
      exec(
        this.db,
        "UPDATE story SET url = ?, createdAt = ?, text = ?, title = ?, lifeEventTitle = ?, userID = ?, attachedStoryID = ?, addedToDatabaseAt = ? WHERE storyID = ?",
        [
          data.url, // url
          new Date(data.creation_time * 1000), // createdAt
          data.message ? data.message.text : null, // text
          data.title ? data.title.text : null, // title
          lifeEventTitle, // lifeEventTitle
          userID, // userID
          attachedStoryID, // attachedStoryID
          new Date(), // addedToDatabaseAt
          data.id, // storyID
        ],
      );
    } else {
      // Save the story
      exec(
        this.db,
        "INSERT INTO story (storyID, url, createdAt, text, title, lifeEventTitle, userID, attachedStoryID, addedToDatabaseAt, archivedAt, deletedStoryAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          data.id, // storyID
          data.url, // url
          new Date(data.creation_time * 1000), // createdAt
          data.message ? data.message.text : null, // text
          data.title ? data.title.text : null, // title
          lifeEventTitle, // lifeEventTitle
          userID, // userID
          attachedStoryID, // attachedStoryID
          new Date(), // addedToDatabaseAt
          null, // archivedAt
          null, // deletedStoryAt
        ],
      );
    }

    if (data.attachments && data.attachments.length > 0) {
      log.info(
        "FacebookAccountController.parseNode: parsing attachments",
        data.id,
      );
      for (const attachment of data.attachments) {
        await this.parseAttachment(data.id, attachment, "story");
      }
    }

    log.info("FacebookAccountController.parseNode: story saved", data.id);

    // Update progress
    this.progress.storiesSaved++;
  }

  async saveUser(actor: FBActor): Promise<string> {
    const userID = actor.id;
    const url = actor.url;
    const name = actor.name;
    const profilePictureURL = actor.profile_picture.uri;

    // Find the profile picture filename
    const profilePicturesDir = path.join(
      this.accountDataPath,
      "media",
      "profile_pictures",
    );
    if (!fs.existsSync(profilePicturesDir)) {
      fs.mkdirSync(profilePicturesDir, { recursive: true });
    }

    const fileExtension = getURLFileExtension(profilePictureURL);
    const profilePictureFilename = `${userID}.${fileExtension}`;

    const destPath = path.join(profilePicturesDir, profilePictureFilename);

    // Check if the profile picture already exists
    if (fs.existsSync(destPath)) {
      log.info(
        "FacebookAccountController.saveUser: profile picture already exists, skipping download",
      );
    } else {
      // Download the profile picture
      const isMediaSaved = await this.downloadFile(profilePictureURL, destPath);
      if (!isMediaSaved) {
        log.error(
          "FacebookAccountController.saveUser: profile picture could not be saved",
        );
      }
    }

    // Is the user already in the database?
    const existingUser = exec(
      this.db,
      "SELECT * FROM user WHERE userID = ?",
      [userID],
      "get",
    );
    if (existingUser) {
      // Update existing user
      exec(
        this.db,
        "UPDATE user SET url = ?, name = ?, profilePictureFilename = ? WHERE userID = ?",
        [url, name, profilePictureFilename, userID],
      );
    } else {
      // Save the user
      exec(
        this.db,
        "INSERT INTO user (userID, url, name, profilePictureFilename) VALUES (?, ?, ?, ?)",
        [userID, url, name, profilePictureFilename],
      );
    }
    log.info(
      "FacebookAccountController.saveUser: user saved",
      userID,
      url,
      name,
      profilePictureFilename,
    );
    return userID;
  }

  async saveAttachedStory(attachedStory: FBAttachedStory): Promise<string> {
    const storyID = attachedStory.id;
    const text = attachedStory.comet_sections.message
      ? attachedStory.comet_sections.message.text
      : null;

    // Is the attached story already in the database?
    const existingAttachedStory = exec(
      this.db,
      "SELECT * FROM attached_story WHERE storyID = ?",
      [storyID],
      "get",
    );
    if (existingAttachedStory) {
      // Update existing attached story
      exec(this.db, "UPDATE attached_story SET text = ? WHERE storyID = ?", [
        text,
        storyID,
      ]);
    } else {
      // Save the attached story
      exec(
        this.db,
        "INSERT INTO attached_story (storyID, text) VALUES (?, ?)",
        [storyID, text],
      );
    }

    if (attachedStory.attachments && attachedStory.attachments.length > 0) {
      log.info(
        "FacebookAccountController.saveAttachedStory: parsing attachments",
        storyID,
      );
      for (const attachment of attachedStory.attachments) {
        await this.parseAttachment(
          attachedStory.id,
          attachment,
          "attached_story",
        );
      }
    }

    log.info(
      "FacebookAccountController.saveAttachedStory: attached story saved",
      storyID,
    );
    return storyID;
  }

  async saveMedia(
    media: FBMedia,
    title: string | null,
  ): Promise<string | null> {
    console.log("FacebookAccountController.saveMedia: saving media", media);
    const mediaType = media.__typename;
    const mediaID = media.id;

    // It seems that GenericAttachmentMedia media does not have a steady mediaID, so we're skipping it to avoid duplicates
    if (mediaType == "GenericAttachmentMedia") {
      log.info(
        "FacebookAccountController.saveMedia: GenericAttachmentMedia mediaID is not steady, skipping download",
      );
      return null;
    }

    let needsVideoDownload = mediaType == "Video" ? 1 : 0;

    let url: string | null = null;
    if (media.image) {
      url = media.image.uri;
    } else if (media.fallback_image) {
      url = media.fallback_image.uri;
    } else {
      log.info(
        "FacebookAccountController.parseAttachment: no image found, skipping download",
      );
    }

    let filename: string | null = null;
    if (url) {
      if (mediaType == "Video") {
        // Make sure the video directory exists
        const videosDir = path.join(this.accountDataPath, "media", "videos");
        if (!fs.existsSync(videosDir)) {
          fs.mkdirSync(videosDir, { recursive: true });
        }

        // Hardcode the extension to .mp4 for now
        filename = `${mediaID}.mp4`;
        const destPath = path.join(videosDir, filename);

        // Check if the file already exists
        if (fs.existsSync(destPath)) {
          // Video already exists, so we don't need to download it again
          needsVideoDownload = 0;
        }
      } else {
        // Make sure the image directory exists
        const imagesDir = path.join(this.accountDataPath, "media", "images");
        if (!fs.existsSync(imagesDir)) {
          fs.mkdirSync(imagesDir, { recursive: true });
        }

        // Hardcoding the file extension to .jpg for now. I think it's always a JPG, but I'm not certain.
        // Sometimes the URL looks like this:
        // https://external.fsac1-2.fna.fbcdn.net/emg1/v/t13/10657298466976369403?url=https\u00253A\u00252F\u00252Fstardewvalleywiki.com\u00252Fmediawiki\u00252Fimages\u00252Ff\u00252Ff9\u00252FJojamart.png&fb_obo=1&utld=stardewvalleywiki.com&stp=c0.5000x0.5000f_dst-jpg_flffffff_p384x200_q75_tt6&_nc_gid=0je8BtTeEj96z97hRXTD6Q&_nc_oc=AdnmhjTDz-wu6Fq3zC2Wvn39vFOGzSk3uNbhs6_mzu0l5QK4XKStMUQJBhPh1hhtrx0&ccb=13-1&oh=06_Q3-yAY_xNhpdFLFxRDa4hcqW_5t67wYtfQHJzqOiqzuQQEd7&oe=680B7364&_nc_sid=c527b2
        // The querystring shows the original URL is a PNG, but this URL downloads a JPG
        filename = `${mediaID}.jpg`;
        const destPath = path.join(imagesDir, filename);

        // Check if the file already exists
        if (fs.existsSync(destPath)) {
          log.info(
            "FacebookAccountController.saveMedia: image already exists, skipping download",
          );
        } else {
          // Download the image
          const isMediaSaved = await this.downloadFile(url, destPath);
          if (!isMediaSaved) {
            log.error(
              "FacebookAccountController.saveMedia: image could not be saved",
            );
          }
        }
      }
    }

    // Is the media already in the database?
    const existingMedia = exec(
      this.db,
      "SELECT * FROM media WHERE mediaID = ?",
      [mediaID],
      "get",
    );
    if (existingMedia) {
      // Update existing media
      exec(
        this.db,
        "UPDATE media SET mediaType = ?, filename = ?, isPlayable = ?, accessibilityCaption = ?, title = ?, url = ? WHERE mediaID = ?",
        [
          mediaType, // mediaType
          filename, // filename
          media.is_playable ? 1 : 0, // isPlayable
          media.accessibility_caption || null, // accessibilityCaption
          title, // title
          url, // url
          mediaID, // mediaID
        ],
      );
    } else {
      // Save the media
      exec(
        this.db,
        "INSERT INTO media (mediaType, mediaID, filename, isPlayable, accessibilityCaption, title, url, needsVideoDownload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          mediaType, // mediaType
          mediaID, // mediaID
          filename, // filename
          media.is_playable ? 1 : 0, // isPlayable
          media.accessibility_caption || null, // accessibilityCaption
          title, // title
          url, // url
          needsVideoDownload, // needsVideoDownload
        ],
      );
    }

    log.info(
      "FacebookAccountController.saveMedia: media saved",
      mediaID,
      mediaType,
    );
    return mediaID;
  }

  async parseAttachment(
    storyID: string,
    attachment: FBAttachment,
    storyType: "story" | "attached_story",
  ) {
    const type = attachment.style_type_renderer.__typename;

    const saveJoin = async (
      mediaID: string,
      storyType: "story" | "attached_story",
    ) => {
      if (storyType == "story") {
        const existingJoin = exec(
          this.db,
          "SELECT * FROM media_story WHERE storyID = ? AND mediaID = ?",
          [storyID, mediaID],
          "get",
        );
        if (!existingJoin) {
          exec(
            this.db,
            "INSERT INTO media_story (storyID, mediaID) VALUES (?, ?)",
            [storyID, mediaID],
          );
        }
      } else {
        const existingJoin = exec(
          this.db,
          "SELECT * FROM media_attached_story WHERE storyID = ? AND mediaID = ?",
          [storyID, mediaID],
          "get",
        );
        if (!existingJoin) {
          exec(
            this.db,
            "INSERT INTO media_attached_story (storyID, mediaID) VALUES (?, ?)",
            [storyID, mediaID],
          );
        }
      }
    };

    if (type == "StoryAttachmentPhotoStyleRenderer") {
      // Single photo
      if (!attachment.style_type_renderer.attachment.media) {
        log.info(
          "FacebookAccountController.parseAttachment: no media found, skipping",
        );
        return;
      }
      const mediaID = await this.saveMedia(
        attachment.style_type_renderer.attachment.media,
        null,
      );
      if (mediaID) {
        await saveJoin(mediaID, storyType);
      }
    } else if (type == "StoryAttachmentAlbumStyleRenderer") {
      // Multiple photos
      if (
        !attachment.style_type_renderer.attachment.all_subattachments ||
        !attachment.style_type_renderer.attachment.all_subattachments.nodes
          .length
      ) {
        log.info(
          "FacebookAccountController.parseAttachment: no media found, skipping",
        );
        return;
      }

      for (const mediaItem of attachment.style_type_renderer.attachment
        .all_subattachments.nodes) {
        const mediaID = await this.saveMedia(mediaItem.media, null);
        if (mediaID) {
          await saveJoin(mediaID, storyType);
        }
      }
    } else if (type == "StoryAttachmentVideoStyleRenderer") {
      // Video
      if (!attachment.style_type_renderer.attachment.media) {
        log.info(
          "FacebookAccountController.parseAttachment: no media found, skipping",
        );
        return;
      }
      const mediaID = await this.saveMedia(
        attachment.style_type_renderer.attachment.media,
        null,
      );
      if (mediaID) {
        await saveJoin(mediaID, storyType);
      }
    } else if (
      [
        "StoryAttachmentFallbackStyleRenderer",
        "StoryAttachmentShareStyleRenderer",
      ].includes(type)
    ) {
      // Attached link or share
      console.log(
        "FacebookAccountController.parseAttachment: parsing attached link or share",
        attachment,
      );

      // If there's attached media, save it
      let mediaID: string | null = null;
      if (attachment.style_type_renderer.attachment.media) {
        const title = attachment.style_type_renderer.attachment.title || null;
        mediaID = await this.saveMedia(
          attachment.style_type_renderer.attachment.media,
          title,
        );
        if (mediaID) {
          await saveJoin(mediaID, storyType);
        }
      }

      // TODO: we need to figure out how to store shared links better

      // // Get the description and title
      // const description = attachment.style_type_renderer.attachment.description?.text || null;
      // const title = attachment.style_type_renderer.attachment.title || null;

      // // Get the URL
      // let url: string | null = null;
      // if(attachment.style_type_renderer.attachment.url) {
      //     const fbURL = new URL(attachment.style_type_renderer.attachment.url);
      //     if(fbURL.host == "l.facebook.com") {
      //         // This is a Facebook URL, so we need to extract the 'u' parameter
      //         // Example: 'https://l.facebook.com/l.php?u=https%3A%2F%2Fstardewvalleywiki.com%2FJojaMart&h=AT09n5aPSKTkHBJlfSlRhgZqwXiTLr6ZBUzspjCefK6zPM9dnj4pLnVfCGyGj9_jBeeC1FJhttz4Kq--j3Es_G3zy92hMrLaruAtm8pr7RSzU-q9V10OaZBZnQyqfuaLV4kJW2oh8VYSVY3ZVP0MSaQ&s=1'
      //         url = fbURL.searchParams.get('u') || null;
      //     } else {
      //         url = attachment.style_type_renderer.attachment.url;
      //     }
      // }

      // // Save the share
      // const existingShare = exec(this.db, 'SELECT * FROM share WHERE storyID = ? AND mediaID = ?', [storyID, mediaID], "get");
      // if (!existingShare) {
      //     // Save the share
      //     exec(
      //         this.db,
      //         'INSERT INTO share (storyID, description, title, url, mediaID) VALUES (?, ?, ?, ?, ?)',
      //         [
      //             storyID,
      //             description,
      //             title,
      //             url,
      //             mediaID
      //         ]
      //     );
      // }
    } else {
      log.info(
        "FacebookAccountController.parseAttachment: not a valid attachment type, skipping",
        attachment.style_type_renderer.__typename,
      );
    }
  }

  async downloadFile(sourceURI: string, destPath: string): Promise<boolean> {
    log.info(
      "FacebookAccountController.downloadFile: downloading file",
      sourceURI,
      destPath,
    );
    try {
      const response = await fetch(sourceURI, {});
      if (!response.ok) {
        return false;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.createWriteStream(destPath).write(buffer);
      return true;
    } catch (error) {
      log.error(
        `FacebookAccountController.downloadFile: Error downloading file: ${error}`,
      );
      return false;
    }
  }

  async parseAPIResponse(responseIndex: number) {
    const responseData = this.mitmController.responseData[responseIndex];

    // Already processed?
    if (responseData.processed) {
      return;
    }

    // Try parsing the response body query string to get the `fb_api_req_friendly_name`
    const params = new URLSearchParams(responseData.requestBody);
    const queryObject: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      queryObject[key] = decodeURIComponent(value);
    }
    if (!queryObject["fb_api_req_friendly_name"]) {
      log.error(
        "FacebookAccountController.parseAPIResponse: fb_api_req_friendly_name not found in query string",
      );
      responseData.processed = true;
      return;
    }

    // Throw out requests we don't care about
    const friendlyName = queryObject["fb_api_req_friendly_name"];
    const validFriendlyNames = [
      "ProfileCometManagePostsTimelineRootQuery",
      "CometManagePostsFeedRefetchQuery",
    ];
    if (!validFriendlyNames.includes(friendlyName)) {
      log.debug(
        "FacebookAccountController.parseAPIResponse: fb_api_req_friendly_name not in valid list",
        friendlyName,
      );
      responseData.processed = true;
      return;
    }

    // Check if the response status is ok
    if (responseData.status !== 200) {
      log.error(
        "FacebookAccountController.parseAPIResponse: response data status code",
        responseData.status,
      );
      responseData.processed = true;
      return;
    }

    log.info(
      "FacebookAccountController.parseAPIResponse: parsing response for",
      friendlyName,
    );

    // Get structured data from the stringified object
    const jsonStrings = responseData.responseBody.split("\n");
    for (const jsonString of jsonStrings) {
      // Handle an empty newline at the end of the file
      if (jsonString.trim() === "") {
        continue;
      }

      // Parse the JSON string
      try {
        const resp = JSON.parse(jsonString);

        // Handle different response structures
        if (isFBAPIResponseProfileCometManagePosts(resp)) {
          log.debug(
            "FacebookAccountController.parseAPIResponse: parsing ProfileCometManagePosts response",
          );
          let edges;
          if (resp.data?.user?.timeline_manage_feed_units?.edges) {
            edges = resp.data.user.timeline_manage_feed_units.edges;
          } else if (resp.data?.node?.timeline_manage_feed_units?.edges) {
            edges = resp.data.node.timeline_manage_feed_units.edges;
          } else {
            log.error(
              "FacebookAccountController.parseAPIResponse: no edges found in response",
              resp,
            );
            continue;
          }

          for (let i = 0; i < edges.length; i++) {
            const edge = edges[i];
            if (edge.node) {
              await this.parseNode(edge.node);
            }
          }
        } else if (isFBAPIResponseProfileCometManagePosts2(resp)) {
          log.debug(
            "FacebookAccountController.parseAPIResponse: parsing ProfileCometManagePosts2 response",
          );
          if (resp?.data?.node) {
            await this.parseNode(resp.data.node);
          }
        } else if (isFBAPIResponseProfileCometManagePostsPageInfo(resp)) {
          // ignore this response
          log.debug(
            "FacebookAccountController.parseAPIResponse: parsing ProfileCometManagePostsPageInfo response (ignoring)",
          );
        }
      } catch (e) {
        // Skip individual JSON errors
        log.error(
          "FacebookAccountController.parseAPIResponse: error parsing JSON",
          e,
          jsonString,
        );
      }
    }

    // Mark the response as processed
    responseData.processed = true;
  }

  async savePosts(): Promise<FacebookProgress> {
    await this.mitmController.clearProcessed();
    log.info(
      `FacebookAccountController.savePosts: parsing ${this.mitmController.responseData.length} responses`,
    );

    for (let i = 0; i < this.mitmController.responseData.length; i++) {
      await this.parseAPIResponse(i);
    }

    return this.progress;
  }

  async archiveBuild() {
    if (!this.account) {
      console.error(
        "FacebookAccountController.archiveBuild: account not found",
      );
      return false;
    }

    if (!this.db) {
      this.initDB();
      if (!this.db) {
        console.error(
          "FacebookAccountController.archiveBuild: database not initialized",
        );
        return;
      }
    }

    log.info("FacebookAccountController.archiveBuild: building archive");

    // Build the archive
    const accountPath = path.join(
      getAccountDataPath(
        "Facebook",
        `${this.account.accountID} ${this.account.name}`,
      ),
    );
    const assetsPath = path.join(accountPath, "assets");
    if (!fs.existsSync(assetsPath)) {
      fs.mkdirSync(assetsPath);
    }
    const archivePath = path.join(assetsPath, "archive.js");
    saveArchive(this.db, app.getVersion(), this.account.name, archivePath);

    // Unzip facebook-archive.zip to the account data folder using unzipper
    const archiveZipPath = path.join(
      getResourcesPath(),
      "facebook-archive.zip",
    );
    const archiveZip = await unzipper.Open.file(archiveZipPath);
    await archiveZip.extract({ path: accountPath });
  }

  async syncProgress(progressJSON: string) {
    this.progress = JSON.parse(progressJSON);
  }

  async getProgress(): Promise<FacebookProgress> {
    return this.progress;
  }

  async getCookie(name: string): Promise<string | null> {
    return this.cookies[name] || null;
  }

  async getProfileImageDataURI(profilePictureURI: string): Promise<string> {
    log.info(
      "FacebookAccountController.getProfileImageDataURI: profilePictureURI",
      profilePictureURI,
    );
    try {
      const response = await fetch(profilePictureURI, {});
      if (!response.ok) {
        return "";
      }
      const buffer = await response.buffer();
      log.info(
        "FacebookAccountController.getProfileImageDataURI: buffer",
        buffer,
      );
      return `data: ${response.headers.get("content-type")}; base64, ${buffer.toString("base64")}`;
    } catch (e) {
      log.error("FacebookAccountController.getProfileImageDataURI: error", e);
      return "";
    }
  }

  async getConfig(key: string): Promise<string | null> {
    return getConfig(key, this.db);
  }

  async setConfig(key: string, value: string) {
    return setConfig(key, value, this.db);
  }

  async getDatabaseStats(): Promise<FacebookDatabaseStats> {
    const databaseStats = emptyFacebookDatabaseStats();
    if (!this.account?.accountID) {
      log.info("FacebookAccountController.getDatabaseStats: no account");
      return databaseStats;
    }

    if (!this.db) {
      this.initDB();
    }

    // Count total stories
    const storiesSaved: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM story",
      [],
      "get",
    ) as Sqlite3Count;
    log.info(
      "FacebookAccountController.getDatabaseStats: stories saved:",
      storiesSaved,
    );

    // Count deleted stories
    const storiesDeleted: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM story WHERE deletedStoryAt IS NOT NULL",
      [],
      "get",
    ) as Sqlite3Count;
    log.info(
      "FacebookAccountController.getDatabaseStats: stories deleted:",
      storiesDeleted,
    );

    databaseStats.storiesSaved = storiesSaved.count;
    databaseStats.storiesDeleted = storiesDeleted.count;
    return databaseStats;
  }
}
