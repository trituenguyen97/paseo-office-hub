import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const wcStatus = defineRpc({
  name: "wc.status",
  input: z.object({}),
  output: z.object({
    stale: z.boolean(),
    offHours: z.boolean(),
    rooms: z.array(
      z.object({
        key: z.string(),
        status: z.enum(["free", "busy", "unknown"]),
      }),
    ),
  }),
});

export const WC_LABELS: Record<string, string> = {
  "men-wc-1": "Men WC 1",
  "men-wc-2": "Men WC 2",
  "women-wc-1": "Women WC 1",
  "women-wc-2": "Women WC 2",
};
