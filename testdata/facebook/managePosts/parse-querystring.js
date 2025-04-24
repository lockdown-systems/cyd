// This script parses a query string from the command line and extracts the `variables` element as JSON.
// Usage: node parse-querystring.js "queryString"

function parseQueryString(queryString) {
    // Convert the query string into a JavaScript object
    const params = new URLSearchParams(queryString);
    const queryObject = {};
    for (const [key, value] of params.entries()) {
        queryObject[key] = decodeURIComponent(value);
    }

    console.log("queryObjects", JSON.stringify(queryObject, null, 2));

    // Parse and return the `variables` element as JSON
    if (queryObject.variables) {
        return JSON.parse(queryObject.variables);
    }

    // Return null if `variables` is not present
    return null;
}

// Get the query string from CLI arguments
const queryString = process.argv[2];
if (!queryString) {
    console.error("Error: Please provide a query string as a CLI argument.");
    process.exit(1);
}

const result = parseQueryString(queryString);
console.log("variables", JSON.stringify(result, null, 2));
