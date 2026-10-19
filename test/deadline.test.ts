import assert from "node:assert/strict";
import { test } from "node:test";
import { dueMs, urgency } from "../client/deadline.ts";

// Dates below are local times, the same way the app reads a deadline.
const now = new Date(2026, 9, 19, 12, 0).getTime();

test("a finished note is green whatever its deadline", () => {
  const u = urgency({ deadline: "2020-01-01", done: true }, now);
  assert.equal(u.label, "Đã xong");
  assert.equal(u.tinted, true);
});

test("a note without a deadline stays neutral", () => {
  const u = urgency({ deadline: null, done: false }, now);
  assert.equal(u.label, "Không có hạn");
  assert.equal(u.tinted, false);
});

test("a past deadline is overdue", () => {
  assert.equal(urgency({ deadline: "2026-10-19 11:00", done: false }, now).label, "Quá hạn");
  assert.equal(urgency({ deadline: "2026-10-18", done: false }, now).label, "Quá hạn");
});

test("a date-only deadline is due at the end of that day", () => {
  assert.equal(dueMs("2026-10-19"), new Date(2026, 9, 19, 23, 59).getTime());
  assert.notEqual(urgency({ deadline: "2026-10-19", done: false }, now).label, "Quá hạn");
});

test("a deadline within a day counts hours", () => {
  assert.equal(urgency({ deadline: "2026-10-19 17:00", done: false }, now).label, "Còn 5 giờ");
});

test("a deadline within three days counts days", () => {
  assert.equal(urgency({ deadline: "2026-10-21 12:00", done: false }, now).label, "Còn 2 ngày");
});

test("a far deadline uses the calm color", () => {
  const near = urgency({ deadline: "2026-10-21 12:00", done: false }, now);
  const far = urgency({ deadline: "2026-11-30", done: false }, now);
  assert.notEqual(near.color, far.color);
});
