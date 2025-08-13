import fs from "fs";
import path from "path";

import { test, expect } from "vitest";
import {
  CurrentUserInitialData,
  findCurrentUserInitialData,
  findProfilePictureURI,
} from "./FacebookViewModel";

test("findCurrentUserInitialData() successfully finds CurrentUserInitialData", async () => {
  const faceDataItemsJSON = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "testdata",
      "facebook",
      "initialData",
      "FacebookDataItems.json",
    ),
    "utf8",
  );
  const facebookDataItems = JSON.parse(faceDataItemsJSON);
  const userData: CurrentUserInitialData | null =
    findCurrentUserInitialData(facebookDataItems);
  expect(userData).toEqual({
    ACCOUNT_ID: "61572760629627",
    USER_ID: "61572760629627",
    NAME: "Ethan Crosswell",
    SHORT_NAME: "Ethan",
    IS_BUSINESS_PERSON_ACCOUNT: false,
    HAS_SECONDARY_BUSINESS_PERSON: false,
    IS_FACEBOOK_WORK_ACCOUNT: false,
    IS_INSTAGRAM_BUSINESS_PERSON: false,
    IS_MESSENGER_ONLY_USER: false,
    IS_DEACTIVATED_ALLOWED_ON_MESSENGER: false,
    IS_MESSENGER_CALL_GUEST_USER: false,
    IS_WORK_MESSENGER_CALL_GUEST_USER: false,
    IS_WORKROOMS_USER: false,
    APP_ID: "2220391788200892",
    IS_BUSINESS_DOMAIN: false,
  });
});

test("findProfilePictureURI() successfully finds the profile picture URI", async () => {
  const faceDataItemsJSON = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "testdata",
      "facebook",
      "initialData",
      "FacebookDataItems.json",
    ),
    "utf8",
  );
  const facebookDataItems = JSON.parse(faceDataItemsJSON);
  const profilePictureURI: string | null =
    findProfilePictureURI(facebookDataItems);
  expect(profilePictureURI).toEqual(
    "https://scontent.fsac1-2.fna.fbcdn.net/v/t39.30808-1/476279280_122101936418758687_8298574481110740604_n.jpg?stp=c434.0.1080.1080a_cp0_dst-jpg_s80x80_tt6&_nc_cat=105&ccb=1-7&_nc_sid=e99d92&_nc_ohc=pIxGW_rtPb4Q7kNvgH-lasu&_nc_oc=AditzkgBRRzY8wq4iVBGX4zS6csLNqI_etFbqsc_Vfmq4NIiPWL2sDxJd-iMlw6k22I&_nc_zt=24&_nc_ht=scontent.fsac1-2.fna&_nc_gid=ANXdZFZVCbQsbR38YXNk10r&oh=00_AYAR9jJI57lhGRMB5jmY4gmvBvCU9SHC6rU0vILNWIDUAQ&oe=67AC6A9A",
  );
});
