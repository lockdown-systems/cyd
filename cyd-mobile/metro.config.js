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

// Silence warnings about "multiformats" and "uint8arrays" exports
const originalGetTransformOptions = config.transformer.getTransformOptions;
config.transformer.getTransformOptions = async (
  entryFiles,
  options,
  getDependenciesOf,
) => {
  const result = await originalGetTransformOptions(
    entryFiles,
    options,
    getDependenciesOf,
  );
  return result;
};

// Ignore specific warnings in LogBox (runtime)
// Note: This doesn't stop the bundler warnings, but helps clean up the device logs.
// Bundler warnings are harder to suppress without patching Metro.

module.exports = config;
