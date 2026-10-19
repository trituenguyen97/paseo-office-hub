import assert from "node:assert/strict";
import { test } from "node:test";
import { findJson, stripBom, textOf } from "../server/agent.ts";

test("findJson reads a bare array", () => {
  assert.deepEqual(findJson('[{"a":1}]', "["), [{ a: 1 }]);
});

test("findJson skips prose before and after the JSON", () => {
  assert.deepEqual(findJson('Here you go: [1, 2] and also [3]', "["), [1, 2]);
});

test("findJson is not fooled by brackets inside strings", () => {
  assert.deepEqual(findJson('ok [{"a":"x]y"}] done', "["), [{ a: "x]y" }]);
});

test("findJson handles escaped quotes", () => {
  assert.deepEqual(findJson('{"a":"say \\"hi\\" }"}', "{"), { a: 'say "hi" }' });
});

test("findJson finds an object after an unrelated brace", () => {
  assert.deepEqual(findJson('note {not json} then {"error":"x"}', "{"), { error: "x" });
});

test("findJson returns undefined when nothing parses", () => {
  assert.equal(findJson("no json here", "["), undefined);
  assert.equal(findJson("[1, 2", "["), undefined);
});

test("stripBom removes a leading byte order mark only", () => {
  assert.equal(stripBom("﻿{}"), "{}");
  assert.equal(stripBom("{}"), "{}");
});

test("textOf reads strings, parts and nested content", () => {
  assert.equal(textOf("hi"), "hi");
  assert.equal(textOf({ content: [{ text: "a" }, { text: "b" }] }), "ab");
  assert.equal(textOf({ unrelated: 1 }), "");
  assert.equal(textOf(undefined), "");
});
