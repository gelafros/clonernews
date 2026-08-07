export const POLL_SEARCH_TIMEOUT_MS = 100000;
const POLL_DISCOVERY_URL = "https://hn.algolia.com/api/v1/search_by_date?tags=poll";

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
    scanLimit = 10000,
    timeoutMs = POLL_SEARCH_TIMEOUT_MS,
) {
    void api;
    void scanLimit;

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
        timeoutController.abort();
    }, timeoutMs);

    try {
        const response = await fetch(POLL_DISCOVERY_URL, {
            signal: timeoutController.signal,
        });

        if (!response.ok) {
            return { pollIds: [], timedOut: false };
        }

        const payload = await response.json();
        const hits = Array.isArray(payload?.hits) ? payload.hits : [];

        // objectID is the Hacker News item ID in Algolia results.
        const pollIds = hits
            .map((hit) => Number.parseInt(hit?.objectID, 10))
            .filter((id) => Number.isInteger(id) && id > 0)
            .filter((id, index, allIds) => allIds.indexOf(id) === index)
            .slice(0, maxPolls);

        return { pollIds, timedOut: false };
    } catch {
        return { pollIds: [], timedOut: timeoutController.signal.aborted };
    } finally {
        clearTimeout(timeoutId);
    }
}
