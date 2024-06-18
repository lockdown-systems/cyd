import { contextBridge, ipcRenderer } from 'electron'

export type XAccount = {
    id: number;
    createdAt: Date;
    updatedAt: Date;
    accessedAt: Date;
    username: string;
    cookies: string;
    deleteTweets: boolean;
    tweetsDaysThreshold: number;
    tweetsEnableRetweetThreshold: boolean;
    tweetsLikeThreshold: number;
    deleteLikes: boolean;
    likesDaysThreshold: number;
    deleteDirectMessages: boolean;
    directMessageDaysThreshold: number;
};

contextBridge.exposeInMainWorld('electron', {
    getApiUrl: (): Promise<string> => {
        return ipcRenderer.invoke('getApiUrl')
    },
    isDevMode: (): Promise<boolean> => {
        return ipcRenderer.invoke('isDevMode')
    },
    getConfig: (key: string): Promise<string> => {
        return ipcRenderer.invoke('getConfig', key);
    },
    setConfig: (key: string, value: string) => {
        ipcRenderer.invoke('setConfig', key, value)
    },
    getXAccounts: (): Promise<XAccount[]> => {
        return ipcRenderer.invoke('getXAccounts')
    },
    createXAccount: (): Promise<XAccount> => {
        return ipcRenderer.invoke('createXAccount')
    },
    saveXAccount: (accountJSON: string) => {
        ipcRenderer.invoke('saveXAccount', accountJSON)
    }
})