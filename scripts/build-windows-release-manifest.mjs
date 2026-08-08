/* global process */
import fs from "fs";
import path from "path";

const root = process.env.ARTIFACTS_ROOT || "downloaded-artifacts";

const artifactDirs = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (artifactDirs.length === 0) {
  throw new Error(`No downloaded artifacts found in ${root}.`);
}

function parseChecksums(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const match = line.match(/^([a-f0-9]{64})\s+(.+)$/i);
    if (!match) {
      throw new Error(`Invalid checksum line: ${line}`);
    }

    return {
      sha256: match[1].toLowerCase(),
      path: match[2],
    };
  });
}

const artifacts = artifactDirs.map((artifactName) => {
  const artifactPath = path.join(root, artifactName);
  const files = fs.readdirSync(artifactPath);
  const checksumFile = files.find(
    (name) =>
      name.startsWith("windows-unsigned-checksums-") && name.endsWith(".txt"),
  );

  if (!checksumFile) {
    throw new Error(
      `Missing checksum file in artifact directory: ${artifactName}`,
    );
  }

  const arch = checksumFile
    .replace("windows-unsigned-checksums-", "")
    .replace(".txt", "");

  const checksumText = fs.readFileSync(
    path.join(artifactPath, checksumFile),
    "utf8",
  );
  const checksums = parseChecksums(checksumText);

  return {
    name: artifactName,
    arch,
    checksumFile,
    fileCount: checksums.length,
    checksums,
  };
});

const manifest = {
  tag: process.env.TAG_NAME,
  version: process.env.TAG_VERSION,
  env: process.env.RELEASE_ENV,
  commitSha: process.env.COMMIT_SHA,
  workflowRunId: Number(process.env.RUN_ID),
  workflowRunAttempt: Number(process.env.RUN_ATTEMPT),
  generatedAt: new Date().toISOString(),
  artifacts,
};

fs.writeFileSync(
  "windows-release-manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
