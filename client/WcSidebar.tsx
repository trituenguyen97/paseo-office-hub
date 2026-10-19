import type { PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { WC_LABELS, wcStatus } from "../shared/wc";
import { GlassCard, rgba } from "./glass";
import { useOfficeSettings, useSectionStyle } from "./settings";

type Data = { stale: boolean; offHours: boolean; rooms: { key: string; status: "free" | "busy" | "unknown" }[] };

const COLOR = { free: "#3fb68b", busy: "#e5604d", unknown: "#8a8f98" } as const;
const WORD = { free: "trống", busy: "bận", unknown: "—" } as const;
const ICON = { free: "🟢", busy: "🔴", unknown: "⚪" } as const;
const POLL_MS = 60_000;

export function WcSidebar({ theme }: PluginSidebarItemProps) {
  const fetchStatus = useRpc(wcStatus);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchStatus({}));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const style = useSectionStyle("wc");
  const wcFilter = useOfficeSettings()?.wcFilter ?? "men";
  const rooms =
    data?.rooms.filter((r) => wcFilter === "all" || r.key.startsWith(wcFilter === "men" ? "men-" : "women-")) ?? [];
  const free = rooms.filter((r) => r.status === "free").length;
  const summary = data ? `${free}/${rooms.length}` : failed ? "!" : "…";
  const summaryColor = !data ? theme.colors.foregroundMuted : free > 0 ? COLOR.free : COLOR.busy;
  const muted = { color: theme.colors.foregroundMuted, fontSize: 11 } as const;

  return (
    <GlassCard
      tone={style.tone}
      theme={theme}
      icon="🚻"
      label={style.title}
      expanded={open}
      onToggle={() => setOpen((v) => !v)}
      trailing={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 6 }}>
          <Text style={{ color: summaryColor, fontSize: 12, fontWeight: "700" }}>{summary}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Làm mới trạng thái nhà vệ sinh"
            disabled={loading}
            onPress={() => void load()}
            hitSlop={8}
            style={{ opacity: loading ? 0.4 : 1, padding: 2 }}
          >
            <Text style={{ color: theme.colors.foregroundMuted, fontSize: 16, lineHeight: 18 }}>↻</Text>
          </Pressable>
        </View>
      }
    >
      <View style={{ gap: 6 }}>
        {rooms.map((r) => (
          <View
            key={r.key}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderRadius: 10,
              paddingHorizontal: 8,
              paddingVertical: 6,
              backgroundColor: rgba(COLOR[r.status], 0.1),
              borderLeftWidth: 3,
              borderLeftColor: COLOR[r.status],
            }}
          >
            <Text style={{ fontSize: 10 }}>{ICON[r.status]}</Text>
            <Text style={{ flex: 1, color: theme.colors.foreground, fontSize: 13 }}>
              {WC_LABELS[r.key] ?? r.key}
            </Text>
            <Text style={{ color: COLOR[r.status], fontSize: 12, fontWeight: "700" }}>{WORD[r.status]}</Text>
          </View>
        ))}
        {data?.stale || failed ? (
          <Text style={muted}>{failed ? "Không tải được, hiển thị dữ liệu cũ" : "Dữ liệu có thể đã cũ"}</Text>
        ) : null}
        {data?.offHours ? <Text style={muted}>Ngoài giờ làm việc</Text> : null}
      </View>
    </GlassCard>
  );
}
