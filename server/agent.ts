import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import { tmpdir } from "node:os";

export type Paseo = PluginHandlerContext["paseo"];

// The agent result may be a string or a structured message; collect its text.
export function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).join("");
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const key of ["text", "content", "message", "final"]) {
      const t = textOf(o[key]);
      if (t) return t;
    }
    return "";
  }
  return "";
}

// Runs a short-lived background agent and returns its final text. The agent is archived afterwards.
export async function askAgent(
  paseo: Paseo,
  options: { prompt: string; title: string; timeoutMs: number; tools?: boolean },
): Promise<string> {
  const agent = await paseo.agents.create({
    config: options.tools
      ? { provider: "claude/claude-haiku-5-5", modeId: "bypassPermissions" }
      : { provider: "claude/claude-haiku-5-5" },
    cwd: tmpdir(),
    prompt: options.prompt,
    background: true,
    title: options.title,
  });
  try {
    const result = await agent.waitForFinish(options.timeoutMs);
    console.log(
      `agent "${options.title}" finished: status=${String(result.status)} final=${JSON.stringify(result.final)?.slice(0, 300)} last=${JSON.stringify(result.lastMessage)?.slice(0, 200)}`,
    );
    if (result.status === "error") throw new Error(String(result.error ?? "agent failed"));
    // `final` can be the agent snapshot, so the last message is the reliable place for the reply.
    return textOf(result.lastMessage) || textOf(result.final);
  } finally {
    await agent.archive().catch(() => undefined);
  }
}

// Finds the first balanced JSON value that starts with `open` ("[" or "{") in free text.
// Agents sometimes add prose before or after the JSON, so a plain first-to-last slice can fail.
export function findJson(text: string, open: "[" | "{"): unknown | undefined {
  const close = open === "[" ? "]" : "}";
  for (let from = text.indexOf(open); from >= 0; from = text.indexOf(open, from + 1)) {
    let depth = 0;
    let inString = false;
    for (let i = from; i < text.length; i++) {
      const c = text[i];
      if (inString) {
        if (c === "\\") i++;
        else if (c === '"') inString = false;
      } else if (c === '"') {
        inString = true;
      } else if (c === open) {
        depth++;
      } else if (c === close && --depth === 0) {
        try {
          return JSON.parse(text.slice(from, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  return undefined;
}

// Windows tools such as PowerShell 5.1 write a byte order mark that JSON.parse rejects.
export const stripBom = (text: string) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
