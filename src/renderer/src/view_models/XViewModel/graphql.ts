import type { XViewModel } from "./view_model";
import { X_AUTHORIZATION_HEADER } from "./types";
import type { XUserInfo, XViewerResults } from "../../types_x";

export async function graphqlDelete(
  vm: XViewModel,
  ct0: string,
  url: string,
  referrer: string,
  body: string,
): Promise<number> {
  vm.log("graphqlDelete", [url, body]);
  return await vm.getWebview()?.executeJavaScript(`
            (async () => {
                const transactionID = [...crypto.getRandomValues(new Uint8Array(95))].map((x, i) => (i = x / 255 * 61 | 0, String.fromCharCode(i + (i > 9 ? i > 35 ? 61 : 55 : 48)))).join('');
                try {
                    const response = await fetch('${url}', {
                        "headers": {
                            "authorization": "${X_AUTHORIZATION_HEADER}",
                            "content-type": "application/json",
                            "x-client-transaction-id": transactionID,
                            "x-csrf-token": '${ct0}',
                            "x-twitter-active-user": "yes",
                            "x-twitter-auth-type": "OAuth2Session"
                        },
                        "referrer": '${referrer}',
                        "referrerPolicy": "strict-origin-when-cross-origin",
                        "body": '${body}',
                        "method": "POST",
                        "mode": "cors",
                        "credentials": "include",
                        "signal": AbortSignal.timeout(5000)
                    })
                    console.log(response.status);
                    if (response.status == 200) {
                        console.log(await response.text());
                    }
                    return response.status;
                } catch (e) {
                    return 0;
                }
            })();
        `);
}

export async function graphqlGetViewerUser(
  vm: XViewModel,
): Promise<XUserInfo | null> {
  vm.log("graphqlGetViewerUser");

  const url =
    "https://api.x.com/graphql/WBT8ommFCSHiy3z2_4k1Vg/Viewer?variables=%7B%22withCommunitiesMemberships%22%3Atrue%7D&features=%7B%22profile_label_improvements_pcf_label_in_post_enabled%22%3Atrue%2C%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%7D&fieldToggles=%7B%22isDelegate%22%3Afalse%2C%22withAuxiliaryUserLabels%22%3Afalse%7D";
  const ct0 = await window.electron.X.getCookie(
    vm.account.id,
    "api.x.com",
    "ct0",
  );

  if (ct0 === null) {
    vm.log("graphqlGetViewerUser", "ct0 is null");
    return null;
  }

  // Give it 3 tries
  let tries = 0;
  while (tries < 3) {
    if (tries > 0) {
      // Sleep 1s before trying again
      vm.sleep(1000);
    }

    vm.log("graphqlGetViewerUser", `try #${tries}`);

    // For reloading home
    await vm.loadURLWithRateLimit("https://x.com/home");

    // Make the graphql request
    const resp: string | null = await vm.getWebview()?.executeJavaScript(`
                (async () => {
                    const transactionID = [...crypto.getRandomValues(new Uint8Array(95))].map((x, i) => (i = x / 255 * 61 | 0, String.fromCharCode(i + (i > 9 ? i > 35 ? 61 : 55 : 48)))).join('');
                    try {
                        const response = await fetch('${url}', {
                            "headers": {
                                "authorization": "${X_AUTHORIZATION_HEADER}",
                                "content-type": "application/json",
                                "x-client-transaction-id": transactionID,
                                "x-csrf-token": '${ct0}',
                                "x-twitter-client-language": "en",
                                "x-twitter-active-user": "yes",
                                "origin": 'https://x.com',
                                "sec-fetch-site": "same-site",
                                "sec-fetch-mode": "cors",
                                "sec-fetch-dest": "empty"
                            },
                            "referrer": 'https://x.com/',
                            "method": "GET",
                            "mode": "cors",
                            "credentials": "include",
                            "signal": AbortSignal.timeout(5000)
                        })
                        if (response.status == 200) {
                            return await response.text();
                        }
                        return null;
                    } catch (e) {
                        return null;
                    }
                })();
            `);

    if (resp === null) {
      vm.log("graphqlGetViewerUser", "response is null");
      tries += 1;
      continue;
    } else {
      try {
        const viewerResults: XViewerResults = JSON.parse(resp);
        const userInfo: XUserInfo = {
          username:
            viewerResults.data.viewer.user_results.result.legacy.screen_name,
          userID: viewerResults.data.viewer.user_results.result.rest_id,
          bio: viewerResults.data.viewer.user_results.result.legacy.description,
          profileImageDataURI: await window.electron.X.getImageDataURI(
            vm.account.id,
            viewerResults.data.viewer.user_results.result.legacy
              .profile_image_url_https,
          ),
          followingCount:
            viewerResults.data.viewer.user_results.result.legacy.friends_count,
          followersCount:
            viewerResults.data.viewer.user_results.result.legacy
              .followers_count,
          tweetsCount:
            viewerResults.data.viewer.user_results.result.legacy.statuses_count,
          likesCount:
            viewerResults.data.viewer.user_results.result.legacy
              .favourites_count,
        };
        return userInfo;
      } catch (e) {
        vm.log("graphqlGetViewerUser", ["error parsing response:", resp, e]);
        tries += 1;
        continue;
      }
    }
  }

  vm.log("graphqlGetViewerUser", "failed to get userInfo after 3 tries");
  return null;
}
