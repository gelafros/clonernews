const API_BASE_URL = "https://hacker-news.firebaseio.com/v0";

/**
 * Fetches one URL with the browser's built-in fetch and returns its JSON data.
 * Tests can pass a fake fetchFunction to avoid making a real network request.
 * @param {string} url - The URL to fetch.
 * @param {typeof fetch} [fetchFunction=fetch] - Optional fetch function override for testing.
 * @returns {Promise<any>} The parsed JSON response.
 */
export async function requestJson(url, fetchFunction = fetch) {
  const response = await fetchFunction(url);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Creates API methods that use the provided function to request JSON data.
 * @param {typeof requestJson} requestJson - The function to use for requesting JSON data.
 * @returns {object} An object containing the Hacker News API methods.
 */
export function createHackerNewsApi(requestJson) {
  const itemCache = new Map();

  /**
   * Returns one item, sharing a pending request and caching a successful result.
   * @param {number} id - The Hacker News item ID.
   * @returns {Promise<any>} The item data.
   */
  async function fetchItem(id) {
    if (itemCache.has(id)) {
      return itemCache.get(id);
    }

    const itemRequest = requestJson(`${API_BASE_URL}/item/${id}.json`);
    itemCache.set(id, itemRequest);

    try {
      const item = await itemRequest;
      itemCache.set(id, item);
      return item;
    } catch (error) {
      itemCache.delete(id);
      throw error;
    }
  }

  /**
   * Returns the Hacker News IDs currently listed as new stories.
   * @returns {Promise<number[]>} The story IDs.
   */
  async function fetchNewStoryIds() {
    return requestJson(`${API_BASE_URL}/newstories.json`);
  }

  /**
   * Returns the Hacker News IDs currently listed as job posts.
   * @returns {Promise<number[]>} The job IDs.
   */
  async function fetchJobStoryIds() {
    return requestJson(`${API_BASE_URL}/jobstories.json`);
  }

  /**
   * Returns IDs for items that Hacker News reports as recently changed.
   * @returns {Promise<number[]>} The updated item IDs.
   */
  async function fetchUpdatedItemIds() {
    const updates = await requestJson(`${API_BASE_URL}/updates.json`);
    return updates.items;
  }

  /**
    * Returns the current maximum item ID from Hacker News.
    * Used by poll discovery to scan recent items backward.
   * @returns {Promise<number>} The latest known item ID.
   */
  async function fetchMaxItemId() {
    return requestJson(`${API_BASE_URL}/maxitem.json`);
  }

  return {
    fetchItem,
    fetchNewStoryIds,
    fetchJobStoryIds,
    fetchUpdatedItemIds,
    fetchMaxItemId,
  };
}
