import fs from 'fs';
import path from 'path';

import { test, expect } from 'vitest';
import { findCurrentUserInitialData, CurrentUserInitialData } from './FacebookViewModel';

test('findCurrentUserInitialData() successfully finds CurrentUserInitialData', async () => {
    const faceDataItemsJSON = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'testdata', 'facebook', 'FacebookDataItems.json'), 'utf8');
    const facebookDataItems = JSON.parse(faceDataItemsJSON);
    const userData: CurrentUserInitialData | null = findCurrentUserInitialData(facebookDataItems);
    expect(userData).toEqual({
        "ACCOUNT_ID": "61572760629627",
        "USER_ID": "61572760629627",
        "NAME": "Ethan Crosswell",
        "SHORT_NAME": "Ethan",
        "IS_BUSINESS_PERSON_ACCOUNT": false,
        "HAS_SECONDARY_BUSINESS_PERSON": false,
        "IS_FACEBOOK_WORK_ACCOUNT": false,
        "IS_INSTAGRAM_BUSINESS_PERSON": false,
        "IS_MESSENGER_ONLY_USER": false,
        "IS_DEACTIVATED_ALLOWED_ON_MESSENGER": false,
        "IS_MESSENGER_CALL_GUEST_USER": false,
        "IS_WORK_MESSENGER_CALL_GUEST_USER": false,
        "IS_WORKROOMS_USER": false,
        "APP_ID": "2220391788200892",
        "IS_BUSINESS_DOMAIN": false
    });
})
