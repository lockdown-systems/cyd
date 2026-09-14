# X element inventory — captured 2026-09-14

Every element Cyd's X automation waits for, counts, mouses over, or clicks,
and every route it loads, taken from the automation code as it stands at
commit `13bffe09`.

This is the half of the problem no HTTP capture can answer. Fill in the
**Observed** column during the capture walk: `ok` if the element is present and
still matches, `changed` with the new selector, or `gone`. A selector reached
positionally rather than by a stable test identifier is called out, because
those are the ones that break silently.

The seeding run writes any selector it could not find to
`capture/seed/<account>/selector-issues.jsonl` with a screenshot, which is
evidence for this table too.

## Routes

| Surface                            | Route loaded                                  | Source                             | Observed |
| ---------------------------------- | --------------------------------------------- | ---------------------------------- | -------- |
| Login                              | `https://x.com/login`                         | `auth.ts:15`                       |          |
| Home (viewer lookup)               | `https://x.com/home`                          | `graphql.ts:75`, `auth.ts:75`      |          |
| Profile timeline (save)            | `https://x.com/<username>/with_replies`       | `jobs_index.ts:49`                 |          |
| Likes (save)                       | `https://x.com/<username>/likes`              | `jobs_index.ts:569`                |          |
| Bookmarks (save)                   | `https://x.com/i/bookmarks`                   | `jobs_index.ts:667`                |          |
| Direct messages (save)             | `https://x.com/i/chat`                        | `jobs_index.ts:205`                |          |
| One conversation (save)            | `https://x.com/i/chat/<conversationID>`       | `jobs_index.ts:408`                |          |
| Post permalink (archive)           | the post's own URL                            | `jobs_index/helpers_archive.ts:30` |          |
| Profile timeline (delete posts)    | `https://x.com/<username>/with_replies`       | `jobs_delete.ts:57`                |          |
| Profile timeline (delete retweets) | `https://x.com/<username>`                    | `jobs_delete.ts:157`               |          |
| Likes (delete)                     | `https://x.com/<username>/likes`              | `jobs_delete.ts:262`               |          |
| Bookmarks (delete)                 | `https://x.com/i/bookmarks`                   | `jobs_delete.ts:362`               |          |
| Following list (unfollow)          | `https://x.com/<username>/following`          | `jobs_delete/helpers_pages.ts:106` |          |
| Profile settings (bio, banner)     | `https://x.com/settings/profile`              | `jobs_tombstone.ts:19,45`          |          |
| Audience settings (account lock)   | `https://x.com/settings/audience_and_tagging` | `jobs_tombstone.ts:229`            |          |

The proxy watches `x.com/i/api/graphql`, `x.com/i/api/1.1/dm`, and
`x.com/i/api/2/notifications/all.json` (`x_account_controller.ts:261`). Note
that `api.x.com/graphql` is _not_ watched, though the viewer lookup calls it
directly.

## GraphQL operations issued by Cyd

These identifiers rotate whenever X redeploys. Record the current value for
each during the walk.

| Operation                | Identifier in code       | Referrer sent                           | Source                             | Observed identifier | Observed referrer |
| ------------------------ | ------------------------ | --------------------------------------- | ---------------------------------- | ------------------- | ----------------- |
| `Viewer`                 | `WBT8ommFCSHiy3z2_4k1Vg` | `https://x.com/`                        | `graphql.ts:52`                    |                     |                   |
| `DeleteTweet` (posts)    | `VaenaVgh5q5ih7kvyVjgtg` | `https://x.com/<username>/with_replies` | `jobs_delete/helpers_tweets.ts:41` |                     |                   |
| `DeleteTweet` (retweets) | `VaenaVgh5q5ih7kvyVjgtg` | `https://x.com/<username>/with_replies` | `jobs_delete/helpers_tweets.ts:66` |                     |                   |
| `UnfavoriteTweet`        | `ZYKSe-w7KEslx3JhSIk5LA` | `https://x.com/<username>/likes`        | `jobs_delete/helpers_likes.ts:12`  |                     |                   |
| `DeleteBookmark`         | `Wlmlj2-xzyS1GN3a6cj-mQ` | `https://x.com/i/bookmarks`             | `jobs_delete/helpers_likes.ts:35`  |                     |                   |

Each identifier appears twice per call — once in the URL and once as `queryId`
in the body.

