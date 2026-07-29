import { createHackerNewsApi, requestJson } from "./api.js";
import { commentBuild } from "./comments.js";
import {
    createLiveUpdates,
    formatUpdateMessage,
} from "./live-updates.js";
import { getNextBatch, hasMore, initItems } from "./posts.js";

const api = createHackerNewsApi(requestJson);
const displayedPosts = new Map();

// Returns only posts that have been rendered in the current post list.
function getDisplayedPosts() {
    return Array.from(displayedPosts.values());
}

// Shows a title-based message when one or more displayed posts are updated.
function showLiveUpdateNotification(updatedPosts) {
    const liveUpdateMessage = document.getElementById("live-update-message");
    liveUpdateMessage.textContent = formatUpdateMessage(updatedPosts);
}

const liveUpdates = createLiveUpdates(
    api,
    getDisplayedPosts,
    showLiveUpdateNotification,
);

// Formats unix time for display in the UI
function formatTime(unixSeconds) {
    if (!unixSeconds) {
        return "unknown time";
    }

    return new Date(unixSeconds * 1000).toLocaleString();
}

// Builds nested comment lists recursively
function createCommentList(commentNodes) {
    const list = document.createElement("ul");

    // each node renders one comment row and optional nested list
    commentNodes.forEach((comment) => {
        const item = document.createElement("li");

        const meta = document.createElement("div");
        meta.textContent = `${comment.by} - ${formatTime(comment.time)}`;

        const text = document.createElement("p");
        text.textContent = comment.text || "(no text)";

        item.append(meta, text);

        // recursive render for reply chains
        if (comment.replies.length > 0) {
            item.appendChild(createCommentList(comment.replies));
        }

        list.appendChild(item);
    });

    return list;
}

// Shows selected post title and its comments
async function showPostAndComments(post) {
    const selectedTitle = document.getElementById("selected-title");
    const commentsContainer = document.getElementById("comments");

    selectedTitle.textContent = post.title || `Post ${post.id}`;
    commentsContainer.textContent = "Loading comments...";

    // comments.js builds and validates the comment tree
    const result = await commentBuild(api, post);

    // clear previous selected post comments before showing new result
    commentsContainer.textContent = "";

    // Handles empty comment state for selected post
    if (result.comments.length === 0) {
        commentsContainer.textContent = "No comments for this post.";
        return;
    }

    commentsContainer.appendChild(createCommentList(result.comments));
}

// Creates a clickable button for each post
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

// Loads the next batch of posts and appends them to the list
async function loadMorePosts() {
    const postList = document.getElementById("post-list");
    const loadMoreButton = document.getElementById("load-more");

    loadMoreButton.disabled = true;

    // posts.js controls which IDs belong to the next 15-item batch
    const ids = getNextBatch();

    // Fetches each post item and skips failed requests
    const items = await Promise.all(
        ids.map(async (id) => {
            try {
                return await api.fetchItem(id);
            } catch {
                return null;
            }
        })
    );

    // Keeps only supported post types
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
        displayedPosts.set(post.id, { id: post.id, title });
    });

    // disable button when feed has no more IDs to load
    loadMoreButton.disabled = !hasMore();
}

// Starts the app, loads first posts, and wires load-more click
async function start() {
    const status = document.getElementById("status");
    const loadMoreButton = document.getElementById("load-more");

    status.textContent = "Loading posts...";

    try {
        // only two endpoint calls here: stories and jobs
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
