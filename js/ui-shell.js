/**
 * Creates and inserts the full app UI into the document body.
 * Builds a sticky header with the live-updates section, a main content area
 * with the post list and load-more button, and a selected-post/comments panel.
 * Skips creation silently if the shell already exists.
 */
export function ensureAppShell() {
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

    const feedSelect = document.createElement("select");
    feedSelect.id = "feed-select";

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All";

    const storiesOption = document.createElement("option");
    storiesOption.value = "stories";
    storiesOption.textContent = "Stories";

    const jobsOption = document.createElement("option");
    jobsOption.value = "jobs";
    jobsOption.textContent = "Jobs";

    const pollsOption = document.createElement("option");
    pollsOption.value = "polls";
    pollsOption.textContent = "Polls";

    const topOption = document.createElement("option");
    topOption.value = "top";
    topOption.textContent = "Top Stories";

    const bestOption = document.createElement("option");
    bestOption.value = "best";
    bestOption.textContent = "Best Stories";

    const askOption = document.createElement("option");
    askOption.value = "ask";
    askOption.textContent = "Ask HN";

    const showOption = document.createElement("option");
    showOption.value = "show";
    showOption.textContent = "Show HN";

    feedSelect.append(allOption, storiesOption, jobsOption, pollsOption, topOption, bestOption, askOption, showOption);

    const postList = document.createElement("ul");
    postList.id = "post-list";
    postList.className = "post-list";

    const loadMoreButton = document.createElement("button");
    loadMoreButton.id = "load-more";
    loadMoreButton.type = "button";
    loadMoreButton.className = "btn btn-load-more";
    loadMoreButton.textContent = "Load more";

    postsSection.append(postsHeading, feedSelect, postList, loadMoreButton);

    // --- Selected post / comments section ---
    const selectedSection = document.createElement("section");
    selectedSection.className = "selected-section";

    const selectedTitle = document.createElement("h2");
    selectedTitle.id = "selected-title";
    selectedTitle.textContent = "Select a post";

    const selectedPostContent = document.createElement("div");
    selectedPostContent.id = "selected-post-content";

    const commentsContainer = document.createElement("div");
    commentsContainer.id = "comments";
    commentsContainer.className = "comments-container";

    selectedSection.append(selectedTitle, selectedPostContent, commentsContainer);

    main.append(status, postsSection, selectedSection);
    document.body.append(header, main);
}
