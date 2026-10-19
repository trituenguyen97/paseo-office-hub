import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

// Meeting alerts already shown and dismissed, so a reload does not pop the same one up again.
// A key is "<event id>|<start time>", which tells apart the occurrences of a recurring meeting.
export const alertList = defineRpc({
  name: "alert.list",
  input: z.object({}),
  output: z.object({ keys: z.array(z.string()) }),
});

export const alertAck = defineRpc({
  name: "alert.ack",
  input: z.object({ keys: z.array(z.string()) }),
  output: z.object({}),
});
