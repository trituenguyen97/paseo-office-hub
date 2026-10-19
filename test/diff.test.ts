import assert from "node:assert/strict";
import { test } from "node:test";
import { addedLines } from "../server/diff.ts";

test("returns nothing when the text is unchanged", () => {
  assert.equal(addedLines("a\nb", "a\nb"), "");
});

test("returns the lines that were appended", () => {
  assert.equal(addedLines("a\nb", "a\nb\nc\nd"), "c\nd");
});

test("returns lines inserted in the middle", () => {
  assert.equal(addedLines("a\nc", "a\nb\nc"), "b");
});

test("ignores removed lines", () => {
  assert.equal(addedLines("a\nb\nc", "a\nc"), "");
});

test("counts a repeated line only when it appears more often than before", () => {
  assert.equal(addedLines("x\nx", "x\nx\nx"), "x");
  assert.equal(addedLines("x\nx", "x\nx"), "");
});

test("treats Windows and Unix line endings the same", () => {
  assert.equal(addedLines("a\r\nb", "a\nb\nc"), "c");
});

test("ignores trailing spaces when comparing lines", () => {
  assert.equal(addedLines("a  \nb", "a\nb"), "");
});

test("reports an edited line as a new line", () => {
  assert.equal(addedLines("buy milk", "buy oat milk"), "buy oat milk");
});
