import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const calEvent = z.object({
  id: z.string(),
  // Mailbox the item came from, for example user@acme.com. Absent for data cached before accounts were tracked.
  account: z.string().optional(),
  subject: z.string(),
  start: z.string(),
  end: z.string(),
  allDay: z.boolean(),
  location: z.string(),
  joinUrl: z.string().nullable(),
});

export const mailItem = z.object({
  id: z.string(),
  account: z.string().optional(),
  subject: z.string(),
  sender: z.string(),
  // ISO 8601 UTC.
  receivedAt: z.string(),
  preview: z.string(),
  hasAttachments: z.boolean(),
  webLink: z.string().nullable(),
});

// Shared by the calendar and mail panels. Data comes from a background agent that reads Outlook,
// so the reply says whether a fetch is running and the last error, if any.
const syncState = {
  // null until the first successful sync.
  updatedAt: z.string().nullable(),
  syncing: z.boolean(),
  error: z.string().nullable(),
};

const syncInput = z.object({
  // Forces a new Outlook fetch even when the cached data is recent.
  refresh: z.boolean().optional(),
});

export const calToday = defineRpc({
  name: "cal.today",
  input: syncInput,
  output: z.object({ ...syncState, events: z.array(calEvent) }),
});

export const mailToday = defineRpc({
  name: "mail.today",
  input: syncInput,
  output: z.object({ ...syncState, mail: z.array(mailItem) }),
});

// Opens a section of the desktop Outlook on the daemon machine. "none" means Outlook was not
// found, and the caller falls back to Outlook on the web.
export const outlookOpen = defineRpc({
  name: "outlook.open",
  input: z.object({ section: z.enum(["Calendar", "Mail"]) }),
  output: z.object({ opened: z.enum(["desktop", "none"]) }),
});
