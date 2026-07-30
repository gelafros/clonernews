// Returns displayed posts whose IDs appear for the first time in an update list.
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

// Formats updated post titles into a clear singular or plural notification.
export function formatUpdateMessage(updatedPosts) {
  const titles = updatedPosts.map((post) => `"${post.title}"`);

  if (titles.length === 1) {
    return `Updated post: ${titles[0]}`;
  }

  return `Updated posts: ${titles.join(", ")}`;
}

// Creates a live-update controller that compares each poll with the previous one.
export function createLiveUpdates(api, getDisplayedPosts, showNotification) {
  let previousUpdatedIds = null;
  let timerId = null;

  // Fetches current updates and notifies only for new updates to displayed posts.
  async function checkForUpdates() {
    let currentUpdatedIds;

    try {
      currentUpdatedIds = await api.fetchUpdatedItemIds();
    } catch {
      return;
    }

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

  // Starts one five-second timer after the first poll establishes a baseline.
  async function start(setIntervalFunction = setInterval) {
    if (timerId !== null) {
      return;
    }

    await checkForUpdates();
    timerId = setIntervalFunction(checkForUpdates, 5000);
  }

  return { checkForUpdates, start };
}
