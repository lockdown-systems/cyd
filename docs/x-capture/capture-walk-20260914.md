# X capture walk — 2026-09-14

The ordered script for the proxy session that establishes ground truth for
#709. Work down it in order and tick as you go.

**Walk order matters.** Deleting destroys the data the read captures need, so
every non-destructive flow is walked to completion first. Nothing in part 3
happens until parts 1 and 2 are done and the HAR is saved.

## Before you start

- [ ] Seed the main test account (see `scripts/x-capture/README.md`)
- [ ] Have a second test account with at least one post, for the orphaned
      retweet
- [ ] Have a third test account that is completely empty, for the empty states
- [ ] Confirm the main account shows three or more pages on posts, likes, and
      bookmarks by scrolling each to the bottom yourself
- [ ] Confirm the main account is **not** protected — X disables reposting for
      protected accounts, so the retweet and quote shapes cannot exist on one.
      The account-lock step in part 3 is where it gets locked
- [ ] Open Chromium on the capture account's profile
      (`chromium --user-data-dir="$PWD/capture/profiles/<handle>"`), open
      DevTools on the Network tab, tick **Preserve log** and **Disable cache**

Keep one HAR per part. If DevTools gets slow, save and clear, then keep going —
the decoder takes several HARs.

## 1. Non-destructive flows, main account

Scroll each timeline to the _very bottom_, so that pagination is exercised past
the first cursor.

- [ ] Profile timeline: `x.com/<username>` — scroll to the bottom
- [ ] Profile timeline with replies: `x.com/<username>/with_replies` — scroll to
      the bottom
- [ ] Likes: `x.com/<username>/likes` — scroll to the bottom
- [ ] Bookmarks: `x.com/i/bookmarks` — scroll to the bottom
- [ ] Following list: `x.com/<username>/following` — scroll to the bottom
- [ ] Open the permalink of one ordinary post
- [ ] Open the permalink of the self-thread
- [ ] Open the permalink of the quote post
- [ ] Open the permalink of the post with one image
- [ ] Open the permalink of the post with four images
- [ ] Open the permalink of the video post
- [ ] Open the permalink of the poll
- [ ] Open the permalink of the long-form post
- [ ] Open the permalink of the link-card post
- [ ] Open the permalink of the retweet whose original was deleted
- [ ] Reload `x.com/home` once, to capture the user lookup (`Viewer`)

Save the HAR as `capture/<date>/raw/01-read-main.har`.

While you are here, work down
`docs/x-capture/element-inventory-20260914.md` with the page inspector open and
fill in the **Observed** column for every read-side element.

## 2. Empty states, empty account

Open the empty account's own profile directory, so the capture account's
session is not disturbed:

```
chromium --user-data-dir="$PWD/capture/profiles/<empty-handle>"
```

- [ ] Profile timeline: `x.com/<empty-username>` — this is the one the ticket
      most needs, since the posts job currently has no explicit empty-state
      signal at all
- [ ] Profile timeline with replies: `x.com/<empty-username>/with_replies`
- [ ] Likes: `x.com/<empty-username>/likes`
- [ ] Bookmarks: `x.com/i/bookmarks`
- [ ] Following list: `x.com/<empty-username>/following`

Fill in the **Empty states, per timeline** table in the element inventory as you
go: both what the response body carries and what the rendered page carries. The
index jobs check the page; the save work needs the response.

Save the HAR as `capture/<date>/raw/02-empty.har`.

For each, note in the inventory which explicit marker X returns, and whether
the marker is in the response body, in the rendered DOM, or in both.

## 3. Destructive flows, main account — least to most

Only after parts 1 and 2 are saved.

- [ ] Delete three or four ordinary posts
- [ ] Undo one retweet
- [ ] Unlike three or four posts
- [ ] Un-bookmark three or four posts
- [ ] Unfollow one or two accounts
- [ ] Change the profile banner
- [ ] Change the bio
- [ ] Lock the account, then unlock it — note what happens to the repost
      control while it is locked

Save the HAR as `capture/<date>/raw/03-destructive.har`.

For every one of these, the thing being captured is as much the **referrer** X's
own client sends as the mutation itself. The decoder reports referrers per
operation; check that each one is there.

Work down the delete-side half of the element inventory as you go.

## 4. Rate limits

A rate limit cannot be scheduled, so take it when it comes. If at any point a
response arrives with HTTP 200 carrying an `errors` array, that is the shape
the save work needs — the decoder flags these under "Rate limits reported
inside a successful response".

- [ ] At least one rate-limit response captured, with its HTTP status recorded
- [ ] Note whether `x-rate-limit-*` headers came with it

This is the one acceptance criterion nothing can guarantee, and #710 and #711
both need the fixture, so give it a deliberate attempt rather than hoping.

What provokes one, in rough order of reliability:

1. Page the likes timeline to the bottom, reload, and do it again, several
   times in a row without pausing.
2. Do the same on the following list, which historically has the tightest
   limit of the read surfaces.
3. Open twenty or so post permalinks in quick succession.

When a limit does arrive, capture it whole: the status line, the response body,
and the response headers. If the body is JSON with an `errors` array _and_ the
status is 200, that is precisely the disguised shape the save work needs — save
that HAR separately rather than appending to it.

## 5. Decode

```
npx tsx scripts/x-capture/decode-har.ts capture/<date>/raw/01-read-main.har --out capture/<date>/decoded/01-read-main
npx tsx scripts/x-capture/decode-har.ts capture/<date>/raw/02-empty.har      --out capture/<date>/decoded/02-empty
npx tsx scripts/x-capture/decode-har.ts capture/<date>/raw/03-destructive.har --out capture/<date>/decoded/03-destructive
```

Read each `SUMMARY.md`. Between them they should answer:

- [ ] Current route for the profile timeline, likes, bookmarks, and following
- [ ] GraphQL operation name and current identifier for every read
- [ ] GraphQL operation name and current identifier for every delete
- [ ] Referrer sent with every delete mutation
- [ ] The explicit empty-state signal for every timeline, including the profile
      timeline
- [ ] At least one rate limit, with its HTTP status

## 6. Commit only what the tests need

```
npx tsx scripts/x-capture/promote-fixture.ts \
  capture/<date>/decoded/01-read-main/operations/UserTweets/01.json \
  capture/<date>/decoded/01-read-main/operations/UserTweets/02.json \
  capture/<date>/decoded/01-read-main/operations/UserTweets/03.json
```

That writes `testdata/x/XUserTweets_<date>_1.json` and so on, and prints the
line to add to `test_fixtures.ts`.

- [ ] Three pages of the profile timeline
- [ ] Three pages of likes
- [ ] Three pages of bookmarks
- [ ] One empty profile timeline
- [ ] One empty likes and one empty bookmarks timeline
- [ ] One rate-limit response
- [ ] One response per awkward content shape, if the shape is not already
      covered by a page above
- [ ] The raw HAR is **not** committed — `capture/` is ignored
- [ ] Skim each promoted fixture for anything from a real person you did not
      mean to commit

## 7. Record what you learned

- [ ] `docs/x-capture/element-inventory-20260914.md` has an **Observed** entry
      on every row
- [ ] Anything surprising written up in the issue
