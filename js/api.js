const API_BASE_URL = "https://hacker-news.firebaseio.com/v0";

// Creates API methods that use the provided function to request JSON data.
export function createHackerNewsApi(requestJson) {
  const itemCache = new Map();

  // Returns one item, reusing the in-memory cache after its first request.
  async function fetchItem(id) {
    if (itemCache.has(id)) {
      return itemCache.get(id);
    }

    const item = await requestJson(`${API_BASE_URL}/item/${id}.json`);
    itemCache.set(id, item);
    return item;
  }

  // Returns the Hacker News IDs currently listed as new stories.
  async function fetchNewStoryIds() {
    return requestJson(`${API_BASE_URL}/newstories.json`);
  }

  // Returns the Hacker News IDs currently listed as job posts.
  async function fetchJobStoryIds() {
    return requestJson(`${API_BASE_URL}/jobstories.json`);
  }

  // Returns IDs for items that Hacker News reports as recently changed.
  async function fetchUpdatedItemIds() {
    const updates = await requestJson(`${API_BASE_URL}/updates.json`);
    return updates.items;
  }

  return {
    fetchItem,
    fetchNewStoryIds,
    fetchJobStoryIds,
    fetchUpdatedItemIds,
  };
}
