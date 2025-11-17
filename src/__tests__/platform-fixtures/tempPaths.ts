import fs from "fs";
import path from "path";

export interface PlatformPathMocks {
  getSettingsPath(): string;
  getAccountSettingsPath(accountID: number): string;
  getDataPath(): string;
  getAccountDataPath(accountType: string, accountUsername: string): string;
  cleanup(): void;
  trackAbsolutePath(value: string): void;
}

const ensureDirSync = (dir: string, tracked: Set<string>): string => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  tracked.add(dir);
  return dir;
};

const sortPathsForDeletion = (paths: Set<string>): string[] => {
  return Array.from(paths).sort((a, b) => b.length - a.length);
};

export const TESTDATA_ROOT = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "testdata",
);

export const createPlatformPathMocks = (
  platformKey: string,
): PlatformPathMocks => {
  const trackedPaths = new Set<string>();
  const settingsPath = path.join(TESTDATA_ROOT, `settingsPath-${platformKey}`);
  const dataPath = path.join(TESTDATA_ROOT, `dataPath-${platformKey}`);
  const accountDataRoot = path.join(TESTDATA_ROOT, "dataPath");

  return {
    getSettingsPath: () => ensureDirSync(settingsPath, trackedPaths),
    getAccountSettingsPath: (accountID: number) =>
      ensureDirSync(
        path.join(settingsPath, `account-${accountID}`),
        trackedPaths,
      ),
    getDataPath: () => ensureDirSync(dataPath, trackedPaths),
    getAccountDataPath: (accountType: string, accountUsername: string) =>
      ensureDirSync(
        path.join(accountDataRoot, accountType, accountUsername),
        trackedPaths,
      ),
    cleanup: () => {
      for (const dir of sortPathsForDeletion(trackedPaths)) {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      }
      trackedPaths.clear();
    },
    trackAbsolutePath: (absolutePath: string) => {
      ensureDirSync(absolutePath, trackedPaths);
    },
  };
};
