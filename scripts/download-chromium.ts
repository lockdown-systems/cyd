import * as path from "path";
import * as process from "process";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import { ReadableStream } from "stream/web";

const downloadURLs: Record<string, string> = {
    "win-x64": "https://download-chromium.appspot.com/dl/Win_x64?type=snapshots",
    "mac-intel": "https://download-chromium.appspot.com/dl/Mac?type=snapshots",
    "mac-arm64": "https://download-chromium.appspot.com/dl/Mac_Arm?type=snapshots",
    "linux-x64": "https://download-chromium.appspot.com/dl/Linux_x64?type=snapshots",
}

export const downloadChromium = async (platform: string, output_folder: string) => {
    const downloadURL = downloadURLs[platform];
    if (!downloadURL) {
        console.error(`Unsupported platform: ${platform}`);
        return;
    }

    console.log(`Downloading: ${downloadURL}`);

    const resp = await fetch(downloadURL);
    if (resp.ok && resp.body) {
        const downloadPath = path.join(output_folder, `chromium-${platform}.zip`);
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

const main = async () => {
    const args = process.argv.slice(2);
    if (args.length !== 2) {
        console.error("Usage: node download-chromium.js <platform> <output_folder>");
        process.exit(1);
    }

    const [platform, output_folder] = args;
    await downloadChromium(platform, output_folder);
}

main();