import * as path from "path";
import { createWriteStream, existsSync, mkdirSync, chmodSync } from "fs";
import { Readable } from "stream";
import { ReadableStream } from "stream/web";

const createFolderIfNotExists = (folder: string) => {
    if (!existsSync(folder)) {
        mkdirSync(folder);
    }
}

// Chromium

export const downloadChromium = async (platform: string, output_folder: string) => {
    createFolderIfNotExists(output_folder);

    const downloadURLs: Record<string, string> = {
        "win-x64": "https://download-chromium.appspot.com/dl/Win_x64?type=snapshots",
        "mac-intel": "https://download-chromium.appspot.com/dl/Mac?type=snapshots",
        "mac-arm64": "https://download-chromium.appspot.com/dl/Mac_Arm?type=snapshots",
        "linux-x64": "https://download-chromium.appspot.com/dl/Linux_x64?type=snapshots",
    }
    const downloadURL = downloadURLs[platform];
    if (!downloadURL) {
        console.error(`Unsupported platform: ${platform}`);
        return;
    }

    const downloadPath = path.join(output_folder, `chromium-${platform}.zip`);
    if (existsSync(downloadPath)) {
        console.log(`Chromium already downloaded: ${downloadPath}`);
        return;
    }

    console.log(`Downloading: ${downloadURL}`);

    const resp = await fetch(downloadURL);
    if (resp.ok && resp.body) {
        const writer = createWriteStream(downloadPath);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const readableStream = resp.body as ReadableStream<any>;

        await new Promise<void>((resolve, reject) => {
            Readable.fromWeb(readableStream)
                .pipe(writer)
                .on('finish', resolve)
                .on('error', reject);
        });

        console.log(`Downloaded to: ${downloadPath}`);
    } else {
        console.error(`Failed to fetch download URL: ${downloadURL}`);
        return;
    }
};

// SingleFile CLI

interface GitHubRelease {
    tag_name: string;
}

const singleFileRepoOwner = 'gildas-lormeau';
const singleFileRepoName = 'single-file-cli';

async function getLatestReleaseTag(): Promise<string> {
    const url = `https://api.github.com/repos/${singleFileRepoOwner}/${singleFileRepoName}/releases/latest`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch latest release: ${response.statusText}`);
    }
    const release = await response.json() as GitHubRelease;
    console.log(`Latest release tag: ${release.tag_name}`);
    return release.tag_name;
}

export const downloadSingleFileCLI = async (platform: string, output_folder: string): Promise<string | null> => {
    createFolderIfNotExists(output_folder);

    const releaseTag = await getLatestReleaseTag();
    let downloadFilename: string;
    switch (platform) {
        case "win-x64":
            downloadFilename = "single-file.exe";
            break;
        case "mac-intel":
            downloadFilename = "single-file-x86_64-apple-darwin";
            break;
        case "mac-arm64":
            downloadFilename = "single-file-aarch64-apple-darwin";
            break;
        case "linux-x64":
            downloadFilename = "single-file-x86_64-linux";
            break;
        default:
            console.error(`Unsupported platform: ${platform}`);
            return null;
    }
    const downloadURL = `https://github.com/${singleFileRepoOwner}/${singleFileRepoName}/releases/download/${releaseTag}/${downloadFilename}`;

    const downloadPath = path.join(output_folder, downloadFilename);
    if (existsSync(downloadPath)) {
        console.log(`SingleFile CLI already downloaded: ${downloadPath}`);
        return downloadPath;
    }

    console.log(`Downloading: ${downloadURL}`);

    const resp = await fetch(downloadURL);
    if (resp.ok && resp.body) {
        const writer = createWriteStream(downloadPath);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const readableStream = resp.body as ReadableStream<any>;

        await new Promise<void>((resolve, reject) => {
            Readable.fromWeb(readableStream)
                .pipe(writer)
                .on('finish', resolve)
                .on('error', reject);
        });

        // Make it executable
        if (platform !== "win-x64") {
            await chmodSync(downloadPath, '755');
        }

        console.log(`Downloaded to: ${downloadPath}`);
        return downloadPath;
    } else {
        console.error(`Failed to fetch download URL: ${downloadURL}`);
        return null;
    }
};
