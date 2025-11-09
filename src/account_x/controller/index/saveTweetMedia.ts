import path from "path";
import fs from "fs";
import fetch from "node-fetch";
import type { XAccountController } from "../../x_account_controller";

export async function saveTweetMedia(
  controller: XAccountController,
  mediaPath: string,
  filename: string,
): Promise<string> {
  if (!controller.account) {
    throw new Error("Account not found");
  }

  // Create path to store tweet media if it doesn't exist already
  const outputPath = await controller.getMediaPath();
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
  }

  // Download and save media from the mediaPath
  try {
    const response = await fetch(mediaPath, {});
    if (!response.ok) {
      return "";
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const outputFileName = path.join(outputPath, filename);
    fs.createWriteStream(outputFileName).write(buffer);
    return outputFileName;
  } catch {
    return "";
  }
}
