import CydAPIClient from '../../cyd-api-client';
import type { DeviceInfo } from './types';
import { FacebookAccount } from '../../shared_types';

export async function facebookHasSomeData(_accountID: number): Promise<boolean> {
    // TODO: implement
    return false;
}

export async function facebookRequiresPremium(_facebookAccount: FacebookAccount): Promise<boolean> {
    // TODO: implement
    return false;
}

export async function facebookPostProgress(_apiClient: CydAPIClient, _deviceInfo: DeviceInfo | null, _accountID: number) {
    // TODO: implement
}
