# X capture tooling

Tooling for the capture sessions that establish how X behaves today
(lockdown-systems/cyd#709). It is not part of the Cyd build: nothing here is
imported by the app, and the root `package.json` does not depend on it.

Three pieces:

- **`seed.ts`** drives a real Chromium to fill a test account with enough data,
  and enough awkward data, to make a capture worth running.
- **`decode-har.ts`** turns a DevTools HAR export into decoded per-operation
  JSON, plus a summary of routes, GraphQL identifiers, referrers, rate limits,
  and empty-state signals.
- **`promote-fixture.ts`** copies the few decoded responses the tests need into
  `testdata/x/`, using the existing dated filename convention.

The walk itself is `docs/x-capture/capture-walk-20260914.md`. The element
inventory it fills in is `docs/x-capture/element-inventory-20260914.md`.

Everything either script writes lands under `capture/`, which is git-ignored.
Raw HARs are never committed.

## Setup

On Arch:

```
sudo pacman -S --needed chromium ffmpeg
cd scripts/x-capture && npm install
```

`npm install` here pulls `playwright-core` only, which does not download its own
browsers — the seeder drives the system Chromium at `/usr/bin/chromium`. Set
`CHROMIUM_PATH` if yours is somewhere else.

Generate the media the seed plan attaches to posts:

```
./scripts/x-capture/make-media.sh
```

## Seeding

Use test accounts, never a real one. The seeder posts, likes, bookmarks, and
follows under the logged-in account.

Two things to be clear about before running it.

**The browser profile holds a live session.** `capture/profiles/<handle>` keeps
X's authentication cookies in the clear, outside the Cyd credential store. In
Cyd's terms that is an account-control credential, so treat the directory as
one: test accounts only, and delete the profile when the capture is done. It is
git-ignored, but git-ignored is not the same as protected.

**Automating X risks the account.** #709 says the capture walk cannot be
automated because X's anti-automation measures require a human, and that is
true of the walk. Seeding is automated here as a deliberate trade: doing ~200
actions by hand is worse. X may still lock the account. Seed an account you can
afford to lose, and if X starts challenging the session, stop.

Log in once. The profile persists in `capture/profiles/<handle>`, so later runs
reuse the session:

```
npx tsx scripts/x-capture/seed.ts --account <handle> --task login
```

See the plan without touching X:

```
npx tsx scripts/x-capture/seed.ts --account <handle> --task all --dry-run
```

Then seed. Doing it in stages is easier to supervise than one long run:

```
npx tsx scripts/x-capture/seed.ts --account <handle> --task shapes --targets https://x.com/someone/status/123,https://x.com/else/status/456
npx tsx scripts/x-capture/seed.ts --account <handle> --task posts
npx tsx scripts/x-capture/seed.ts --account <handle> --task likes
npx tsx scripts/x-capture/seed.ts --account <handle> --task bookmarks
npx tsx scripts/x-capture/seed.ts --account <handle> --task follows
```

`--targets` are live posts by other accounts, used for the quote posts and
retweets. `--count N` overrides how many filler posts, likes, and bookmarks to
make; the default is 61 each, which clears three pages of twenty. The default
follow count is 21, enough for the following list to page once.

Two steps stop and ask you to do them in the open browser window, then
continue:

- **The long-form post** needs a premium account and X's own long-form
  composer, which the ordinary composer will not stand in for.
- **The orphaned retweet** needs two accounts: retweet a post from the second
  test account, then delete it from that account.

Both are recorded as manual steps rather than as selector failures, so they do
not pollute the selector evidence.

### When it stops

X is hostile to automation and the point of this exercise is that we do not yet
know what its interface looks like. So the seeder stops rather than pushes:

- A selector it cannot find is screenshotted to
  `capture/seed/<account>/failures/`, appended to
  `capture/seed/<account>/selector-issues.jsonl`, and you are asked whether to
  retry, skip, or quit. **Those entries are findings** — they belong in the
  element inventory.
- If X interrupts with a verification or login flow, the run stops and hands the
  window to you. Clear it by hand, then retry.
- Progress is recorded per action in `capture/seed/<account>/progress.jsonl`, so
  quitting and resuming picks up where it left off rather than double-posting.

Pacing is deliberately slow: four to nine seconds between actions, and a minute
off every fifteen. Seeding an account takes a couple of hours. Leave it running
and check on it.

## Capturing

Walk `docs/x-capture/capture-walk-20260914.md` in a browser with DevTools open
on the Network tab, **Preserve log** and **Disable cache** ticked. Export with
right-click → **Copy all as HAR (with sensitive data)**, which is the one that
includes request headers, so the referrers survive.

Save the HARs under `capture/<date>/raw/`.

## Decoding

```
npx tsx scripts/x-capture/decode-har.ts capture/<date>/raw/01-read-main.har --out capture/<date>/decoded/01-read-main
```

Writes, per operation, the decoded response body and a `.meta.json` beside it
with the route, the rotating identifier, the referrer, the request body, any
error array, rate-limit headers, empty-state markers, and a count of timeline
entries by kind. Also writes `SUMMARY.md` and `calls.json` across the whole
capture.

Only the referrer is kept from the request headers, so no cookies or
authorization tokens reach the decoded output. Response bodies are kept whole,
because their shape is the point — check a fixture before committing it.

## Promoting fixtures

```
npx tsx scripts/x-capture/promote-fixture.ts capture/<date>/decoded/01-read-main/operations/Bookmarks/01.json
```

Names the file `testdata/x/XBookmarks_<date>.json` and prints the accessor line
for `src/renderer/src/view_models/XViewModel/test_fixtures.ts`. Pass several
files from one operation to number them, `--name` to rename the operation, and
`--force` to replace an existing fixture.
