import { commentBuild } from "./comments.js";
import {
    renderCommentTree,
    renderSelectedPost,
} from "./renderers.js";

/**
 * Creates a controller for rendering a selected post and its comments.
 * Guards against stale async responses when users click multiple posts quickly.
 * @param {{ fetchItem: (id: number) => Promise<any> }} api - Hacker News API helpers.
 * @returns {{ showPostAndComments: (post: { id: number, title?: string, kids?: number[] }) => Promise<void> }}
 */
export function createPostSelectionController(api) {
    let activePostRequestId = 0;

    /**
     * Renders one selected post and its comment tree.
     * @param {{ id: number, title?: string, kids?: number[] }} post - The selected post object.
     * @returns {Promise<void>}
     */
    async function showPostAndComments(post) {
        const currentPostRequestId = ++activePostRequestId;
        const selectedTitle = document.getElementById("selected-title");
        const selectedPostContent = document.getElementById("selected-post-content");
        const commentsContainer = document.getElementById("comments");

        renderSelectedPost(post, selectedTitle, selectedPostContent);

        commentsContainer.textContent = "Loading comments...";

        const result = await commentBuild(api, post);

        // Ignore stale responses when the user has selected a different post.
        if (currentPostRequestId !== activePostRequestId) {
            return;
        }

        commentsContainer.textContent = "";

        if (result.comments.length === 0) {
            commentsContainer.textContent = "No comments for this post.";
            return;
        }

        renderCommentTree(result.comments, commentsContainer);
    }

    return { showPostAndComments };
}
