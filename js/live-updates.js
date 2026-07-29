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

// Creates a live-update controller that compares each poll with the previous one.
export function createLiveUpdates(api, getDisplayedPosts, showNotification) {
  let previousUpdatedIds = null;

  // Fetches current updates and notifies only for new updates to displayed posts.
  async function checkForUpdates() {
    const currentUpdatedIds = await api.fetchUpdatedItemIds();

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

  return { checkForUpdates };
}
