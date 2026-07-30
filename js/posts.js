/** @type {number[]} All merged and sorted item IDs */
let allItems = [];

/** @type {number} The current position in the items array */
let indexOffset = 0;

/**
 * Initializes and sorts the items feed.
 *
 * @param {object} api - The Hacker News API instance.
 * @param {number[]} newStoryIds - The latest story/poll IDs.
 * @param {number[]} newJobStoryIds - The latest job IDs.
 */
export function initItems(api, newStoryIds, newJobStoryIds) {
  const mergedIds = [...newStoryIds, ...newJobStoryIds];
  // Deduplicate so the same post cannot appear twice across feed modes.
  allItems = Array.from(new Set(mergedIds));
  allItems.sort((a, b) => b - a);
  indexOffset = 0;
}

/**
 * Returns the next batch of up to 15 item IDs.
 *
 * @returns {number[]} Array of item IDs.
 */
export function getNextBatch() {
  // Fixed-size batches keep rendering consistent with the load-more UX.
  const batch = allItems.slice(indexOffset, indexOffset + 15);
  indexOffset += 15;
  return batch;
}

/**
 * Checks if there are more items left to load.
 *
 * @returns {boolean} True if more items exist.
 */
export function hasMore() {
  return indexOffset < allItems.length;
}

/**
 * Returns all item IDs that have been loaded so far.
 *
 * @returns {number[]} Array of loaded item IDs.
 */
export function getLoadedIds() {
  return allItems.slice(0, indexOffset);
}