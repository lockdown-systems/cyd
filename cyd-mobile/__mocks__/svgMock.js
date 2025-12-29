// Mock SVG imports
const React = require("react");

const SvgMock = (props) => React.createElement("svg", props);
SvgMock.displayName = "SvgMock";

module.exports = SvgMock;
module.exports.default = SvgMock;
