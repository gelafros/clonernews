/** @type {Map<number, object>} Cache of built comment trees keyed by post ID */
const postCommentsCache = new Map();

/**
 * Removes a post's comment tree from the cache so the next open fetches fresh data.
 * Call this when live-updates reports that a displayed post has changed.
 * @param {number} postId - The ID of the post whose cache entry should be cleared.
 */
export function clearCommentCache(postId) {
    postCommentsCache.delete(postId);
}

/**
 * Creates a placeholder comment node for an item that is deleted or unavailable.
 * Used to keep invalid comments visible in the thread rather than silently hiding them.
 * @param {number} commentId - The ID of the comment.
 * @param {number} parentId - The ID of the expected parent item.
 * @param {"deleted"|"unavailable"} status - The reason the comment is invalid.
 * @param {number} [time=0] - Unix timestamp of the comment, if known.
 * @returns {{ id: number, parent: number, by: string, time: number, text: string, status: string, isValid: false, replies: [] }}
 */
function createInvalidCommentNode(commentId, parentId, status, time = 0) {
    return {
        id: commentId,
        parent: parentId,
        by: "unknown",
        time,
        text: status === "deleted" ? "Deleted by user" : "Unavailable",
        status,
        isValid: false,
        replies: [],
    };
}

/**
 * Fetches and validates a single comment from the API, then recursively builds
 * its nested reply tree while keeping comments ordered from newest to oldest.
 * Returns an invalid placeholder node when the comment cannot be used.
 * Returns null when the comment's parent does not match the expected position in the tree.
 * @param {object} api - The Hacker News API instance.
 * @param {number} commentId - The ID of the comment to fetch.
 * @param {number} expectedParentId - The ID that this comment's parent field must match.
 * @returns {Promise<object|null>} A comment node object, or null if the parent does not match.
 */
async function buildCommentNode(api, commentId, expectedParentId) {
    let comment;

    try {
        comment = await api.fetchItem(commentId);
    } catch {
        return createInvalidCommentNode(commentId, expectedParentId, "unavailable");
    }

    // show invalid/unavailable comments instead of hiding them
    if (!comment) return createInvalidCommentNode(commentId, expectedParentId, "unavailable");
    if (comment.type !== "comment") return createInvalidCommentNode(commentId, expectedParentId, "unavailable", comment.time ?? 0);
    // parent must match expected tree position to prevent orphaned comments
    if (comment.parent !== expectedParentId) return null;
    if (comment.deleted === true) return createInvalidCommentNode(comment.id, comment.parent, "deleted", comment.time ?? 0);
    if (comment.dead === true) return createInvalidCommentNode(comment.id, comment.parent, "unavailable", comment.time ?? 0);

    // kids are direct child comment IDs for this comment
    const childIds = Array.isArray(comment.kids) ? comment.kids : [];

    // recursively build all nested replies
    const childNodes = await Promise.all(
        childIds.map((childId) => buildCommentNode(api, childId, comment.id))
    );

    // Keep nested replies newest-to-oldest for audit ordering requirements.
    const replies = childNodes
        .filter((node) => node !== null)
        .sort((a, b) => (b.time ?? 0) - (a.time ?? 0));

    return {
        id: comment.id,
        parent: comment.parent,
        by: comment.by ?? "unknown",
        time: comment.time ?? 0,
        text: comment.text ?? "",
        status: "ok",
        isValid: true,
        replies,
    };
}

/**
 * Builds and caches the full comment tree for a post.
 * Direct comments and all nested replies are ordered from newest to oldest.
 * Reuses the cached result when the same post is opened again to avoid redundant API requests.
 * @param {object} api - The Hacker News API instance.
 * @param {{ id?: number, kids?: number[] }} post - The post whose comments to load.
 * @returns {Promise<{ postId: number|null, totalDirectComments: number, comments: object[] }>}
 */
export async function commentBuild(api, post) {
    if (!api || !post) {
        return { postId: null, totalDirectComments: 0, comments: [] };
    }

    // put IDs in variables and check if null or undefined
    const postId = post.id ?? null;
    const commentIds = Array.isArray(post.kids) ? post.kids : [];

    // reuse built comment trees for previously opened posts
    // this avoids rebuilding and refetching comment trees on repeat clicks
    if (postCommentsCache.has(postId)) {
        return postCommentsCache.get(postId);
    }

    if (!postId || commentIds.length === 0) {
        return { postId, totalDirectComments: 0, comments: [] };
    }

    // normalize the data for rendering, preparation for nested replies
    const commentNodes = await Promise.all(
        commentIds.map((id) => buildCommentNode(api, id, postId))
    );

    // Keep top-level comments newest-to-oldest for audit ordering requirements.
    const comments = commentNodes
        .filter((node) => node !== null)
        .sort((a, b) => (b.time ?? 0) - (a.time ?? 0));

    const result = {
        postId,
        totalDirectComments: comments.length,
        comments,
    };

    // cache built tree for later reuse
    postCommentsCache.set(postId, result);

    return result;
}
