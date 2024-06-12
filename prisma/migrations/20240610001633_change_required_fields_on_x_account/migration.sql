-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_XAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "username" TEXT,
    "cookies" TEXT,
    "deleteTweets" BOOLEAN NOT NULL DEFAULT false,
    "tweetsDaysThreshold" INTEGER NOT NULL DEFAULT 20,
    "tweetsEnableRetweetThreshold" BOOLEAN NOT NULL DEFAULT false,
    "tweetsLikeThreshold" INTEGER NOT NULL DEFAULT 20,
    "deleteLikes" BOOLEAN NOT NULL DEFAULT false,
    "likesDaysThreshold" INTEGER NOT NULL DEFAULT 60,
    "deleteDirectMessages" BOOLEAN NOT NULL DEFAULT false,
    "directMessageDaysThreshold" INTEGER NOT NULL DEFAULT 30
);
INSERT INTO "new_XAccount" ("accessedAt", "cookies", "createdAt", "deleteDirectMessages", "deleteLikes", "deleteTweets", "directMessageDaysThreshold", "id", "likesDaysThreshold", "tweetsDaysThreshold", "tweetsEnableRetweetThreshold", "tweetsLikeThreshold", "updatedAt", "username") SELECT "accessedAt", "cookies", "createdAt", "deleteDirectMessages", "deleteLikes", "deleteTweets", "directMessageDaysThreshold", "id", "likesDaysThreshold", "tweetsDaysThreshold", "tweetsEnableRetweetThreshold", "tweetsLikeThreshold", "updatedAt", "username" FROM "XAccount";
DROP TABLE "XAccount";
ALTER TABLE "new_XAccount" RENAME TO "XAccount";
PRAGMA foreign_key_check("XAccount");
PRAGMA foreign_keys=ON;
