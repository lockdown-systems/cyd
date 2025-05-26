import CydAPIClient from '../../cyd-api-client';
import type { DeviceInfo } from './types';
import { FacebookAccount } from '../../shared_types';

export async function facebookGetLastBuildDatabase(accountID: number): Promise<Date | null> {
    const lastFinishedJob_savePosts = await window.electron.Facebook.getConfig(accountID, 'lastFinishedJob_savePosts');
    if (lastFinishedJob_savePosts) {
        return new Date(lastFinishedJob_savePosts);
    }
    return null;
}

export async function facebookHasSomeData(_accountID: number): Promise<boolean> {
    const lastBuildDatabase: Date | null = await facebookGetLastBuildDatabase(_accountID);
    return lastBuildDatabase !== null;
}

export async function facebookRequiresPremium(_facebookAccount: FacebookAccount): Promise<boolean> {
    // TODO: implement
    return false;
}

export async function facebookPostProgress(_apiClient: CydAPIClient, _deviceInfo: DeviceInfo | null, _accountID: number) {
    // TODO: implement
}
