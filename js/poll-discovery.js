/** @type {number} Timeout duration for poll scanning in milliseconds */
export const POLL_SEARCH_TIMEOUT_MS = 4000;

/** @type {number} Number of items to fetch concurrently in a single batch */
const POLL_BATCH_SIZE = 5;

/** @type {number|null} The next item ID to start scanning from, or null if scanning from maxitem */
let nextScanStartId = null;

/**
 * Finds recent poll IDs by scanning backward from the latest item ID.
 * Fetches items in parallel batches to reduce total scan time and avoid
 * sequential API calls.
 * @param {{ fetchMaxItemId: () => Promise<number>, fetchItem: (id: number) => Promise<any> }} api - Hacker News API helpers.
 * @param {number} [maxPolls=20] - Maximum number of poll IDs to collect.
 * @param {number} [scanLimit=4000] - Maximum number of item IDs to scan.
 * @param {number} [timeoutMs=POLL_SEARCH_TIMEOUT_MS] - Maximum poll-search time budget in ms.
 * @returns {Promise<{ pollIds: number[], timedOut: boolean }>} Poll IDs and timeout flag.
 */
export async function findRecentPollIds(
    api,
    maxPolls = 20,
    scanLimit = 4000,
    timeoutMs = POLL_SEARCH_TIMEOUT_MS,
) {
    let maxItemId;

    try {
        maxItemId = await api.fetchMaxItemId();
    } catch {
        return { pollIds: [], timedOut: false };
    }

    if (nextScanStartId === null || nextScanStartId > maxItemId) {
        nextScanStartId = maxItemId;
    }

    const pollIds = [];
    const startId = nextScanStartId;
    const minItemId = Math.max(1, startId - scanLimit + 1);
    const startedAt = Date.now();
    let timedOut = false;
    let currentId = startId;

    // Fetch items in parallel batches instead of one at a time.
    // Each batch of POLL_BATCH_SIZE requests runs concurrently, then the
    // next batch starts — balancing speed against API request volume.
    while (currentId >= minItemId && pollIds.length < maxPolls) {
        if (Date.now() - startedAt >= timeoutMs) {
            timedOut = true;
            break;
        }

        // Collect the IDs for this batch without going below minItemId.
        const batchIds = [];
        for (
            let i = 0;
            i < POLL_BATCH_SIZE && currentId >= minItemId;
            i += 1, currentId -= 1
        ) {
            batchIds.push(currentId);
        }

        // Fetch all IDs in this batch concurrently.
        const batchItems = await Promise.all(
            batchIds.map(async (id) => {
                try {
                    return await api.fetchItem(id);
                } catch {
                    return null;
                }
            }),
        );

        // Collect any polls found in this batch.
        for (const item of batchItems) {
            if (item && item.type === "poll" && pollIds.length < maxPolls) {
                pollIds.push(item.id);
            }
        }
    }

    // Resume at the next unscanned ID on the next call.
    nextScanStartId = currentId;
    if (nextScanStartId < 1) {
        nextScanStartId = null;
    }

    return { pollIds, timedOut };
}
