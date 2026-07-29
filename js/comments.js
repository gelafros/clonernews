const postCommentsCache = new Map();

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

// Helper function that builds comment and child comment data
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
    // parent must match expected tree position
    if (comment.parent !== expectedParentId) return null;
    if (comment.deleted === true) return createInvalidCommentNode(comment.id, comment.parent, "deleted", comment.time ?? 0);
    if (comment.dead === true) return createInvalidCommentNode(comment.id, comment.parent, "unavailable", comment.time ?? 0);

    // kids are direct child comment IDs for this comment
    const childIds = Array.isArray(comment.kids) ? comment.kids : [];

    // recursively build all nested replies
    const childNodes = await Promise.all(
        childIds.map((childId) => buildCommentNode(api, childId, comment.id))
    );

    //sort the nested comments
    const replies = childNodes
        .filter((node) => node !== null)
        .sort((a, b) => b.time - a.time);

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

// Builds a comment structure for rendering
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

    const comments = commentNodes
        .filter((node) => node !== null)
        .sort((a, b) => b.time - a.time);

    const result = {
        postId,
        totalDirectComments: comments.length,
        comments,
    };

    // cache built tree for later reuse
    postCommentsCache.set(postId, result);

    return result;
}

