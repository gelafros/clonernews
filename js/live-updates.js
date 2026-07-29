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
