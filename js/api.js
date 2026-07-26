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

  return { fetchItem };
}
