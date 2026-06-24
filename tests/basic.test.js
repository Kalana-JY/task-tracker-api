const { test } = require('node:test');
const assert = require('node:assert');

test('sanity check: true is true', () => {
    assert.strictEqual(true, true);
});

test('environment default are sane', () => {
    const port = process.env.PORT || 3000;
    assert.ok(Number(port) > 0);
});