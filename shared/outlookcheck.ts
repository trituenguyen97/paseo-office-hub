import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

const method = z.enum(["com", "connector"]);

// Tests one way of reading Outlook and says what is missing, so the settings screen can offer the
// matching fix.
export const outlookCheck = defineRpc({
  name: "outlook.check",
  input: z.object({ method }),
  output: z.object({
    ok: z.boolean(),
    summary: z.string(),
    lines: z.array(z.string()),
    // "install": no Outlook found. "profile": Outlook has no account yet. "connector": the Microsoft 365
    // connector is missing or not authorized. "error": anything else.
    needs: z.enum(["none", "install", "profile", "connector", "error"]),
  }),
});

// Starts the sign-in for a method: opens the classic Outlook to add an account, or points to the
// page that connects the Microsoft 365 connector.
export const outlookConnect = defineRpc({
  name: "outlook.connect",
  input: z.object({ method }),
  output: z.object({
    action: z.enum(["opened-outlook", "open-url", "none"]),
    url: z.string().nullable(),
    message: z.string(),
  }),
});
