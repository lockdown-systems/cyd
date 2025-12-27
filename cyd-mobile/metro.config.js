const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.transformer.babelTransformerPath = require.resolve(
  "react-native-svg-transformer",
);
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== "svg",
);
config.resolver.sourceExts.push("svg");

// Prefer "react-native" then "browser" exports.
// This ensures we get the browser version of "jose" (which uses WebCrypto)
// instead of the Node version (which uses node:crypto).
config.resolver.unstable_conditionNames = [
  "react-native",
  "browser",
  "require",
  "import",
];

module.exports = config;
