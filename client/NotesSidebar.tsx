import type { PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { notesList, notesUpdate } from "../shared/notes";
import { NoteDialog } from "./NoteDialog";
import { RowList } from "./RowList";
import { useSectionStyle } from "./settings";
import { type Note, urgency } from "./deadline";
import { GlassCard, rgba } from "./glass";

const POLL_MS = 60_000;
const VISIBLE_ROWS = 4;
const ROW_HEIGHT = 40;
const ROW_GAP = 6;

export function NotesSidebar({ theme, openScreen }: PluginSidebarItemProps) {
  const fetchList = useRpc(notesList);
  const style = useSectionStyle("notes");
  const update = useRpc(notesUpdate);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setNotes((await fetchList({})).notes);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setLoading(false);
    }
  }, [fetchList]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const patch = useCallback(
    async (id: string, p: { title?: string; deadline?: string; done?: boolean; hidden?: boolean; detail?: string }) => {
      try {
        await update({ id, ...p });
        await load();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Lỗi");
      }
    },
    [update, load],
  );

  const pending = notes?.filter((n) => !n.done && !n.hidden) ?? [];
  const selected = notes?.find((n) => n.id === selectedId) ?? null;
  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 } as const;

  return (
    <>
      <GlassCard
        tone={style.tone}
        theme={theme}
        icon="📝"
        label={style.title}
        expanded={open}
        onToggle={() => setOpen((v) => !v)}
        trailing={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 6 }}>
            <Text style={{ color: theme.colors.foreground, fontSize: 12, fontWeight: "700" }}>
              {notes ? pending.length : "…"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Làm mới ghi nhớ"
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
        <View style={{ gap: 8 }}>
          {notes && pending.length === 0 ? <Text style={muted}>Không có việc chưa xong</Text> : null}
          {pending.length > 0 ? (
            <RowList count={pending.length} rowHeight={ROW_HEIGHT} gap={ROW_GAP} visibleRows={VISIBLE_ROWS}>
              {pending.map((n) => {
                const u = urgency(n);
                return (
                  <View
                    key={n.id}
                    style={{
                      height: ROW_HEIGHT,
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 8,
                      borderLeftWidth: 3,
                      borderLeftColor: u.color,
                      borderRadius: 8,
                      paddingLeft: 6,
                      paddingRight: 4,
                      paddingTop: 3,
                      backgroundColor: rgba(u.color, u.tinted ? 0.1 : 0.05),
                    }}
                  >
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: n.done }}
                      accessibilityLabel={`Hoàn thành: ${n.title}`}
                      onPress={() => void patch(n.id, { done: !n.done })}
                      hitSlop={8}
                    >
                      <Text style={{ color: u.tinted ? u.color : theme.colors.foreground, fontSize: 16, lineHeight: 18 }}>☐</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Xem chi tiết: ${n.title}`}
                      onPress={() => setSelectedId(n.id)}
                      style={{ flex: 1, gap: 1 }}
                    >
                      <Text
                        style={{ color: u.tinted ? u.color : theme.colors.foreground, fontSize: 13, fontWeight: "600" }}
                        numberOfLines={1}
                      >
                        {u.icon} {n.title}
                      </Text>
                      <Text style={{ color: u.color, fontSize: 12 }} numberOfLines={1}>
                        {n.deadline ? `${n.deadline} · ${u.label}` : u.label}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Xóa ghi nhớ: ${n.title}`}
                      onPress={() => void patch(n.id, { hidden: true })}
                      hitSlop={8}
                    >
                      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 14, lineHeight: 18 }}>✕</Text>
                    </Pressable>
                  </View>
                );
              })}
            </RowList>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => openScreen({ screenId: "notes" })}>
            <Text style={{ color: theme.colors.accent, fontSize: 12 }}>Xem và sửa tất cả</Text>
          </Pressable>
          {err ? <Text style={muted}>{err}</Text> : null}
        </View>
      </GlassCard>
      {selected ? (
        <NoteDialog key={selected.id} note={selected} theme={theme} onClose={() => setSelectedId(null)} onPatch={patch} />
      ) : null}
    </>
  );
}
