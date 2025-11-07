import type { XViewModel } from "../view_model";

export async function indexTweetsHandleRateLimit(
  vm: XViewModel,
): Promise<boolean> {
  vm.log("indexTweetsHandleRateLimit", vm.progress);

  await vm.waitForPause();

  if (await vm.doesSelectorExist('section [data-testid="cellInnerDiv"]')) {
    vm.log("indexTweetsHandleRateLimit", "tweets have loaded");
    // Tweets have loaded. If there are tweets, the HTML looks like of like this:
    // <section>
    //     <div>
    //         <div>
    //             <div data-testid="cellInnerDiv"></div>
    //             <div data-testid="cellInnerDiv"></div>
    //             <div data-testid="cellInnerDiv>...</div>
    //                 <div>...</div>
    //                 <button>...</button>
    //             </div>
    //         </div>
    //     </div>
    // </section>

    // Check if we get more tweets by scrolling down, even without clicking any buttons
    let numberOfDivsBefore = await vm.countSelectorsFound(
      "section div[data-testid=cellInnerDiv]",
    );
    await vm.sleep(2000);
    await vm.scrollUp(2000);
    await vm.sleep(2000);
    await vm.scrollToBottom();
    await vm.sleep(2000);
    let numberOfDivsAfter = await vm.countSelectorsFound(
      "section div[data-testid=cellInnerDiv]",
    );
    if (numberOfDivsAfter > numberOfDivsBefore) {
      // More tweets loaded
      return true;
    }

    // If the retry button does not exist, try scrolling up and down again to trigger it
    // The retry button should be in the last cellInnerDiv, and it should have only 1 button in it
    if (
      (await vm.countSelectorsWithinElementLastFound(
        'main[role="main"] nav[role="navigation"] + section div[data-testid=cellInnerDiv]',
        "button",
      )) != 1
    ) {
      await vm.scrollUp(2000);
      await vm.sleep(2000);
      await vm.scrollToBottom();
      await vm.sleep(2000);
      if (
        (await vm.countSelectorsWithinElementLastFound(
          'main[role="main"] nav[role="navigation"] + section div[data-testid=cellInnerDiv]',
          "button",
        )) != 1
      ) {
        vm.log("indexTweetsHandleRateLimit", "retry button does not exist");
        return false;
      }
    }

    // Count divs before clicking retry button
    numberOfDivsBefore = await vm.countSelectorsFound(
      "section div[data-testid=cellInnerDiv]",
    );
    if (numberOfDivsBefore > 0) {
      // The last one is the one with the button
      numberOfDivsBefore--;
    }

    // Click the retry button
    await vm.scriptClickElementWithinElementLast(
      'main[role="main"] nav[role="navigation"] + section div[data-testid=cellInnerDiv]',
      "button",
    );
    await vm.sleep(2000);

    // Count divs after clicking retry button
    numberOfDivsAfter = await vm.countSelectorsFound(
      "section div[data-testid=cellInnerDiv]",
    );

    // If there are more divs after, it means more tweets loaded
    return numberOfDivsAfter > numberOfDivsBefore;
  } else {
    vm.log("indexTweetsHandleRateLimit", "no tweets have loaded");
    // No tweets have loaded. If there are no tweets, the HTML looks kind of like this:
    // <main role="main">
    //     <div>
    //         <div>
    //             <div>
    //                 <div>
    //                     <div>
    //                         <nav role="navigation">
    //                         <div>
    //                             <div>...</div>
    //                             <button>...</button>
    //                         </div>
    //                     </div>
    //                 </div>
    //             </div>
    //         </div>
    //     </div>
    // </main>

    // Click retry button
    await vm.scriptClickElement(
      'main[role="main"] nav[role="navigation"] + div > button',
    );

    // Count divs after clicking retry button
    const numberOfDivsAfter = await vm.countSelectorsFound(
      "section div[data-testid=cellInnerDiv]",
    );

    // If there are more divs after, it means more tweets loaded
    return numberOfDivsAfter > 0;
  }
}

// Check if there is a "Something went wrong" message, and click retry if there is
export async function indexTweetsCheckForSomethingWrong(
  vm: XViewModel,
): Promise<void> {
  // X might show a "Something went wrong" message if an AJAX request fails for a reason other than
  // being rate limited. If this happens, we need to click the retry button to try again.
  if (
    (await vm.doesSelectorExist('section div[data-testid="cellInnerDiv"]')) &&
    // If the last cellInnerDiv has just one button, that should be the retry button
    (await vm.countSelectorsWithinElementLastFound(
      'main[role="main"] nav[role="navigation"] + section div[data-testid=cellInnerDiv]',
      "button",
    )) == 1
  ) {
    // Click retry
    await vm.scriptClickElementWithinElementLast(
      'main[role="main"] nav[role="navigation"] + section div[data-testid=cellInnerDiv]',
      "button",
    );
    await vm.sleep(2000);
  }
}

// When we get to the bottom of a tweets or likes feed, verify that we're actually
// at the bottom. Do this by scrolling up, then down again, and making sure we still got the
// final API response.
// Returns true if we're actually at the bottom, false if we're not.
export async function indexTweetsVerifyThereIsNoMore(
  vm: XViewModel,
): Promise<boolean> {
  vm.log("indexTweetsVerifyThereIsNoMore", "verifying there is no more tweets");
  await vm.scrollToBottom();

  // Record the current number of tweets, retweets, and likes
  const currentTweetsIndexed = vm.progress.tweetsIndexed;
  const currentRetweetsIndexed = vm.progress.retweetsIndexed;
  const currentLikesIndexed = vm.progress.likesIndexed;
  const currentUnknownIndex = vm.progress.unknownIndexed;

  // Reset the thereIsMore flag
  await window.electron.X.resetThereIsMore(vm.account.id);

  // Try to trigger more API requests by scrolling up and down
  await vm.sleep(500);
  await vm.scrollUp(2000);
  await vm.sleep(1500);
  await vm.scrollToBottom();
  await vm.sleep(1500);

  // Parse so far
  vm.progress = await window.electron.X.indexParseTweets(vm.account.id);
  vm.log("indexTweetsVerifyThereIsNoMore", ["parsed tweets", vm.progress]);

  // Check if we're done again
  if (!(await window.electron.X.indexIsThereMore(vm.account.id))) {
    vm.log(
      "indexTweetsVerifyThereIsNoMore",
      "got the final API response again, so we are done",
    );
    return true;
  }

  // It's also possible that the final API response did not load, in which case we can see if the
  // progress was updated. If it was not, we're done.
  if (
    vm.progress.tweetsIndexed == currentTweetsIndexed &&
    vm.progress.retweetsIndexed == currentRetweetsIndexed &&
    vm.progress.likesIndexed == currentLikesIndexed &&
    vm.progress.unknownIndexed == currentUnknownIndex
  ) {
    vm.log(
      "indexTweetsVerifyThereIsNoMore",
      "the progress was not updated, we are done",
    );
    return true;
  }

  vm.log(
    "indexTweetsVerifyThereIsNoMore",
    "we are not done, good thing we checked",
  );
  return false;
}
