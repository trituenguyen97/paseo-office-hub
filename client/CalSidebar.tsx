import type { PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { calToday } from "../shared/cal";
import { AccountTag } from "./account";
import { MeetingAlert } from "./MeetingAlert";
import { GlassCard, rgba } from "./glass";
import { useMeetingAlertToggle, useSectionStyle } from "./settings";
import { OutlookOpenButton } from "./outlook";
import { RowList } from "./RowList";

type Event = {
  id: string;
  account?: string;
  subject: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string;
  joinUrl: string | null;
};
type Data = { updatedAt: string | null; syncing: boolean; error: string | null; events: Event[] };

const POLL_MS = 60_000;
const VISIBLE_ROWS = 4;
const ROW_HEIGHT = 68;
const ROW_GAP = 6;
const SOON_MS = 30 * 60_000;
const hm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// Past meetings fade, the running one is green, one starting within 30 minutes is orange.
function phase(e: Event, now: number) {
  if (e.allDay) return { color: "#8b7bd8", icon: "📌", label: "Cả ngày", fade: false };
  const start = new Date(e.start).getTime();
  const end = new Date(e.end).getTime();
  if (end <= now) return { color: "#8a8f98", icon: "✔️", label: "Đã qua", fade: true };
  if (start <= now) return { color: "#3fb68b", icon: "🔴", label: "Đang diễn ra", fade: false };
  if (start - now <= SOON_MS) {
    return { color: "#e08a45", icon: "🔔", label: `Còn ${Math.max(1, Math.round((start - now) / 60_000))} phút`, fade: false };
  }
  return { color: "#5b8def", icon: "🗓", label: "Sắp tới", fade: false };
}

export function CalSidebar({ theme }: PluginSidebarItemProps) {
  const fetchToday = useRpc(calToday);
  const alerts = useMeetingAlertToggle();
  const style = useSectionStyle("calendar");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // `refresh` asks the daemon to fetch Outlook again; the timer only re-reads the cached data.
  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      try {
        setData(await fetchToday({ refresh }));
        setErr(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Lỗi");
      } finally {
        setLoading(false);
      }
    },
    [fetchToday],
  );

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 } as const;
  const summary = data?.updatedAt ? String(data.events.length) : data ? "–" : "…";
  const busy = loading || data?.syncing === true;
  const now = Date.now();

  return (
    <>
    <GlassCard
      tone={style.tone}
      theme={theme}
      icon="📅"
      label={style.title}
      expanded={open}
      onToggle={() => setOpen((v) => !v)}
      trailing={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 6 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={alerts.enabled ? "Tắt thông báo giờ họp" : "Bật thông báo giờ họp"}
            accessibilityState={{ checked: alerts.enabled }}
            disabled={!alerts.ready}
            onPress={alerts.toggle}
            hitSlop={8}
            style={{ opacity: alerts.ready ? (alerts.enabled ? 1 : 0.55) : 0.3, padding: 2 }}
          >
            <Text style={{ fontSize: 14, lineHeight: 18 }}>{alerts.enabled ? "🔔" : "🔕"}</Text>
          </Pressable>
          <Text style={{ color: theme.colors.foreground, fontSize: 12, fontWeight: "700" }}>{summary}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Làm mới lịch họp"
            disabled={busy}
            onPress={() => void load(true)}
            hitSlop={8}
            style={{ opacity: busy ? 0.4 : 1, padding: 2 }}
          >
            <Text style={{ color: theme.colors.foregroundMuted, fontSize: 16, lineHeight: 18 }}>↻</Text>
          </Pressable>
        </View>
      }
    >
      <View style={{ gap: 8 }}>
        {data && !data.updatedAt && !data.syncing ? <Text style={muted}>Chưa có dữ liệu hôm nay.</Text> : null}
        {data?.updatedAt && data.events.length === 0 ? <Text style={muted}>Hôm nay không có cuộc họp</Text> : null}
        {data && data.events.length > 0 ? (
          <RowList count={data.events.length} rowHeight={ROW_HEIGHT} gap={ROW_GAP} visibleRows={VISIBLE_ROWS}>
            {data.events.map((e) => {
              const p = phase(e, now);
              return (
                <View
                  key={`${e.id}|${e.start}`}
                  style={{
                    height: ROW_HEIGHT,
                    gap: 2,
                    borderRadius: 10,
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                    backgroundColor: rgba(p.color, 0.1),
                    borderLeftWidth: 3,
                    borderLeftColor: p.color,
                    opacity: p.fade ? 0.55 : 1,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ flex: 1, color: theme.colors.foreground, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
                      {e.subject}
                    </Text>
                    <AccountTag account={e.account} />
                  </View>
                  <Text style={{ color: p.color, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
                    {p.icon} {e.allDay ? "Cả ngày" : `${hm(e.start)} - ${hm(e.end)}`} · {p.label}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ ...muted, flex: 1 }} numberOfLines={1}>
                      {e.location ? `📍 ${e.location}` : " "}
                    </Text>
                    {e.joinUrl && !p.fade ? (
                      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(e.joinUrl!)}>
                        <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: "600" }}>Tham gia</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </RowList>
        ) : null}
        <OutlookOpenButton section="Calendar" label="🗓 Mở Outlook Calendar" tone={style.tone} theme={theme} onError={setErr} />
        {data?.syncing ? <Text style={{ ...muted, color: style.tone.from }}>⏳ Đang đồng bộ từ Outlook…</Text> : null}
        {data?.error ? <Text style={{ ...muted, color: "#e5604d" }}>⚠ {data.error}</Text> : null}
        {data?.updatedAt ? <Text style={muted}>Cập nhật lúc {hm(data.updatedAt)}</Text> : null}
        {err ? <Text style={muted}>{err}</Text> : null}
      </View>
    </GlassCard>
    <MeetingAlert events={data?.events ?? []} accent={style.tone.from} enabled={alerts.enabled && alerts.ready} theme={theme} />
    </>
  );
}
