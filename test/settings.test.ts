import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_COLORS, DEFAULT_TITLES, withDefaults } from "../shared/settings.ts";

test("an empty document gives the defaults, with the toilet status hidden", () => {
  const s = withDefaults(null);
  assert.equal(s.show.wc, false);
  assert.equal(s.show.calendar, true);
  assert.equal(s.show.mail, true);
  assert.equal(s.show.notes, true);
  assert.equal(s.wcFilter, "men");
  assert.equal(s.outlookSource, "auto");
  assert.equal(s.meetingAlert, true);
  assert.deepEqual(s.titles, DEFAULT_TITLES);
  assert.deepEqual(s.colors, DEFAULT_COLORS);
});

test("saved switches override the defaults one by one", () => {
  const s = withDefaults({ show: { wc: true, mail: false } });
  assert.equal(s.show.wc, true);
  assert.equal(s.show.mail, false);
  assert.equal(s.show.calendar, true);
});

test("a custom title replaces the default and a blank one does not", () => {
  const s = withDefaults({ titles: { mail: "  Thư  ", calendar: "   " } });
  assert.equal(s.titles.mail, "Thư");
  assert.equal(s.titles.calendar, DEFAULT_TITLES.calendar);
});

test("a valid hex color is used and a malformed one falls back", () => {
  const s = withDefaults({ colors: { wc: "#112233", notes: "red", mail: "#12345" } });
  assert.equal(s.colors.wc, "#112233");
  assert.equal(s.colors.notes, DEFAULT_COLORS.notes);
  assert.equal(s.colors.mail, DEFAULT_COLORS.mail);
});

test("unknown sections in the document are ignored", () => {
  const s = withDefaults({ titles: { unknown: "x" } });
  assert.deepEqual(s.titles, DEFAULT_TITLES);
});
