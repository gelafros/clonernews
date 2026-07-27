// Builds a comment structure for rendering
export async function commentBuild(api, post) {
    if (!api || !post)
        return { postId: null, totalDirectComments: 0, comments: [] };

    // put IDs in variables and check if null or undefined
    const postid = post.id ?? null
    const commentid = Array.isArray(post) ? post.kids : [];


    if (!postId || commentIds.length === 0) {
        return { postId, totalDirectComments: 0, comments: [] };
    }

    // fetch comments from selected post
    const directComments = await Promise.all(
        commentIds.map((id) => api.fetchItem(id))
    );

    //filter through comments, ignore if not valid and sort by time descending
    const validDirectComments = directComments
        .filter((comment) => {
            if (!comment) return false;
            if (comment.type !== "comment") return false;
            if (comment.parent !== postId) return false;
            if (comment.deleted === true) return false;
            if (comment.dead === true) return false;
            return true;
        })
        .sort((a, b) => (b.time ?? 0) - (a.time ?? 0));


    return {
        postId,
        totalDirectComments: directComments.length,
        comments: directComments,
    };
}

