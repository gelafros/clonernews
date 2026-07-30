/**
 * Returns displayed posts whose IDs appear for the first time in the current update list.
 * Filters out IDs that were already present in the previous poll so only genuinely
 * new updates trigger a notification.
 * @param {number[]} previousIds - Item IDs returned by the previous update poll.
 * @param {number[]} currentIds - Item IDs returned by the current update poll.
 * @param {{ id: number, title: string }[]} displayedPosts - Posts currently visible in the feed.
 * @returns {{ id: number, title: string }[]} Posts that are newly updated since the last poll.
 */
export function findNewDisplayedUpdates(
  previousIds,
  currentIds,
  displayedPosts,
) {
  const previousIdSet = new Set(previousIds);
  const newIdSet = new Set(
    currentIds.filter((id) => !previousIdSet.has(id)),
  );

  return displayedPosts.filter((post) => newIdSet.has(post.id));
}

/**
 * Formats updated post titles into a clear singular or plural notification string.
 * @param {{ title: string }[]} updatedPosts - Posts that were updated.
 * @returns {string} A human-readable notification message listing updated post titles.
 */
export function formatUpdateMessage(updatedPosts) {
  const titles = updatedPosts.map((post) => `"${post.title}"`);

  if (titles.length === 1) {
    return `Updated post: ${titles[0]}`;
  }

  return `Updated posts: ${titles.join(", ")}`;
}

/**
 * Creates a live-update controller that polls the Hacker News updates endpoint
 * every five seconds and notifies the app when a displayed post appears in the results.
 * Keeps only one active timer regardless of how many times start is called.
 * @param {object} api - The Hacker News API instance.
 * @param {() => { id: number, title: string }[]} getDisplayedPosts - Returns the currently displayed posts.
 * @param {(posts: { id: number, title: string }[]) => void} showNotification - Called with any newly updated posts.
 * @returns {{ checkForUpdates: Function, start: Function }}
 */
export function createLiveUpdates(api, getDisplayedPosts, showNotification) {
  let previousUpdatedIds = null;
  let timerId = null;

  /**
   * Fetches the current update list and notifies only for new updates to displayed posts.
   * Silently ignores failed network requests so a transient error does not stop the timer.
   * Skips the network request entirely while the browser tab is not visible.
   * @returns {Promise<void>}
   */
  async function checkForUpdates() {
    // Skip network requests while the tab is hidden to respect the API.
    if (typeof document !== "undefined" && document.hidden) {
      return;
    }

    let currentUpdatedIds;

    try {
      currentUpdatedIds = await api.fetchUpdatedItemIds();
    } catch {
      return;
    }

    // first poll establishes a baseline; no notification is sent on startup
    if (previousUpdatedIds === null) {
      previousUpdatedIds = currentUpdatedIds;
      return;
    }

    const updatedPosts = findNewDisplayedUpdates(
      previousUpdatedIds,
      currentUpdatedIds,
      getDisplayedPosts(),
    );
    previousUpdatedIds = currentUpdatedIds;

    if (updatedPosts.length > 0) {
      showNotification(updatedPosts);
    }
  }

  /**
   * Starts one five-second polling interval after establishing a baseline on the first call.
   * Subsequent calls are ignored if a timer is already active.
   * @param {typeof setInterval} [setIntervalFunction=setInterval] - Optional override used in tests.
   * @returns {Promise<void>}
   */
  async function start(setIntervalFunction = setInterval) {
    if (timerId !== null) {
      return;
    }

    await checkForUpdates();
    timerId = setIntervalFunction(checkForUpdates, 5000);
  }

  return { checkForUpdates, start };
}
