import { clearCommentCache } from "./comments.js";
import { createHackerNewsApi, requestJson } from "./api.js";
import { createFeedController } from "./feed-controller.js";
import {
    createLiveUpdates,
    formatUpdateMessage,
} from "./live-updates.js";
import { createPostSelectionController } from "./post-selection-controller.js";
import { ensureAppShell } from "./ui-shell.js";

const api = createHackerNewsApi(requestJson);
const displayedPosts = new Map();
const renderedFeed = [];
const feedCache = {
    storyIds: [],
    jobIds: [],
    pollIds: [],
};

/**
 * Returns all posts that have been rendered in the current post list.
 * @returns {{ id: number, title: string }[]} Array of displayed post objects.
 */
function getDisplayedPosts() {
    return Array.from(displayedPosts.values());
}

/**
 * Writes a notification message into the live-update-message element.
 * @param {{ id: number, title: string }[]} updatedPosts - Posts found in the latest update list.
 */
function showLiveUpdateNotification(updatedPosts) {
    const liveUpdateMessage = document.getElementById("live-update-message");
    liveUpdateMessage.textContent = formatUpdateMessage(updatedPosts);
    // Invalidate cached comment trees so re-opening a live-updated post shows fresh comments.
    updatedPosts.forEach((post) => clearCommentCache(post.id));
}

const liveUpdates = createLiveUpdates(
    api,
    getDisplayedPosts,
    showLiveUpdateNotification,
);

const { showPostAndComments } = createPostSelectionController(api);
const {
    applyFeedMode,
    loadMorePosts,
    scheduleFeedModeChange,
} = createFeedController({
    api,
    displayedPosts,
    renderedFeed,
    feedCache,
    onPostSelect: showPostAndComments,
});

/**
 * Bootstraps the application: builds the UI shell, loads the first post batch,
 * wires the load-more button, and starts the live-update polling.
 * @returns {Promise<void>}
 */
async function start() {
    ensureAppShell();

    const status = document.getElementById("status");
    const loadMoreButton = document.getElementById("load-more");
    const feedSelect = document.getElementById("feed-select");

    status.textContent = "Loading posts...";

    try {
        const [storyIds, jobIds] = await Promise.all([
            api.fetchNewStoryIds(),
            api.fetchJobStoryIds(),
        ]);

        feedCache.storyIds = storyIds;
        feedCache.jobIds = jobIds;

        await applyFeedMode("all");

        loadMoreButton.addEventListener("click", loadMorePosts);
        feedSelect.addEventListener("change", (event) => {
            scheduleFeedModeChange(event.target.value);
        });
        await liveUpdates.start();
    } catch {
        status.textContent = "Failed to load posts.";
    }
}

start();