The read operations are never named in Cyd's code: they are whatever X's own
client issues while the automation scrolls. Record their names and identifiers
from the capture: the profile timeline, likes, bookmarks, the user lookup, the
post permalink, and the following list.

## Empty states, per timeline

Captured from an account with nothing in it. Record both halves: what the
response body carries, and what the rendered page carries, because the index
jobs check the DOM while the save work needs the response.

| Timeline                      | Route                           | What Cyd checks today                                      | Observed response signal | Observed DOM signal |
| ----------------------------- | ------------------------------- | ---------------------------------------------------------- | ------------------------ | ------------------- |
| Profile timeline              | `x.com/<username>`              | nothing — inferred from absent content                     |                          |                     |
| Profile timeline with replies | `x.com/<username>/with_replies` | nothing — inferred from absent content                     |                          |                     |
| Likes                         | `x.com/<username>/likes`        | `div[data-testid="emptyState"]`                            |                          |                     |
| Bookmarks                     | `x.com/i/bookmarks`             | `div[data-testid="emptyState"]`                            |                          |                     |
| Following list                | `x.com/<username>/following`    | nothing — a 2s timeout on the unfollow button means "none" |                          |                     |

## Elements

`testid` means the selector is anchored on a `data-testid` X sets deliberately.
`positional` means it is reached by structure or by index, which is the kind
that breaks without saying so.

### Session and login

| Step                            | Selector                                       | Kind       | Source          | Observed |
| ------------------------------- | ---------------------------------------------- | ---------- | --------------- | -------- |
| Dismiss the mobile bottom bar   | `div[data-testid="BottomBar"]`                 | testid     | `auth.ts:79`    |          |
| Click the last button inside it | `div[data-testid="BottomBar"]` → last `button` | positional | `auth.ts:80,85` |          |

### Saving posts

| Step                                  | Selector                                                                                                            | Kind           | Source                                               | Observed |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------- | -------- |
| Decide the timeline is empty          | _(no empty-state selector is passed)_                                                                               | **missing**    | `jobs_index.ts:57`                                   |          |
| Count posts present                   | `section article`                                                                                                   | positional     | `jobs_index.ts:58`                                   |          |
| Detect a section with no content      | `section`                                                                                                           | positional     | `jobs_index/helpers_shared.ts:30`                    |          |
| Wait for posts to appear              | `section article`                                                                                                   | positional     | `jobs_index.ts` via `indexContentWaitForInitialLoad` |          |
| Detect that posts loaded              | `section [data-testid="cellInnerDiv"]`                                                                              | testid         | `jobs_index/helpers_tweets.ts:10`                    |          |
| Count loaded cells                    | `section div[data-testid=cellInnerDiv]`                                                                             | testid         | `jobs_index/helpers_tweets.ts:28,36,68,84,117`       |          |
| Find the retry button after a failure | `main[role="main"] nav[role="navigation"] + section div[data-testid=cellInnerDiv]` → last cell, its single `button` | **positional** | `jobs_index/helpers_tweets.ts:47,57,77,135,141`      |          |
| Click retry when nothing loaded       | `main[role="main"] nav[role="navigation"] + div > button`                                                           | **positional** | `jobs_index/helpers_tweets.ts:111`                   |          |

The missing empty-state selector on the first row is the silent failure: with
nothing explicit to check, the job infers emptiness from the absence of
rendered posts. Record what X actually returns for an empty profile timeline.

### Saving likes and bookmarks

| Step                       | Selector                        | Kind       | Source                                          | Observed |
| -------------------------- | ------------------------------- | ---------- | ----------------------------------------------- | -------- |
| Empty state                | `div[data-testid="emptyState"]` | testid     | `jobs_index.ts:577` (likes), `:674` (bookmarks) |          |
| Count and wait for content | `article`                       | positional | `jobs_index.ts:578,675`                         |          |

### Saving a post permalink

| Step                           | Selector                                                           | Kind       | Source                             | Observed |
| ------------------------------ | ------------------------------------------------------------------ | ---------- | ---------------------------------- | -------- |
| Detect an already-deleted post | `div[data-testid="primaryColumn"] div[data-testid="error-detail"]` | testid     | `jobs_index/helpers_archive.ts:36` |          |
| Wait for the post              | `article[tabindex="-1"]`                                           | positional | `jobs_index/helpers_archive.ts:47` |          |

### Unfollowing

