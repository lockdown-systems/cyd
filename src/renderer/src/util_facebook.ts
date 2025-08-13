import CydAPIClient from "../../cyd-api-client";
import type { DeviceInfo } from "./types";
import { FacebookAccount } from "../../shared_types";

export async function facebookGetLastImportArchive(
  accountID: number,
): Promise<Date | null> {
  const lastFinishedJob_importArchive =
    await window.electron.Facebook.getConfig(
      accountID,
      "lastFinishedJob_importArchive",
    );
  if (lastFinishedJob_importArchive) {
    return new Date(lastFinishedJob_importArchive);
  }
  return null;
}

export async function facebookGetLastBuildDatabase(
  _accountID: number,
): Promise<Date | null> {
  // TODO implement
  return null;
}

export async function facebookHasSomeData(
  _accountID: number,
): Promise<boolean> {
  const lastImportArchive: Date | null =
    await facebookGetLastImportArchive(_accountID);
  const lastBuildDatabase: Date | null =
    await facebookGetLastBuildDatabase(_accountID);
  return lastImportArchive !== null || lastBuildDatabase !== null;
}

export async function facebookRequiresPremium(
  _facebookAccount: FacebookAccount,
): Promise<boolean> {
  // TODO: implement
  return false;
}

export async function facebookPostProgress(
  _apiClient: CydAPIClient,
  _deviceInfo: DeviceInfo | null,
  _accountID: number,
) {
  // TODO: implement
}
