export enum State {
    Login = "login",
    Dashboard = "dashboard",
    DownloadArchive = "downloadArchive",
    UnlikeTweets = "unlikeTweets",
    FinishUnlikeTweets = "finishUnlikeTweets",
    DeleteTweets = "deleteTweets",
    FinishDeleteTweets = "finishDeleteTweets",
    DeleteDirectMessages = "deleteDirectMessages",
    FinishDeleteDirectMessages = "finishDeleteDirectMessages",
}

export class AccountXModel {
    private account: XAccount;
    private state: string;
    private showBrowser: boolean;

    public instructions: string;

    constructor(account: XAccount) {
        this.account = account;
        this.state = State.Login;
        this.instructions = "";
        this.showBrowser = false;
    }

    async run() {
        switch (this.state) {
            case State.Login:
                // Never logged in before
                if (this.account.username === null) {
                    this.instructions = `
Excellent choice! I can help you automatically delete your tweets, likes, and direct messages, 
except for the ones you want to keep. To start, login to your X account below.
`;
                    this.showBrowser = true;
                } else {
                    // We have logged in before. Are we currently logged in?
                }

                break;

            case State.Dashboard:
            case State.DownloadArchive:
            case State.UnlikeTweets:
            case State.FinishUnlikeTweets:
            case State.DeleteTweets:
            case State.FinishDeleteTweets:
            case State.DeleteDirectMessages:
            case State.FinishDeleteDirectMessages:
                break;

        }
    }
}