import assert from "node:assert/strict";
import test from "node:test";

import { commentBuild } from "../js/comments.js";

test("commentBuild orders top-level comments newest to oldest", async () => {
    const items = new Map([
        [11, { id: 11, type: "comment", parent: 1, by: "a", time: 100, text: "old" }],
        [12, { id: 12, type: "comment", parent: 1, by: "b", time: 300, text: "new" }],
        [13, { id: 13, type: "comment", parent: 1, by: "c", time: 200, text: "mid" }],
    ]);

    const api = {
        fetchItem: async (id) => items.get(id) ?? null,
    };

    const result = await commentBuild(api, { id: 1, kids: [11, 12, 13] });

    assert.deepEqual(result.comments.map((comment) => comment.id), [12, 13, 11]);
});

test("commentBuild orders nested replies newest to oldest", async () => {
    const items = new Map([
        [21, { id: 21, type: "comment", parent: 2, by: "root", time: 100, text: "root", kids: [31, 32, 33] }],
        [31, { id: 31, type: "comment", parent: 21, by: "r1", time: 10, text: "old" }],
        [32, { id: 32, type: "comment", parent: 21, by: "r2", time: 30, text: "new" }],
        [33, { id: 33, type: "comment", parent: 21, by: "r3", time: 20, text: "mid" }],
    ]);

    const api = {
        fetchItem: async (id) => items.get(id) ?? null,
    };

    const result = await commentBuild(api, { id: 2, kids: [21] });

    assert.deepEqual(result.comments[0].replies.map((reply) => reply.id), [32, 33, 31]);
});
