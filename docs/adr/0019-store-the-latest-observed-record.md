# Store the latest observed record

Version 2 represents the latest observation of each Bluesky record at its stable AT URI, including observation timestamps and deletion state, rather than retaining every historical CID revision. Import selects the newer observation and does not replace populated fields with absent data; complete revision history is outside the initial parity scope.
