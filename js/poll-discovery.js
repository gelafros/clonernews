export const POLL_SEARCH_TIMEOUT_MS = 4000;

/**
 * Finds recent poll IDs by scanning backward from the latest item ID.
 * Stops searching when a timeout window is reached.
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

    const pollIds = [];
    const minItemId = Math.max(1, maxItemId - scanLimit);
    const startedAt = Date.now();
    let timedOut = false;

    for (let id = maxItemId; id >= minItemId && pollIds.length < maxPolls; id -= 1) {
        if (Date.now() - startedAt >= timeoutMs) {
            timedOut = true;
            break;
        }

        let item;

        try {
            item = await api.fetchItem(id);
        } catch {
            continue;
        }

        if (item && item.type === "poll") {
            pollIds.push(item.id);
        }
    }

    return { pollIds, timedOut };
}
