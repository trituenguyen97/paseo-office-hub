import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Modal, Pressable, Text, View } from "react-native";
import { alertAck, alertList } from "../shared/alerts";
import { AccountTag } from "./account";
import { rgba } from "./glass";

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

const CHECK_MS = 10_000;
// A meeting that began more than this long ago is not announced as "starting now".
const GRACE_MS = 10 * 60_000;
const SNOOZE_MS = 5 * 60_000;
const COLOR = "#e08a45";

const keyOf = (e: Event) => `${e.id}|${e.start}`;
const hm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// Centered popup that announces meetings which have just started. Dismissed alerts are remembered by
// the daemon, so reloading the app does not show them again.
export function MeetingAlert({
  events,
  enabled,
  accent,
  theme,
}: {
  events: Event[];
  enabled: boolean;
  accent: string;
  theme: PluginScreenProps["theme"];
}) {
  const listAcked = useRpc(alertList);
  const ack = useRpc(alertAck);
  const [acked, setAcked] = useState<Set<string> | null>(null);
  const [snoozed, setSnoozed] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void listAcked({}).then(
      (r) => setAcked(new Set(r.keys)),
      () => setAcked(new Set()),
    );
  }, [listAcked]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), CHECK_MS);
    return () => clearInterval(t);
  }, []);

  const due = useMemo(() => {
    if (!enabled || !acked) return [];
    return events.filter((e) => {
      if (e.allDay) return false;
      const start = new Date(e.start).getTime();
      const end = new Date(e.end).getTime();
      if (start > now || end <= now || acked.has(keyOf(e))) return false;
      const until = snoozed[keyOf(e)];
      if (until !== undefined) return until <= now;
      return now - start <= GRACE_MS;
    });
  }, [events, enabled, acked, snoozed, now]);

  const dismiss = useCallback(
    (list: Event[]) => {
      const keys = list.map(keyOf);
      setAcked((prev) => new Set([...(prev ?? []), ...keys]));
      void ack({ keys }).catch(() => undefined);
    },
    [ack],
  );

  const snooze = useCallback((list: Event[]) => {
    const until = Date.now() + SNOOZE_MS;
    setSnoozed((prev) => ({ ...prev, ...Object.fromEntries(list.map((e) => [keyOf(e), until])) }));
  }, []);

  if (due.length === 0) return null;
  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 } as const;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => snooze(due)}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <View
          accessibilityRole="alert"
          style={{
            width: "100%",
            maxWidth: 460,
            backgroundColor: theme.colors.surface0,
            borderRadius: 16,
            borderTopWidth: 5,
            borderTopColor: COLOR,
            padding: 20,
            gap: 14,
          }}
        >
          <Text style={{ color: COLOR, fontSize: 13, fontWeight: "700", letterSpacing: 0.4 }}>
            🔔 ĐẾN GIỜ HỌP
          </Text>
          {due.map((e) => (
            <View
              key={keyOf(e)}
              style={{
                gap: 4,
                borderRadius: 12,
                padding: 12,
                backgroundColor: rgba(COLOR, 0.12),
                borderLeftWidth: 3,
                borderLeftColor: COLOR,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
                <Text style={{ flex: 1, color: theme.colors.foreground, fontSize: 16, fontWeight: "700" }}>{e.subject}</Text>
                <AccountTag account={e.account} />
              </View>
              <Text style={{ color: COLOR, fontSize: 13, fontWeight: "600" }}>
                🕒 {hm(e.start)} - {hm(e.end)}
              </Text>
              {e.location ? <Text style={muted}>📍 {e.location}</Text> : null}
              {e.joinUrl ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void Linking.openURL(e.joinUrl!);
                    dismiss([e]);
                  }}
                  style={{
                    alignSelf: "flex-start",
                    marginTop: 4,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    backgroundColor: accent,
                  }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>Tham gia họp</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 18, alignItems: "center" }}>
            <Pressable accessibilityRole="button" onPress={() => snooze(due)}>
              <Text style={{ color: theme.colors.foregroundMuted, fontSize: 14 }}>Nhắc lại sau 5 phút</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => dismiss(due)}
              style={{ backgroundColor: theme.colors.accent, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 }}
            >
              <Text style={{ color: theme.colors.accentForeground, fontSize: 14, fontWeight: "600" }}>Đã biết</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
