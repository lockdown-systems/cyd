// Mock react-native-markdown-display
const React = require("react");

const Markdown = ({ children }) => {
  return React.createElement("text", {}, children);
};

module.exports = Markdown;
module.exports.default = Markdown;
