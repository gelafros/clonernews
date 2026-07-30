import { getNextBatch, hasMore, initItems } from "./posts.js";
import { findRecentPollIds } from "./poll-discovery.js";
import { renderPostList } from "./renderers.js";

const FEED_CHANGE_DEBOUNCE_MS = 250;

/**
 * Creates a controller for feed mode selection, pagination, and list rendering.
 * @param {{
 *   api: { fetchItem: (id: number) => Promise<any> },
 *   displayedPosts: Map<number, { id: number, title: string }>,
 *   renderedFeed: any[],
 *   feedCache: { storyIds: number[], jobIds: number[], pollIds: number[] },
 *   onPostSelect: (post: any) => Promise<void>
 * }} deps - Dependencies and mutable state containers.
 * @returns {{
 *   applyFeedMode: (mode: "all"|"stories"|"jobs"|"polls") => Promise<void>,
 *   loadMorePosts: () => Promise<void>,
 *   scheduleFeedModeChange: (mode: "all"|"stories"|"jobs"|"polls") => void,
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

        const byId = new Map(renderedFeed.map((post) => [post.id, post]));
        visibleItems.forEach((post) => {
            byId.set(post.id, post);
        });

        renderedFeed.length = 0;
        renderedFeed.push(...Array.from(byId.values()));
        renderedFeed.sort((a, b) => (b.time ?? 0) - (a.time ?? 0));

        renderPostList(renderedFeed, postList, onPostSelect);

        displayedPosts.clear();
        renderedFeed.forEach((post) => {
            const title = post.title || `Post ${post.id}`;
            displayedPosts.set(post.id, { id: post.id, title });
        });

        loadMoreButton.disabled = !hasMore();
    }

    /**
     * Applies one feed mode and loads its first batch.
     * @param {"all"|"stories"|"jobs"|"polls"} mode - Selected feed mode.
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

        let pollSearchTimedOut = false;

        if (mode === "polls" && feedCache.pollIds.length === 0) {
            status.textContent = "Searching for polls...";
            const pollSearchResult = await findRecentPollIds(api);

            if (currentFeedRequestId !== activeFeedRequestId) {
                return;
            }

            feedCache.pollIds = pollSearchResult.pollIds;
            pollSearchTimedOut = pollSearchResult.timedOut && feedCache.pollIds.length === 0;
        }

        if (mode === "all") {
            initItems(api, feedCache.storyIds, feedCache.jobIds);
        } else if (mode === "stories") {
            initItems(api, feedCache.storyIds, []);
        } else if (mode === "jobs") {
            initItems(api, [], feedCache.jobIds);
        } else {
            initItems(api, feedCache.pollIds, []);
        }

        const hasSourceItems =
            mode === "all"
                ? feedCache.storyIds.length + feedCache.jobIds.length > 0
                : mode === "stories"
                    ? feedCache.storyIds.length > 0
                    : mode === "jobs"
                        ? feedCache.jobIds.length > 0
                        : feedCache.pollIds.length > 0;

        if (!hasSourceItems) {
            if (mode === "polls" && pollSearchTimedOut) {
                status.textContent = "Poll search timed out. Try again in a moment.";
                return;
            }

            status.textContent = mode === "polls" ? "No recent polls found yet." : "No posts available.";
            return;
        }

        if (currentFeedRequestId !== activeFeedRequestId) {
            return;
        }

        status.textContent = "Loading posts...";
        await loadMorePosts();

        if (currentFeedRequestId !== activeFeedRequestId) {
            return;
        }

        status.textContent = "Posts loaded.";
    }

    /**
     * Debounces feed mode switching to avoid burst requests during rapid toggling.
     * @param {"all"|"stories"|"jobs"|"polls"} mode - Selected feed mode.
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
