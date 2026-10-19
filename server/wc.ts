import type { RpcOutput } from "@getpaseo/plugin";
import type { wcStatus } from "../shared/wc";

const URL = "https://keystone-quest.pages.dev/api/wc-status";

export async function fetchWcStatus(): Promise<RpcOutput<typeof wcStatus>> {
  const res = await fetch(URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`wc-status HTTP ${res.status}`);
  const json = (await res.json()) as {
    stale?: boolean;
    offHours?: boolean;
    wc?: { key: string; status: string }[];
  };
  return {
    stale: json.stale === true,
    offHours: json.offHours === true,
    rooms: (json.wc ?? []).map((r) => ({
      key: r.key,
      status: r.status === "free" || r.status === "busy" ? r.status : "unknown",
    })),
  };
}
