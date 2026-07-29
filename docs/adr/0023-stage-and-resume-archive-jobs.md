# Stage and resume archive jobs

Import and export are checkpointed, resumable jobs capable of continuing validation, hashing, media copying, and merge preparation after interruption. Import staging remains isolated from the live local account until final commit; cancellation or unrecoverable failure leaves existing account data untouched and safely removes staged artifacts.
