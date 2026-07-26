import assert from "node:assert/strict";
import test from "node:test";

import { createHackerNewsApi } from "../js/api.js";

test("fetchItem reuses a cached item instead of requesting it twice", async () => {
  let requestCount = 0;
  const expectedItem = { id: 123, title: "Cached item", type: "story" };
  const requestJson = async (url) => {
    requestCount += 1;
    assert.equal(url, "https://hacker-news.firebaseio.com/v0/item/123.json");
    return expectedItem;
  };
  const api = createHackerNewsApi(requestJson);

  const firstItem = await api.fetchItem(123);
  const secondItem = await api.fetchItem(123);

  assert.equal(firstItem, expectedItem);
  assert.equal(secondItem, expectedItem);
  assert.equal(requestCount, 1);
});

test("fetchNewStoryIds requests the new stories endpoint", async () => {
  const expectedIds = [101, 102, 103];
  const requestJson = async (url) => {
    assert.equal(url, "https://hacker-news.firebaseio.com/v0/newstories.json");
    return expectedIds;
  };
  const api = createHackerNewsApi(requestJson);

  const storyIds = await api.fetchNewStoryIds();

  assert.equal(storyIds, expectedIds);
});

test("fetchJobStoryIds requests the job stories endpoint", async () => {
  const expectedIds = [201, 202];
  const requestJson = async (url) => {
    assert.equal(url, "https://hacker-news.firebaseio.com/v0/jobstories.json");
    return expectedIds;
  };
  const api = createHackerNewsApi(requestJson);

  const jobIds = await api.fetchJobStoryIds();

  assert.equal(jobIds, expectedIds);
});
