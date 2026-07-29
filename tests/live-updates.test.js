import assert from "node:assert/strict";
import test from "node:test";

import {
  createLiveUpdates,
  findNewDisplayedUpdates,
} from "../js/live-updates.js";

test("findNewDisplayedUpdates returns only newly updated displayed posts", () => {
  const previousIds = [10, 20];
  const currentIds = [20, 30, 40];
  const displayedPosts = [
    { id: 30, title: "Updated story" },
    { id: 50, title: "Unchanged story" },
  ];

  const updates = findNewDisplayedUpdates(
    previousIds,
    currentIds,
    displayedPosts,
  );

  assert.deepEqual(updates, [{ id: 30, title: "Updated story" }]);
});

test("createLiveUpdates uses the first poll as a baseline", async () => {
  const updateLists = [[10], [10, 30]];
  const api = {
    fetchUpdatedItemIds: async () => updateLists.shift(),
  };
  const displayedPosts = [{ id: 30, title: "Updated story" }];
  const notifications = [];
  const liveUpdates = createLiveUpdates(
    api,
    () => displayedPosts,
    (posts) => notifications.push(posts),
  );

  await liveUpdates.checkForUpdates();
  assert.deepEqual(notifications, []);

  await liveUpdates.checkForUpdates();
  assert.deepEqual(notifications, [displayedPosts]);
});

test("createLiveUpdates starts only one five-second timer", async () => {
  const api = {
    fetchUpdatedItemIds: async () => [],
  };
  let timerCount = 0;
  const setIntervalFunction = (callback, delay) => {
    timerCount += 1;
    assert.equal(typeof callback, "function");
    assert.equal(delay, 5000);
    return timerCount;
  };
  const liveUpdates = createLiveUpdates(api, () => [], () => {});

  await liveUpdates.start(setIntervalFunction);
  await liveUpdates.start(setIntervalFunction);

  assert.equal(timerCount, 1);
});
