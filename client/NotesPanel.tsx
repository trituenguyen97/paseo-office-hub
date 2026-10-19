import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { DEADLINE_RE, notesList, notesUpdate } from "../shared/notes";
import { type Note, urgency } from "./deadline";

type Patch = { title?: string; deadline?: string; done?: boolean; hidden?: boolean; detail?: string };

const POLL_MS = 60_000;

function NoteCard({
  note,
  theme,
  onPatch,
}: {
  note: Note;
  theme: PluginScreenProps["theme"];
  onPatch: (id: string, patch: Patch) => Promise<void>;
}) {
  const [title, setTitle] = useState(note.customTitle ? note.title : "");
  const [deadline, setDeadline] = useState(note.deadline ?? "");
  const [detail, setDetail] = useState(note.detail);
  const [bad, setBad] = useState(false);
  const editing = useRef(false);

  // Take server values unless the user is typing.
  useEffect(() => {
    if (editing.current) return;
    setTitle(note.customTitle ? note.title : "");
    setDeadline(note.deadline ?? "");
    setDetail(note.detail);
  }, [note.title, note.customTitle, note.deadline, note.detail]);

  const u = urgency(note);
  const overdue = u.label === "Quá hạn";
  const input = {
    color: theme.colors.foreground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
  } as const;
  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 } as const;

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface1,
        borderRadius: 10,
        padding: 12,
        gap: 8,
        opacity: note.done ? 0.6 : 1,
        borderLeftWidth: 5,
        borderLeftColor: u.color,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: note.done }}
          accessibilityLabel={`Hoàn thành: ${note.title}`}
          onPress={() => void onPatch(note.id, { done: !note.done })}
          hitSlop={8}
        >
          <Text style={{ color: u.tinted ? u.color : theme.colors.foreground, fontSize: 20 }}>{note.done ? "☑" : "☐"}</Text>
        </Pressable>
        <TextInput
          value={title}
          placeholder={note.title}
          placeholderTextColor={theme.colors.foregroundMuted}
          onFocus={() => {
            editing.current = true;
          }}
          onChangeText={setTitle}
          onBlur={() => {
            editing.current = false;
            if (title.trim() !== (note.customTitle ? note.title : "")) void onPatch(note.id, { title });
          }}
          style={{
            ...input,
            flex: 1,
            color: u.tinted ? u.color : theme.colors.foreground,
            fontWeight: "600",
            textDecorationLine: note.done ? "line-through" : "none",
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={note.hidden ? `Khôi phục: ${note.title}` : `Xóa ghi nhớ: ${note.title}`}
          onPress={() => void onPatch(note.id, { hidden: !note.hidden })}
          hitSlop={8}
        >
          <Text style={{ color: theme.colors.foregroundMuted, fontSize: note.hidden ? 12 : 18 }}>
            {note.hidden ? "Khôi phục" : "✕"}
          </Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={muted}>Hạn</Text>
        <TextInput
          value={deadline}
          placeholder="YYYY-MM-DD HH:mm"
          placeholderTextColor={theme.colors.foregroundMuted}
          onFocus={() => {
            editing.current = true;
          }}
          onChangeText={(v) => {
            setDeadline(v);
            setBad(false);
          }}
          onBlur={() => {
            editing.current = false;
            const v = deadline.trim();
            if (v && !DEADLINE_RE.test(v)) {
              setBad(true);
              return;
            }
            if (v !== (note.deadline ?? "")) void onPatch(note.id, { deadline: v });
          }}
          style={{ ...input, width: 160, borderColor: bad ? "#e5604d" : overdue ? "#e5604d" : theme.colors.border }}
        />
        {bad ? null : (
          <Text style={{ color: u.color, fontSize: 13, fontWeight: "600" }}>
            {u.icon} {u.label}
          </Text>
        )}
        {bad ? <Text style={{ color: "#e5604d", fontSize: 12 }}>Sai định dạng</Text> : null}
      </View>
      <TextInput
        value={detail}
        multiline
        placeholder="Nội dung chi tiết"
        placeholderTextColor={theme.colors.foregroundMuted}
        onFocus={() => {
          editing.current = true;
        }}
        onChangeText={setDetail}
        onBlur={() => {
          editing.current = false;
          if (detail !== note.detail) void onPatch(note.id, { detail });
        }}
        style={{ ...input, minHeight: 80, fontSize: 13, lineHeight: 19, textAlignVertical: "top" }}
      />
      <Text style={muted}>
        {note.name} · sửa lúc {new Date(note.modifiedAt).toLocaleString()}
      </Text>
    </View>
  );
}

export function NotesPanel({ theme, layout }: Pick<PluginScreenProps, "theme" | "layout">) {
  const fetchList = useRpc(notesList);
  const update = useRpc(notesUpdate);
  const [notes, setNotes] = useState<Note[]>([]);
  const [available, setAvailable] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetchList({});
      setNotes(r.notes);
      setAvailable(r.available);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    }
  }, [fetchList]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const patch = useCallback(
    async (id: string, p: Patch) => {
      try {
        await update({ id, ...p });
        await load();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Lỗi");
      }
    },
    [update, load],
  );

  const visible = useMemo(
    () => notes.filter((n) => (showHidden ? n.hidden : !n.hidden && (showDone || !n.done))),
    [notes, showDone, showHidden],
  );
  const doneCount = notes.filter((n) => n.done && !n.hidden).length;
  const hiddenCount = notes.filter((n) => n.hidden).length;
  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 } as const;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: layout.compact ? 12 : 16,
        }}
      >
        <Text style={{ color: theme.colors.foreground, fontSize: 16, fontWeight: "600", flex: 1 }}>
          Ghi nhớ Notepad++
        </Text>
        {showHidden ? null : (
          <Pressable accessibilityRole="button" onPress={() => setShowDone((v) => !v)}>
            <Text style={muted}>{showDone ? "Ẩn đã xong" : `Hiện đã xong (${doneCount})`}</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={() => setShowHidden((v) => !v)}>
          <Text style={muted}>{showHidden ? "Quay lại" : `Đã xóa (${hiddenCount})`}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Làm mới" onPress={() => void load()} hitSlop={8}>
          <Text style={{ color: theme.colors.foregroundMuted, fontSize: 18 }}>↻</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: layout.compact ? 12 : 16, paddingTop: 0, gap: 10 }}>
        {!available ? <Text style={muted}>Không tìm thấy session của Notepad++ trên máy này.</Text> : null}
        {available && visible.length === 0 ? <Text style={muted}>Không có ghi nhớ nào.</Text> : null}
        {visible.map((n) => (
          <NoteCard key={n.id} note={n} theme={theme} onPatch={patch} />
        ))}
        {err ? <Text style={muted}>{err}</Text> : null}
      </ScrollView>
    </View>
  );
}
