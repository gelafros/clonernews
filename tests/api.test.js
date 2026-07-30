import assert from "node:assert/strict";
import test from "node:test";

import { createHackerNewsApi, requestJson } from "../js/api.js";

test("requestJson fetches a URL and returns its JSON data", async () => {
  const expectedData = { id: 401, type: "story" };
  const fetchJson = async (url) => {
    assert.equal(url, "https://hacker-news.firebaseio.com/v0/item/401.json");
    return {
      ok: true,
      json: async () => expectedData,
    };
  };

  const data = await requestJson(
    "https://hacker-news.firebaseio.com/v0/item/401.json",
    fetchJson,
  );

  assert.equal(data, expectedData);
});

test("requestJson rejects an unsuccessful HTTP response", async () => {
  const fetchJson = async () => ({ ok: false, status: 404 });

  await assert.rejects(
    requestJson("https://hacker-news.firebaseio.com/v0/item/404.json", fetchJson),
    /Request failed with status 404/,
  );
});

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

test("fetchItem reuses an in-flight request for the same item", async () => {
  let requestCount = 0;
  let resolveRequest;
  const expectedItem = { id: 124, title: "In-flight item", type: "story" };
  const requestJson = () => {
    requestCount += 1;
    return new Promise((resolve) => {
      resolveRequest = resolve;
    });
  };
  const api = createHackerNewsApi(requestJson);

  const firstRequest = api.fetchItem(124);
  const secondRequest = api.fetchItem(124);
  resolveRequest(expectedItem);

  const [firstItem, secondItem] = await Promise.all([firstRequest, secondRequest]);

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

test("fetchUpdatedItemIds returns item IDs from the live updates endpoint", async () => {
  const expectedIds = [301, 302];
  const requestJson = async (url) => {
    assert.equal(url, "https://hacker-news.firebaseio.com/v0/updates.json");
    return { items: expectedIds, profiles: ["user1"] };
  };
  const api = createHackerNewsApi(requestJson);

  const updatedItemIds = await api.fetchUpdatedItemIds();

  assert.equal(updatedItemIds, expectedIds);
});

test("fetchMaxItemId requests the maxitem endpoint", async () => {
  const expectedMaxId = 999;
  const requestJson = async (url) => {
    assert.equal(url, "https://hacker-news.firebaseio.com/v0/maxitem.json");
    return expectedMaxId;
  };
  const api = createHackerNewsApi(requestJson);

  const maxId = await api.fetchMaxItemId();

  assert.equal(maxId, expectedMaxId);
});
