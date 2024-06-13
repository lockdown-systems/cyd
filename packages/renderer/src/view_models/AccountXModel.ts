import Electron from 'electron';

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
    private webview: Electron.WebviewTag;

    public instructions: string;

    constructor(account: XAccount, webview: Electron.WebviewTag) {
        this.account = account;
        this.webview = webview;

        this.state = State.Login;
        this.instructions = "";
        this.showBrowser = false;
    }

    async run() {
        console.log("State is " + this.state)
        switch (this.state) {
            case State.Login:
                // Never logged in before
                if (this.account.username === null) {
                    this.instructions = `
Excellent choice! I can help you automatically delete your tweets, likes, and direct messages, 
except for the ones you want to keep. To start, login to your X account below.
`;
                    this.showBrowser = true;
                    this.webview.loadURL("https://twitter.com/login");
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