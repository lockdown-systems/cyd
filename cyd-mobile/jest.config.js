module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "babel-jest",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|@react-navigation|expo|@expo|@unimodules|unimodules|sentry-expo|native-base|react-native-svg|react-native-markdown-display|@testing-library)/)",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest-setup.ts"],
  collectCoverageFrom: [
    "**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/coverage/**",
    "!**/node_modules/**",
    "!**/.expo/**",
    "!**/android/**",
    "!**/ios/**",
  ],
  moduleNameMapper: {
    "\\.(svg)$": "<rootDir>/__mocks__/svgMock.js",
    "react-native-markdown-display":
      "<rootDir>/__mocks__/react-native-markdown-display.js",
    "^@/(.*)$": "<rootDir>/$1",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testMatch: ["**/__tests__/**/*.test.(ts|tsx|js)"],
  modulePathIgnorePatterns: ["<rootDir>/node_modules/react-native/jest"],
};