| Step                                | Selector                                             | Kind           | Source                               | Observed |
| ----------------------------------- | ---------------------------------------------------- | -------------- | ------------------------------------ | -------- |
| Wait for the following list         | `div[data-testid="cellInnerDiv"] button button`      | **positional** | `jobs_delete/helpers_pages.ts:116`   |          |
| Count accounts to unfollow          | `div[data-testid="cellInnerDiv"] button button`      | **positional** | `jobs_delete.ts:534`                 |          |
| Mouse over the nth Following button | `div[data-testid="cellInnerDiv"] button button`, nth | **positional** | `jobs_delete/helpers_unfollow.ts:31` |          |
| Click the nth Following button      | same, nth                                            | **positional** | `jobs_delete/helpers_unfollow.ts:41` |          |
| Wait for the confirm sheet          | `button[data-testid="confirmationSheetConfirm"]`     | testid         | `jobs_delete/helpers_unfollow.ts:51` |          |
| Click confirm                       | `button[data-testid="confirmationSheetConfirm"]`     | testid         | `jobs_delete/helpers_unfollow.ts:66` |          |

"The button inside the button inside the cell" is the most fragile selector in
the codebase. Record whether the Following button now carries a
`data-testid` of the `<userId>-unfollow` form.

### Tombstone: bio

| Step                             | Selector                                                                   | Kind           | Source                    | Observed |
| -------------------------------- | -------------------------------------------------------------------------- | -------------- | ------------------------- | -------- |
| Wait for the edit-profile dialog | `div[role="dialog"] textarea`                                              | positional     | `jobs_tombstone.ts:48`    |          |
| Click into the modal             | `div[role="group"][tabindex="0"]`                                          | positional     | `jobs_tombstone.ts:55`    |          |
| Reach the bio field              | up to 50 Tab presses until `document.activeElement.tagName === "TEXTAREA"` | **positional** | `jobs_tombstone.ts:60-90` |          |
| Save                             | `button[data-testid="Profile_Save_Button"]`                                | testid         | `jobs_tombstone.ts:204`   |          |

### Tombstone: account lock

| Step                            | Selector                                                 | Kind           | Source                  | Observed |
| ------------------------------- | -------------------------------------------------------- | -------------- | ----------------------- | -------- |
| Read the protect-posts checkbox | `document.querySelectorAll('input[type="checkbox"]')[0]` | **positional** | `jobs_tombstone.ts:234` |          |
| Click it                        | same, index 0                                            | **positional** | `jobs_tombstone.ts:245` |          |
| Wait for confirm                | `button[data-testid="confirmationSheetConfirm"]`         | testid         | `jobs_tombstone.ts:248` |          |
| Click confirm                   | `button[data-testid="confirmationSheetConfirm"]`         | testid         | `jobs_tombstone.ts:253` |          |

### Tombstone: banner

Not implemented. `runJobTombstoneUpdateBanner` loads the profile settings page,
sleeps two seconds, and reports success (`jobs_tombstone.ts:19-26`). Record
what the banner change actually requires so the job can be written.

### Direct messages

X replaced direct messages with X Chat and #708 withdraws the feature, so these
selectors are recorded for completeness rather than for repair.

| Step                                   | Selector                                                          | Kind           | Source                                                 | Observed |
| -------------------------------------- | ----------------------------------------------------------------- | -------------- | ------------------------------------------------------ | -------- |
| Wait for the conversation search field | `section input[type="text"]`                                      | positional     | `jobs_index.ts:221`, `jobs_delete/helpers_pages.ts:25` |          |
| Wait for the conversation list         | `section div div[role="tablist"] div[data-testid="cellInnerDiv"]` | positional     | `jobs_index.ts:239`, `jobs_delete/helpers_pages.ts:46` |          |
| Wait for one conversation              | `div[data-testid="DmActivityContainer"]`                          | testid         | `jobs_index.ts:413`                                    |          |
| Scroll a conversation                  | `div[data-testid="DmActivityViewport"]`                           | testid         | `jobs_index.ts:488`                                    |          |
| A conversation row                     | `div[data-testid="conversation"]`                                 | testid         | `jobs_delete/helpers_dms.ts:27,50,58,73`               |          |
| The last item in the row menu          | `div[data-testid="Dropdown"] div[role="menuitem"]:last-of-type`   | **positional** | `jobs_delete/helpers_dms.ts:93,107`                    |          |
| Confirm deletion                       | `button[data-testid="confirmationSheetConfirm"]`                  | testid         | `jobs_delete/helpers_dms.ts:115,130`                   |          |
