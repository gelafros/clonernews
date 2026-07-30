import { createHackerNewsApi, requestJson } from "./api.js";
import { commentBuild } from "./comments.js";
import {
    createLiveUpdates,
    formatUpdateMessage,
} from "./live-updates.js";
import { getNextBatch, hasMore, initItems } from "./posts.js";

const api = createHackerNewsApi(requestJson);
const displayedPosts = new Map();

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
 * Creates and inserts the full app UI into the document body.
 * Builds a sticky header with the live-updates section, a main content area
 * with the post list and load-more button, and a selected-post/comments panel.
 * Skips creation silently if the shell already exists.
 */
function ensureAppShell() {
    if (document.getElementById("status")) {
        return;
    }

    // --- Header ---
    const header = document.createElement("header");
    header.className = "app-header";

    const title = document.createElement("h1");
    title.textContent = "Clonernews";

    const liveSection = document.createElement("section");
    liveSection.className = "live-updates";
    liveSection.setAttribute("aria-labelledby", "live-updates-title");

    const liveTitle = document.createElement("h2");
    liveTitle.id = "live-updates-title";
    liveTitle.textContent = "Live Updates";

    const liveMessage = document.createElement("p");
    liveMessage.id = "live-update-message";
    liveMessage.setAttribute("role", "status");
    liveMessage.textContent = "Watching for updates...";

    liveSection.append(liveTitle, liveMessage);
    header.append(title, liveSection);

    // --- Main ---
    const main = document.createElement("main");
    main.className = "app-main";

    const status = document.createElement("p");
    status.id = "status";
    status.className = "status-message";
    status.textContent = "Starting...";

    // --- Posts section ---
    const postsSection = document.createElement("section");
    postsSection.className = "posts-section";

    const postsHeading = document.createElement("h2");
    postsHeading.textContent = "Posts";

    const postList = document.createElement("ul");
    postList.id = "post-list";
    postList.className = "post-list";

    const loadMoreButton = document.createElement("button");
    loadMoreButton.id = "load-more";
    loadMoreButton.type = "button";
    loadMoreButton.className = "btn btn-load-more";
    loadMoreButton.textContent = "Load more";

    postsSection.append(postsHeading, postList, loadMoreButton);

    // --- Selected post / comments section ---
    const selectedSection = document.createElement("section");
    selectedSection.className = "selected-section";

    const selectedTitle = document.createElement("h2");
    selectedTitle.id = "selected-title";
    selectedTitle.textContent = "Select a post";

    const commentsContainer = document.createElement("div");
    commentsContainer.id = "comments";
    commentsContainer.className = "comments-container";

    selectedSection.append(selectedTitle, commentsContainer);

    main.append(status, postsSection, selectedSection);
    document.body.append(header, main);
}

/**
 * Formats a Unix timestamp into a locale-appropriate date and time string.
 * @param {number} unixSeconds - Unix timestamp in seconds.
 * @returns {string} A human-readable date/time string, or "unknown time" if the value is falsy.
 */
function formatTime(unixSeconds) {
    if (!unixSeconds) {
        return "unknown time";
    }

    return new Date(unixSeconds * 1000).toLocaleString();
}

/**
 * Recursively builds a nested `<ul>` list from an array of comment node objects.
 * Invalid comments are rendered muted with a "Deleted by user" or "Unavailable" label.
 * @param {{ by: string, time: number, text: string, isValid: boolean, status: string, replies: object[] }[]} commentNodes - Array of comment node objects.
 * @returns {HTMLUListElement} A `<ul>` element containing all rendered comment items.
 */
function createCommentList(commentNodes) {
    const list = document.createElement("ul");

    // each node renders one comment row and optional nested reply list
    commentNodes.forEach((comment) => {
        const item = document.createElement("li");

        const meta = document.createElement("div");
        meta.textContent = `${comment.by} - ${formatTime(comment.time)}`;

        const text = document.createElement("p");
        if (comment.isValid === false) {
            text.textContent = comment.status === "deleted" ? "Deleted by user" : "Unavailable";
            item.style.opacity = "0.6";
            item.style.fontStyle = "italic";
        } else {
            text.textContent = comment.text || "(no text)";
        }

        item.append(meta, text);

        // recursive render for reply chains
        if (comment.replies.length > 0) {
            item.appendChild(createCommentList(comment.replies));
        }

        list.appendChild(item);
    });

    return list;
}

/**
 * Fetches and renders comments for the selected post.
 * Shows a loading state while comments are being retrieved.
 * @param {{ id: number, title?: string, kids?: number[] }} post - The selected post object.
 * @returns {Promise<void>}
 */
async function showPostAndComments(post) {
    const selectedTitle = document.getElementById("selected-title");
    const commentsContainer = document.getElementById("comments");

    selectedTitle.textContent = post.title || `Post ${post.id}`;
    commentsContainer.textContent = "Loading comments...";

    // comments.js builds and validates the full comment tree
    const result = await commentBuild(api, post);

    // clear previous comments before rendering the new result
    commentsContainer.textContent = "";

    if (result.comments.length === 0) {
        commentsContainer.textContent = "No comments for this post.";
        return;
    }

    commentsContainer.appendChild(createCommentList(result.comments));
}

/**
 * Creates a button element representing a single post in the feed.
 * Clicking the button triggers comment loading for that post.
 * @param {{ id: number, title?: string, type: string }} post - The post object.
 * @returns {HTMLButtonElement} A button element for the given post.
 */
function createPostButton(post) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${post.title || `Post ${post.id}`} (${post.type})`;
    // click flow: select post -> build comments -> render comments
    button.addEventListener("click", () => {
        showPostAndComments(post);
    });

    return button;
}

/**
 * Fetches and renders the next batch of posts from the feed.
 * Disables the load-more button while loading and when the feed is exhausted.
 * @returns {Promise<void>}
 */
async function loadMorePosts() {
    const postList = document.getElementById("post-list");
    const loadMoreButton = document.getElementById("load-more");

    loadMoreButton.disabled = true;

    // posts.js controls which IDs belong to the next 15-item batch
    const ids = getNextBatch();

    // fetch each item, returning null for any that fail
    const items = await Promise.all(
        ids.map(async (id) => {
            try {
                return await api.fetchItem(id);
            } catch {
                return null;
            }
        })
    );

    // keep only the supported post types
    const visibleItems = items.filter((item) => {
        if (!item) {
            return false;
        }

        return item.type === "story" || item.type === "job" || item.type === "poll";
    });

    visibleItems.forEach((post) => {
        const title = post.title || `Post ${post.id}`;
        const listItem = document.createElement("li");
        listItem.appendChild(createPostButton(post));
        postList.appendChild(listItem);
        // track displayed posts so live-updates can compare against them
        displayedPosts.set(post.id, { id: post.id, title });
    });

    // disable button when feed has no more IDs to load
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

    status.textContent = "Loading posts...";

    try {
        // one request each for stories and jobs, then merge and sort in posts.js
        const [storyIds, jobIds] = await Promise.all([
            api.fetchNewStoryIds(),
            api.fetchJobStoryIds(),
        ]);

        initItems(api, storyIds, jobIds);
        // load first batch immediately so page is usable on startup
        await loadMorePosts();

        loadMoreButton.addEventListener("click", loadMorePosts);
        await liveUpdates.start();
        status.textContent = "Posts loaded.";
    } catch {
        status.textContent = "Failed to load posts.";
    }
}

start();
