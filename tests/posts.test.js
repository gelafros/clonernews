import assert from "node:assert/strict";
import test from "node:test";

import { getNextBatch, initItems } from "../js/posts.js";

test("initItems deduplicates merged story and job IDs", () => {
    initItems({}, [10, 30, 20], [20, 5, 30]);

    const batch = getNextBatch();

    assert.deepEqual(batch, [30, 20, 10, 5]);
});

test("getNextBatch does not repeat IDs between batches", () => {
    initItems({}, Array.from({ length: 20 }, (_, index) => index + 1), []);

    const firstBatch = getNextBatch();
    const secondBatch = getNextBatch();

    assert.equal(firstBatch.length, 15);
    assert.equal(secondBatch.length, 5);
    assert.equal(new Set([...firstBatch, ...secondBatch]).size, 20);
});
