import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { alertAck, alertList } from "../shared/alerts";
import { stripBom } from "./agent";

const FILE = join(homedir(), ".paseo", "wc-status-alerted.json");
const KEEP_MS = 2 * 24 * 3_600_000;

type Acked = Record<string, string>;

async function read(): Promise<Acked> {
  try {
    return JSON.parse(stripBom(await readFile(FILE, "utf8"))) as Acked;
  } catch {
    return {};
  }
}

export async function list(): Promise<RpcOutput<typeof alertList>> {
  return { keys: Object.keys(await read()) };
}

let writing: Promise<unknown> = Promise.resolve();

export function ack(input: RpcInput<typeof alertAck>): Promise<RpcOutput<typeof alertAck>> {
  const run = writing.then(async () => {
    const acked = await read();
    const now = new Date().toISOString();
    for (const key of input.keys) acked[key] = now;
    // Old entries can never match a meeting again, so drop them.
    for (const [key, at] of Object.entries(acked)) {
      if (Date.now() - Date.parse(at) > KEEP_MS) delete acked[key];
    }
    await mkdir(dirname(FILE), { recursive: true });
    await writeFile(FILE, JSON.stringify(acked, null, 2));
    return {};
  });
  writing = run.catch(() => undefined);
  return run;
}
