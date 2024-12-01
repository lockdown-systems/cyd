export async function xHasSomeData(accountID: number): Promise<boolean> {
    let lastImportArchive: Date | null = null;
    let lastBuildDatabase: Date | null = null;

    const lastFinishedJob_importArchive = await window.electron.X.getConfig(accountID, 'lastFinishedJob_importArchive');
    if (lastFinishedJob_importArchive) {
        lastImportArchive = new Date(lastFinishedJob_importArchive);
    }

    const lastFinishedJob_indexTweets = await window.electron.X.getConfig(accountID, 'lastFinishedJob_indexTweets');
    const lastFinishedJob_indexLikes = await window.electron.X.getConfig(accountID, 'lastFinishedJob_indexLikes');
    if (lastFinishedJob_indexTweets || lastFinishedJob_indexLikes) {
        const lastFinishedJob_indexTweets_date = lastFinishedJob_indexTweets ? new Date(lastFinishedJob_indexTweets) : new Date(0);
        const lastFinishedJob_indexLikes_date = lastFinishedJob_indexLikes ? new Date(lastFinishedJob_indexLikes) : new Date(0);
        lastBuildDatabase = lastFinishedJob_indexTweets_date > lastFinishedJob_indexLikes_date ? lastFinishedJob_indexTweets_date : lastFinishedJob_indexLikes_date;
    }

    return lastImportArchive !== null || lastBuildDatabase !== null;
}