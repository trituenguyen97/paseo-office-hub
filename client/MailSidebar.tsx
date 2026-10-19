import type { PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { mailToday, outlookOpen } from "../shared/cal";
import { AccountTag } from "./account";
import { useSectionStyle } from "./settings";
import { GlassCard, rgba } from "./glass";
import { OutlookOpenButton } from "./outlook";
import { RowList } from "./RowList";

type Mail = {
  id: string;
  account?: string;
  subject: string;
  sender: string;
  receivedAt: string;
  preview: string;
  hasAttachments: boolean;
  webLink: string | null;
};
type Data = { updatedAt: string | null; syncing: boolean; error: string | null; mail: Mail[] };

const POLL_MS = 60_000;
const VISIBLE_ROWS = 4;
const ROW_HEIGHT = 58;
const ROW_GAP = 6;

const hm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function MailSidebar({ theme }: PluginSidebarItemProps) {
  const fetchMail = useRpc(mailToday);
  const openOutlook = useRpc(outlookOpen);
  const style = useSectionStyle("mail");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // `refresh` asks the daemon to fetch Outlook again; the timer only re-reads the cached data.
  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      try {
        setData(await fetchMail({ refresh }));
        setErr(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Lỗi");
      } finally {
        setLoading(false);
      }
    },
    [fetchMail],
  );

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 } as const;
  const count = data?.updatedAt ? data.mail.length : null;
  const busy = loading || data?.syncing === true;

  return (
    <GlassCard
      tone={style.tone}
      theme={theme}
      icon="✉️"
      label={style.title}
      expanded={open}
      onToggle={() => setOpen((v) => !v)}
      trailing={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 6 }}>
          <Text style={{ color: count ? style.tone.from : theme.colors.foreground, fontSize: 12, fontWeight: "700" }}>
            {count ?? (data ? "–" : "…")}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Làm mới mail"
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
        {data?.updatedAt && data.mail.length === 0 ? <Text style={muted}>Không có mail chưa đọc hôm nay 🎉</Text> : null}
        {data && data.mail.length > 0 ? (
          <RowList count={data.mail.length} rowHeight={ROW_HEIGHT} gap={ROW_GAP} visibleRows={VISIBLE_ROWS}>
            {data.mail.map((m) => (
              <Pressable
                key={m.id}
                accessibilityRole="link"
                accessibilityLabel={`Mở mail: ${m.subject}`}
                onPress={() => {
                  // Mail read from the local Outlook has no web link, so open the Mail view instead.
                  if (m.webLink) void Linking.openURL(m.webLink);
                  else void openOutlook({ section: "Mail" }).catch((e) => setErr(e instanceof Error ? e.message : "Lỗi"));
                }}
                style={{
                  height: ROW_HEIGHT,
                  gap: 1,
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  backgroundColor: rgba(style.tone.from, 0.1),
                  borderLeftWidth: 3,
                  borderLeftColor: style.tone.from,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ flex: 1, color: theme.colors.foreground, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
                    {m.sender}
                  </Text>
                  <AccountTag account={m.account} />
                  <Text style={muted}>
                    {m.hasAttachments ? "📎 " : ""}
                    {hm(m.receivedAt)}
                  </Text>
                </View>
                <Text style={{ color: theme.colors.foreground, fontSize: 13 }} numberOfLines={1}>
                  {m.subject}
                </Text>
                {m.preview ? (
                  <Text style={muted} numberOfLines={1}>
                    {m.preview}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </RowList>
        ) : null}
        <OutlookOpenButton section="Mail" label="✉️ Mở Outlook Mail" tone={style.tone} theme={theme} onError={setErr} />
        {data?.syncing ? <Text style={{ ...muted, color: style.tone.from }}>⏳ Đang đồng bộ từ Outlook…</Text> : null}
        {data?.error ? <Text style={{ ...muted, color: "#e5604d" }}>⚠ {data.error}</Text> : null}
        {data?.updatedAt ? <Text style={muted}>Cập nhật lúc {hm(data.updatedAt)}</Text> : null}
        {err ? <Text style={muted}>{err}</Text> : null}
      </View>
    </GlassCard>
  );
}
