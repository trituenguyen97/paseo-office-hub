import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const noteItem = z.object({
  id: z.string(),
  // Notepad++ tab name, for example "new 5".
  name: z.string(),
  // Title shown on the card: the custom title, else the first line of the content.
  title: z.string(),
  customTitle: z.boolean(),
  detail: z.string(),
  // Local "YYYY-MM-DD" or "YYYY-MM-DD HH:mm", or null.
  deadline: z.string().nullable(),
  done: z.boolean(),
  hidden: z.boolean(),
  modifiedAt: z.string(),
});

export const notesList = defineRpc({
  name: "notes.list",
  input: z.object({}),
  output: z.object({ available: z.boolean(), notes: z.array(noteItem) }),
});

export const notesUpdate = defineRpc({
  name: "notes.update",
  input: z.object({
    id: z.string(),
    // Empty string resets to the automatic title.
    title: z.string().optional(),
    // Empty string clears the deadline.
    deadline: z.string().optional(),
    done: z.boolean().optional(),
    // Replaces the note's editable detail. The Notepad++ text is not touched.
    detail: z.string().optional(),
    // Hides the note in Paseo only; the Notepad++ tab is untouched.
    hidden: z.boolean().optional(),
  }),
  output: z.object({}),
});

export const DEADLINE_RE = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/;
