import fs from "fs";
import log from "electron-log/main";
import fetch from "node-fetch";

/**
 * Fetch an image from a URL and convert it to a data URI.
 * Returns an empty string if the URL is invalid or the fetch fails.
 */
export async function getImageDataURI(url: string): Promise<string> {
  if (!url) {
    return "";
  }
  try {
    const response = await fetch(url, {});
    if (!response.ok) {
      return "";
    }
    const buffer = await response.buffer();
    return `data:${response.headers.get("content-type")};base64,${buffer.toString("base64")}`;
  } catch {
    return "";
  }
}

// Simple image dimension reader for PNG and JPG
export async function getImageDimensions(
  filePath: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const buffer = await fs.promises.readFile(filePath);

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      // PNG: width and height are at bytes 16-19 and 20-23 (big-endian)
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    // JPG/JPEG signature: FF D8
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      // Scan for SOF0 (Start of Frame) marker: FF C0
      for (let i = 2; i < buffer.length - 8; i++) {
        if (buffer[i] === 0xff && buffer[i + 1] === 0xc0) {
          // Height at offset 5-6, width at offset 7-8 (big-endian)
          const height = buffer.readUInt16BE(i + 5);
          const width = buffer.readUInt16BE(i + 7);
          return { width, height };
        }
      }
    }

    return null;
  } catch (error) {
    log.error(`Error reading image dimensions: ${error}`);
    return null;
  }
}
