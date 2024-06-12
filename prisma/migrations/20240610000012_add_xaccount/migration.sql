-- CreateTable
CREATE TABLE "XAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "accessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "username" TEXT NOT NULL,
    "cookies" TEXT NOT NULL,
    "deleteTweets" BOOLEAN NOT NULL DEFAULT false,
    "tweetsDaysThreshold" INTEGER NOT NULL DEFAULT 20,
    "tweetsEnableRetweetThreshold" BOOLEAN NOT NULL DEFAULT false,
    "tweetsLikeThreshold" INTEGER NOT NULL DEFAULT 20,
    "deleteLikes" BOOLEAN NOT NULL DEFAULT false,
    "likesDaysThreshold" INTEGER NOT NULL DEFAULT 60,
    "deleteDirectMessages" BOOLEAN NOT NULL DEFAULT false,
    "directMessageDaysThreshold" INTEGER NOT NULL DEFAULT 30
);
