import * as path from "path";
import * as process from "process";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import { ReadableStream } from "stream/web";

interface GitHubRelease {
    tag_name: string;
}

const repoOwner = 'gildas-lormeau';
const repoName = 'single-file-cli';

async function getLatestReleaseTag(): Promise<string> {
    const url = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch latest release: ${response.statusText}`);
    }
    const release = await response.json() as GitHubRelease;
    console.log(`Latest release tag: ${release.tag_name}`);
    return release.tag_name;
}

export const downloadSingleFileCLI = async (platform: string, output_folder: string): Promise<string | null> => {
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
    const downloadURL = `https://github.com/${repoOwner}/${repoName}/releases/download/${releaseTag}/${downloadFilename}`;

    console.log(`Downloading: ${downloadURL}`);

    const resp = await fetch(downloadURL);
    if (resp.ok && resp.body) {
        const downloadPath = path.join(output_folder, downloadFilename);
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
        return downloadPath;
    } else {
        console.error(`Failed to fetch download URL: ${downloadURL}`);
        return null;
    }
};

// export const zipSingleFileCLI = async (uncompressedPath: string, platform: string, output_folder: string): Promise<string | null> => {
//     const compressedPath = path.join(output_folder, `single-file-cli-${platform}.zip`);
//     const zip = new JSZip();
//     zip.file("single-file", fs.readFileSync(uncompressedPath));
//     await zip.generateNodeStream({ type: "nodebuffer", streamFiles: true })
//         .pipe(fs.createWriteStream(compressedPath));
//     console.log(`Compressed to: ${compressedPath}`);
//     return compressedPath;
// }

const main = async () => {
    const args = process.argv.slice(2);
    if (args.length !== 2) {
        console.error("Usage: node download-single-file-cli.js <platform> <output_folder>");
        process.exit(1);
    }

    const [platform, output_folder] = args;
    await downloadSingleFileCLI(platform, output_folder);
}

main();