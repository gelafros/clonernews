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
 * Converts HTML-like API text into safe plain text for display.
 * Decodes entities and strips tags by reading textContent.
 * @param {string} value - Raw API text that may contain HTML.
 * @returns {string} Plain readable text.
 */
function toPlainText(value) {
    if (!value) {
        return "";
    }

    const wrapper = document.createElement("div");
    wrapper.innerHTML = value;
    return (wrapper.textContent || "").trim();
}

/**
 * Renders selected post metadata/content into the provided container elements.
 * @param {{ id: number, title?: string, type?: string, by?: string, time?: number, url?: string, text?: string }} post - The selected post.
 * @param {HTMLElement} selectedTitle - Element that displays the selected title.
 * @param {HTMLElement} selectedPostContent - Element that displays selected post content.
 */
export function renderSelectedPost(post, selectedTitle, selectedPostContent) {
    selectedTitle.textContent = post.title || `Post ${post.id}`;

    selectedPostContent.textContent = "";

    const meta = document.createElement("p");
    meta.textContent = `${post.type || "item"} by ${post.by || "unknown"} - ${formatTime(post.time)}`;
    selectedPostContent.appendChild(meta);

    if (post.url) {
        const link = document.createElement("a");
        link.href = post.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = post.url;
        selectedPostContent.appendChild(link);
        return;
    }

    const text = document.createElement("p");
    text.textContent = toPlainText(post.text) || "No content available.";
    selectedPostContent.appendChild(text);
}

/**
 * Recursively builds a nested `<ul>` list from an array of comment node objects.
 * @param {{ by: string, time: number, text: string, isValid: boolean, status: string, replies: object[] }[]} commentNodes - Array of comment node objects.
 * @returns {HTMLUListElement} A `<ul>` element containing all rendered comment items.
 */
function createCommentList(commentNodes) {
    const list = document.createElement("ul");

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
            text.textContent = toPlainText(comment.text) || "(no text)";
        }

        item.append(meta, text);

        if (comment.replies.length > 0) {
            item.appendChild(createCommentList(comment.replies));
        }

        list.appendChild(item);
    });

    return list;
}

/**
 * Renders comment nodes into the target comments container.
 * @param {{ by: string, time: number, text: string, isValid: boolean, status: string, replies: object[] }[]} commentNodes - Array of comment node objects.
 * @param {HTMLElement} commentsContainer - Container that receives the comment tree.
 */
export function renderCommentTree(commentNodes, commentsContainer) {
    commentsContainer.appendChild(createCommentList(commentNodes));
}

/**
 * Creates a button element representing a single post in the feed.
 * Clicking the button triggers post-selection handling for that post.
 * @param {{ id: number, title?: string, type: string, hasComments?: boolean }} post - The post object.
 * @param {(post: object) => void} onPostSelect - Callback run when this post is clicked.
 * @returns {HTMLButtonElement} A button element for the given post.
 */
function createPostButton(post, onPostSelect) {
    const button = document.createElement("button");
    button.type = "button";

    const labelText = `${post.title || `Post ${post.id}`} (${post.type})`;
    const label = document.createElement("span");
    label.className = "post-button-label";
    label.textContent = labelText;
    button.appendChild(label);

    if (post.hasComments) {
        const commentIndicator = document.createElement("span");
        commentIndicator.className = "post-comment-indicator";
        commentIndicator.textContent = "C";
        commentIndicator.title = "Has comments";
        commentIndicator.setAttribute("aria-hidden", "true");
        button.appendChild(commentIndicator);
        button.setAttribute("aria-label", `${labelText}. Has comments.`);
    } else {
        button.setAttribute("aria-label", labelText);
    }

    button.addEventListener("click", () => {
        // Remove selection from the previously highlighted post button.
        const previous = document.querySelector(".post-list button.selected");
        if (previous) {
            previous.classList.remove("selected");
            previous.removeAttribute("aria-current");
        }

        button.classList.add("selected");
        button.setAttribute("aria-current", "true");
        onPostSelect(post);
    });

    return button;
}

/**
 * Renders the full post list from the provided post array.
 * @param {{ id: number, title?: string, type: string, hasComments?: boolean }[]} posts - Posts to display.
 * @param {HTMLElement} postList - Post list container (`<ul>`).
 * @param {(post: object) => void} onPostSelect - Callback run when a post is clicked.
 */
export function renderPostList(posts, postList, onPostSelect) {
    postList.textContent = "";

    posts.forEach((post) => {
        const listItem = document.createElement("li");
        listItem.appendChild(createPostButton(post, onPostSelect));
        postList.appendChild(listItem);
    });
}

/**
 * Appends new post elements to an existing list without clearing it.
 * Used by load-more to avoid re-rendering previously displayed posts.
 * @param {{ id: number, title?: string, type: string, hasComments?: boolean }[]} newPosts - New posts to append.
 * @param {HTMLElement} postList - Post list container (`<ul>`).
 * @param {(post: object) => void} onPostSelect - Callback run when a post is clicked.
 */
export function appendToPostList(newPosts, postList, onPostSelect) {
    newPosts.forEach((post) => {
        const listItem = document.createElement("li");
        listItem.appendChild(createPostButton(post, onPostSelect));
        postList.appendChild(listItem);
    });
}
