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
