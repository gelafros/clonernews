# clonernews

clonernews is a browser UI for the Hacker News API. It loads stories, jobs, and polls, lets users select a post, renders comments, and shows live update notifications.

## How the program works

The app is split into small JavaScript modules, each with one clear responsibility.

1. API access and caching
- js/api.js wraps Hacker News endpoints.
- requestJson performs fetch calls and checks HTTP status.
- createHackerNewsApi exposes methods such as fetchItem, fetchNewStoryIds, fetchJobStoryIds, fetchUpdatedItemIds, and fetchMaxItemId.
- fetchItem uses an in-memory cache and shares in-flight requests to avoid duplicate network calls.

2. App entrypoint and wiring
- js/app.js is now a thin startup file.
- It creates shared state, wires controllers, loads initial story/job IDs, registers UI events, and starts live updates.

3. Feed controller
- js/feed-controller.js handles feed mode switching (All, Stories, Jobs, Polls, Top Stories, Best Stories, Ask HN, Show HN), post-list reset, poll discovery integration, and load-more behavior.
- It debounces rapid feed-selector changes to reduce burst requests.
- It also ignores stale async feed responses so old requests do not overwrite newer UI state.

4. Post selection controller
- js/post-selection-controller.js handles selected-post rendering and comment loading.
- It ignores stale async comment responses when users click posts quickly.

5. Feed preparation and pagination
- js/posts.js merges feed IDs, deduplicates them, sorts newest first (highest ID first), and returns fixed-size batches.
- The app never loads all posts at once. The Load more button asks for the next batch only when needed.

6. Poll discovery
- js/poll-discovery.js scans recent item IDs backward from maxitem to discover poll posts.
- The scan is bounded by a timeout so the UI does not hang indefinitely.

7. Post and comment rendering
- js/renderers.js handles rendering of the post list, selected post details, and nested comment tree.
- js/comments.js builds a nested tree recursively from kids.
- Comments are displayed newest-to-oldest at root and nested levels.
- Built trees are cached per post so reopening the same post avoids redundant requests.
- Deleted or unavailable comments are shown as placeholder nodes instead of silently disappearing.

8. UI shell
- js/ui-shell.js creates the full page structure at startup (header, status, feed selector, post list, selected post area, comments area).
- Feed selector options are All, Stories, Jobs, Polls, Top Stories, Best Stories, Ask HN, and Show HN.

9. Live updates
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

## Audit-relevant behavior

- **Post Categories**: UI includes Stories, Jobs, and Polls (required) as well as Top Stories, Best Stories, Ask HN, and Show HN (bonus feeds).
- **Post Ordering**: All feed lists are strictly ordered by their numerical timestamp (`time`), newest-to-oldest.
- **Recursive Comments**: Direct comments and nested replies are rendered in hierarchical order, validated against expected parent IDs, and sorted newest-to-oldest.
- **Live Updates**: Background updates check the HN live-updates endpoint every 5 seconds using a single timer. Pauses requests automatically when the browser tab is hidden (`document.hidden`).
- **Throttling & Efficiency**: Throttles request rates using in-memory request-deduplication, debounced selector handlers, stale-response controller guards, and parallel batching (size of 5) during poll scans.
- **Safety**: Raw API HTML is parsed inside a sandboxed `DOMParser` document rather than executing via dangerous `innerHTML` injections.
## License

MIT, see [LICENSE](LICENSE).
