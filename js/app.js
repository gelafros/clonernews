import { createHackerNewsApi, requestJson } from "./api.js";
import { commentBuild } from "./comments.js";
import {
    createLiveUpdates,
    formatUpdateMessage,
} from "./live-updates.js";
import { getNextBatch, hasMore, initItems } from "./posts.js";
import { findRecentPollIds } from "./poll-discovery.js";
import {
    renderCommentTree,
    renderPostList,
    renderSelectedPost,
} from "./renderers.js";
import { ensureAppShell } from "./ui-shell.js";

const api = createHackerNewsApi(requestJson);
const displayedPosts = new Map();
const renderedFeed = [];
let storyIdsCache = [];
let jobIdsCache = [];
let pollIdsCache = [];

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
}

const liveUpdates = createLiveUpdates(
    api,
    getDisplayedPosts,
    showLiveUpdateNotification,
);

/**
 * Handles clicking one post from the list, then renders post content and comments.
 * @param {{ id: number, title?: string, kids?: number[] }} post - The selected post object.
 * @returns {Promise<void>}
 */
async function showPostAndComments(post) {
    const selectedTitle = document.getElementById("selected-title");
    const selectedPostContent = document.getElementById("selected-post-content");
    const commentsContainer = document.getElementById("comments");

    renderSelectedPost(post, selectedTitle, selectedPostContent);

    commentsContainer.textContent = "Loading comments...";

    const result = await commentBuild(api, post);
    commentsContainer.textContent = "";

    if (result.comments.length === 0) {
        commentsContainer.textContent = "No comments for this post.";
        return;
    }

    renderCommentTree(result.comments, commentsContainer);
}

/**
 * Applies one feed mode and loads the first batch for it.
 * @param {"all"|"stories"|"jobs"|"polls"} mode - Selected feed mode.
 * @returns {Promise<void>}
 */
async function applyFeedMode(mode) {
    const status = document.getElementById("status");
    const loadMoreButton = document.getElementById("load-more");
    const postList = document.getElementById("post-list");
    const selectedTitle = document.getElementById("selected-title");
    const selectedPostContent = document.getElementById("selected-post-content");
    const commentsContainer = document.getElementById("comments");

    renderedFeed.length = 0;
    displayedPosts.clear();
    renderPostList([], postList, showPostAndComments);
    selectedTitle.textContent = "Select a post";
    selectedPostContent.textContent = "";
    commentsContainer.textContent = "";
    loadMoreButton.disabled = true;

    let pollSearchTimedOut = false;

    if (mode === "polls" && pollIdsCache.length === 0) {
        status.textContent = "Searching for polls...";
        const pollSearchResult = await findRecentPollIds(api);
        pollIdsCache = pollSearchResult.pollIds;
        pollSearchTimedOut = pollSearchResult.timedOut && pollIdsCache.length === 0;
    }

    if (mode === "all") {
        initItems(api, storyIdsCache, jobIdsCache);
    } else if (mode === "stories") {
        initItems(api, storyIdsCache, []);
    } else if (mode === "jobs") {
        initItems(api, [], jobIdsCache);
    } else {
        initItems(api, pollIdsCache, []);
    }

    const hasSourceItems =
        mode === "all"
            ? storyIdsCache.length + jobIdsCache.length > 0
            : mode === "stories"
                ? storyIdsCache.length > 0
                : mode === "jobs"
                    ? jobIdsCache.length > 0
                    : pollIdsCache.length > 0;

    if (!hasSourceItems) {
        if (mode === "polls" && pollSearchTimedOut) {
            status.textContent = "Poll search timed out. Try again in a moment.";
            return;
        }

        status.textContent = mode === "polls" ? "No recent polls found yet." : "No posts available.";
        return;
    }

    status.textContent = "Loading posts...";
    await loadMorePosts();
    status.textContent = "Posts loaded.";
}

/**
 * Fetches and renders the next batch of posts from the feed.
 * Disables the load-more button while loading and when the feed is exhausted.
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

    renderPostList(renderedFeed, postList, showPostAndComments);

    displayedPosts.clear();
    renderedFeed.forEach((post) => {
        const title = post.title || `Post ${post.id}`;
        displayedPosts.set(post.id, { id: post.id, title });
    });

    loadMoreButton.disabled = !hasMore();
}

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

        storyIdsCache = storyIds;
        jobIdsCache = jobIds;

        await applyFeedMode("all");

        loadMoreButton.addEventListener("click", loadMorePosts);
        feedSelect.addEventListener("change", async (event) => {
            await applyFeedMode(event.target.value);
        });
        await liveUpdates.start();
    } catch {
        status.textContent = "Failed to load posts.";
    }
}

start();
