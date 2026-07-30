import { getNextBatch, hasMore, initItems } from "./posts.js";
import { findRecentPollIds } from "./poll-discovery.js";
import { appendToPostList, renderPostList } from "./renderers.js";

/** @type {number} Debounce time in milliseconds for feed mode switching */
const FEED_CHANGE_DEBOUNCE_MS = 250;

/**
 * Creates a controller for feed mode selection, pagination, and list rendering.
 * @param {{
 *   api: object,
 *   displayedPosts: Map<number, { id: number, title: string }>,
 *   renderedFeed: any[],
 *   feedCache: { storyIds: number[], jobIds: number[], pollIds: number[], topIds: number[], bestIds: number[], askIds: number[], showIds: number[] },
 *   onPostSelect: (post: any) => Promise<void>
 * }} deps - Dependencies and mutable state containers.
 * @returns {{
 *   applyFeedMode: (mode: "all"|"stories"|"jobs"|"polls"|"top"|"best"|"ask"|"show") => Promise<void>,
 *   loadMorePosts: () => Promise<void>,
 *   scheduleFeedModeChange: (mode: "all"|"stories"|"jobs"|"polls"|"top"|"best"|"ask"|"show") => void,
 * }}
 */
export function createFeedController(deps) {
    const {
        api,
        displayedPosts,
        renderedFeed,
        feedCache,
        onPostSelect,
    } = deps;

    let feedChangeTimerId = null;
    let activeFeedRequestId = 0;

    /**
     * Fetches and renders the next batch of posts from the feed.
     * @returns {Promise<void>}
     */
    async function loadMorePosts() {
        const loadMoreButton = document.getElementById("load-more");
        const postList = document.getElementById("post-list");

        loadMoreButton.disabled = true;

        const ids = getNextBatch();
        const items = await Promise.all(
            ids.map(async (id) => {
                try {
                    return await api.fetchItem(id);
                } catch {
                    return null;
                }
            }),
        );

        const visibleItems = items.filter((item) => {
            if (!item) {
                return false;
            }

            return item.type === "story" || item.type === "job" || item.type === "poll";
        });

        visibleItems.forEach((post) => {
            post.hasComments = (post.descendants ?? 0) > 0
                || (Array.isArray(post.kids) && post.kids.length > 0);
        });

        visibleItems.sort((a, b) => (b.time ?? 0) - (a.time ?? 0));

        // Only append posts not already in the rendered feed.
        const existingIds = new Set(renderedFeed.map((p) => p.id));
        const newPosts = visibleItems.filter((p) => !existingIds.has(p.id));

        // Track all posts for live-update cross-checking.
        newPosts.forEach((post) => renderedFeed.push(post));

        // Append only new elements — avoid re-rendering the full list.
        appendToPostList(newPosts, postList, onPostSelect);

        // Update displayed posts for live-updates tracking.
        newPosts.forEach((post) => {
            const title = post.title || `Post ${post.id}`;
            displayedPosts.set(post.id, { id: post.id, title });
        });

        loadMoreButton.disabled = !hasMore();
    }

    /**
     * Lazily fetches item IDs for modes that are not loaded at startup.
     * Returns false when the caller should abort (request superseded or no data found).
     * @param {"all"|"stories"|"jobs"|"polls"|"top"|"best"|"ask"|"show"} mode - Selected feed mode.
     * @param {number} currentFeedRequestId - Stale-request guard value.
     * @param {HTMLElement} status - Status paragraph element.
     * @returns {Promise<boolean>} True to continue, false to abort.
     */
    async function ensureModeIds(mode, currentFeedRequestId, status) {
        // Polls require a custom backward scan rather than a simple endpoint call.
        if (mode === "polls" && feedCache.pollIds.length === 0) {
            status.textContent = "Searching for polls...";
            const pollSearchResult = await findRecentPollIds(api);
            if (currentFeedRequestId !== activeFeedRequestId) return false;
            feedCache.pollIds = pollSearchResult.pollIds;
            if (pollSearchResult.timedOut && feedCache.pollIds.length === 0) {
                status.textContent = "Poll search timed out. Try again in a moment.";
                return false;
            }
            return true;
        }

        // All other non-startup modes share the same lazy-fetch pattern.
        const lazyModes = {
            top: { key: "topIds", fetch: () => api.fetchTopStoryIds(), label: "Loading top stories..." },
            best: { key: "bestIds", fetch: () => api.fetchBestStoryIds(), label: "Loading best stories..." },
            ask: { key: "askIds", fetch: () => api.fetchAskStoryIds(), label: "Loading Ask HN..." },
            show: { key: "showIds", fetch: () => api.fetchShowStoryIds(), label: "Loading Show HN..." },
        };

        const entry = lazyModes[mode];
        if (entry && feedCache[entry.key].length === 0) {
            status.textContent = entry.label;
            try {
                feedCache[entry.key] = await entry.fetch();
            } catch {
                feedCache[entry.key] = [];
            }
            if (currentFeedRequestId !== activeFeedRequestId) return false;
        }

        return true;
    }

    /**
     * Applies one feed mode and loads its first batch.
     * @param {"all"|"stories"|"jobs"|"polls"|"top"|"best"|"ask"|"show"} mode - Selected feed mode.
     * @returns {Promise<void>}
     */
    async function applyFeedMode(mode) {
        const currentFeedRequestId = ++activeFeedRequestId;
        const status = document.getElementById("status");
        const loadMoreButton = document.getElementById("load-more");
        const postList = document.getElementById("post-list");
        const selectedTitle = document.getElementById("selected-title");
        const selectedPostContent = document.getElementById("selected-post-content");
        const commentsContainer = document.getElementById("comments");

        renderedFeed.length = 0;
        displayedPosts.clear();
        renderPostList([], postList, onPostSelect);
        selectedTitle.textContent = "Select a post";
        selectedPostContent.textContent = "";
        commentsContainer.textContent = "";
        loadMoreButton.disabled = true;

        // Lazily load IDs for modes that are not fetched at startup.
        const shouldContinue = await ensureModeIds(mode, currentFeedRequestId, status);
        if (!shouldContinue) return;

        // Route each mode to the correct cached ID list.
        if (mode === "all") {
            initItems(feedCache.storyIds, feedCache.jobIds);
        } else if (mode === "stories") {
            initItems(feedCache.storyIds, []);
        } else if (mode === "jobs") {
            initItems([], feedCache.jobIds);
        } else if (mode === "polls") {
            initItems(feedCache.pollIds, []);
        } else if (mode === "top") {
            initItems(feedCache.topIds, []);
        } else if (mode === "best") {
            initItems(feedCache.bestIds, []);
        } else if (mode === "ask") {
            initItems(feedCache.askIds, []);
        } else {
            // "show"
            initItems(feedCache.showIds, []);
        }

        // Count available source IDs for the selected mode.
        const modeSourceCount = {
            all: feedCache.storyIds.length + feedCache.jobIds.length,
            stories: feedCache.storyIds.length,
            jobs: feedCache.jobIds.length,
            polls: feedCache.pollIds.length,
            top: feedCache.topIds.length,
            best: feedCache.bestIds.length,
            ask: feedCache.askIds.length,
            show: feedCache.showIds.length,
        };

        if ((modeSourceCount[mode] ?? 0) === 0) {
            status.textContent = "No posts available.";
            return;
        }

        if (currentFeedRequestId !== activeFeedRequestId) {
            return;
        }

        try {
            status.textContent = "Loading posts...";
            await loadMorePosts();

            if (currentFeedRequestId !== activeFeedRequestId) {
                return;
            }

            status.textContent = "Posts loaded.";
        } catch {
            if (currentFeedRequestId === activeFeedRequestId) {
                status.textContent = "Failed to load posts.";
            }
        }
    }

    /**
     * Debounces feed mode switching to avoid burst requests during rapid toggling.
     * @param {"all"|"stories"|"jobs"|"polls"|"top"|"best"|"ask"|"show"} mode - Selected feed mode.
     */
    function scheduleFeedModeChange(mode) {
        if (feedChangeTimerId !== null) {
            clearTimeout(feedChangeTimerId);
        }

        feedChangeTimerId = setTimeout(() => {
            feedChangeTimerId = null;
            void applyFeedMode(mode);
        }, FEED_CHANGE_DEBOUNCE_MS);
    }

    return {
        applyFeedMode,
        loadMorePosts,
        scheduleFeedModeChange,
    };
}
