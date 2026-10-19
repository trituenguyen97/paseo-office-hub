import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { DEADLINE_RE } from "../shared/notes";
import { type Note, urgency } from "./deadline";

type Patch = { title?: string; deadline?: string; done?: boolean; hidden?: boolean; detail?: string };

// Centered popup to read and edit one note. Saving sends only the fields that changed.
export function NoteDialog({
  note,
  theme,
  onClose,
  onPatch,
}: {
  note: Note;
  theme: PluginScreenProps["theme"];
  onClose: () => void;
  onPatch: (id: string, patch: Patch) => Promise<void>;
}) {
  const [title, setTitle] = useState(note.customTitle ? note.title : "");
  const [deadline, setDeadline] = useState(note.deadline ?? "");
  const [done, setDone] = useState(note.done);
  const [detail, setDetail] = useState(note.detail);
  const [bad, setBad] = useState(false);
  const u = urgency({ deadline: deadline.trim() || null, done });

  const save = async () => {
    const dl = deadline.trim();
    if (dl && !DEADLINE_RE.test(dl)) {
      setBad(true);
      return;
    }
    const patch: Patch = {};
    if (title.trim() !== (note.customTitle ? note.title : "")) patch.title = title;
    if (dl !== (note.deadline ?? "")) patch.deadline = dl;
    if (done !== note.done) patch.done = done;
    if (detail !== note.detail) patch.detail = detail;
    if (Object.keys(patch).length > 0) await onPatch(note.id, patch);
    onClose();
  };

  const input = {
    color: theme.colors.foreground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
  } as const;
  const muted = { color: theme.colors.foregroundMuted, fontSize: 12 } as const;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Đóng"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 16 }}
      >
        {/* A press inside the card must not reach the backdrop. */}
        <Pressable
          onPress={() => {}}
          style={{
            width: "100%",
            maxWidth: 560,
            maxHeight: "85%",
            backgroundColor: theme.colors.surface0,
            borderRadius: 12,
            borderLeftWidth: 4,
            borderLeftColor: u.color,
            padding: 16,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done }}
              accessibilityLabel="Hoàn thành"
              onPress={() => setDone((v) => !v)}
              hitSlop={8}
            >
              <Text style={{ color: u.tinted ? u.color : theme.colors.foreground, fontSize: 22 }}>{done ? "☑" : "☐"}</Text>
            </Pressable>
            <TextInput
              value={title}
              placeholder={note.title}
              placeholderTextColor={theme.colors.foregroundMuted}
              onChangeText={setTitle}
              style={{ ...input, flex: 1, fontWeight: "600", fontSize: 15, color: u.tinted ? u.color : theme.colors.foreground }}
            />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Text style={muted}>Hạn</Text>
            <TextInput
              value={deadline}
              placeholder="YYYY-MM-DD HH:mm"
              placeholderTextColor={theme.colors.foregroundMuted}
              onChangeText={(v) => {
                setDeadline(v);
                setBad(false);
              }}
              style={{ ...input, width: 170, borderColor: bad ? "#e5604d" : theme.colors.border }}
            />
            <Text style={{ color: u.color, fontSize: 13, fontWeight: "600" }}>
              {u.icon} {bad ? "Sai định dạng" : u.label}
            </Text>
          </View>
          <TextInput
            value={detail}
            onChangeText={setDetail}
            multiline
            placeholder="Nội dung chi tiết"
            placeholderTextColor={theme.colors.foregroundMuted}
            style={{
              ...input,
              flexShrink: 1,
              minHeight: 140,
              maxHeight: 420,
              fontSize: 13,
              lineHeight: 19,
              textAlignVertical: "top",
            }}
          />
          <Text style={muted}>
            {note.name} · sửa lúc {new Date(note.modifiedAt).toLocaleString()}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void onPatch(note.id, { hidden: true }).then(onClose);
              }}
            >
              <Text style={{ color: "#e5604d", fontSize: 13 }}>✕ Xóa</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable accessibilityRole="button" onPress={onClose}>
              <Text style={{ color: theme.colors.foregroundMuted, fontSize: 14 }}>Đóng</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void save()}
              style={{ backgroundColor: theme.colors.accent, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 }}
            >
              <Text style={{ color: theme.colors.accentForeground, fontSize: 14, fontWeight: "600" }}>Lưu</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
