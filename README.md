# clonernews

clonernews is a browser UI for the Hacker News API. It loads stories, jobs, and polls, lets users select a post, renders comments, and shows live update notifications.

## How the program works

The app is split into small JavaScript modules, each with one clear responsibility.

1. API access and caching
- js/api.js wraps Hacker News endpoints.
- requestJson performs fetch calls and checks HTTP status.
- createHackerNewsApi exposes methods such as fetchItem, fetchNewStoryIds, fetchJobStoryIds, fetchUpdatedItemIds, and fetchMaxItemId.
- fetchItem uses an in-memory cache and shares in-flight requests to avoid duplicate network calls.

2. UI shell and rendering
- js/ui-shell.js creates the full page structure at startup (header, status, feed selector, post list, selected post area, comments area).
- js/renderers.js handles rendering of the post list, selected post content, and comment tree.

3. Feed preparation and pagination
- js/posts.js merges feed IDs, deduplicates them, sorts newest first (highest ID first), and returns fixed-size batches.
- The app never loads all posts at once. The Load more button asks for the next batch only when needed.

4. Mode switching (All, New, Jobs, Polls)
- js/app.js orchestrates startup and interactions.
- On startup, it preloads New and Jobs IDs.
- When the feed mode changes, it resets list state and initializes the correct source IDs.
- Poll mode uses js/poll-discovery.js to scan recent items backward from maxitem with a timeout budget.

5. Post selection and comments
- When a post is clicked, js/app.js renders the selected post details and requests comments through js/comments.js.
- js/comments.js builds a nested tree recursively from kids.
- It keeps Hacker News order and stores built trees in a per-post cache so reopening a post is faster.
- Deleted or unavailable comments are shown as placeholder nodes instead of silently disappearing.

6. Live updates
- js/live-updates.js polls updates.json every 5 seconds.
- The first poll is a baseline (no notification).
- Later polls compare previous IDs to current IDs and notify only when newly updated IDs match currently displayed posts.

## How to run

### Requirements

- Python 3 (for a simple static file server)
- Node.js 18+ (for tests)

### Run the web app locally

From the repository root, start a local server:

python3 -m http.server 8000

Then open:

http://localhost:8000/static/

### Run tests

From the repository root:

npm test

This runs the Node test suite with node --test.